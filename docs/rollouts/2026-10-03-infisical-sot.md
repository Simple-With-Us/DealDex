# DealDex Infisical sole-source-of-truth rollout — 2026-10-03

## Scope

Fleet-wide owner directive: Infisical is the sole source of truth for app-level settings (secrets, env config, tunable knobs).  This change adds the settings layer, migrates every app-level `process.env` read to it, exposes tunable scan/arb knobs, and documents the contract.

- New `src/lib/server/app-settings.ts`: typed wrapper around the fleet-shared `createInfisicalSettings` client (`@jaywedgeworth22/congress-trading-shared`, `github:Simple-With-Us/congress-trading-shared#semver:^2.7.1`).  Startup load into an in-memory cache, zero-network runtime reads (Infisical → env → schema default), self-tuning background refresh (`SETTINGS_REFRESH_INTERVAL_MS`) + `SIGHUP`, write-through `set()` (Infisical first, rejects on failure, unknown keys rejected), local-only mode without credentials (warn once; `set()` refuses).
- New `src/lib/server/app-settings.test.ts`: 17 tests proving the contract (startup populates cache, zero network reads after init, write-through ordering with mid-write cache assertion, failed refresh keeps last-known-good, failed write rejects with cache untouched, local-only degradation).
- New `src/routes/api/admin/settings.ts`: admin surface.  DealDex has no user roles, so the existing machine credential (the `SCAN_RUNNER_TOKEN` bearer) is the admin gate — 403 for non-admins.  `GET` returns names + metadata only (never values); `POST {"action":"set"}` is write-through; `POST {"action":"refresh"}` is on-demand reload.
- Migrated reads: `DATABASE_URL` (now lazy in `src/lib/db.ts` — resolved after settings init, never at import), `BETTER_AUTH_SECRET` (auth + `secret-box.ts`), `SCAN_RUNNER_TOKEN` (runner route), `PROXY_URL_LIST`, all Google/Apple/X OAuth key aliases, eBay app keys (`ebay-oauth.ts`, `ebay-browse.ts`), `BETTER_AUTH_URL`, `EBAY_REDIRECT_URI`, `EBAY_ENV`, Sentry DSN/env/sample rate.  Modules with injectable `env` params now default to `defaultServerEnv()` (Infisical overlaid on `process.env`); tests still pass explicit objects.
- Tunable knobs (all live in Infisical, changeable without a deploy): `SCAN_MAX_ROWS_PER_RUN` (was hardcoded 50), `PROXY_MAX_CONCURRENCY` (was 4), `AUTO_BUY_DRY_RUN_FORCE` (global safety kill-switch, default false), `AUTO_BUY_DEFAULT_*` rule defaults (min spread 0.18, price/daily/monthly caps, cooldown), `SETTINGS_REFRESH_INTERVAL_MS`.
- New `INFISICAL.md` (policy, key inventory, per-user boundary, cache/refresh/write-through contract, rotation notes), `.env.example` (names only), AGENTS.md section pointing at `INFISICAL.md`.
- 11 non-sensitive defaults written to the DealDex Infisical project's `dev` environment (knobs + `EBAY_ENV` + `SENTRY_TRACES_SAMPLE_RATE`).  All secret keys are documented as "to be filled by admin" — no secret values invented, copied, or committed.

Deliberately left out (documented in INFISICAL.md): per-user settings (desk keys, alert rules, eBay OAuth tokens, UI prefs) stay in the app's own stores; build-time `VITE_*` client env stays as build env; pricing-model constants (`CONDITION_MULT`, `GRADE_MULT`, fees, vs-book band) stay code — they are consumed by client-shared pure modules, so a server-only runtime knob would silently fork pricing; iOS/App Store Connect ship secrets untouched.

## Verification and release

`npm run lint` — 0 errors (28 pre-existing warnings, none new).  `npm run typecheck` — clean.  `npm test` — 295 pass, 0 fail (278 existing + 17 new).  `npm run build` — clean (regenerated `src/routeTree.gen.ts`, which also normalized the pre-existing `/api/settings` route path to `/api/settings/` — the codegen's own output, kept).

PR: branch `infisical-sot` (this note's PR number TBD at push time).
