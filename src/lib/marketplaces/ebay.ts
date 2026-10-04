import { fetchBraveHtml, parseBraveListings } from "./brave";
import {
  BROWSER_HEADERS,
  SKIP_LISTING,
  decodeHtml,
  isBroadQuery,
  parseListedAt,
  parseMoney,
  parseShipping,
  titleMatchesQuery,
} from "./html";
import { fetchJina, parseJinaEbay } from "./jina";
import { defaultServerEnv } from "@/lib/server/app-settings";
import type { LiveListing } from "./types";
import { parseEbaySellerFromText } from "./seller";
import {
  filterBrowseByQuery,
  searchEbayBrowse,
  searchEbayBrowseEnabled,
} from "./ebay-browse";
import { fetchWithPool } from "@/lib/server/proxy-pool";

export const EBAY_SCAN_CAP = 50;

function pokemonQuery(query: string) {
  const q = query.trim();
  if (!q || isBroadQuery(q)) return "pokemon";
  return /pokemon|pokémon|tcg/i.test(q) ? q : `${q} pokemon`;
}

export async function searchEbay(
  query: string,
  options: { userProxyUrl?: string | null } = {},
): Promise<LiveListing[]> {
  // Per-user proxy override takes precedence over the server default.
  const env = options.userProxyUrl
    ? { ...defaultServerEnv(), PROXY_URL_LIST: options.userProxyUrl }
    : defaultServerEnv();
  // Try the official Browse API first when both keys are configured.  This
  // avoids the Vercel datacenter IP getting 403'd on the raw HTML scrape,
  // and gives paging up to ~50 listings per call across multiple pages.
  if (searchEbayBrowseEnabled()) {
    const browse = await searchEbayBrowse(query, EBAY_SCAN_CAP);
    const filtered = filterBrowseByQuery(browse, query);
    if (filtered.length >= Math.min(10, EBAY_SCAN_CAP / 2)) return filtered.slice(0, EBAY_SCAN_CAP);
    if (filtered.length) {
      // Browse returned a few good rows but the query filter is too narrow
      // for the official search syntax — fall through to Jina to widen.
    }
  }

  const nkw = pokemonQuery(query);
  const broad = isBroadQuery(query);
  const jinaUrl =
    `https://www.ebay.com/sch/183454/i.html?_nkw=${encodeURIComponent(nkw)}` +
    `&LH_BIN=1&_ipg=60&rt=nc&_udlo=3` +
    (broad ? "&_sop=10" : "");
  const jina = await fetchJina(jinaUrl);
  const fromJina = parseJinaEbay(jina, query);
  if (fromJina.length) return fromJina;

  const braveQ = nkw || "pokemon tcg";
  const brave = await fetchBraveHtml(`${braveQ} card site:ebay.com/itm`);
  const fromBrave = parseBraveListings(brave, query, "ebay");
  if (fromBrave.length) return fromBrave;

  const res = await fetchWithPool(jinaUrl, { headers: BROWSER_HEADERS }, env);
  if (res.ok) {
    const html = await res.text();
    const rows = parseEbayHtml(html, query);
    if (rows.length) return rows;
  }
  return [];
}

export function parseEbayHtml(html: string, query = ""): LiveListing[] {
  const out: LiveListing[] = [];
  const seen = new Set<string>();

  for (const match of html.matchAll(/<li class="s-card[^"]*"[^>]*data-listingid=(\d{12,14})/g)) {
    const id = match[1]!;
    if (seen.has(id)) continue;
    seen.add(id);
    const start = match.index ?? 0;
    const next = html.indexOf('<li class="s-card', start + 10);
    const chunk = html.slice(start, next > 0 ? next : start + 14000);

    const titled = chunk.match(
      /s-card__title><span class="su-styled-text primary default">([^<]{6,240})<\/span>/,
    )?.[1];
    const alt = chunk.match(/alt="([^"]{8,240})"/)?.[1];
    const title = decodeHtml(titled || alt || "");
    if (!title || /shop on ebay/i.test(title) || SKIP_LISTING.test(title)) continue;
    if (!titleMatchesQuery(title, query)) continue;

    const price = parseMoney(chunk.match(/s-card__price">\$([0-9,]+\.?\d*)/)?.[1]);
    if (price == null || price < 2.5 || price >= 1_000_000) continue;

    const img = chunk.match(/src=(https:\/\/i\.ebayimg\.com\/images\/g\/[^ "]+)/)?.[1] ?? null;
    const ship = parseShipping(chunk, "ebay");

    out.push({
      id,
      marketplace: "ebay",
      title,
      url: `https://www.ebay.com/itm/${id}`,
      price,
      shipping: ship.amount,
      shippingEstimated: ship.estimated,
      image: img,
      listedAt: parseListedAt(chunk),
      seller: parseEbaySellerFromText(chunk),
    });
    if (out.length >= EBAY_SCAN_CAP) break;
  }

  return out;
}
