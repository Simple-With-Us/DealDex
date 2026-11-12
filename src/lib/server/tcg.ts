import { createServerFn } from "@tanstack/react-start";
import type { DeskKeys } from "@/lib/settings/keys";
import { FEATURED_CARD_IDS, fetchCard, fetchCardStrict, fetchCards } from "@/lib/tcg/tcgdex";
import { matchListing } from "@/lib/tcg/match";
import { parseListingBlob } from "@/lib/tcg/parse-listing";
import { pingDeskKey } from "@/lib/tcg/paid-sources";

function cleanKeys(input: unknown): DeskKeys {
  if (!input || typeof input !== "object") return {};
  const raw = input as Record<string, unknown>;
  const out: DeskKeys = {};
  for (const id of ["justtcg", "pricecharting", "pokemontcg"] as const) {
    const v = raw[id];
    if (typeof v === "string" && v.trim()) out[id] = v.trim().slice(0, 200);
  }
  return out;
}

export const searchMarket = createServerFn({ method: "POST" })
  .validator((input: { q: string }) => ({ q: String(input.q ?? "").slice(0, 240) }))
  .handler(async ({ data }) => {
    const parsed = parseListingBlob(data.q);
    const cards = await matchListing(parsed);
    return { parsed, cards, cardCount: cards.length };
  });

export const getCard = createServerFn({ method: "GET" })
  .validator((input: { id: string }) => ({ id: String(input.id ?? "") }))
  .handler(async ({ data }) => {
    if (!data.id) return null;
    try {
      return await fetchCardStrict(data.id);
    } catch (err) {
      if (err instanceof Error && /TCGDex 40[04]\b/.test(err.message)) return null;
      throw err;
    }
  });

export const getMarketBoard = createServerFn({ method: "GET" }).handler(async () => {
  const cards = await fetchCards(FEATURED_CARD_IDS);
  return cards;
});

export const getValuationBook = createServerFn({ method: "POST" })
  .validator((input: { id: string; grade?: string; keys?: DeskKeys }) => ({
    id: String(input.id ?? ""),
    grade: String(input.grade ?? "raw"),
    keys: cleanKeys(input.keys),
  }))
  .handler(async ({ data }) => {
    if (!data.id) return null;
    const card = await fetchCard(data.id);
    if (!card) return null;
    const { buildValuationBook } = await import("@/lib/tcg/comps");
    const grade = (data.grade || "raw") as import("@/lib/tcg/types").Grade;
    return buildValuationBook(card, grade, data.keys);
  });

export const testDeskKey = createServerFn({ method: "POST" })
  .validator((input: { id: string; key: string }) => ({
    id: String(input.id ?? ""),
    key: String(input.key ?? "")
      .trim()
      .slice(0, 200),
  }))
  .handler(async ({ data }) => {
    if (!data.key) return { ok: false, message: "Paste a key first." };
    if (data.id !== "justtcg" && data.id !== "pricecharting" && data.id !== "pokemontcg") {
      return { ok: false, message: "Unknown price source." };
    }
    return pingDeskKey(data.id, data.key);
  });
