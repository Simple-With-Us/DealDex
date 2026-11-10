import type { Verdict } from "@/lib/tcg/types";
import type { ScanSource } from "@/lib/marketplaces/types";

export const ALERT_CHANNELS = ["native", "email", "sms", "pushover"] as const;
export type AlertChannel = (typeof ALERT_CHANNELS)[number];

/**
 * Auto-buy fields on a saved filter.
 *
 * The user opt-in happens here.  The actual Buy It Now call is made
 * server-side (PR #2 of this initiative, behind a separate deploy) once
 * an order API is granted.  Until then the preview endpoint returns the
 * same rows the order would buy, dry-run by default.
 */
export type AutoBuyConfig = {
  enabled: boolean;
  dryRun: boolean;
  maxPriceCents: number;
  minSpread: number;
  maxMonthlyCents: number;
  maxDailyCents: number;
  coolHours: number;
  /** Marketplace to auto-buy on.  Today only eBay supports fixed-price order placement. */
  marketplace: "ebay";
};

export const DEFAULT_AUTO_BUY: AutoBuyConfig = {
  enabled: false,
  dryRun: true,
  maxPriceCents: 5000,
  minSpread: 0.18,
  maxMonthlyCents: 50000,
  maxDailyCents: 10000,
  coolHours: 24,
  marketplace: "ebay",
};

export type AlertRule = {
  id: string;
  enabled: boolean;
  name: string;
  keyword: string;
  marketplaces: ScanSource[];
  verdicts: Verdict[];
  minSpread: number | null;
  maxPrice: number | null;
  condition: "any" | "raw" | "graded";
  channels: Record<AlertChannel, boolean>;
  email: string;
  phone: string;
  pushoverUser: string;
  pushoverToken: string;
  autoBuy: AutoBuyConfig;
};

export type AlertHit = {
  id: string;
  at: number;
  ruleId: string;
  ruleName: string;
  title: string;
  url: string;
  price: number | null;
  spread: number | null;
  verdict: Verdict | null;
  marketplace: string;
  channels: AlertChannel[];
};

export function defaultRule(): AlertRule {
  return {
    id: crypto.randomUUID(),
    enabled: true,
    name: "Steals under $100",
    keyword: "",
    marketplaces: ["ebay", "mercari"],
    verdicts: ["steal", "good"],
    minSpread: 0.12,
    maxPrice: 100,
    condition: "any",
    channels: { native: true, email: false, sms: false, pushover: false },
    email: "",
    phone: "",
    pushoverUser: "",
    pushoverToken: "",
    autoBuy: { ...DEFAULT_AUTO_BUY },
  };
}
