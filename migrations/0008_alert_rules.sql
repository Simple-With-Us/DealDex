-- Server-side alert rules table for the auto-buy scan-runner.
--
-- Today alert rules live in localStorage on web, and in DeskStore on iOS /
-- Android, so they cannot be read by the scan-runner. This table lets a
-- signed-in user opt into server-side scanning + auto-buy by uploading the
-- rule config, and lets the runner persist decision history.  Rule.id is
-- client-minted, so the primary key is (user_id, id) — same pattern as
-- `appraisals`.
--
-- The `auto_buy` block is the opt-in.  `auto_buy.dry_run = true` (the
-- default) means the runner still records what it WOULD have bought but
-- does not place an order.  Flipping it to false requires an explicit
-- confirmation in the UI and is gated server-side by the rate limit +
-- max-spend check in src/lib/server/auto-buy.ts.

create table if not exists alert_rules (
  user_id      text         not null,
  id           text         not null,
  enabled      boolean      not null default true,
  name         text         not null,
  keyword      text         not null default '',
  marketplaces text[]       not null,
  verdicts     text[]       not null,
  min_spread   double precision,
  max_price    double precision,
  condition    text         not null default 'any',
  channels     jsonb        not null default '{}'::jsonb,
  email        text         not null default '',
  phone        text         not null default '',
  pushover_user text        not null default '',
  pushover_token text       not null default '',
  auto_buy     jsonb        not null,
  created_at   timestamptz  not null default now(),
  updated_at   timestamptz  not null default now(),
  primary key (user_id, id)
);

create index if not exists alert_rules_user_enabled_idx
  on alert_rules (user_id, enabled);