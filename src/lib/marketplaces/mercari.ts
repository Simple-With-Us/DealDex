import { fetchBraveHtml, parseBraveListings } from "./brave";
import {
  ASSUMED_SHIPPING,
  BROWSER_HEADERS,
  SKIP_LISTING,
  decodeHtml,
  parseListedAt,
  parseMoney,
  titleMatchesQuery,
} from "./html";
import { fetchJina, parseJinaMercari } from "./jina";
import type { LiveListing } from "./types";
import { parseMercariSellerFromText } from "./seller";

export const MERCARI_SCAN_CAP = 50;

function searchPhrase(query: string) {
  const q = query.trim();
  if (!q || /^(pokemon|pokémon)(\s+tcg)?$/i.test(q)) return "pokemon card";
  return /pokemon|pokémon/i.test(q) ? `${q} card` : `${q} pokemon card`;
}

export async function searchMercari(query: string): Promise<LiveListing[]> {
  const phrase = searchPhrase(query);
  const jina = await fetchJina(
    `https://www.mercari.com/search/?keyword=${encodeURIComponent(phrase)}`,
  );
  const fromJina = parseJinaMercari(jina, query);
  if (fromJina.length) return fromJina;

  const brave = await fetchBraveHtml(`${phrase} site:mercari.com/us/item`);
  const fromBrave = parseBraveListings(brave, query, "mercari");
  if (fromBrave.length) return fromBrave;

  const res = await fetch(
    `https://html.duckduckgo.com/html/?q=${encodeURIComponent(`${phrase} site:mercari.com/us/item`)}`,
    { headers: BROWSER_HEADERS },
  );
  if (!res.ok) return [];
  return parseDdgMercari(await res.text(), query);
}

export function parseDdgMercari(html: string, query = ""): LiveListing[] {
  const out: LiveListing[] = [];
  const seen = new Set<string>();
  const titles = [...html.matchAll(/class="result__a"[^>]*>([\s\S]*?)<\/a>/g)].map((m) =>
    decodeHtml(m[1] ?? ""),
  );
  const snips = [...html.matchAll(/class="result__snippet"[^>]*>([\s\S]*?)<\/a>/g)].map((m) =>
    decodeHtml(m[1] ?? ""),
  );
  const ids: string[] = [];
  for (const m of html.matchAll(/mercari\.com\/us\/item\/(m\d+)/gi)) {
    const id = m[1]!;
    if (seen.has(id)) continue;
    seen.add(id);
    ids.push(id);
  }

  for (let i = 0; i < ids.length && out.length < MERCARI_SCAN_CAP; i++) {
    const title = (titles[i] || `Mercari listing ${ids[i]}`)
      .replace(/\s*[|\-–]\s*Mercari.*$/i, "")
      .trim();
    if (SKIP_LISTING.test(title) || !titleMatchesQuery(title, query)) continue;
    const snippet = snips[i] ?? "";
    out.push({
      id: ids[i]!,
      marketplace: "mercari",
      title,
      url: `https://www.mercari.com/us/item/${ids[i]}/`,
      price: parseMoney(
        (snippet.match(/\$([0-9,]+\.?\d*)/) ?? title.match(/\$([0-9,]+\.?\d*)/))?.[1],
      ),
      shipping: ASSUMED_SHIPPING.mercari,
      shippingEstimated: true,
      image: null,
      listedAt: parseListedAt(snippet),
      seller: parseMercariSellerFromText(snippet),
    });
  }
  return out;
}

export function mercariSearchPage(query: string) {
  const q = query.trim() || "pokemon card";
  return `https://www.mercari.com/search/?keyword=${encodeURIComponent(q)}`;
}
