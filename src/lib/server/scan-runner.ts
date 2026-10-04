/**
 * Server-side scan runner.
 *
 * Owner direction 2026-09-20: the user wants auto-buy to fire before
 * someone else snags the steal, and the user can't have the app open
 * 24/7.  The runner is a thin server-side cron over Market.scan +
 * auto-buy that fires once per enabled rule.
 *
 * Today (PR #5): the runner reads alert_rules from the server-side
 * table, runs Market.scan, persists a scan_runs row, and runs the
 * auto-buy decision engine in DRY-RUN mode (no orders).  Flipping
 * dry-run off requires an explicit user confirmation AND an eBay
 * order-write scope to be granted to the Browse app.
 *
 * Cadence: the .github/workflows/scan-runner.yml workflow hits the
 * endpoint once per minute; the endpoint itself decides which rules to
 * run this tick based on the rule's `coolHours` and the last scan_run
 * row.
 */
import { createServerFn } from "@tanstack/react-start";
import { authMiddleware } from "@/lib/auth/middleware";
import { scanAndScore } from "@/lib/marketplaces/scan";
import { type AlertRule, type AutoBuyConfig } from "@/lib/alerts/types";
import { listingMatchesRule } from "@/lib/alerts/match";
import type { ScanSource } from "@/lib/marketplaces/types";
import { evaluateAutoBuy } from "./auto-buy";
import { loadAlertRules, persistScanRun, listScanRunsSince, type AlertRuleRow } from "./alert-rules-store";
import { fetchWithPool } from "./proxy-pool";
import { loadRunUserCredentials } from "./user-settings-store";
import { fetchUserDeskKeys } from "./desk-keys";
import {
  getBooleanSetting,
  getNumberSetting,
  initAppSettings,
  serverAutoBuyDefaults,
} from "./app-settings";

/**
 * Max alert-rule rows evaluated per runner tick.  Tunable without a deploy
 * via the SCAN_MAX_ROWS_PER_RUN knob (Infisical).  Default 50.
 */
function maxRowsPerRun(): number {
  return getNumberSetting("SCAN_MAX_ROWS_PER_RUN", 50);
}

type RunnerInput = {
  /** When false, the runner only re-evaluates rows already on the scan_run record. */
  forceScan?: boolean;
  /** Optional cursor: only run rules whose last run is older than this. */
  cursorMs?: number;
};

export type ScanRunnerOutput = {
  ran: number;
  skipped: number;
  dryRunOnly: boolean;
  perRule: Array<{
    ruleId: string;
    accepted: number;
    rejected: number;
    totalCents: number;
    error?: string;
  }>;
};

function rowToAlertRule(row: AlertRuleRow): AlertRule {
  const marketplaces = row.marketplaces.filter(
    (m): m is "ebay" | "mercari" => m === "ebay" || m === "mercari",
  );
  const verdicts = row.verdicts.filter(
    (v): v is AlertRule["verdicts"][number] =>
      v === "steal" || v === "good" || v === "fair" || v === "pass",
  );
  const ab = row.auto_buy as Partial<AlertRule["autoBuy"]> | null;
  // Server-side rule defaults come from the Infisical-tunable knobs
  // (AUTO_BUY_DEFAULT_*); the client keeps its own DEFAULT_AUTO_BUY copy.
  const autoBuyDefaults: AutoBuyConfig = {
    enabled: false,
    dryRun: true,
    marketplace: "ebay",
    ...serverAutoBuyDefaults(),
  };
  return {
    id: row.id,
    enabled: row.enabled,
    name: row.name,
    keyword: row.keyword,
    marketplaces: marketplaces.length ? marketplaces : ["ebay"],
    verdicts,
    minSpread: row.min_spread,
    maxPrice: row.max_price,
    condition: row.condition === "raw" || row.condition === "graded" ? row.condition : "any",
    channels: {
      native: Boolean(row.channels.native),
      email: Boolean(row.channels.email),
      sms: Boolean(row.channels.sms),
      pushover: Boolean(row.channels.pushover),
    },
    email: row.email,
    phone: row.phone,
    pushoverUser: row.pushover_user,
    pushoverToken: row.pushover_token,
    autoBuy: ab ? { ...autoBuyDefaults, ...ab, marketplace: "ebay" } : { ...autoBuyDefaults },
  };
}

export const runScanRunner = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: RunnerInput = {}) => ({
    forceScan: Boolean(input.forceScan),
    cursorMs: typeof input.cursorMs === "number" ? input.cursorMs : 0,
  }))
  .handler(async ({ data }): Promise<ScanRunnerOutput> => {
    await initAppSettings();
    const rules = await loadAlertRules();
    const now = Date.now();
    const cursorMs = data.cursorMs || 0;
    const perRule: ScanRunnerOutput["perRule"] = [];
    let ran = 0;
    let skipped = 0;
    const dryRunOnly = true;

    for (const rawRule of rules) {
      const rule = rowToAlertRule(rawRule);
      if (!rule.enabled) {
        skipped += 1;
        continue;
      }
      if (!rule.autoBuy.enabled) {
        skipped += 1;
        continue;
      }
      const ruleStartedAt = Date.now();
      const lastRuns = await listScanRunsSince(rawRule.user_id, rule.id, cursorMs);
      if (!data.forceScan && lastRuns.length && ruleStartedAt - new Date(lastRuns[0]!.started_at).getTime() < rule.autoBuy.coolHours * 3_600_000) {
        skipped += 1;
        continue;
      }

      ran += 1;
      // Consult per-user credentials BEFORE flipping dry-run off.  The runner
      // stays in dry-run whenever the user has not connected their eBay
      // account, so an auto-buy rule with autoBuy.dryRun=false but no eBay
      // OAuth never silently places an order — it logs scan.runner.no_credentials
      // and stays safe.  Future work: load the eBay refresh token, refresh
      // the access token, and call the eBay Order API on `accepted` rows.
      const userCreds = await loadRunUserCredentials(rawRule.user_id, ruleStartedAt);
      // AUTO_BUY_DRY_RUN_FORCE is the global safety kill-switch (Infisical
      // knob): when true, every evaluation stays in dry-run no matter what
      // the rule config says.
      const isDryRun =
        getBooleanSetting("AUTO_BUY_DRY_RUN_FORCE", false) ||
        rule.autoBuy.dryRun ||
        !userCreds.has_ebay ||
        userCreds.ebay_oauth_expired;
      if (!userCreds.has_ebay) {
        console.warn(
          `[scan.runner.no_credentials] rule=${rule.id} user=${rawRule.user_id} reason=ebay_not_connected`,
        );
      } else if (userCreds.ebay_oauth_expired) {
        console.warn(
          `[scan.runner.no_credentials] rule=${rule.id} user=${rawRule.user_id} reason=ebay_token_expired`,
        );
      }

      try {
        const marketplaces: ScanSource[] = rule.marketplaces.filter(
          (m): m is ScanSource => m === "ebay" || m === "mercari",
        );
        const keys = await fetchUserDeskKeys(rawRule.user_id);
        const effectiveQuery = rule.keyword?.trim() || "pokemon";
        const scanResult = await scanAndScore(effectiveQuery, marketplaces, keys, {
          userProxyUrl: userCreds.proxy_url_override,
        });
        const scored = scanResult.rows;
        const ledger = {
          recentListingIds: new Map<string, number>(),
          spentTodayCents: 0,
          spentThisMonthCents: 0,
        };
        let accepted = 0;
        let rejected = 0;
        let totalCents = 0;
        const candidateRows = scored.filter((row) => row.listing.marketplace === rule.autoBuy.marketplace);
        for (const row of candidateRows.slice(0, maxRowsPerRun())) {
          if (!listingMatchesRule(row, rule)) {
            rejected += 1;
            continue;
          }
          const d = evaluateAutoBuy(rule, row, ruleStartedAt, ledger);
          if (d.kind === "accept") {
            accepted += 1;
            totalCents += d.allInCents;
            ledger.recentListingIds.set(row.listing.id, ruleStartedAt);
            ledger.spentTodayCents += d.allInCents;
            ledger.spentThisMonthCents += d.allInCents;
          } else {
            rejected += 1;
          }
        }
        const ruleFinishedAt = Date.now();
        const runError = scanResult.errors?.length ? scanResult.errors.join("; ") : null;
        await persistScanRun({
          user_id: rawRule.user_id,
          id: `run-${ruleStartedAt}-${rule.id}`,
          rule_id: rule.id,
          query: effectiveQuery,
          marketplaces: rule.marketplaces,
          row_count: scored.length,
          accepted_count: accepted,
          rejected_count: rejected,
          total_cents: totalCents,
          dry_run: isDryRun,
          auto_buy_enabled: rule.autoBuy.enabled,
          started_at: new Date(ruleStartedAt).toISOString(),
          finished_at: new Date(ruleFinishedAt).toISOString(),
          error: runError,
        });
        perRule.push({
          ruleId: rule.id,
          accepted,
          rejected,
          totalCents,
          error: runError ?? undefined,
        });
      } catch (err) {
        const ruleFinishedAt = Date.now();
        const errMsg = err instanceof Error ? err.message : "unknown";
        perRule.push({
          ruleId: rule.id,
          accepted: 0,
          rejected: 0,
          totalCents: 0,
          error: errMsg,
        });
        await persistScanRun({
          user_id: rawRule.user_id,
          id: `run-${ruleStartedAt}-${rule.id}`,
          rule_id: rule.id,
          query: rule.keyword,
          marketplaces: rule.marketplaces,
          row_count: 0,
          accepted_count: 0,
          rejected_count: 0,
          total_cents: 0,
          dry_run: rule.autoBuy.dryRun,
          auto_buy_enabled: rule.autoBuy.enabled,
          started_at: new Date(ruleStartedAt).toISOString(),
          finished_at: new Date(ruleFinishedAt).toISOString(),
          error: errMsg,
        }).catch(() => undefined);
      }
    }

    return { ran, skipped, dryRunOnly, perRule };
  });