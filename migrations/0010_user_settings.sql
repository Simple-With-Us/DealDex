-- Per-user credentials for OAuth-protected integrations.
--
-- Auto-buy needs each user's eBay refresh token (Buy It Now order placement
-- is per-user OAuth, not per-app).  Out-of-app alert channels (Pushover, SMS,
-- email) need per-user credentials so the server-side runner can deliver.
-- Owner direction 2026-09-21: prefer OAuth / browser-auth over copy-paste keys,
-- so all user credentials here arrive via the OAuth start/callback route, never
-- a text field on the Settings page.
--
-- PK on user_id — single row per signed-in user.  Refresh tokens are stored in
-- the clear in this migration because the server is the only actor; encryption
-- at rest is a follow-up (already handled by the secret-box helpers in
-- src/lib/server/secret-box.ts when the columns are read).

create table if not exists user_settings (
  user_id              text         primary key,
  -- eBay Buy It Now order placement
  ebay_refresh_token   text,
  ebay_oauth_expiry    timestamptz,
  ebay_username        text,
  ebay_scopes          text[]       not null default '{}'::text[],
  -- Out-of-app channels (server-side delivery by the scan runner)
  pushover_user_key    text,
  pushover_api_token   text,
  email_address        text,
  sms_provider         text,
  sms_e164             text,
  -- Per-user proxy override.  When set, fetchWithPool prefers this URL over
  -- the server-default PROXY_URL_LIST for this user's scan calls.
  proxy_url_override   text,
  -- Audit
  created_at           timestamptz  not null default now(),
  updated_at           timestamptz  not null default now()
);

create index if not exists user_settings_ebay_expiry_idx
  on user_settings (ebay_oauth_expiry)
  where ebay_refresh_token is not null;