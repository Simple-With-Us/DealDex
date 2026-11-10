/**
 * Auto-buy decision engine.
 *
 * Owner direction 2026-09-20: a saved filter (AlertRule) can authorize the
 * server to attempt a Buy It Now purchase on eBay within user-defined caps.
 *
 * Today (PR #2 of this initiative) this module runs in DRY-RUN mode
 * everywhere; the actual eBay Order API call lands in PR #2b once an
 * order-write scope has been granted to the Browse app.  The same shape
 * runs in either mode, so flipping `dryRun` off is a one-line change for
 * an authorized user.
 *
 * Hard guardrails:
 *   1. Never auto-buy when `autoBuy.enabled` is false.
 *   2. Never auto-buy outside `autoBuy.marketplace` (only eBay for now).
 *   3. Never auto-buy when the all-in price (price + shipping) exceeds
 *      `autoBuy.maxPriceCents` (cents, not dollars — matches the rest of
 *      the autoBuy schema).
 *   4. Never auto-buy when the spread is below `autoBuy.minSpread`.
 *   5. Never auto-buy when the same listing id was purchased within
 *      `autoBuy.coolHours` (idempotency).
 *   6. Never auto-buy when the per-day / per-month total spend would
 *      exceed the cap.
 *
 * Every accept/reject decision returns a `reason` so the dry-run preview
 * is auditable: the user sees WHY each row was kept or skipped.
 */
import type { ScoredListing } from "@/lib/marketplaces/types";
import type { AlertRule, AutoBuyConfig } from "@/lib/alerts/types";

export type AutoBuyDecision =
  | { kind: "accept"; reason: "ok"; row: ScoredListing; allInCents: number }
  | { kind: "reject"; reason: AutoBuyRejectReason; row: ScoredListing; allInCents: number | null };

export type AutoBuyRejectReason =
  | "disabled"
  | "marketplace-not-supported"
  | "marketplace-not-in-rule"
  | "no-appraisal"
  | "no-spread"
  | "spread-too-low"
  | "no-price"
  | "all-in-too-high"
  | "verdict-not-in-rule"
  | "condition-not-in-rule"
  | "cooldown"
  | "daily-cap-reached"
  | "monthly-cap-reached";

export type AutoBuyLedger = {
  /** Listing ids that have already been purchased, with the purchase timestamp in epoch ms. */
  recentListingIds: Map<string, number>;
  /** Total spend so far today (cents). */
  spentTodayCents: number;
  /** Total spend so far this month (cents). */
  spentThisMonthCents: number;
  /** Optional day reset boundary (epoch ms). Defaults to "today" at 00:00 local. */
  dayBoundaryMs?: number;
  /** Optional month reset boundary (epoch ms). Defaults to "this month" at 00:00 local on the 1st. */
  monthBoundaryMs?: number;
};

/** Pure decision — no IO.  Caller passes the ledger so the test suite can drive it. */
export function evaluateAutoBuy(
  rule: AlertRule,
  row: ScoredListing,
  now: number,
  ledger: AutoBuyLedger,
): AutoBuyDecision {
  const cfg = rule.autoBuy;
  const allInCents = allInCentsOf(row);
  if (!cfg.enabled) return reject(row, allInCents, "disabled");
  if (cfg.marketplace !== "ebay") return reject(row, allInCents, "marketplace-not-supported");
  if (!rule.marketplaces.includes("ebay")) return reject(row, allInCents, "marketplace-not-in-rule");
  if (!rule.marketplaces.includes(row.listing.marketplace))
    return reject(row, allInCents, "marketplace-not-in-rule");

  if (!row.appraisal) return reject(row, allInCents, "no-appraisal");

  const verdict = row.appraisal.verdict;
  if (rule.verdicts.length && (verdict == null || !rule.verdicts.includes(verdict)))
    return reject(row, allInCents, "verdict-not-in-rule");
  if (rule.condition === "raw" && row.parsed.grade !== "raw")
    return reject(row, allInCents, "condition-not-in-rule");
  if (rule.condition === "graded" && row.parsed.grade === "raw")
    return reject(row, allInCents, "condition-not-in-rule");

  const spread = row.appraisal.spread;
  if (spread == null) return reject(row, allInCents, "no-spread");
  if (spread < cfg.minSpread) return reject(row, allInCents, "spread-too-low");

  if (allInCents == null) return reject(row, allInCents, "no-price");
  if (allInCents > cfg.maxPriceCents) return reject(row, allInCents, "all-in-too-high");

  const dayBoundary = ledger.dayBoundaryMs ?? defaultDayBoundary(now);
  const monthBoundary = ledger.monthBoundaryMs ?? defaultMonthBoundary(now);
  void dayBoundary; // boundaries are not used in the decision yet but documented for future cap rollups
  void monthBoundary;
  if (ledger.spentTodayCents + allInCents > cfg.maxDailyCents)
    return reject(row, allInCents, "daily-cap-reached");
  if (ledger.spentThisMonthCents + allInCents > cfg.maxMonthlyCents)
    return reject(row, allInCents, "monthly-cap-reached");

  const recentAt = ledger.recentListingIds.get(row.listing.id);
  if (recentAt && now - recentAt < cfg.coolHours * 3_600_000)
    return reject(row, allInCents, "cooldown");

  return { kind: "accept", reason: "ok", row, allInCents };
}

/** Mutates the ledger with an accepted decision so back-to-back evals stay honest. */
export function applyAutoBuy(decision: AutoBuyDecision, ledger: AutoBuyLedger, now: number): void {
  if (decision.kind !== "accept") return;
  ledger.recentListingIds.set(decision.row.listing.id, now);
  ledger.spentTodayCents += decision.allInCents;
  ledger.spentThisMonthCents += decision.allInCents;
}

/** Convenience: run the decision loop over a scored set and return accepted rows. */
export function previewAutoBuy(
  rule: AlertRule,
  rows: ScoredListing[],
  now: number,
  ledger: AutoBuyLedger = {
    recentListingIds: new Map(),
    spentTodayCents: 0,
    spentThisMonthCents: 0,
  },
): { accepted: ScoredListing[]; rejected: Array<{ row: ScoredListing; reason: AutoBuyRejectReason; allInCents: number | null }> } {
  const accepted: ScoredListing[] = [];
  const rejected: Array<{ row: ScoredListing; reason: AutoBuyRejectReason; allInCents: number | null }> = [];
  for (const row of rows) {
    const d = evaluateAutoBuy(rule, row, now, ledger);
    if (d.kind === "accept") {
      accepted.push(row);
      applyAutoBuy(d, ledger, now);
    } else {
      rejected.push({ row: d.row, reason: d.reason, allInCents: d.allInCents });
    }
  }
  return { accepted, rejected };
}

function reject(row: ScoredListing, allInCents: number | null, reason: AutoBuyRejectReason): AutoBuyDecision {
  return { kind: "reject", reason, row, allInCents };
}

function allInCentsOf(row: ScoredListing): number | null {
  const price = row.listing.price;
  if (price == null) return null;
  return Math.round((price + row.listing.shipping) * 100);
}

function defaultDayBoundary(now: number): number {
  const d = new Date(now);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

function defaultMonthBoundary(now: number): number {
  const d = new Date(now);
  d.setDate(1);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

/**
 * Today / month reset helpers — exported so the server can hydrate the ledger
 * from the auto-buy orders table without re-deriving math.
 */
export function dayBoundary(now: number): number {
  return defaultDayBoundary(now);
}
export function monthBoundary(now: number): number {
  return defaultMonthBoundary(now);
}
export const AUTO_BUY_COOL_HOURS_MIN = 0;
export const AUTO_BUY_COOL_HOURS_MAX = 24 * 30;
export const AUTO_BUY_PRICE_CENTS_MIN = 100;
export const AUTO_BUY_PRICE_CENTS_MAX = 1_000_000;

/** Clamp a user-supplied AutoBuyConfig to safe ranges. */
export function clampAutoBuy(input: Partial<AutoBuyConfig>): AutoBuyConfig {
  const cfg = input ?? {};
  return {
    enabled: Boolean(cfg.enabled),
    dryRun: cfg.dryRun !== false,
    maxPriceCents: clampInt(cfg.maxPriceCents, 100, 1_000_000, 5000),
    minSpread: clampNum(cfg.minSpread, 0, 1, 0.18),
    maxMonthlyCents: clampInt(cfg.maxMonthlyCents, 0, 10_000_000, 50000),
    maxDailyCents: clampInt(cfg.maxDailyCents, 0, 1_000_000, 10000),
    coolHours: clampInt(cfg.coolHours, 0, 24 * 30, 24),
    marketplace: "ebay",
  };
}

function clampInt(value: unknown, min: number, max: number, fallback: number): number {
  const n = Math.round(Number(value));
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, n));
}
function clampNum(value: unknown, min: number, max: number, fallback: number): number {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, n));
}