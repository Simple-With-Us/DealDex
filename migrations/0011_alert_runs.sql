-- Manager-triggered scan-runner invocations (cron or manual POST /api/alerts/run).
--
-- `scan_runs` stores per-user, per-rule Market.scan outcomes.  `alert_runs`
-- stores one aggregate row per runner tick so ops can audit cadence, skipped
-- rules, and dry-run posture without joining every scan_runs row.
create table if not exists alert_runs (
  id               text         not null,
  source           text         not null default 'cron',
  rules_ran        integer      not null default 0,
  rules_skipped    integer      not null default 0,
  dry_run_only     boolean      not null default true,
  per_rule         jsonb        not null default '[]'::jsonb,
  started_at       timestamptz  not null default now(),
  finished_at      timestamptz  not null default now(),
  error            text,
  primary key (id)
);

create index if not exists alert_runs_started_idx
  on alert_runs (started_at desc);
