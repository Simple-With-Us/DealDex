/**
 * Server-side store for `alert_rules`, `scan_runs`, and `alert_runs`.
 *
 * Today alerts live in localStorage / DeskStore on iOS / Android, so the
 * scan-runner cannot read them.  The first opt-in user journey:
 *   1. Web /alerts UI pushes the rule config to `alert_rules`.
 *   2. Scan-runner reads `alert_rules`, runs Market.scan, persists a
 *      `scan_runs` row, returns accepted/rejected counts.
 *   3. Auto-buy ledger (per rule) is recomputed from the scan_runs rows
 *      so spentTodayCents / spentThisMonthCents stay honest across runs.
 *
 * Every query is parameterized through `getSql()` so the Neon vs PGlite
 * backend switch (see src/lib/db.ts) is a no-op.
 */
import { getSql } from "@/lib/db";

export type AlertRuleRow = {
  user_id: string;
  id: string;
  enabled: boolean;
  name: string;
  keyword: string;
  marketplaces: string[];
  verdicts: string[];
  min_spread: number | null;
  max_price: number | null;
  condition: string;
  channels: Record<string, boolean>;
  email: string;
  phone: string;
  pushover_user: string;
  pushover_token: string;
  auto_buy: Record<string, unknown> | null;
};

export type AlertRunRow = {
  id: string;
  source: string;
  rules_ran: number;
  rules_skipped: number;
  dry_run_only: boolean;
  per_rule: unknown;
  started_at: string;
  finished_at: string;
  error: string | null;
};

export type ScanRunRow = {
  user_id: string;
  id: string;
  rule_id: string;
  query: string;
  marketplaces: string[];
  row_count: number;
  accepted_count: number;
  rejected_count: number;
  total_cents: number;
  dry_run: boolean;
  auto_buy_enabled: boolean;
  started_at: string;
  finished_at: string;
  error: string | null;
};

export async function loadAlertRules(): Promise<AlertRuleRow[]> {
  const sql = await getSql();
  return sql<AlertRuleRow>`select * from alert_rules where enabled = true`;
}

export async function upsertAlertRule(row: AlertRuleRow): Promise<void> {
  const sql = await getSql();
  await sql`
    insert into alert_rules (
      user_id, id, enabled, name, keyword, marketplaces, verdicts,
      min_spread, max_price, condition, channels, email, phone,
      pushover_user, pushover_token, auto_buy
    ) values (
      ${row.user_id}, ${row.id}, ${row.enabled}, ${row.name}, ${row.keyword},
      ${row.marketplaces}, ${row.verdicts}, ${row.min_spread}, ${row.max_price},
      ${row.condition}, ${JSON.stringify(row.channels)}, ${row.email},
      ${row.phone}, ${row.pushover_user}, ${row.pushover_token},
      ${JSON.stringify(row.auto_buy ?? {})}
    )
    on conflict (user_id, id) do update set
      enabled = excluded.enabled,
      name = excluded.name,
      keyword = excluded.keyword,
      marketplaces = excluded.marketplaces,
      verdicts = excluded.verdicts,
      min_spread = excluded.min_spread,
      max_price = excluded.max_price,
      condition = excluded.condition,
      channels = excluded.channels,
      email = excluded.email,
      phone = excluded.phone,
      pushover_user = excluded.pushover_user,
      pushover_token = excluded.pushover_token,
      auto_buy = excluded.auto_buy,
      updated_at = now()
  `;
}

export async function deleteAlertRule(userId: string, id: string): Promise<void> {
  const sql = await getSql();
  await sql`delete from alert_rules where user_id = ${userId} and id = ${id}`;
}

export async function persistScanRun(row: ScanRunRow): Promise<void> {
  const sql = await getSql();
  await sql`
    insert into scan_runs (
      user_id, id, rule_id, query, marketplaces,
      row_count, accepted_count, rejected_count, total_cents,
      dry_run, auto_buy_enabled, started_at, finished_at, error
    ) values (
      ${row.user_id}, ${row.id}, ${row.rule_id}, ${row.query}, ${row.marketplaces},
      ${row.row_count}, ${row.accepted_count}, ${row.rejected_count}, ${row.total_cents},
      ${row.dry_run}, ${row.auto_buy_enabled}, ${row.started_at}, ${row.finished_at},
      ${row.error}
    )
    on conflict (user_id, id) do update set
      row_count = excluded.row_count,
      accepted_count = excluded.accepted_count,
      rejected_count = excluded.rejected_count,
      total_cents = excluded.total_cents,
      dry_run = excluded.dry_run,
      auto_buy_enabled = excluded.auto_buy_enabled,
      finished_at = excluded.finished_at,
      error = excluded.error
  `;
}

export async function listScanRunsSince(
  userId: string,
  ruleId: string,
  sinceMs: number,
): Promise<ScanRunRow[]> {
  const sql = await getSql();
  if (sinceMs > 0) {
    const cutoff = new Date(sinceMs).toISOString();
    return sql<ScanRunRow>`
      select * from scan_runs
      where user_id = ${userId} and rule_id = ${ruleId}
        and started_at >= ${cutoff}
      order by started_at desc
    `;
  }
  return sql<ScanRunRow>`
    select * from scan_runs
    where user_id = ${userId} and rule_id = ${ruleId}
    order by started_at desc
    limit 5
  `;
}

export async function listRecentScanRuns(userId: string, limit = 20): Promise<ScanRunRow[]> {
  const sql = await getSql();
  return sql<ScanRunRow>`
    select * from scan_runs where user_id = ${userId}
    order by started_at desc
    limit ${limit}
  `;
}

export async function persistAlertRun(row: AlertRunRow): Promise<void> {
  const sql = await getSql();
  await sql`
    insert into alert_runs (
      id, source, rules_ran, rules_skipped, dry_run_only,
      per_rule, started_at, finished_at, error
    ) values (
      ${row.id}, ${row.source}, ${row.rules_ran}, ${row.rules_skipped},
      ${row.dry_run_only}, ${JSON.stringify(row.per_rule)}, ${row.started_at},
      ${row.finished_at}, ${row.error}
    )
    on conflict (id) do update set
      rules_ran = excluded.rules_ran,
      rules_skipped = excluded.rules_skipped,
      dry_run_only = excluded.dry_run_only,
      per_rule = excluded.per_rule,
      finished_at = excluded.finished_at,
      error = excluded.error
  `;
}

export async function listRecentAlertRuns(limit = 20): Promise<AlertRunRow[]> {
  const sql = await getSql();
  return sql<AlertRunRow>`
    select * from alert_runs
    order by started_at desc
    limit ${limit}
  `;
}