# INFISICAL.md — DealDex

Owner directive (2026-10-03): Infisical is the sole source of truth for every app — secrets, env variables, and tunable settings knobs.  "Truth" means everything the app's behavior depends on that is not code.

DealDex Infisical project: `DealDex` (`6d50da37-5fb9-4c5b-bcf0-085ac29c1705`), **prod is the only environment the app reads** (owner directive 2026-10-10; `dev` and `staging` are being retired).  `resolveAppEnv()` returns `prod` for every deploy environment, including Vercel Preview and Development, and refuses a `DEALDEX_INFISICAL_ENV` override: a non-prod value logs one warning and is ignored.  The Cursor boot script (`scripts/cursor-cloud-start.sh`) and its Infisical coordinates file under `.cursor/` use `prod` too, and the script exits 1 if `INFISICAL_ENV` is anything else.

## The policy

- Infisical holds app-level **secrets** (API keys, tokens, OAuth client secrets, DB credentials), app-level **env config** (service URLs, environment selectors, observability config), and **tunable settings knobs** (scan/scoring/arb parameters an admin would tweak without a code deploy).
- **Per-user settings never go in Infisical.**  They live in the app's own stores: alert rules and saved filters (server DB, per user), desk API keys (browser localStorage; optional encrypted server backup in `user_settings`), the app mark / theme / UI prefs (browser localStorage).  See "Explicitly out of scope" below.
- Local dev overrides are documented in `.env.example`; real values are never committed.
- Secret values never appear in code, logs, PR bodies, or chat — names and metadata only.

## The runtime contract

1. **Load at startup.**  `initAppSettings()` (in `src/lib/server/app-settings.ts`) fetches the full settings set for the app's project + environment into an in-memory cache.  It is idempotent and is awaited by server entry points (`src/lib/auth/server.ts`, `/api/alerts/run`, the scan runner) and lazily before the first DB touch (`src/lib/db.ts`).  Without universal-auth credentials (`INFISICAL_CLIENT_ID` / `INFISICAL_CLIENT_SECRET`) the server runs in **local-only mode** — `process.env` + built-in defaults, with a one-time warning — so `npm run dev` and CI work unchanged.  A failed Infisical load degrades to local-only mode (loudly logged) rather than crashing cold starts; staleness/outage-safety wins over fail-fast here.
2. **Never fetch per-request.**  `getSetting()` / `getNumberSetting()` / `getBooleanSetting()` / `getRequiredSetting()` resolve Infisical cache → `process.env` → schema default, entirely from memory/env.  They make zero network calls and are safe in hot request/tick paths (proven by `app-settings.test.ts`: 250 reads, zero fetches after init).  A per-request Infisical fetch is the one forbidden pattern.
3. **Background refresh.**  The cache re-reads Infisical on a self-tuning interval — `SETTINGS_REFRESH_INTERVAL_MS` is itself a knob (default 300000, 5 minutes) — plus a `SIGHUP` handler and the admin "Reload settings" action (`POST /api/admin/settings` with `{"action":"refresh"}`).  Refresh failures log loudly and keep serving the last-known-good cache.
4. **Write-through on admin save.**  `setSetting(key, value)` persists to Infisical FIRST (via the shared `createInfisicalSettings` client from `@jaywedgeworth22/congress-trading-shared`), then updates the local cache.  A failed Infisical write rejects — cache and Infisical never diverge silently.  Unknown keys are rejected so this inventory stays honest.  In local-only mode `setSetting` refuses (fail, never diverge).

The settings client is the fleet-shared zero-dependency module `createInfisicalSettings` (`github:Simple-With-Us/congress-trading-shared#semver:^2.7.1`, package `@jaywedgeworth22/congress-trading-shared`); `src/lib/server/app-settings.ts` is DealDex's typed wrapper (schema, precedence, refresh scheduling, admin helpers).

## Admin gating

DealDex has no user roles — sign-in is optional and there is no admin/owner concept in the auth layer.  The settings surface (`GET/POST /api/admin/settings`) is gated by the app's existing machine credential: the `SCAN_RUNNER_TOKEN` bearer (the same token that gates `/api/alerts/run` for the scan-runner cron).  Non-admin requests get **403**.  The UI hides admin surfaces for non-admins; today there is no in-app admin settings UI — the surface is the API (curl/ops) plus the Infisical dashboard.  `GET` returns names + metadata only (`kind`, `source`, `configured`, `blurb`) — never secret values.

## Key inventory for THIS app

### Secrets (to be filled by the admin; never committed, never invented)

App auth + data: `DATABASE_URL`, `BETTER_AUTH_SECRET`, `SCAN_RUNNER_TOKEN`, `PROXY_URL_LIST`.
Sign-in providers (Google / Apple / X — first set candidate wins):
`GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `DD_WEB_GOOGLE_ID`, `DD_WEB_GOOGLE_SECRET`, `DEALDEX_GOOGLE_CLIENT_ID`, `DEALDEX_GOOGLE_CLIENT_SECRET`, `DEALDEX_WEB_GOOGLE_ID`, `DEALDEX_WEB_GOOGLE_SECRET`,
`APPLE_CLIENT_ID`, `APPLE_CLIENT_SECRET` (pre-generated JWT) **or** `APPLE_TEAM_ID` + `APPLE_KEY_ID` + `APPLE_PRIVATE_KEY` (JWT generated at startup), plus the `DEALDEX_`/`DD_` aliases of each,
`TWITTER_CLIENT_ID`, `TWITTER_CLIENT_SECRET`, `X_CLIENT_ID`, `X_CLIENT_SECRET`, `DEALDEX_X_CLIENT_ID`, `DEALDEX_X_CLIENT_SECRET`, `DD_X_CLIENT_ID`, `DD_X_CLIENT_SECRET`.
eBay (server-side website scan + Browse API): `EBAY_APP_ID`, `EBAY_CERT_ID`.

### Env config

`BETTER_AUTH_URL` (deployed origin; unset → per-request dynamic base URL), `EBAY_REDIRECT_URI`, `EBAY_ENV` (`production`|`sandbox`, default `production`), `SENTRY_DSN`, `SENTRY_ENV`, `SENTRY_TRACES_SAMPLE_RATE` (default `0.2`).

### Tunable knobs (arb / scan / scoring parameters)

`SCAN_MAX_ROWS_PER_RUN` (default `50`), `PROXY_MAX_CONCURRENCY` (default `4`), `AUTO_BUY_DRY_RUN_FORCE` (default `false` — global safety kill-switch: `true` forces dry-run on every auto-buy evaluation regardless of rule config), `AUTO_BUY_DEFAULT_MIN_SPREAD` (`0.18`), `AUTO_BUY_DEFAULT_MAX_PRICE_CENTS` (`5000`), `AUTO_BUY_DEFAULT_MAX_DAILY_CENTS` (`10000`), `AUTO_BUY_DEFAULT_MAX_MONTHLY_CENTS` (`50000`), `AUTO_BUY_DEFAULT_COOL_HOURS` (`24`), `SETTINGS_REFRESH_INTERVAL_MS` (`300000`).

## Explicitly out of scope (per-user — stays in the app's own store)

- Desk API keys (JustTCG, PriceCharting, Pokémon TCG API): the user's own paid keys, kept in browser localStorage (`dealdex:desk-keys`) and optionally encrypted in `user_settings` server-side.  The server never receives phone-side keys (`/api/native/scan` refuses a `keys` payload).
- Alert rules / saved filters: per-user rows in the server DB (`alert_rules`, `saved_filters`).
- eBay OAuth refresh tokens: per-user rows in `user_settings`.
- UI prefs: app mark, theme, PWA state — browser localStorage.
- Build-time client env (`VITE_*`): `VITE_AUTH_ENABLED`, `VITE_PUBLIC_HOSTNAME`, `VITE_SENTRY_DSN`, `VITE_SENTRY_ENV`, `VITE_*_SAMPLE_RATE`, `VITE_DD_*`.  These are baked into the client bundle at build time and cannot be refreshed at runtime; they stay as build env vars.
- Pricing-model constants: `CONDITION_MULT`, `GRADE_MULT`, `MARKETPLACE_FEE`, `TCGPLAYER_SELL_FEE`, grade-bucket curves, the vs-book "middle" band.  These are model parameters with correctness invariants (see the `gradeMultiplier` ordering comment in `src/lib/tcg/appraise.ts`), consumed by client-shared pure modules — changing them at runtime for the server half while the client bundle keeps the old values would silently fork pricing.  They change with code deploys only.
- iOS / App Store Connect shipping secrets already in the project (`ASC_ISSUER_ID`, `ASC_KEY_ID`, `ASC_KEY_P8`, `IOS_DIST_P12_BASE64`, `IOS_DIST_P12_PASSWORD`): used by ship scripts, untouched by this change.

## Cache / refresh / write-through contract (for future agents)

- Add a new app-level setting: add a `SettingDef` to `SETTING_DEFS` in `src/lib/server/app-settings.ts` (this list IS the inventory — keep it in sync with the section above), read it via `getSetting`/`getNumberSetting`/`getBooleanSetting`, and never read `process.env` directly for it.  Modules that take an injectable `env` param default it to `defaultServerEnv()`; tests keep passing explicit objects.
- Never call the Infisical REST API directly from app code — go through `app-settings.ts`.
- Admin saves always go through `setSetting()` (write-through).  Never write the local cache without the Infisical write succeeding first.
- CI guard: `npm run typecheck` + the `app-settings.test.ts` suite pin the contract.

## Rotation notes

- Rotate a secret in the Infisical dashboard (or via the API); the running server picks it up on the next background refresh (≤5 minutes by default) or immediately via `POST /api/admin/settings` `{"action":"refresh"}`.  No redeploy needed.
- `SCAN_RUNNER_TOKEN`: rotate in Infisical, then update the `.github/workflows/scan-runner.yml` secret and any external cron callers — in-flight runs with the old token get 401 until callers update.
- `BETTER_AUTH_SECRET`: rotating invalidates all sessions (users re-sign-in).
- `DATABASE_URL`: the pool is created per cold start; rotate, then redeploy or wait for instance turnover.
