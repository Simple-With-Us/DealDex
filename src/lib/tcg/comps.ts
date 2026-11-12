import { fetchJina } from "@/lib/marketplaces/jina";
import { parseMoney } from "@/lib/marketplaces/html";
import type { DeskKeys } from "@/lib/settings/keys";
import { gradeMultiplier } from "./appraise";
import { fetchKeyedQuotes } from "./paid-sources";
import type { Confidence, FinishPrices, Grade, TcgCard } from "./types";

export type QuoteFamily = "listed" | "sold" | "retail" | "model";

/**
 * Which price desk a quote came from. Several quotes share a desk — TCGPlayer
 * publishes market, mid and direct-low — and conflating them made the
 * "Desks Differ" badge fire on a single desk's own internal spread.
 */
export type DeskId =
  "tcgplayer" | "cardmarket" | "ebay" | "pricecharting" | "justtcg" | "pokemontcg" | "model";

export type ValuationQuote = {
  source: string;
  label: string;
  usd: number | null;
  note: string;
  url?: string;
  family: QuoteFamily;
  weight: number;
  /** Desk this quote belongs to. Defaults to `source` when unset. */
  desk?: DeskId;
  /**
   * `usd` restated on the raw-NM basis the rest of the book uses. Graded comps
   * (an eBay PSA 10 sold median) are 2-8x raw, so scoring them against a raw
   * seed median threw them out as outliers and left slabs priced off raw cards.
   * `usd` stays the real observed number so the dossier does not lie; scoring
   * reads this.
   */
  basisUsd?: number | null;
};

/** The value `scoreBook` scores on: raw-equivalent when we have one. */
function basisOf(q: ValuationQuote): number | null {
  return q.basisUsd !== undefined ? q.basisUsd : q.usd;
}

function deskOf(q: ValuationQuote): string {
  return q.desk ?? q.source;
}

export type ValuationBook = {
  quotes: ValuationQuote[];
  blend: number | null;
  conservative: number | null;
  rangeLow: number | null;
  rangeHigh: number | null;
  fxEurUsd: number | null;
  confidence: Confidence;
  /** Number of DISTINCT desks that contributed a usable quote. */
  sourcesUsed: number;
  conflict: boolean;
  relSpread: number | null;
  note: string;
  conflictDetail: string | null;
};

const fxCache: { at: number; rate: number | null } = { at: 0, rate: null };

export async function eurUsd(): Promise<number | null> {
  if (fxCache.rate != null && Date.now() - fxCache.at < 12 * 60 * 60 * 1000) return fxCache.rate;
  try {
    const res = await fetch("https://api.frankfurter.app/latest?from=EUR&to=USD");
    const json = (await res.json()) as { rates?: { USD?: number } };
    const rate = json.rates?.USD ?? null;
    fxCache.at = Date.now();
    fxCache.rate = rate;
    return rate;
  } catch {
    return fxCache.rate;
  }
}

export function median(nums: number[]): number | null {
  if (!nums.length) return null;
  const s = [...nums].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid]! : (s[mid - 1]! + s[mid]!) / 2;
}

export function iqrTrim(nums: number[]): number[] {
  if (nums.length < 4) return [...nums];
  const s = [...nums].sort((a, b) => a - b);
  const q1 = s[Math.floor((s.length - 1) * 0.25)]!;
  const q3 = s[Math.floor((s.length - 1) * 0.75)]!;
  const iqr = q3 - q1;
  if (iqr <= 0) return s;
  return s.filter((n) => n >= q1 - 1.5 * iqr && n <= q3 + 1.5 * iqr);
}

function parseSoldPrices(md: string, hint?: number | null): number[] {
  const out: number[] = [];
  for (const m of md.matchAll(/\$([0-9]{1,3}(?:,[0-9]{3})*(?:\.\d{2})?)/g)) {
    const n = parseMoney(m[1]);
    if (n == null || n < 2 || n >= 250000) continue;
    if (hint != null && hint > 8) {
      if (n < hint * 0.22 || n > hint * 3.8) continue;
    } else if (n < 8) {
      continue;
    }
    out.push(n);
  }
  return out.slice(0, 36);
}

export function soldStats(prices: number[]): { median: number | null; n: number } {
  const trimmed = iqrTrim(prices.filter((n) => n < 50000));
  // `iqrTrim` returns its input SORTED, so the old `.slice(0, 16)` took the 16
  // cheapest comps and medianed those — a systematic downward bias on every
  // sold median, which made real listings look expensive against the book. The
  // set is already outlier-trimmed; median the whole of it.
  return { median: median(trimmed), n: trimmed.length };
}

/**
 * Expected price for THIS grade, used to reject scraped numbers that cannot be
 * this card. Scaling by the grade matters: `parseSoldPrices` keeps values within
 * 0.22x-3.8x of the hint, and a vintage-holo PSA 10 trades near 8x raw — so
 * hinting with the raw price threw away every genuine graded comp and left the
 * median built from page furniture, or null.
 */
function priceHint(card: TcgCard, grade: Grade, printing?: FinishPrices | null): number | null {
  const raw = printing?.market ?? card.finishes.find((f) => f.market != null)?.market ?? null;
  if (raw == null) return null;
  return raw * gradeMultiplier(card, grade);
}

export async function fetchEbaySoldMedian(
  card: TcgCard,
  grade: Grade,
  printing?: FinishPrices | null,
): Promise<number | null> {
  const hint = priceHint(card, grade, printing);
  const q = encodeURIComponent(
    `${card.name} ${card.setName} ${card.localId}${grade === "raw" ? "" : ` ${grade}`}`,
  );
  const url = `https://www.ebay.com/sch/i.html?_nkw=${q}&LH_Sold=1&LH_Complete=1&_sop=13&_ipg=25`;
  const md = await fetchJina(url);
  return soldStats(parseSoldPrices(md, hint)).median;
}

export async function fetchEbayActiveMedian(
  card: TcgCard,
  grade: Grade,
  printing?: FinishPrices | null,
): Promise<number | null> {
  const hint = priceHint(card, grade, printing);
  const q = encodeURIComponent(
    `${card.name} ${card.setName} ${card.localId}${grade === "raw" ? "" : ` ${grade}`}`,
  );
  const url = `https://www.ebay.com/sch/183454/i.html?_nkw=${q}&LH_BIN=1&_sop=15&_ipg=25&_udlo=3`;
  const md = await fetchJina(url);
  return soldStats(parseSoldPrices(md, hint)).median;
}

export async function fetchPriceCharting(card: TcgCard): Promise<{
  ungraded: number | null;
  psa10: number | null;
  psa9: number | null;
  url: string;
}> {
  const q = encodeURIComponent(`${card.name} ${card.setName} pokemon`);
  const url = `https://www.pricecharting.com/search-products?type=prices&q=${q}`;
  const md = await fetchJina(url);
  const ungraded =
    parseMoney(md.match(/Ungraded[^$]{0,40}\$([0-9,]+\.?\d*)/i)?.[1]) ??
    parseMoney(md.match(/loose[^$]{0,20}\$([0-9,]+\.?\d*)/i)?.[1]);
  const psa10 = parseMoney(md.match(/PSA\s*10[^$]{0,40}\$([0-9,]+\.?\d*)/i)?.[1]);
  const psa9 = parseMoney(md.match(/PSA\s*9[^$]{0,40}\$([0-9,]+\.?\d*)/i)?.[1]);
  const href = md.match(/https:\/\/www\.pricecharting\.com\/game\/[^)\s]+/)?.[0] ?? url;
  return { ungraded, psa10, psa9, url: href };
}

type CsvGroup = { groupId: number; name: string };
type CsvPrice = {
  productId: number;
  marketPrice?: number | null;
  lowPrice?: number | null;
  midPrice?: number | null;
  subTypeName?: string;
};

const groupsCache: { at: number; rows: CsvGroup[] } = { at: 0, rows: [] };
/**
 * Bounded LRU. A warm serverless instance would otherwise hold one full price
 * dump per set it has ever seen, forever.
 */
const PRICE_CACHE_MAX = 24;
const priceCache = new Map<number, { at: number; rows: CsvPrice[] }>();

function rememberPrices(groupId: number, entry: { at: number; rows: CsvPrice[] }) {
  priceCache.delete(groupId);
  priceCache.set(groupId, entry);
  while (priceCache.size > PRICE_CACHE_MAX) {
    const oldest = priceCache.keys().next().value;
    if (oldest === undefined) break;
    priceCache.delete(oldest);
  }
}

async function tcgcsvGroups(): Promise<CsvGroup[]> {
  if (groupsCache.rows.length && Date.now() - groupsCache.at < 12 * 60 * 60 * 1000) {
    return groupsCache.rows;
  }
  const res = await fetch("https://tcgcsv.com/tcgplayer/3/groups", {
    headers: { Accept: "application/json", "User-Agent": "DealDex/1.0" },
  });
  if (!res.ok) return groupsCache.rows;
  const json = (await res.json()) as { results?: CsvGroup[] };
  groupsCache.at = Date.now();
  groupsCache.rows = json.results ?? [];
  return groupsCache.rows;
}

/**
 * Bind a TCGDex set name to a TCGCSV group.
 *
 * The old fallback accepted `gn.includes(n) || n.includes(gn)` with no length
 * guard, so "Base" happily bound to "Base Set 2" and pulled a different set's
 * prices into the book. Containment is now last-resort only: both sides must be
 * long enough to be distinctive, and the match must land on a word boundary.
 */
function matchGroup(groups: CsvGroup[], setName: string): CsvGroup | null {
  const full = setName.toLowerCase().trim();
  const n = full
    .replace(/^sv\d+[.:]\s*/i, "")
    .replace(/^swsh\d+[.:]\s*/i, "")
    .trim();
  const bare = (g: CsvGroup) => g.name.toLowerCase().trim();
  const unprefixed = (g: CsvGroup) => bare(g).replace(/^[^:]+:\s*/, "");

  const exact = groups.find((g) => bare(g) === n || bare(g) === full);
  if (exact) return exact;

  const strippedExact = groups.find((g) => unprefixed(g) === n || unprefixed(g) === full);
  if (strippedExact) return strippedExact;

  const MIN = 10;
  if (n.length < MIN) return null;
  const wordBounded = (hay: string, needle: string) => {
    const i = hay.indexOf(needle);
    if (i < 0) return false;
    const before = i === 0 || !/[a-z0-9]/.test(hay[i - 1]!);
    const afterIdx = i + needle.length;
    const after = afterIdx >= hay.length || !/[a-z0-9]/.test(hay[afterIdx]!);
    return before && after;
  };
  return (
    groups.find((g) => {
      const gn = unprefixed(g);
      if (gn.length < MIN) return false;
      return wordBounded(gn, n) || wordBounded(n, gn);
    }) ?? null
  );
}

export async function fetchTcgcsv(card: TcgCard): Promise<{
  market: number | null;
  low: number | null;
  mid: number | null;
  url?: string;
} | null> {
  try {
    const groups = await tcgcsvGroups();
    const group = matchGroup(groups, card.setName);
    if (!group) return null;
    let hit = priceCache.get(group.groupId);
    if (!hit || Date.now() - hit.at > 6 * 60 * 60 * 1000) {
      const res = await fetch(`https://tcgcsv.com/tcgplayer/3/${group.groupId}/prices`, {
        headers: { Accept: "application/json", "User-Agent": "DealDex/1.0" },
      });
      if (!res.ok) return null;
      const json = (await res.json()) as { results?: CsvPrice[] };
      hit = { at: Date.now(), rows: json.results ?? [] };
      rememberPrices(group.groupId, hit);
    }
    const pid = card.finishes.find((f) => f.productId != null)?.productId;
    const row = pid != null ? hit.rows.find((p) => p.productId === pid) : null;
    if (!row) return { market: null, low: null, mid: null };
    return {
      market: row.marketPrice ?? null,
      low: row.lowPrice ?? null,
      mid: row.midPrice ?? null,
      url: `https://www.tcgplayer.com/product/${row.productId}`,
    };
  } catch {
    return null;
  }
}

function usd(eur: number | null | undefined, fx: number | null): number | null {
  if (eur == null || fx == null || !Number.isFinite(eur)) return null;
  return eur * fx;
}

/**
 * Quotes we already hold on the card record.
 *
 * `printing` is the finish the appraisal actually chose. Without it this fell
 * back to "the first priced finish", so a reverse-holo listing was booked off
 * the holo prices — a different card, often several times the value. `appraise`
 * picks the right printing via `pickFinish`, and `applyVerification` then
 * replaced its number with a blend built from the wrong one.
 */
export function onHandQuotes(
  card: TcgCard,
  fx: number | null,
  printing?: FinishPrices | null,
): ValuationQuote[] {
  const finish =
    printing ?? card.finishes.find((f) => f.market != null) ?? card.finishes[0] ?? null;
  const cmNote = fx ? `Frankfurter EUR→USD ${fx.toFixed(3)}` : "Need FX for USD";
  return [
    {
      source: "tcgplayer",
      desk: "tcgplayer",
      label: "TCGPlayer market",
      usd: finish?.market ?? null,
      note: finish?.label ?? "NM raw snapshot via TCGDex",
      family: "listed",
      weight: 0.18,
    },
    {
      source: "tcgplayer-low",
      desk: "tcgplayer",
      label: "TCGPlayer low",
      usd: finish?.low ?? null,
      note: "Listed floor — a floor, not a fair value",
      family: "listed",
      weight: 0,
    },
    {
      source: "tcgplayer-mid",
      desk: "tcgplayer",
      label: "TCGPlayer mid",
      usd: finish?.mid ?? null,
      note: "Mid of active TCGPlayer listings",
      family: "listed",
      weight: 0.06,
    },
    {
      source: "tcgplayer-high",
      desk: "tcgplayer",
      label: "TCGPlayer high",
      usd: finish?.high ?? null,
      note: "Highest live TCGPlayer ask (often noise)",
      family: "listed",
      weight: 0,
    },
    {
      source: "tcgplayer-direct",
      desk: "tcgplayer",
      label: "TCGPlayer direct low",
      usd: finish?.directLow ?? null,
      note: "Direct inventory floor",
      family: "retail",
      weight: 0.04,
    },
    {
      source: "cardmarket",
      desk: "cardmarket",
      label: "Cardmarket trend",
      usd: usd(card.cardmarketEur, fx),
      note:
        card.cardmarketEur != null
          ? `€${card.cardmarketEur.toFixed(2)} · ${cmNote}`
          : "EU trend via TCGDex",
      family: "listed",
      weight: 0.08,
    },
    {
      source: "cardmarket-1d",
      desk: "cardmarket",
      label: "Cardmarket 1-day avg",
      usd: usd(card.cardmarketAvg1, fx),
      note: "Yesterday’s EU prints",
      family: "sold",
      weight: 0.05,
    },
    {
      source: "cardmarket-7d",
      desk: "cardmarket",
      label: "Cardmarket 7-day avg",
      usd: usd(card.cardmarketAvg7, fx),
      note: "Dealers lean on 7-day more than a single trend tick",
      family: "sold",
      weight: 0.14,
    },
    {
      source: "cardmarket-30d",
      desk: "cardmarket",
      label: "Cardmarket 30-day avg",
      usd: usd(card.cardmarketAvg30, fx),
      note: "Slower EU mean — flags spikes",
      family: "sold",
      weight: 0.05,
    },
    {
      source: "cardmarket-low",
      desk: "cardmarket",
      label: "Cardmarket low",
      usd: usd(card.cardmarketLow, fx),
      note: "EU listed floor",
      family: "listed",
      weight: 0,
    },
  ];
}

const DESK_LABEL: Record<string, string> = {
  tcgplayer: "TCGPlayer",
  cardmarket: "Cardmarket",
  ebay: "eBay comps",
  pricecharting: "PriceCharting",
  justtcg: "JustTCG",
  pokemontcg: "pokemontcg.io",
  model: "Grade model",
};

export function scoreBook(
  quotes: ValuationQuote[],
): Pick<
  ValuationBook,
  | "blend"
  | "conservative"
  | "rangeLow"
  | "rangeHigh"
  | "confidence"
  | "sourcesUsed"
  | "conflict"
  | "relSpread"
  | "note"
  | "conflictDetail"
> {
  // Seed on the desks that publish a broad, stable book. Used only to throw out
  // obvious garbage before weighting — never as the answer.
  const seeded = quotes.filter((q) => {
    const v = basisOf(q);
    return (
      v != null &&
      v > 0 &&
      (q.source === "tcgplayer" ||
        q.source === "cardmarket-7d" ||
        q.source === "cardmarket" ||
        q.source === "tcgcsv" ||
        q.source === "justtcg" ||
        q.source === "pricecharting-api")
    );
  });
  const seedMed = median(seeded.map((q) => basisOf(q)!));
  const core = quotes.filter((q) => {
    const v = basisOf(q);
    if (v == null || v <= 0 || q.weight <= 0) return false;
    if (seedMed != null && (v < seedMed * 0.35 || v > seedMed * 2.8)) return false;
    return true;
  });

  let wsum = 0;
  let acc = 0;
  for (const q of core) {
    acc += basisOf(q)! * q.weight;
    wsum += q.weight;
  }
  const blend = wsum > 0 ? acc / wsum : median(seeded.map((q) => basisOf(q)!));

  // Collapse to ONE representative value per desk before measuring spread. A
  // desk that publishes market, mid and direct-low is one opinion, not three,
  // and comparing its own low against its own high produced conflict warnings
  // like "TCGPlayer market $43 vs TCGPlayer direct low $120".
  const byDesk = new Map<string, { label: string; best: ValuationQuote; tied: number[] }>();
  for (const q of core) {
    const key = deskOf(q);
    const hit = byDesk.get(key);
    if (!hit) {
      byDesk.set(key, { label: DESK_LABEL[key] ?? q.label, best: q, tied: [basisOf(q)!] });
      continue;
    }
    // A desk's representative is its HIGHEST-WEIGHTED quote, not the median of
    // everything it publishes. Medianing threw the weights away, so TCGPlayer's
    // desk value became the midpoint of market / mid / direct-low rather than
    // the market price the weights say to trust.
    if (q.weight > hit.best.weight) {
      hit.best = q;
      hit.tied = [basisOf(q)!];
    } else if (q.weight === hit.best.weight) {
      hit.tied.push(basisOf(q)!);
    }
  }
  const desks = [...byDesk.entries()]
    .map(([id, row]) => ({ id, label: row.label, usd: median(row.tied)! }))
    .sort((a, b) => a.usd - b.usd);

  const sourcesUsed = desks.length;
  const loQ = desks[0];
  const hiQ = desks[desks.length - 1];
  const lo = loQ?.usd ?? null;
  const hi = hiQ?.usd ?? null;
  const conflict = lo != null && hi != null && lo > 0 && hi / lo > 1.35;
  const rangeLow = lo;
  const rangeHigh = hi;
  // Full desk-to-desk spread, not a percentile band. With at most a handful of
  // desks the percentile version was worse than useless: at exactly two desks
  // `floor(1 * 0.2)` and `floor(1 * 0.8)` are BOTH index 0, so relSpread came
  // out as exactly 0 — "2 desks agree within ~0%" — even when they disagreed
  // three to one, and the confidence gate read that 0 as agreement.
  const relSpread = blend && lo != null && hi != null ? (hi - lo) / blend : null;
  // Conservative value: the lowest desk, never above the blend.
  const p20 = lo;

  let confidence: Confidence = "low";
  if (sourcesUsed >= 3 && (relSpread ?? 1) < 0.22) confidence = "high";
  else if (sourcesUsed >= 2 && (relSpread ?? 1) < 0.4) confidence = "medium";

  const conservative = p20 != null && blend != null ? Math.min(p20, blend) : blend;
  const conflictDetail =
    conflict && loQ && hiQ
      ? `${loQ.label} $${loQ.usd.toFixed(0)} vs ${hiQ.label} $${hiQ.usd.toFixed(0)} (${Math.round((hi! / lo! - 1) * 100)}% apart)`
      : null;

  let note: string;
  if (sourcesUsed === 0) note = "No price source returned a usable price for this printing.";
  else if (sourcesUsed === 1)
    note = `Only ${desks[0]!.label} priced this. Treat a low price as unverified.`;
  else if (conflict && conflictDetail) {
    note = `Price sources differ: ${conflictDetail}. Common on vintage US vs EU. We score against the lower cluster, not the highest ask.`;
  } else if (confidence === "high") {
    note = `${sourcesUsed} price sources agree within about ${Math.round((relSpread ?? 0) * 100)}%.`;
  } else {
    note = `${sourcesUsed} price sources. The spread between them is ${relSpread != null ? `${Math.round(relSpread * 100)}%` : "wide"}.`;
  }

  return {
    blend,
    conservative,
    rangeLow,
    rangeHigh,
    confidence,
    sourcesUsed,
    conflict,
    relSpread,
    note,
    conflictDetail,
  };
}

export async function buildValuationBook(
  card: TcgCard,
  grade: Grade = "raw",
  keys: DeskKeys = {},
  printing?: FinishPrices | null,
): Promise<ValuationBook> {
  const finish =
    printing ?? card.finishes.find((f) => f.market != null) ?? card.finishes[0] ?? null;
  const market = finish?.market ?? null;
  const [fx, sold, active, chart, csv, keyed] = await Promise.all([
    eurUsd(),
    fetchEbaySoldMedian(card, grade, finish).catch(() => null),
    fetchEbayActiveMedian(card, grade, finish).catch(() => null),
    fetchPriceCharting(card).catch(() => ({ ungraded: null, psa10: null, psa9: null, url: "" })),
    fetchTcgcsv(card).catch(() => null),
    fetchKeyedQuotes(card, keys).catch(() => [] as ValuationQuote[]),
  ]);

  // eBay sold/active medians were fetched with a GRADE-SPECIFIC query, so they
  // live on the graded basis while every other quote is raw-NM. Restate them on
  // the raw basis for scoring — otherwise the seed-median gate in `scoreBook`
  // discards them as outliers (a vintage-holo PSA 10 trades near 8x raw) and the
  // slab ends up priced off raw cards. `usd` keeps the real observed number.
  const gradeBasis = gradeMultiplier(card, grade) || 1;
  const toRawBasis = (v: number | null) => (v == null ? null : v / gradeBasis);
  const psa10 = market != null ? market * gradeMultiplier(card, "PSA 10") : null;
  const soldUrl = `https://www.ebay.com/sch/i.html?_nkw=${encodeURIComponent(`${card.name} ${card.setName} ${card.localId}`)}&LH_Sold=1&LH_Complete=1`;
  const hasPcApi = keyed.some((q) => q.source === "pricecharting-api" && q.usd != null);

  const quotes: ValuationQuote[] = [
    ...onHandQuotes(card, fx, finish),
    {
      source: "tcgcsv",
      desk: "tcgplayer",
      label: "TCGCSV (TCGPlayer dump)",
      usd: csv?.market ?? null,
      note: "Daily public TCGPlayer price file — independent snapshot of the same market",
      url: csv?.url,
      family: "listed",
      weight: 0.1,
    },
    {
      source: "ebay-sold",
      desk: "ebay",
      label: "eBay sold median",
      usd: sold,
      basisUsd: toRawBasis(sold),
      note:
        grade === "raw"
          ? "IQR-trimmed completed sales. Shop buyers weight this over asks."
          : `IQR-trimmed ${grade} completed sales, restated to raw for scoring.`,
      url: soldUrl,
      family: "sold",
      weight: 0.28,
    },
    {
      source: "ebay-active",
      desk: "ebay",
      label: "eBay active BIN median",
      usd: active,
      basisUsd: toRawBasis(active),
      note: "What is listed right now — often high vs what actually clears",
      url: `https://www.ebay.com/sch/183454/i.html?_nkw=${encodeURIComponent(`${card.name} ${card.setName}`)}&LH_BIN=1`,
      family: "listed",
      weight: 0.04,
    },
    {
      source: "pricecharting",
      desk: "pricecharting",
      label: "PriceCharting ungraded",
      usd: hasPcApi ? null : chart.ungraded,
      note: hasPcApi
        ? "Superseded by your PriceCharting API token"
        : "Sold-comp guide (raw / loose scrape)",
      url: chart.url || undefined,
      family: "sold",
      weight: hasPcApi ? 0 : 0.12,
    },
    {
      source: "pricecharting-psa9",
      desk: "pricecharting",
      label: "PriceCharting PSA 9",
      usd: hasPcApi ? null : chart.psa9,
      basisUsd:
        hasPcApi || chart.psa9 == null ? null : chart.psa9 / (gradeMultiplier(card, "PSA 9") || 1),
      note: "Graded slab guide",
      url: chart.url || undefined,
      family: "sold",
      weight: 0,
    },
    {
      source: "pricecharting-psa10",
      desk: "pricecharting",
      label: "PriceCharting PSA 10",
      usd: hasPcApi ? null : chart.psa10,
      basisUsd:
        hasPcApi || chart.psa10 == null
          ? null
          : chart.psa10 / (gradeMultiplier(card, "PSA 10") || 1),
      note: "Graded slab guide",
      url: chart.url || undefined,
      family: "sold",
      weight: 0,
    },
    {
      source: "psa10-model",
      desk: "model",
      label: "PSA 10 model",
      usd: psa10,
      basisUsd: market,
      note: "Raw market × desk grade bucket (not a sold comp)",
      family: "model",
      weight: 0,
    },
    ...keyed,
  ];

  return { quotes, fxEurUsd: fx, ...scoreBook(quotes) };
}
