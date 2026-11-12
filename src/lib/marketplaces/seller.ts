import type { ScanSource, SellerInfo, SellerReputation } from "./types";

/**
 * Format large feedback counts into readable abbreviations (e.g. 1450 -> "1.5k").
 */
export function formatFeedbackCount(count: number): string {
  if (!Number.isFinite(count) || count < 0) return "0";
  if (count < 1000) return String(Math.round(count));
  if (count < 100_000) {
    const k = Math.round(count / 100) / 10;
    return `${k}k`;
  }
  if (count < 1_000_000) {
    return `${Math.round(count / 1000)}k`;
  }
  const m = Math.round(count / 100_000) / 10;
  return `${m}m`;
}

export type DeriveSellerOptions = {
  marketplace: ScanSource;
  username?: string | null;
  feedbackScore?: number | null;
  feedbackPercent?: number | null;
  isTopRated?: boolean;
  isNew?: boolean;
};

/**
 * Determines seller reputation category and badge copy based on marketplace metrics.
 *
 * Rules:
 * - "top_rated": High-rated with significant sales volume (e.g., eBay Top Rated or >=100 sales & >=98% positive).
 * - "trusted": Positive feedback with solid history (e.g., >=20 sales & >=97% positive).
 * - "new": Brand new seller (0 to 5 sales/reviews) — alerts buyers to exercise caution.
 * - "low_rated": Below-average feedback (<95% on eBay, <4.5 stars on Mercari) with enough ratings to be significant.
 * - "standard": Moderate history meeting normal standards.
 */
export function deriveSellerReputation(opts: DeriveSellerOptions): SellerInfo {
  const { marketplace, username, feedbackScore, feedbackPercent, isTopRated, isNew } = opts;

  let reputation: SellerReputation = "unknown";
  let label: string | null = null;
  let detail: string | null = null;

  const score = typeof feedbackScore === "number" && Number.isFinite(feedbackScore) ? feedbackScore : null;
  const pct = typeof feedbackPercent === "number" && Number.isFinite(feedbackPercent) ? feedbackPercent : null;

  if (marketplace === "ebay") {
    // 1. Low rated check (<95% positive feedback, with at least 3 reviews)
    if (pct != null && pct < 95.0 && (score == null || score >= 3)) {
      reputation = "low_rated";
      label = `Low Rated (${pct.toFixed(1)}%)`;
      detail = `Seller has below-average feedback (${pct.toFixed(1)}% positive). Exercise caution.`;
    }
    // 2. Brand new seller (0 to 5 feedback, or explicitly flagged new)
    else if (isNew || (score != null && score <= 5)) {
      reputation = "new";
      const s = score ?? 0;
      label = s === 0 ? "New Seller (0 sales)" : `New Seller (${s} sale${s === 1 ? "" : "s"})`;
      detail = "Brand new seller with few or no recorded transactions. Verify carefully.";
    }
    // 3. Top Rated / High Rated with High Sales Volume
    else if (
      isTopRated ||
      (score != null && score >= 100 && (pct == null || pct >= 98.0)) ||
      (score != null && score >= 50 && pct != null && pct >= 99.0)
    ) {
      reputation = "top_rated";
      if (pct != null && score != null) {
        label = `Top Rated (${pct.toFixed(1)}% · ${formatFeedbackCount(score)})`;
      } else if (score != null) {
        label = `Top Seller (${formatFeedbackCount(score)} sales)`;
      } else {
        label = "Top Rated Seller";
      }
      detail = `Top rated seller with high volume and positive track record (${score ? `${formatFeedbackCount(score)} sales` : "top status"}${pct ? `, ${pct.toFixed(1)}%` : ""}).`;
    }
    // 4. Trusted (solid rating with moderate history: >=20 sales and >=97% positive)
    else if (score != null && score >= 20 && (pct == null || pct >= 97.0)) {
      reputation = "trusted";
      label = `Trusted (${pct ? `${pct.toFixed(1)}% · ` : ""}${formatFeedbackCount(score)})`;
      detail = `Established seller with consistent positive feedback (${formatFeedbackCount(score)} sales).`;
    }
    // 5. Standard established seller
    else if (username || score != null || pct != null) {
      reputation = "standard";
      const parts: string[] = [];
      if (score != null) parts.push(formatFeedbackCount(score));
      if (pct != null) parts.push(`${pct.toFixed(1)}%`);
      label = parts.length ? parts.join(" · ") : (username ?? "Seller");
      detail = username ? `Seller: ${username}` : null;
    }
  } else if (marketplace === "mercari") {
    // Mercari ratings: star rating 1.0 - 5.0 (or percentage 0 - 100%)
    const isFiveStarScale = pct != null && pct <= 5.0;

    // 1. Low rated check (<4.5 stars on 5-star scale, or <90% on 100% scale)
    if (
      pct != null &&
      ((isFiveStarScale && pct < 4.5) || (!isFiveStarScale && pct < 90.0)) &&
      (score == null || score >= 3)
    ) {
      reputation = "low_rated";
      label = isFiveStarScale ? `Low Rated (${pct.toFixed(1)}★)` : `Low Rated (${pct.toFixed(1)}%)`;
      detail = "Seller has lower-than-average ratings on Mercari. Exercise caution.";
    }
    // 2. Brand new seller (0 to 3 reviews or flagged new)
    else if (isNew || (score != null && score <= 3)) {
      reputation = "new";
      const s = score ?? 0;
      label = s === 0 ? "New Seller (0 reviews)" : `New Seller (${s} review${s === 1 ? "" : "s"})`;
      detail = "New Mercari account with little or no review history.";
    }
    // 3. Top Rated / High Rated with many reviews (>=50 reviews and >=4.8 stars or >=97%)
    else if (
      isTopRated ||
      (score != null &&
        score >= 50 &&
        (pct == null || (isFiveStarScale ? pct >= 4.8 : pct >= 97.0)))
    ) {
      reputation = "top_rated";
      const ratingStr = pct != null ? (isFiveStarScale ? `${pct.toFixed(1)}★ · ` : `${pct.toFixed(1)}% · `) : "";
      label = `Top Seller (${ratingStr}${score != null ? formatFeedbackCount(score) : ""})`;
      detail = `Top Mercari seller with high sales volume and high ratings.`;
    }
    // 4. Trusted (>=15 reviews and >=4.7 stars or >=95%)
    else if (
      score != null &&
      score >= 15 &&
      (pct == null || (isFiveStarScale ? pct >= 4.7 : pct >= 95.0))
    ) {
      reputation = "trusted";
      label = `Trusted Seller (${formatFeedbackCount(score)})`;
      detail = `Established Mercari seller with positive reviews.`;
    }
    // 5. Standard seller
    else if (username || score != null || pct != null) {
      reputation = "standard";
      const parts: string[] = [];
      if (score != null) parts.push(`${formatFeedbackCount(score)} reviews`);
      if (pct != null) parts.push(isFiveStarScale ? `${pct.toFixed(1)}★` : `${pct.toFixed(1)}%`);
      label = parts.length ? parts.join(" · ") : (username ?? "Seller");
      detail = username ? `Seller: ${username}` : null;
    }
  }

  return {
    username: username ?? null,
    feedbackScore: score,
    feedbackPercent: pct,
    reputation,
    label,
    detail,
  };
}

/**
 * Parses eBay seller info from HTML snippet, search chunk, or markdown text.
 */
export function parseEbaySellerFromText(chunk: string): SellerInfo | null {
  if (!chunk) return null;

  const isTopRated = /\b(top[- ]?rated(?:\s+plus|\s+seller)?)\b/i.test(chunk);
  const isNew = /\b(new seller|0 feedback|just joined)\b/i.test(chunk);

  // Pattern 1: username (score) percentage%
  // e.g. "poke_vault (1,450) 99.8%" or "Seller: card_king (45) 100%"
  const matchWithPct = chunk.match(
    /(?:seller:?|by)?\s*\[?([a-zA-Z0-9._-]{3,40})\]?\s*\(([0-9,]{1,10})\)\s*([0-9]{1,3}(?:\.[0-9]+)?)\s*%/i,
  );
  if (matchWithPct) {
    const username = matchWithPct[1]!.trim();
    const score = parseInt(matchWithPct[2]!.replace(/,/g, ""), 10);
    const pct = parseFloat(matchWithPct[3]!);
    return deriveSellerReputation({
      marketplace: "ebay",
      username,
      feedbackScore: Number.isFinite(score) ? score : null,
      feedbackPercent: Number.isFinite(pct) ? pct : null,
      isTopRated,
      isNew: isNew || score === 0,
    });
  }

  // Pattern 2: username (score) without percentage
  // e.g. "cardmaster (1,234)"
  const matchScoreOnly = chunk.match(
    /(?:seller:?|by)?\s*\[?([a-zA-Z0-9._-]{3,40})\]?\s*\(([0-9,]{1,10})\)/i,
  );
  if (matchScoreOnly) {
    const username = matchScoreOnly[1]!.trim();
    const score = parseInt(matchScoreOnly[2]!.replace(/,/g, ""), 10);
    return deriveSellerReputation({
      marketplace: "ebay",
      username,
      feedbackScore: Number.isFinite(score) ? score : null,
      isTopRated,
      isNew: isNew || score === 0,
    });
  }

  // Pattern 3: Top Rated flag with no parsed score
  if (isTopRated || isNew) {
    return deriveSellerReputation({
      marketplace: "ebay",
      isTopRated,
      isNew,
    });
  }

  return null;
}

/**
 * Parses Mercari seller info from markdown, search snippet, or HTML text.
 */
export function parseMercariSellerFromText(chunk: string): SellerInfo | null {
  if (!chunk) return null;

  const isNew = /\b(new seller|0 reviews?|no ratings? yet|just joined)\b/i.test(chunk);
  const isTopRated = /\b(top seller|quick shipper|reliable seller)\b/i.test(chunk);

  // Pattern: "Sold by username" or "Seller: username"
  const userMatch = chunk.match(/(?:sold by|seller:?)\s*\[?([a-zA-Z0-9_-]{2,30})\]?/i);
  const username = userMatch ? userMatch[1]!.trim() : null;

  // Pattern: star rating e.g. "5.0 ★" or "4.8 stars"
  const starMatch = chunk.match(/([1-5](?:\.[0-9]+)?)\s*(?:★|stars?)/i);
  const stars = starMatch ? parseFloat(starMatch[1]!) : null;

  // Pattern: reviews / sales count e.g. "(124) reviews" or "124 ratings" or "(124)"
  const reviewsMatch = chunk.match(/(?:\(|\b)([0-9,]{1,9})\s*(?:reviews?|ratings?|sales?)/i);
  const reviewsCount = reviewsMatch ? parseInt(reviewsMatch[1]!.replace(/,/g, ""), 10) : null;

  if (username || stars != null || reviewsCount != null || isNew || isTopRated) {
    return deriveSellerReputation({
      marketplace: "mercari",
      username,
      feedbackScore: Number.isFinite(reviewsCount) ? reviewsCount : null,
      feedbackPercent: Number.isFinite(stars) ? stars : null,
      isTopRated,
      isNew,
    });
  }

  return null;
}
