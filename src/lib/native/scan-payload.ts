import type { ScoredListing } from "@/lib/marketplaces/types";

export type NativeScanRow = {
  id: string;
  marketplace: string;
  title: string;
  url: string;
  price: number | null;
  shipping: number;
  image: string | null;
  card: {
    id: string;
    name: string;
    localId: string;
    setName: string;
    setId: string;
    rarity: string | null;
    image: string | null;
  } | null;
  appraisal: {
    market: number | null;
    adjusted: number | null;
    allIn: number;
    spread: number | null;
    verdict: string;
  } | null;
  grade: string;
  seller?: {
    username?: string | null;
    feedbackPercent?: number | null;
    feedbackScore?: number | null;
    reputation: string;
    label?: string | null;
  } | null;
};

/** Compact listing rows for the iPhone / Android clients.  No session required. */
export function nativeScanRows(rows: ScoredListing[]): NativeScanRow[] {
  return rows.map((row) => ({
    id: row.listing.id,
    marketplace: row.listing.marketplace,
    title: row.listing.title,
    url: row.listing.url,
    price: row.listing.price,
    shipping: row.listing.shipping,
    image: row.listing.image,
    card: row.card
      ? {
          id: row.card.id,
          name: row.card.name,
          localId: row.card.localId,
          setName: row.card.setName,
          setId: row.card.setId,
          rarity: row.card.rarity,
          image: row.card.image,
        }
      : null,
    appraisal: row.appraisal
      ? {
          market: row.appraisal.market,
          adjusted: row.appraisal.adjustedMarket,
          allIn: row.appraisal.allIn,
          spread: row.appraisal.spread,
          verdict: row.appraisal.verdict,
        }
      : null,
    grade: row.parsed.grade,
    seller: row.listing.seller ?? null,
  }));
}
