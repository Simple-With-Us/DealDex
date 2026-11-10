-- Server-side scan_run records for the auto-buy scan runner.
--
-- The runner (PR #5) hits Market.scan on a per-rule cadence and persists
-- the rows that came back so the runner can dedupe against the prior
-- results, the audit UI can replay a decision, and the auto-buy ledger
-- can compute spentTodayCents / spentThisMonthCents without re-reading
-- the marketplace.
--
-- PK is (user_id, id) — same pattern as `alert_rules`.  row_count stays
-- cheap; auto_buy_decisions is a small JSON blob so the audit trail is
-- in one row.
create table if not exists scan_runs (
  user_id          text         not null,
  id               text         not null,
  rule_id          text         not null,
  query            text         not null,
  marketplaces     text[]       not null,
  row_count        integer      not null default 0,
  accepted_count   integer      not null default 0,
  rejected_count   integer      not null default 0,
  total_cents      integer      not null default 0,
  dry_run          boolean      not null default true,
  auto_buy_enabled boolean      not null default false,
  started_at       timestamptz  not null default now(),
  finished_at      timestamptz  not null default now(),
  error            text,
  primary key (user_id, id)
);

create index if not exists scan_runs_user_rule_idx
  on scan_runs (user_id, rule_id, started_at desc);
create index if not exists scan_runs_user_started_idx
  on scan_runs (user_id, started_at desc);