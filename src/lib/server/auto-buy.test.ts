import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { ScoredListing } from "@/lib/marketplaces/types";
import type { Appraisal, ParsedListing, Verdict } from "@/lib/tcg/types";
import type { AlertRule, AutoBuyConfig } from "@/lib/alerts/types";
import {
  AUTO_BUY_COOL_HOURS_MAX,
  AUTO_BUY_PRICE_CENTS_MIN,
  applyAutoBuy,
  clampAutoBuy,
  evaluateAutoBuy,
  previewAutoBuy,
} from "./auto-buy";

function rule(overrides: Partial<AlertRule["autoBuy"]> = {}, rest: Partial<AlertRule> = {}): AlertRule {
  return {
    id: "rule-1",
    enabled: true,
    name: "Steals",
    keyword: "",
    marketplaces: ["ebay"],
    verdicts: ["steal", "good"],
    minSpread: 0.1,
    maxPrice: null,
    condition: "any",
    channels: { native: true, email: false, sms: false, pushover: false },
    email: "",
    phone: "",
    pushoverUser: "",
    pushoverToken: "",
    autoBuy: {
      enabled: true,
      dryRun: true,
      maxPriceCents: 5000,
      minSpread: 0.18,
      maxMonthlyCents: 50000,
      maxDailyCents: 10000,
      coolHours: 24,
      marketplace: "ebay",
      ...overrides,
    },
    ...rest,
  };
}

function fullAppraisal(over: Partial<Appraisal> = {}): Appraisal {
  return {
    market: null,
    allIn: 25,
    spread: 0.25,
    dollarsOff: null,
    verdict: "steal",
    conditionMult: 1,
    gradeMult: 1,
    adjustedMarket: null,
    sellFeeRate: 0.13,
    estimatedNetIfSold: null,
    flipProfit: null,
    finish: null,
    verifiedMarket: null,
    rangeLow: null,
    rangeHigh: null,
    confidence: "high",
    sourcesUsed: 1,
    conflict: false,
    verifyNote: null,
    conflictDetail: null,
    ...over,
  };
}

function fullParsed(over: Partial<ParsedListing> = {}): ParsedListing {
  return {
    raw: "charizard",
    title: "Charizard PSA 10",
    url: "https://www.ebay.com/itm/1",
    marketplace: "ebay",
    price: 25,
    shipping: 0,
    condition: "NM",
    grade: "raw",
    finishHint: null,
    collectorNumber: null,
    setHint: null,
    nameQuery: "charizard",
    ...over,
  };
}

function row(over: { listing?: Partial<ScoredListing["listing"]>; appraisal?: Partial<Appraisal> | null; parsed?: Partial<ParsedListing>; } = {}): ScoredListing {
  const listing = {
    id: "v1|1|0",
    marketplace: "ebay" as const,
    title: "Charizard PSA 10",
    url: "https://www.ebay.com/itm/1",
    price: 25,
    shipping: 0,
    image: null,
    listedAt: null,
    ...over.listing,
  };
  const appraisal = over.appraisal === null ? null : fullAppraisal(over.appraisal ?? {});
  const parsed = fullParsed(over.parsed ?? {});
  return { listing, appraisal, parsed, card: null };
}

const NOW = Date.UTC(2026, 8, 20, 12, 0, 0); // 2026-09-20T12:00:00Z

function ledger(spentToday = 0, spentMonth = 0, recent = new Map<string, number>()) {
  return { recentListingIds: recent, spentTodayCents: spentToday, spentThisMonthCents: spentMonth };
}

describe("evaluateAutoBuy", () => {
  it("rejects when auto-buy is disabled", () => {
    const r = rule({ enabled: false });
    const d = evaluateAutoBuy(r, row(), NOW, ledger());
    assert.equal(d.kind, "reject");
    if (d.kind === "reject") assert.equal(d.reason, "disabled");
  });

  it("rejects when marketplace is not in the rule", () => {
    const r = rule({}, { marketplaces: ["mercari"] });
    const d = evaluateAutoBuy(r, row(), NOW, ledger());
    assert.equal(d.kind, "reject");
    if (d.kind === "reject") assert.equal(d.reason, "marketplace-not-in-rule");
  });

  it("accepts when all checks pass and returns cents", () => {
    const r = rule();
    const d = evaluateAutoBuy(r, row(), NOW, ledger());
    assert.equal(d.kind, "accept");
    if (d.kind === "accept") assert.equal(d.allInCents, 2500);
  });

  it("rejects when spread is below the cap", () => {
    const r = rule({ minSpread: 0.5 });
    const d = evaluateAutoBuy(r, row({ appraisal: { spread: 0.3 } }), NOW, ledger());
    assert.equal(d.kind, "reject");
    if (d.kind === "reject") assert.equal(d.reason, "spread-too-low");
  });

  it("rejects when no appraisal or no spread", () => {
    const r = rule();
    const noAppraisal = evaluateAutoBuy(r, row({ appraisal: null }), NOW, ledger());
    assert.equal(noAppraisal.kind, "reject");
    if (noAppraisal.kind === "reject") assert.equal(noAppraisal.reason, "no-appraisal");

    const noSpread = evaluateAutoBuy(r, row({ appraisal: { spread: null } }), NOW, ledger());
    assert.equal(noSpread.kind, "reject");
    if (noSpread.kind === "reject") assert.equal(noSpread.reason, "no-spread");
  });

  it("rejects when all-in (price + shipping) is above the cap", () => {
    const r = rule({ maxPriceCents: 2000 });
    const d = evaluateAutoBuy(r, row({ listing: { price: 30, shipping: 0 } }), NOW, ledger());
    assert.equal(d.kind, "reject");
    if (d.kind === "reject") assert.equal(d.reason, "all-in-too-high");
  });

  it("rejects when listing id is on cooldown", () => {
    const r = rule({ coolHours: 12 });
    const recent = new Map([["v1|1|0", NOW - 3_600_000]]);
    const d = evaluateAutoBuy(r, row(), NOW, { ...ledger(), recentListingIds: recent });
    assert.equal(d.kind, "reject");
    if (d.kind === "reject") assert.equal(d.reason, "cooldown");
  });

  it("rejects when daily cap would be exceeded", () => {
    const r = rule({ maxPriceCents: 5000, maxDailyCents: 3000 });
    const d = evaluateAutoBuy(r, row(), NOW, ledger(2800));
    assert.equal(d.kind, "reject");
    if (d.kind === "reject") assert.equal(d.reason, "daily-cap-reached");
  });

  it("rejects when monthly cap would be exceeded", () => {
    const r = rule({ maxPriceCents: 5000, maxMonthlyCents: 3000 });
    const d = evaluateAutoBuy(r, row(), NOW, ledger(0, 4800));
    assert.equal(d.kind, "reject");
    if (d.kind === "reject") assert.equal(d.reason, "monthly-cap-reached");
  });

  it("rejects verdict outside the rule's allowed list", () => {
    const r = rule({}, { verdicts: ["steal"] as Verdict[] });
    const d = evaluateAutoBuy(r, row({ appraisal: { verdict: "good" } }), NOW, ledger());
    assert.equal(d.kind, "reject");
    if (d.kind === "reject") assert.equal(d.reason, "verdict-not-in-rule");
  });

  it("rejects condition mismatch", () => {
    const rawRule = rule({}, { condition: "raw" });
    const d = evaluateAutoBuy(rawRule, row({ parsed: { grade: "PSA 10" } }), NOW, ledger());
    assert.equal(d.kind, "reject");
    if (d.kind === "reject") assert.equal(d.reason, "condition-not-in-rule");

    const gradedRule = rule({}, { condition: "graded" });
    const d2 = evaluateAutoBuy(gradedRule, row(), NOW, ledger());
    assert.equal(d2.kind, "reject");
    if (d2.kind === "reject") assert.equal(d2.reason, "condition-not-in-rule");
  });

  it("rejects when price is missing", () => {
    const r = rule();
    const d = evaluateAutoBuy(r, row({ listing: { price: null } }), NOW, ledger());
    assert.equal(d.kind, "reject");
    if (d.kind === "reject") assert.equal(d.reason, "no-price");
  });
});

describe("applyAutoBuy", () => {
  it("mutates the ledger with accepted totals and recent id", () => {
    const led = ledger();
    const d = evaluateAutoBuy(rule(), row(), NOW, led);
    assert.equal(d.kind, "accept");
    if (d.kind === "accept") applyAutoBuy(d, led, NOW);
    assert.equal(led.spentTodayCents, 2500);
    assert.equal(led.spentThisMonthCents, 2500);
    assert.equal(led.recentListingIds.get("v1|1|0"), NOW);
  });

  it("is a no-op for rejected decisions", () => {
    const led = ledger();
    const d = evaluateAutoBuy(rule({ enabled: false }), row(), NOW, led);
    assert.equal(d.kind, "reject");
    if (d.kind === "reject") applyAutoBuy(d, led, NOW);
    assert.equal(led.spentTodayCents, 0);
    assert.equal(led.spentThisMonthCents, 0);
    assert.equal(led.recentListingIds.size, 0);
  });
});

describe("previewAutoBuy", () => {
  it("filters rows in deterministic cap order, then stops at the daily cap", () => {
    const r = rule({ maxDailyCents: 8000, maxPriceCents: 5000 });
    const rows: ScoredListing[] = [
      row({ listing: { id: "a", price: 30, shipping: 0 } }),
      row({ listing: { id: "b", price: 35, shipping: 0 } }),
      row({ listing: { id: "c", price: 40, shipping: 0 } }),
    ];
    const { accepted, rejected } = previewAutoBuy(r, rows, NOW);
    // All-in cents: a=3000, b=3500, c=4000.  Daily cap=8000 -> a+b accepted, c rejected.
    assert.equal(accepted.length, 2);
    assert.equal(accepted[0]!.listing.id, "a");
    assert.equal(accepted[1]!.listing.id, "b");
    assert.equal(rejected.length, 1);
    assert.equal(rejected[0]!.reason, "daily-cap-reached");
    assert.equal(rejected[0]!.row.listing.id, "c");
  });

  it("treats dryRun=true as still-allowed (the order call is gated elsewhere)", () => {
    const r = rule({ dryRun: true });
    const { accepted } = previewAutoBuy(r, [row()], NOW);
    assert.equal(accepted.length, 1);
  });
});

describe("clampAutoBuy", () => {
  it("clamps price and cool hours to the safe ranges", () => {
    const cfg = clampAutoBuy({
      maxPriceCents: -100,
      coolHours: 1_000_000,
      minSpread: 2,
      maxDailyCents: 999_999_999,
      maxMonthlyCents: -1,
      enabled: true,
      dryRun: false,
    });
    assert.equal(cfg.maxPriceCents, AUTO_BUY_PRICE_CENTS_MIN);
    assert.equal(cfg.coolHours, AUTO_BUY_COOL_HOURS_MAX);
    assert.equal(cfg.minSpread, 1);
    assert.equal(cfg.maxDailyCents, 1_000_000);
    assert.equal(cfg.maxMonthlyCents, 0);
    assert.equal(cfg.enabled, true);
    assert.equal(cfg.dryRun, false);
    assert.equal(cfg.marketplace, "ebay");
  });

  it("treats any non-`false` dryRun value as the safe dry-run default", () => {
    assert.equal(clampAutoBuy({ dryRun: undefined }).dryRun, true);
    assert.equal(clampAutoBuy({ dryRun: 0 as unknown as boolean }).dryRun, true);
    assert.equal(clampAutoBuy({ dryRun: null as unknown as boolean }).dryRun, true);
    assert.equal(clampAutoBuy({ dryRun: false }).dryRun, false);
  });

  it("passes valid input through with safe defaults filled in", () => {
    const cfg = clampAutoBuy({} satisfies Partial<AutoBuyConfig>);
    assert.equal(cfg.coolHours, 24);
    assert.equal(cfg.maxPriceCents, 5000);
    assert.equal(cfg.dryRun, true);
    assert.equal(cfg.marketplace, "ebay");
  });
});