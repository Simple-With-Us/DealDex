import type { FinishPrices, TcgCard } from "./types";
import { finishLabel } from "./appraise";

const BASE = "https://api.tcgdex.net/v2/en";

type CacheEntry<T> = { at: number; value: T };
const cache = new Map<string, CacheEntry<unknown>>();
const TTL = 8 * 60 * 1000;
/**
 * Bounded LRU. Entries only expired lazily on read before this, so a key that
 * was fetched once and never asked for again was never freed.
 */
const CACHE_MAX = 400;

function getCached<T>(key: string): T | null {
  const hit = cache.get(key);
  if (!hit) return null;
  if (Date.now() - hit.at > TTL) {
    cache.delete(key);
    return null;
  }
  return hit.value as T;
}

function setCached<T>(key: string, value: T) {
  cache.delete(key);
  cache.set(key, { at: Date.now(), value });
  while (cache.size > CACHE_MAX) {
    const oldest = cache.keys().next().value;
    if (oldest === undefined) break;
    cache.delete(oldest);
  }
}

async function tcgFetch<T>(path: string): Promise<T> {
  const url = `${BASE}${path}`;
  const cached = getCached<T>(url);
  if (cached) return cached;
  const res = await fetch(url, {
    headers: { Accept: "application/json", "User-Agent": "DealDex/1.0" },
  });
  if (!res.ok) throw new Error(`TCGDex ${res.status} for ${path}`);
  const data = (await res.json()) as T;
  setCached(url, data);
  return data;
}

type TcgdexListCard = {
  id: string;
  localId: string;
  name: string;
  image?: string;
};

type TcgdexPriceBlock = {
  productId?: number;
  lowPrice?: number | null;
  midPrice?: number | null;
  highPrice?: number | null;
  marketPrice?: number | null;
  directLowPrice?: number | null;
};

type TcgdexCard = {
  id: string;
  name: string;
  localId: string;
  rarity?: string;
  illustrator?: string;
  image?: string;
  category?: string;
  hp?: number;
  types?: string[];
  stage?: string;
  updated?: string;
  set?: { id?: string; name?: string; logo?: string };
  pricing?: {
    cardmarket?: {
      trend?: number | null;
      avg?: number | null;
      unit?: string;
      low?: number | null;
      avg1?: number | null;
      avg7?: number | null;
      avg30?: number | null;
      "trend-holo"?: number | null;
    };
    tcgplayer?: Record<string, unknown>;
  };
};

function num(v: unknown): number | null {
  return typeof v === "number" && Number.isFinite(v) ? v : null;
}

function extractFinishes(raw: Record<string, unknown> | undefined): FinishPrices[] {
  if (!raw) return [];
  const finishes: FinishPrices[] = [];
  for (const [key, value] of Object.entries(raw)) {
    if (!value || typeof value !== "object" || Array.isArray(value)) continue;
    const block = value as TcgdexPriceBlock;
    if (block.marketPrice == null && block.midPrice == null && block.lowPrice == null) {
      continue;
    }
    finishes.push({
      key,
      label: finishLabel(key),
      productId: typeof block.productId === "number" ? block.productId : null,
      low: num(block.lowPrice),
      mid: num(block.midPrice),
      high: num(block.highPrice),
      market: num(block.marketPrice),
      directLow: num(block.directLowPrice),
    });
  }
  return finishes;
}

export function normalizeCard(raw: TcgdexCard): TcgCard {
  const tcgplayer = raw.pricing?.tcgplayer as Record<string, unknown> | undefined;
  const cm = raw.pricing?.cardmarket;
  return {
    id: raw.id,
    name: raw.name,
    localId: String(raw.localId ?? ""),
    rarity: raw.rarity ?? null,
    illustrator: raw.illustrator ?? null,
    image: raw.image ?? null,
    setId: raw.set?.id ?? "",
    setName: raw.set?.name ?? "Unknown set",
    setLogo: raw.set?.logo ?? null,
    category: raw.category ?? null,
    hp: raw.hp ?? null,
    types: raw.types ?? [],
    stage: raw.stage ?? null,
    updatedAt: typeof tcgplayer?.updated === "string" ? tcgplayer.updated : (raw.updated ?? null),
    finishes: extractFinishes(tcgplayer),
    cardmarketEur: num(cm?.trend) ?? num(cm?.avg),
    cardmarketLow: num(cm?.low),
    cardmarketAvg1: num(cm?.avg1),
    cardmarketAvg7: num(cm?.avg7),
    cardmarketAvg30: num(cm?.avg30),
    cardmarketHoloEur: num(cm?.["trend-holo"]),
  };
}

export async function searchCardIndex(
  name: string,
  localId?: string | null,
): Promise<TcgdexListCard[]> {
  const params = new URLSearchParams();
  params.set("name", name);
  params.set("pagination:itemsPerPage", "24");
  if (localId) params.set("localId", localId);
  try {
    return await tcgFetch<TcgdexListCard[]>(`/cards?${params.toString()}`);
  } catch {
    return [];
  }
}

export async function fetchCardStrict(id: string): Promise<TcgCard> {
  const raw = await tcgFetch<TcgdexCard>(`/cards/${encodeURIComponent(id)}`);
  return normalizeCard(raw);
}

export async function fetchCard(id: string): Promise<TcgCard | null> {
  try {
    return await fetchCardStrict(id);
  } catch {
    return null;
  }
}

export async function fetchCards(ids: string[]): Promise<TcgCard[]> {
  const rows = await Promise.all(ids.map((id) => fetchCard(id)));
  return rows.filter((c): c is TcgCard => c != null);
}

export const FEATURED_CARD_IDS = [
  "base1-4",
  "swsh7-215",
  "sv08-238",
  "sv03.5-006",
  "swsh7-189",
  "base1-58",
  "det1-5",
  "sv08.5-060",
];
