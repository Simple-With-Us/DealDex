import type { Appraisal, ParsedListing, TcgCard } from "@/lib/tcg/types";

export type ScanSource = "ebay" | "mercari";

export type SellerReputation =
  | "top_rated"
  | "trusted"
  | "standard"
  | "new"
  | "low_rated"
  | "unknown";

export type SellerInfo = {
  username?: string | null;
  /** Rating score or percentage, e.g. 99.8 for 99.8% positive (eBay) or 4.9 stars (Mercari) */
  feedbackPercent?: number | null;
  /** Total count of feedback / reviews / sales */
  feedbackScore?: number | null;
  /** Rating category */
  reputation: SellerReputation;
  /** Display label for UI badge, e.g. "Top Rated (99.8% · 1.5k)" or "New Seller (0 sales)" */
  label?: string | null;
  /** Detailed note or tooltip */
  detail?: string | null;
};

export type LiveListing = {
  id: string;
  marketplace: ScanSource;
  title: string;
  url: string;
  price: number | null;
  shipping: number;
  /**
   * True when `shipping` is our assumed default rather than a figure the
   * marketplace actually printed. The UI discloses it so an all-in built on a
   * guess is never presented as a quoted total.
   */
  shippingEstimated?: boolean;
  image: string | null;
  /** ISO time the marketplace said it was listed, when we can parse one. */
  listedAt?: string | null;
  /** Seller profile and reputation indicator when available. */
  seller?: SellerInfo | null;
};

export type ScoredListing = {
  listing: LiveListing;
  parsed: ParsedListing;
  card: TcgCard | null;
  appraisal: Appraisal | null;
};
