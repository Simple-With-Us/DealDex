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

## Update Sat Oct 10 (owner decision)

Later on Sat Oct 10 the owner decided "ok to do all" and "if values differ defer to prod, all the rest move to prod".  That replaces the plan in the first version of this note, which was to leave the eleven dev-only knobs out of prod and let prod run on the schema defaults in `SETTING_DEFS`.

- Copied to prod:  10 of the 11 dev-only keys.  They are `AUTO_BUY_DEFAULT_COOL_HOURS`, `AUTO_BUY_DEFAULT_MAX_DAILY_CENTS`, `AUTO_BUY_DEFAULT_MAX_MONTHLY_CENTS`, `AUTO_BUY_DEFAULT_MAX_PRICE_CENTS`, `AUTO_BUY_DEFAULT_MIN_SPREAD`, `EBAY_ENV`, `PROXY_MAX_CONCURRENCY`, `SCAN_MAX_ROWS_PER_RUN`, `SENTRY_TRACES_SAMPLE_RATE` and `SETTINGS_REFRESH_INTERVAL_MS`.  Prod now holds an explicit value for each one instead of falling back to the schema default.  `EBAY_ENV` was copied with the value `production`, the same as the code default.
- Money path:  the five `AUTO_BUY_DEFAULT_*` keys (cooldown hours, daily cents, monthly cents, max price cents, min spread) set the default limits for newly created alert rules.  They are money-path values and are now live in prod.
- Held for an owner decision:  `AUTO_BUY_DRY_RUN_FORCE`.  It is the kill switch that forces dry-run on every auto-buy evaluation.  Its dev value is `false`.  Prod already behaves as `false` through the schema default, so holding it changes nothing in production.
- Environments:  `staging` is deleted.  The `dev` environment still exists until the `AUTO_BUY_DRY_RUN_FORCE` decision is made.  No code path reads it, because every selector resolves to `prod`.

## Verification

`npm run typecheck`, `npm run lint` and `npm test` (see the PR for results).
