# DealDex Sentry release, source maps, Android mappings, FLEET-INFRA-CC

**Seat:** CURSOR (cloud).  **Branch:** `cursor/sentry-release-sourcemaps-af57`.

## Context

Telemetry audit 2026-10-11 section C item 9: dealdex web events had no `release` (so deploy markers and source maps cannot line up), no vite source-map upload, and 0 Sentry logs despite spans arriving.  Android had never sent an event: DSN is compile-time `SENTRY_DSN` and was empty in CI, and there was no Gradle plugin for R8 mappings.  FLEET-INFRA-CC (84+ missed cron events) is the ios-ship Sentry Crons monitor.

## What changed

1. **Web + server release** — Browser SDK reads `VITE_SENTRY_RELEASE`, which `vite.config.ts` copies from `VERCEL_GIT_COMMIT_SHA` / `GITHUB_SHA`.  Server SDK uses `SENTRY_RELEASE` then `VERCEL_GIT_COMMIT_SHA` then `GITHUB_SHA`.  Same 40-char SHA as `.github/workflows/sentry-deploy.yml`.
2. **Source maps** — `@sentry/vite-plugin` on production `vite build` when `SENTRY_AUTH_TOKEN` is set.  Hidden sourcemaps, deleted after upload.  CI/local builds without the token stay map-free.
3. **Logs** — v11 BrowserOptions dropped `enableLogs`; console lines were breadcrumbs only, so the project recorded 0 logs.  Both SDKs now add `consoleLoggingIntegration` (`info`/`warn`/`error`) and emit `dealdex.web.sentry_ready` / `dealdex.server.sentry_ready` on init so a deploy proves the pipeline.
4. **Android** — `io.sentry.android.gradle` 6.23.0 (AGP 9 compatible): ProGuard/R8 mapping + source-context upload, auto-install off (SDK versions stay pinned).  CI `android` job assembles release with `SENTRY_DSN` and `SENTRY_AUTH_TOKEN` from repo secrets.  `DealDexApp` sets `release` to `versionName+versionCode` and `environment` from `BuildConfig.DEBUG`.
5. **iOS** — `SentryTelemetry` sets `releaseName` from `CFBundleShortVersionString`+`CFBundleVersion`.  dSYM upload path already existed.
6. **FLEET-INFRA-CC** — `ios-ship.yml` is `disabled_manually` (credential hold; last scheduled success 2026-09-27 07:31Z).  The monitor still expected `22,52 * * * *` check-ins, so fleet-infra paged.  Cron is now hourly `22 * * * *` (avoids concurrency-dropped :52 ticks when macos-latest is queued).  New `ios-ship-cron-park.yml` ubuntu heartbeat upserts `ci-dealdex-ios-testflight-ship-github-hosted-macos` until the ship workflow is re-enabled.  `max_runtime` raised to 120 to match the 90-minute ship timeout.

## Secrets Jay must set (names only)

| Name | Where | Why |
| --- | --- | --- |
| `SENTRY_AUTH_TOKEN` | Vercel project `dealdex` Production + Preview; GitHub repo Actions | Source-map upload (`project:releases` + `org:read`) and Android mapping upload.  The current GitHub secret is present but **401 Invalid token** — replace it |
| `SENTRY_DSN` | GitHub repo Actions (ios-ship already lists it); Android CI release assemble | Compile-time Android DSN.  Empty = SDK stays dark |
| `VITE_SENTRY_DSN` | Vercel Production + Preview (already documented) | Browser SDK |
| `SENTRY_DSN` | Infisical DealDex prod / Vercel runtime | Server SDK |
| `SENTRY_FLEET_DSN` | GitHub repo Actions (already used by sentry-ci-report) | Park heartbeat for FLEET-INFRA-CC |

Do not commit values.  Do not re-enable `ios-ship.yml` from this change — that stays on the signing-credential hold.  Disable `iOS ship cron park` when TestFlight ships resume.

## Verification

- `python3 scripts/sentry-ci-report-margins_test.py`
- `npm run lint`, `npm run typecheck`, `npm test`, `npm run build` (no `SENTRY_AUTH_TOKEN` in this environment, so the vite plugin is skipped)
- Android `assembleRelease` in CI once secrets exist; locally the plugin configures without uploading
- Production log proof is the `dealdex.web.sentry_ready` / `dealdex.server.sentry_ready` lines after the next Vercel deploy that has `VITE_SENTRY_DSN`

## Extra-ship

No.  `ios-ship.yml` stays disabled.  The park heartbeat does not archive or upload.
