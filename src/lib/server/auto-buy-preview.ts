/**
 * Server-side auto-buy preview endpoint.
 *
 * Phase 1 (this PR): a dry-run preview that takes the rule config + the
 * already-appraised scan rows from the client, applies the same logic the
 * runner will use, and returns the accept / reject breakdown so the UI
 * can render an auditable decision per row.
 *
 * Phase 2 (next PR): the actual Buy It Now call goes here too, gated by
 * the same `dryRun` flag the user sees.
 */
import { createServerFn } from "@tanstack/react-start";
import { authMiddleware } from "@/lib/auth/middleware";
import { ALERT_CHANNELS, DEFAULT_AUTO_BUY, type AlertChannel, type AlertRule, type AutoBuyConfig } from "@/lib/alerts/types";
import { CONDITIONS, GRADES, MARKETPLACES, VERDICTS, type Condition, type Grade, type Marketplace, type Verdict } from "@/lib/tcg/types";
import type { Appraisal, ParsedListing } from "@/lib/tcg/types";
import type { ScanSource, ScoredListing } from "@/lib/marketplaces/types";
import { previewAutoBuy } from "./auto-buy";
import { parseListingBlob } from "@/lib/tcg/parse-listing";

const MAX_ROWS = 50;

type PreviewInput = {
  rule: Partial<AlertRule>;
  rows: Array<{
    listing: {
      id: string;
      marketplace: string;
      title: string;
      url: string;
      price: number | null;
      shipping: number;
      image?: string | null;
      listedAt?: string | null;
    };
    appraisal: Appraisal | null;
    parsed: ParsedListing;
  }>;
};

export type AutoBuyPreviewOutput = {
  accepted: Array<{ id: string; title: string; url: string; price: number; allInCents: number }>;
  rejected: Array<{
    id: string;
    title: string;
    reason: string;
    allInCents: number | null;
  }>;
  totals: {
    scannedRows: number;
    accepted: number;
    rejected: number;
    allInCentsAccepted: number;
  };
  rule: { autoBuy: AutoBuyConfig; enabled: boolean; marketplaces: AlertRule["marketplaces"] };
};

function asString(v: unknown, max: number): string {
  return typeof v === "string" ? v.trim().slice(0, max) : "";
}
function asNumber(v: unknown): number | null {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string" && v.trim() !== "") {
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}
function asBool(v: unknown): boolean {
  return v === true;
}

function cleanAutoBuy(v: unknown): AutoBuyConfig {
  if (!v || typeof v !== "object") return { ...DEFAULT_AUTO_BUY };
  const r = v as Record<string, unknown>;
  return {
    enabled: asBool(r.enabled),
    dryRun: r.dryRun !== false,
    maxPriceCents: Math.max(0, Math.round(Number(r.maxPriceCents ?? DEFAULT_AUTO_BUY.maxPriceCents))),
    minSpread: Math.max(0, Number(r.minSpread ?? DEFAULT_AUTO_BUY.minSpread)),
    maxMonthlyCents: Math.max(0, Math.round(Number(r.maxMonthlyCents ?? DEFAULT_AUTO_BUY.maxMonthlyCents))),
    maxDailyCents: Math.max(0, Math.round(Number(r.maxDailyCents ?? DEFAULT_AUTO_BUY.maxDailyCents))),
    coolHours: Math.max(0, Math.round(Number(r.coolHours ?? DEFAULT_AUTO_BUY.coolHours))),
    marketplace: "ebay",
  };
}

function cleanChannels(v: unknown): Record<AlertChannel, boolean> {
  const raw = (v ?? {}) as Record<string, unknown>;
  const out = {} as Record<AlertChannel, boolean>;
  for (const c of ALERT_CHANNELS) out[c] = asBool(raw[c]);
  return out;
}

function oneOf<T extends string>(v: unknown, allowed: readonly T[], fallback: T): T {
  return typeof v === "string" && (allowed as readonly string[]).includes(v) ? (v as T) : fallback;
}

function cleanVerdicts(v: unknown): Verdict[] {
  if (!Array.isArray(v)) return [];
  return v.filter((x): x is Verdict => typeof x === "string" && (VERDICTS as readonly string[]).includes(x));
}

function cleanMarketplaces(v: unknown): AlertRule["marketplaces"] {
  if (!Array.isArray(v)) return ["ebay"];
  return v.filter((m): m is ScanSource => m === "ebay" || m === "mercari") as AlertRule["marketplaces"];
}

function cleanRule(raw: unknown): AlertRule {
  const v = (raw ?? {}) as Record<string, unknown>;
  return {
    id: asString(v.id, 80) || "preview",
    enabled: v.enabled !== false,
    name: asString(v.name, 120) || "Preview",
    keyword: asString(v.keyword, 200),
    marketplaces: cleanMarketplaces(v.marketplaces),
    verdicts: cleanVerdicts(v.verdicts),
    minSpread: asNumber(v.minSpread),
    maxPrice: asNumber(v.maxPrice),
    condition: oneOf(v.condition, ["any", "raw", "graded"], "any"),
    channels: cleanChannels(v.channels),
    email: asString(v.email, 200),
    phone: asString(v.phone, 40),
    pushoverUser: asString(v.pushoverUser, 80),
    pushoverToken: asString(v.pushoverToken, 80),
    autoBuy: cleanAutoBuy(v.autoBuy),
  };
}

function cleanRows(input: unknown): ScoredListing[] {
  if (!Array.isArray(input)) return [];
  return input.slice(0, MAX_ROWS).map((row: unknown) => {
    const r = (row ?? {}) as Record<string, unknown>;
    const l = (r.listing ?? {}) as Record<string, unknown>;
    const marketplace = oneOf<Marketplace>(l.marketplace, MARKETPLACES, "other");
    const scanMarketplace: ScanSource =
      marketplace === "ebay" || marketplace === "mercari" ? marketplace : "mercari";
    const listing = {
      id: asString(l.id, 80) || `row-${Math.random().toString(36).slice(2, 10)}`,
      marketplace: scanMarketplace,
      title: asString(l.title, 240),
      url: asString(l.url, 500) || "",
      price: asNumber(l.price),
      shipping: asNumber(l.shipping) ?? 0,
      image: typeof l.image === "string" ? l.image : null,
      listedAt: typeof l.listedAt === "string" ? l.listedAt : null,
    };
    const appraisal = (r.appraisal ?? null) as Appraisal | null;
    const parsedIn = r.parsed as Record<string, unknown> | undefined;
    const parsed: ParsedListing = parsedIn
      ? {
          raw: asString(parsedIn.raw, 1000) || listing.title,
          title: asString(parsedIn.title, 240) || listing.title,
          url: asString(parsedIn.url, 500) || listing.url,
          marketplace: oneOf<Marketplace>(parsedIn.marketplace, MARKETPLACES, marketplace),
          price: asNumber(parsedIn.price) ?? listing.price ?? null,
          shipping: asNumber(parsedIn.shipping) ?? listing.shipping,
          condition: oneOf<Condition>(parsedIn.condition, CONDITIONS, "NM"),
          grade: oneOf<Grade>(parsedIn.grade, GRADES, "raw"),
          finishHint: typeof parsedIn.finishHint === "string" ? parsedIn.finishHint : null,
          collectorNumber: typeof parsedIn.collectorNumber === "string" ? parsedIn.collectorNumber : null,
          setHint: typeof parsedIn.setHint === "string" ? parsedIn.setHint : null,
          nameQuery: asString(parsedIn.nameQuery, 120) || listing.title,
        }
      : parseListingBlob(`${marketplace} ${listing.title} ${listing.price != null ? `$${listing.price}` : ""}`);
    return { listing, appraisal, parsed, card: null };
  });
}

export const previewAutoBuyServer = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: PreviewInput) => ({
    rule: cleanRule(input?.rule),
    rows: cleanRows(input?.rows),
  }))
  .handler(async ({ data }): Promise<AutoBuyPreviewOutput> => {
    const now = Date.now();
    const { accepted, rejected } = previewAutoBuy(data.rule, data.rows, now);
    return {
      accepted: accepted.map((row) => ({
        id: row.listing.id,
        title: row.listing.title,
        url: row.listing.url,
        price: row.listing.price ?? 0,
        allInCents: Math.round(((row.listing.price ?? 0) + row.listing.shipping) * 100),
      })),
      rejected: rejected.map(({ row, reason, allInCents }) => ({
        id: row.listing.id,
        title: row.listing.title,
        reason,
        allInCents,
      })),
      totals: {
        scannedRows: data.rows.length,
        accepted: accepted.length,
        rejected: rejected.length,
        allInCentsAccepted: accepted.reduce(
          (sum, row) => sum + Math.round(((row.listing.price ?? 0) + row.listing.shipping) * 100),
          0,
        ),
      },
      rule: {
        autoBuy: data.rule.autoBuy,
        enabled: data.rule.enabled,
        marketplaces: data.rule.marketplaces,
      },
    };
  });