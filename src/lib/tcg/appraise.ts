import type {
  Appraisal,
  Condition,
  FinishPrices,
  Grade,
  ListingInput,
  Marketplace,
  TcgCard,
  Verdict,
} from "./types";

export const CONDITION_MULT: Record<Condition, number> = {
  NM: 1,
  LP: 0.8,
  MP: 0.55,
  HP: 0.35,
  DMG: 0.2,
};

/** Multipliers vs raw NM TCGPlayer market. Labeled as estimates in the UI. */
export const GRADE_MULT: Record<Grade, number> = {
  raw: 1,
  "PSA 10": 2.8,
  "PSA 9": 1.35,
  "PSA 8": 0.95,
  "BGS 10": 3.2,
  "BGS 9.5": 1.8,
  "CGC 10": 2.4,
  "CGC 9.5": 1.4,
  "ACE 10": 2.2,
};

export const MARKETPLACE_FEE: Record<Marketplace, number> = {
  ebay: 0.1325,
  mercari: 0.1,
  other: 0.1,
};

export const TCGPLAYER_SELL_FEE = 0.1125;

function gradeBucket(card: TcgCard): "vintage-holo" | "vintage" | "chase" | "modern" {
  const set = `${card.setId} ${card.setName}`.toLowerCase();
  const vintage = /base1|base2|base3|base4|jungle|fossil|neo|gym|team rocket|wotc/.test(set);
  const chase = /illustration rare|special illustration|alt art|hyper rare|secret/.test(
    (card.rarity ?? "").toLowerCase(),
  );
  if (vintage && /holo/.test((card.rarity ?? "").toLowerCase())) return "vintage-holo";
  if (vintage) return "vintage";
  if (chase) return "chase";
  return "modern";
}

const PSA10_BY_BUCKET = {
  "vintage-holo": 8,
  vintage: 4,
  chase: 2.1,
  modern: 1.25,
} as const;

export function gradeMultiplier(card: TcgCard | null, grade: Grade): number {
  if (grade === "raw") return 1;
  const base = GRADE_MULT[grade] ?? 1;
  if (!card) return base;
  // The bucket scales this card's WHOLE grade curve, anchored on PSA 10.
  //
  // Two earlier versions got this wrong. The first returned the bucket value
  // for every 10-grade, collapsing BGS 10 / CGC 10 / ACE 10 onto PSA 10. The
  // second scaled only the 10s and left 9s on their flat multiplier, which
  // INVERTED the ordering on modern cards: PSA 10 came back 1.25 while PSA 9
  // kept 1.35, so a gem-mint slab booked below a near-mint one. Scaling the
  // whole curve keeps every grade in order for every bucket.
  const scale = PSA10_BY_BUCKET[gradeBucket(card)] / GRADE_MULT["PSA 10"];
  return base * scale;
}

export function finishLabel(key: string) {
  return key
    .replace(/-/g, " ")
    .replace(/\bholofoil\b/gi, "Holofoil")
    .replace(/\bholo\b/gi, "Holo")
    .replace(/\breverse\b/gi, "Reverse")
    .replace(/\bunlimited\b/gi, "Unlimited")
    .replace(/\bnormal\b/gi, "Normal")
    .replace(/\b1st edition\b/gi, "1st Edition")
    .replace(/\bfirst edition\b/gi, "1st Edition")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

export function pickFinish(card: TcgCard, hint: string | null): FinishPrices | null {
  if (!card.finishes.length) return null;
  const priced = card.finishes.filter((f) => f.market != null);
  const pool = priced.length ? priced : card.finishes;
  if (!hint) {
    return (
      pool.find((f) => f.key.includes("holo") && !f.key.includes("reverse")) ??
      pool.find((f) => f.key === "normal") ??
      pool[0] ??
      null
    );
  }
  const h = hint.toLowerCase();
  const scored = pool
    .map((f) => {
      const k = f.key.toLowerCase();
      let s = 0;
      if (h.includes("reverse") && k.includes("reverse")) s += 6;
      if ((h.includes("1st") || h.includes("first")) && (k.includes("1st") || k.includes("first")))
        s += 6;
      if (h.includes("unlimited") && k.includes("unlimited")) s += 5;
      if (h.includes("holo") && k.includes("holo") && !k.includes("reverse")) s += 3;
      if (h.includes("normal") && k.includes("normal")) s += 4;
      return { f, s };
    })
    .sort((a, b) => b.s - a.s);
  return scored[0] && scored[0].s > 0 ? scored[0].f : (pool[0] ?? null);
}

export function verdictFromSpread(spread: number | null): Verdict {
  if (spread == null) return "fair";
  if (spread >= 0.3) return "steal";
  if (spread >= 0.12) return "good";
  if (spread >= -0.08) return "fair";
  if (spread >= -0.3) return "high";
  return "avoid";
}

export function verdictCopy(verdict: Verdict) {
  switch (verdict) {
    case "steal":
      return { label: "Steal", blurb: "Well under recent prices. Strong buy if the card is real." };
    case "good":
      return {
        label: "Good Deal",
        blurb: "Meaningfully cheaper than the middle of recent prices.",
      };
    case "fair":
      return { label: "Fair", blurb: "Inside the usual price range. Compare shipping and fees." };
    case "high":
      return { label: "High Ask", blurb: "Above recent prices. Fine if you need the card now." };
    case "avoid":
      return { label: "Overpriced", blurb: "Far above recent prices. Wait, or make an offer." };
  }
}

export function isRepackOrProxy(title: string): { suspicious: boolean; reason?: string } {
  const t = title.toLowerCase();
  if (/\b(proxy|custom\s*card|replica|fake|fan\s*made|orica)\b/i.test(t)) {
    return { suspicious: true, reason: "Likely proxy or replica card." };
  }
  if (
    /\b(mystery\s*(?:pack|box|bundle|lot)|repack|god\s*pack|chance\s*at|chase\s*card\?)\b/i.test(t)
  ) {
    return { suspicious: true, reason: "Mystery pack or repack lot." };
  }
  if (/\b(digital|tcgl|tcg\s*live|code\s*card|code\s*only|online\s*code)\b/i.test(t)) {
    return { suspicious: true, reason: "Digital item or code card." };
  }
  if (/\b(empty\s*(?:tin|box|pack|wrapper)|booster\s*art|read\s*desc(?:ription)?)\b/i.test(t)) {
    return { suspicious: true, reason: "Packaging only or suspicious condition." };
  }
  return { suspicious: false };
}

export function calculateGradingArbitrage(
  card: TcgCard,
  rawMarket: number | null,
  allIn: number,
  condition: Condition,
): import("./types").GradingArbitrage | null {
  if (rawMarket == null || rawMarket <= 0) return null;
  const psa10Mult = gradeMultiplier(card, "PSA 10");
  const psa9Mult = gradeMultiplier(card, "PSA 9");
  const gradingCost = 22.0; // standard submission fee + insurance/shipping
  const psa10Value = rawMarket * psa10Mult;
  const psa9Value = rawMarket * psa9Mult;
  const psa10Net = psa10Value * (1 - TCGPLAYER_SELL_FEE) - (allIn + gradingCost);
  const psa9Net = psa9Value * (1 - TCGPLAYER_SELL_FEE) - (allIn + gradingCost);
  const totalInvested = allIn + gradingCost;
  const psa10Roi = totalInvested > 0 ? psa10Net / totalInvested : null;
  const worthGrading =
    condition === "NM" && psa10Net > 20 && (psa10Roi ?? 0) >= 0.35 && psa10Value >= 50;

  return {
    psa10Value,
    psa9Value,
    gradingCost,
    psa10NetProfit: psa10Net,
    psa9NetProfit: psa9Net,
    psa10Roi,
    worthGrading,
  };
}

export function appraise(card: TcgCard, listing: ListingInput): Appraisal {
  const finish = listing.finish
    ? (card.finishes.find((f) => f.key === listing.finish) ?? pickFinish(card, listing.finish))
    : pickFinish(card, null);
  const conditionMult = CONDITION_MULT[listing.condition];
  const gradeMult = gradeMultiplier(card, listing.grade);
  const rawMarket = finish?.market ?? null;
  const adjustedMarket = rawMarket == null ? null : rawMarket * conditionMult * gradeMult;
  const allIn = listing.price + listing.shipping;
  const dollarsOff = adjustedMarket == null ? null : adjustedMarket - allIn;
  const spread = adjustedMarket && adjustedMarket > 0 ? dollarsOff! / adjustedMarket : null;
  const sellFeeRate = TCGPLAYER_SELL_FEE;
  const estimatedNetIfSold = adjustedMarket == null ? null : adjustedMarket * (1 - sellFeeRate);
  const flipProfit = estimatedNetIfSold == null ? null : estimatedNetIfSold - allIn;
  const netMarginRate = allIn > 0 && flipProfit != null ? flipProfit / allIn : null;
  const mult = conditionMult * gradeMult;
  const rawLow = finish?.low ?? (rawMarket != null ? rawMarket * 0.85 : null);
  // `high` is the top of the range; preferring `mid` understated it whenever a
  // mid existed, which is almost always.
  const rawHigh = finish?.high ?? finish?.mid ?? (rawMarket != null ? rawMarket * 1.15 : null);
  const rangeLow = rawLow == null ? null : rawLow * mult;
  const rangeHigh = rawHigh == null ? null : rawHigh * mult;

  const repackCheck = isRepackOrProxy(listing.title);
  const grading =
    listing.grade === "raw"
      ? calculateGradingArbitrage(card, rawMarket, allIn, listing.condition)
      : null;

  return {
    market: rawMarket,
    allIn,
    spread,
    dollarsOff,
    verdict: repackCheck.suspicious ? "avoid" : verdictFromSpread(spread),
    conditionMult,
    gradeMult,
    adjustedMarket,
    sellFeeRate,
    estimatedNetIfSold,
    flipProfit,
    netMarginRate,
    finish,
    verifiedMarket: adjustedMarket,
    rangeLow: rangeLow != null && rangeHigh != null ? Math.min(rangeLow, rangeHigh) : rangeLow,
    rangeHigh: rangeLow != null && rangeHigh != null ? Math.max(rangeLow, rangeHigh) : rangeHigh,
    confidence: rawMarket == null ? "low" : "medium",
    sourcesUsed: rawMarket == null ? 0 : 1,
    conflict: false,
    verifyNote: repackCheck.suspicious
      ? (repackCheck.reason ?? "Flagged listing")
      : rawMarket == null
        ? "No market price for this printing yet."
        : "One price source so far. The cross-check is still running.",
    conflictDetail: null,
    grading,
    isSuspiciousRepack: repackCheck.suspicious,
    repackReason: repackCheck.reason ?? null,
  };
}

export function tcgplayerUrl(card: TcgCard, finish: FinishPrices | null) {
  if (finish?.productId) return `https://www.tcgplayer.com/product/${finish.productId}`;
  const q = encodeURIComponent(`${card.name} ${card.setName}`);
  return `https://www.tcgplayer.com/search/pokemon/product?q=${q}`;
}

export function ebaySoldUrl(card: TcgCard, grade: Grade) {
  const q = encodeURIComponent(
    `${card.name} ${card.setName} ${card.localId}${grade === "raw" ? "" : ` ${grade}`}`,
  );
  return `https://www.ebay.com/sch/i.html?_nkw=${q}&LH_Sold=1&LH_Complete=1&_sop=13`;
}

export function mercariSearchUrl(card: TcgCard, grade: Grade) {
  const q = encodeURIComponent(`${card.name} ${card.setName}${grade === "raw" ? "" : ` ${grade}`}`);
  return `https://www.mercari.com/search/?keyword=${q}`;
}
