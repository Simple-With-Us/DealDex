# DealDex reads Infisical prod only (2026-10-10)

Owner directive (2026-10-10): the `dev` and `staging` environments of the DealDex Infisical project (`6d50da37-5fb9-4c5b-bcf0-085ac29c1705`) are being retired.  Every code and config path now selects `prod`.

## What changed

- `resolveAppEnv()` in `src/lib/server/app-settings.ts` always returns `prod`.  Vercel Preview, Vercel Development and an unset `VERCEL_ENV` no longer map to `staging` or `dev`.
- The guard: a `DEALDEX_INFISICAL_ENV` override with any non-prod value is refused.  It logs one warning and is ignored.  It never throws, because the function runs in the startup path and in error-message builders, and a throw would drop a production server into local-only mode.
- The type `DealDexAppEnv` is now the single literal `"prod"`, so a non-prod slug no longer type-checks.
- The Cursor Cloud boot (`scripts/cursor-cloud-start.sh` and the Infisical coordinates file under `.cursor/`) selects `prod`, and the script exits 1 if `INFISICAL_ENV` is set to anything else.
- `.env.example` and `INFISICAL.md` describe the prod-only contract.

## Production behavior

Vercel Production already read `prod`, so nothing changes there.  No Vercel variable named `DEALDEX_INFISICAL_ENV` or `INFISICAL_ENV` exists (names checked 2026-10-10), so the guard cannot trip on a live deploy.

## Readers that now see prod

Vercel Preview, local `npm run dev` with machine-identity credentials, and the Cursor Cloud boot read prod.  A credentialed Preview or local run can also write through to prod via the admin settings route, so do not hand Preview a machine identity unless that is intended.

## Dev-only knobs not copied to prod

These eleven keys exist only in the `dev` environment and were deliberately not copied.  Prod falls back to the schema defaults in `SETTING_DEFS`: `AUTO_BUY_DEFAULT_COOL_HOURS` (24), `AUTO_BUY_DEFAULT_MAX_DAILY_CENTS` (10000), `AUTO_BUY_DEFAULT_MAX_MONTHLY_CENTS` (50000), `AUTO_BUY_DEFAULT_MAX_PRICE_CENTS` (5000), `AUTO_BUY_DEFAULT_MIN_SPREAD` (0.18), `AUTO_BUY_DRY_RUN_FORCE` (false), `EBAY_ENV` (production), `PROXY_MAX_CONCURRENCY` (4), `SCAN_MAX_ROWS_PER_RUN` (50), `SENTRY_TRACES_SAMPLE_RATE` (0.2), `SETTINGS_REFRESH_INTERVAL_MS` (300000).  The owner decides later whether any of them should be set in prod.

## Verification

`npm run typecheck`, `npm run lint` and `npm test` (see the PR for results).
