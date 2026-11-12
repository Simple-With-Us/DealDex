import { SCAN_SPAN, withScanSpan } from "@/lib/observability/sentry-server";
import { defaultServerEnv } from "@/lib/server/app-settings";
import { appraise } from "@/lib/tcg/appraise";
import { eurUsd, fetchEbaySoldMedian } from "@/lib/tcg/comps";
import { matchListing } from "@/lib/tcg/match";
import { parseListingBlob } from "@/lib/tcg/parse-listing";
import { fetchKeyedQuotes } from "@/lib/tcg/paid-sources";
import type { ListingInput, TcgCard } from "@/lib/tcg/types";
import { applyVerification } from "@/lib/tcg/verify";
import type { DeskKeys } from "@/lib/settings/keys";
import { searchEbay } from "./ebay";
import { significantTokens } from "./html";
import { searchMercari } from "./mercari";
import type { LiveListing, ScanSource, ScoredListing } from "./types";

export type { ScanSource };

function marketOf(card: TcgCard): number | null {
  return card.finishes.find((f) => f.market != null)?.market ?? null;
}

/**
 * Minimum match evidence before we are willing to name a card and price
 * against it. Roughly: a collector-number hit, or a real name plus a real set.
 * Below this we return null and the row renders as "No card match yet", which
 * is the honest answer — a confident wrong card is worse than no card.
 */
const MIN_MATCH_SCORE = 40;

function pickScanCard(
  cards: TcgCard[],
  listing: LiveListing,
  parsed: ReturnType<typeof parseListingBlob>,
): TcgCard | null {
  if (!cards.length) return null;
  const q0 = significantTokens(parsed.nameQuery)[0];
  const title = listing.title.toLowerCase();
  let pool = cards;
  if (q0) {
    const named = cards.filter((c) => c.name.toLowerCase().includes(q0));
    if (named.length) pool = named;
  }
  const extras = ["dark", "blaine", "shining", "mega", "team aqua", "team magma"];
  const filtered = pool.filter((c) => {
    const nm = c.name.toLowerCase();
    const extra = extras.find((e) => nm.includes(e));
    return !extra || title.includes(extra);
  });
  if (filtered.length) pool = filtered;

  if (parsed.setHint) {
    const hint = parsed.setHint.toLowerCase();
    const hinted = pool.filter((c) => {
      const set = c.setName.toLowerCase();
      if (hint === "base set") return set === "base set";
      if (set === hint) return true;
      if (hint.length >= 8 && set.includes(hint)) return true;
      return false;
    });
    if (hinted.length) pool = hinted;
  }

  const priced = pool.filter((c) => marketOf(c) != null);
  const use = priced.length ? priced : pool;

  // Rank on match EVIDENCE only.
  //
  // This used to break ties on `Math.abs(marketOf(card) - allIn)` — whichever
  // card's market price sat closest to the listing's own ask. That let the ask
  // decide which card the listing was, and then scored the ask against that
  // card: a circular rule that pushed every row toward "fair" and hid exactly
  // the underpriced listings the product exists to find.
  const ranked = [...use].sort((a, b) => {
    const byScore = (b.matchScore ?? 0) - (a.matchScore ?? 0);
    if (byScore !== 0) return byScore;
    // Stable, price-independent tie-break so a scan is reproducible.
    return a.id.localeCompare(b.id);
  });

  const best = ranked[0];
  if (!best || (best.matchScore ?? 0) < MIN_MATCH_SCORE) return null;

  // A tie at the top between two DIFFERENT cards is not a confident match
  // either — we would just be picking one at random.
  const runnerUp = ranked[1];
  if (
    runnerUp &&
    (runnerUp.matchScore ?? 0) === (best.matchScore ?? 0) &&
    runnerUp.name.toLowerCase() !== best.name.toLowerCase()
  ) {
    return null;
  }
  return best;
}

async function matchCached(
  parsed: ReturnType<typeof parseListingBlob>,
  cache: Map<string, TcgCard[]>,
): Promise<TcgCard[]> {
  const key = `${parsed.nameQuery}|${parsed.collectorNumber ?? ""}|${parsed.setHint ?? ""}`;
  let cards = cache.get(key);
  if (!cards) {
    cards = await matchListing(parsed);
    cache.set(key, cards);
  }
  return cards;
}

async function mapPool<T, R>(items: T[], limit: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let i = 0;
  async function worker() {
    while (i < items.length) {
      const idx = i++;
      out[idx] = await fn(items[idx]!);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, () => worker()));
  return out;
}

const MATCH_POOL = 6;

export async function scanAndScore(
  query: string,
  sources: ScanSource[],
  keys: DeskKeys = {},
  options: { userProxyUrl?: string | null } = {},
): Promise<{ rows: ScoredListing[]; ebay: number; mercari: number; notes: string[]; errors?: string[] }> {
  const notes: string[] = [];
  const errors: string[] = [];
  const listings: LiveListing[] = [];
  // When the user has set a per-user proxy override, fold it into a synthetic
  // env so fetchWithPool picks the override ahead of the server default.
  const env = options.userProxyUrl
    ? { ...defaultServerEnv(), PROXY_URL_LIST: options.userProxyUrl }
    : defaultServerEnv();
  if (sources.includes("ebay")) {
    listings.push(
      ...(await withScanSpan(SCAN_SPAN.ebay, async (span) => {
        try {
          const rows = await searchEbay(query, { userProxyUrl: options.userProxyUrl });
          span?.setAttribute("scan.marketplace", "ebay");
          span?.setAttribute("listing.count", rows.length);
          return rows;
        } catch (err) {
          errors.push(`ebay: ${err instanceof Error ? err.message : String(err)}`);
          return [];
        }
      })),
    );
  }
  if (sources.includes("mercari")) {
    listings.push(
      ...(await withScanSpan(SCAN_SPAN.mercari, async (span) => {
        try {
          const rows = await searchMercari(query);
          span?.setAttribute("scan.marketplace", "mercari");
          span?.setAttribute("listing.count", rows.length);
          return rows;
        } catch (err) {
          errors.push(`mercari: ${err instanceof Error ? err.message : String(err)}`);
          return [];
        }
      })),
    );
  }

  const ebay = listings.filter((l) => l.marketplace === "ebay").length;
  const mercari = listings.filter((l) => l.marketplace === "mercari").length;
  if (sources.includes("ebay") && ebay === 0) {
    notes.push("eBay returned no singles for that search.");
  }
  if (sources.includes("mercari") && mercari === 0) {
    notes.push("Mercari blocks direct reads — open their search, or try again.");
  }

  const hint = significantTokens(query).slice(0, 3).join(" ");
  const cache = new Map<string, TcgCard[]>();
  const fx = await eurUsd().catch(() => null);

  const scored = await withScanSpan(SCAN_SPAN.match, async (span) => {
    const rows = await mapPool(listings, MATCH_POOL, async (listing) => {
      const blob = `${listing.marketplace} ${listing.title} ${listing.price != null ? `$${listing.price}` : ""}`;
      const parsed = parseListingBlob(blob);
      parsed.url = listing.url;
      parsed.marketplace = listing.marketplace;
      if (listing.price != null) parsed.price = listing.price;
      parsed.shipping = listing.shipping;
      // The search term is a FALLBACK, not an override. Replacing every row's
      // parsed name with the query's first three tokens meant a targeted scan
      // matched every listing against the same name regardless of its own title.
      if (hint && !parsed.nameQuery.trim()) parsed.nameQuery = hint;
      const cards = await matchCached(parsed, cache);
      const card = pickScanCard(cards, listing, parsed);
      let appraisal = null;
      if (card && listing.price != null) {
        const input: ListingInput = {
          title: listing.title,
          url: listing.url,
          marketplace: listing.marketplace,
          price: listing.price,
          shipping: listing.shipping,
          condition: parsed.condition,
          grade: parsed.grade,
          finish: parsed.finishHint,
        };
        appraisal = applyVerification(appraise(card, input), card, { fx });
      }
      return { listing, parsed, card, appraisal } satisfies ScoredListing;
    });
    span?.setAttribute("listing.count", listings.length);
    span?.setAttribute("matched.count", rows.filter((row) => row.card).length);
    return rows;
  });

  // Cross-desk verification is expensive, so only the strongest candidates get
  // it. Sort BEFORE slicing — the previous code took the first five qualifying
  // rows in arrival order, so the rows that ended up at the top of the results
  // were routinely the unverified ones.
  const toConfirm = scored
    .filter(
      (row) =>
        row.card &&
        row.appraisal &&
        (row.appraisal.verdict === "steal" || row.appraisal.verdict === "good"),
    )
    .sort((a, b) => (b.appraisal?.spread ?? -99) - (a.appraisal?.spread ?? -99))
    .slice(0, 5);
  const keyedCache = new Map<string, Awaited<ReturnType<typeof fetchKeyedQuotes>>>();
  await withScanSpan(SCAN_SPAN.enrich, async (span) => {
    span?.setAttribute("candidate.count", toConfirm.length);
    await mapPool(toConfirm, 3, async (row) => {
      if (!row.card || !row.appraisal) return row;
      const sold = await fetchEbaySoldMedian(
        row.card,
        row.parsed.grade,
        row.appraisal.finish,
      ).catch(() => null);
      let extraQuotes = keyedCache.get(row.card.id);
      if (!extraQuotes && (keys.justtcg || keys.pricecharting || keys.pokemontcg)) {
        extraQuotes = await fetchKeyedQuotes(row.card, keys).catch(() => []);
        keyedCache.set(row.card.id, extraQuotes);
      }
      row.appraisal = applyVerification(row.appraisal, row.card, {
        fx,
        sold,
        extraQuotes,
      });
      return row;
    });
  });

  scored.sort((a, b) => {
    const as = a.appraisal?.spread ?? -99;
    const bs = b.appraisal?.spread ?? -99;
    return bs - as;
  });
  return { rows: scored, ebay, mercari, notes, errors: errors.length ? errors : undefined };
}
