import type { LiveListing, ScanSource } from "./types";
import { parseEbaySellerFromText, parseMercariSellerFromText } from "./seller";
import {
  BROWSER_HEADERS,
  SKIP_LISTING,
  decodeHtml,
  parseListedAt,
  parseMoney,
  parseShipping,
  titleMatchesQuery,
} from "./html";

const ID_RE: Record<ScanSource, RegExp> = {
  ebay: /ebay\.com\/itm\/(\d{12,14})/i,
  mercari: /mercari\.com\/us\/item\/(m\d+)/i,
};

function listingUrl(marketplace: ScanSource, id: string) {
  return marketplace === "ebay"
    ? `https://www.ebay.com/itm/${id}`
    : `https://www.mercari.com/us/item/${id}/`;
}

function priceFrom(block: string): number | null {
  const tagged = parseMoney(block.match(/>Price<\/strong>[\s\S]{0,160}?\$([0-9,]+\.?\d*)/)?.[1]);
  if (tagged != null) return tagged;
  const any = parseMoney(block.match(/\$([0-9]{1,3}(?:,[0-9]{3})*(?:\.\d{2})?)/)?.[1]);
  return any;
}

export function parseBraveListings(
  html: string,
  query: string,
  marketplace: ScanSource,
): LiveListing[] {
  if (!html || html.length < 4000) return [];
  const out: LiveListing[] = [];
  const seen = new Set<string>();
  const idRe = ID_RE[marketplace];
  const blocks = html.includes("search-snippet-title")
    ? html.split(/<div class="snippet[\s"]/)
    : [html];

  for (const block of blocks) {
    const found = block.match(idRe);
    if (!found) continue;
    const id = found[1]!;
    if (seen.has(id)) continue;
    seen.add(id);

    const titled =
      block.match(/class="title search-snippet-title[^"]*"[^>]*title="([^"]+)"/)?.[1] ??
      block.match(/class="title search-snippet-title[^"]*"[^>]*>([\s\S]*?)<\/div>/)?.[1] ??
      block.match(/<strong class="line-clamp-1">([^<]{8,200})<\/strong>/)?.[1] ??
      "";
    const title = decodeHtml(titled)
      .replace(/\s*[|\-–]\s*(Mercari|eBay).*$/i, "")
      .trim();
    if (!title || SKIP_LISTING.test(title) || !titleMatchesQuery(title, query)) continue;

    const price = priceFrom(block);
    if (price != null && price >= 1_000_000) continue;

    const image = block.match(/src="(https:\/\/imgs\.search\.brave\.com\/[^"]+)"/)?.[1] ?? null;
    // A search-engine snippet rarely carries a real shipping line, so read it
    // when present and fall back to the disclosed assumption otherwise.
    const ship = parseShipping(block, marketplace);

    out.push({
      id,
      marketplace,
      title,
      url: listingUrl(marketplace, id),
      price,
      shipping: ship.amount,
      shippingEstimated: ship.estimated,
      image,
      listedAt: parseListedAt(block),
      seller:
        marketplace === "ebay"
          ? parseEbaySellerFromText(block)
          : parseMercariSellerFromText(block),
    });
    if (out.length >= 12) break;
  }
  return out;
}

export async function fetchBraveHtml(query: string): Promise<string> {
  const url = `https://search.brave.com/search?q=${encodeURIComponent(query)}&source=web`;
  const res = await fetch(url, { headers: BROWSER_HEADERS });
  if (!res.ok) return "";
  return res.text();
}
