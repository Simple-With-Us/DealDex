# 2026-09-20 — MM Comprehensive Top-To-Bottom Review

**Seat:** MM **Branch:** `mm/comprehensive-review` **Worktree:** `~/apps/dealdex-mm`

Owner direction 2026-09-20: "do a comprehensive top to bottom review/inspection of the app on all platforms and with all integrations to find all the ways it can be fixed, improved, and optimized. Add them to the mac board, effort log, and github issues; then try to autonomously implement all of those fixes, improvements, and optimizations. Enable use of official ebay API and also of other methods of avoiding data center IP issues and increasing the number of listings analyzed to reduce the number of missed legitimate deals. Ensure Sentry and all features are fully implemented on Android also as well as web and iOS. Design the app so that users can (at least in the near future if not already) opt to set a saved deal filter/scan that can be authorized within parameters to automatically make purchases in order to enable a user to take advantage of the best deals often snapped up by others fast."

## What was filed first

- 8 board items on the fleet board (4 P0, 3 P1, 1 P2), all `In Progress` against MM.
- 4 GitHub issues: #335 (eBay Browse API), #336 (auto-buy), #337 (Android Sentry parity), #338 (scan cap raise).
- Effort log mirror row in `~/apps/DEALDEX-EFFORT-LOG.md` + `docs/EFFORT-LOG.md`.

## What shipped

**PR #339 — eBay Browse API path + raise scan cap to 50 (#335, #338).** Merged 2026-09-20T20:41Z.

- `src/lib/marketplaces/ebay-browse.ts` — OAuth2 client_credentials token cache (in-process, app-id keyed), `buyingOptions:{FIXED}` + `conditionIds` filter, paging up to 50 per call across multiple pages. Env-gated via `EBAY_APP_ID` + `EBAY_CERT_ID`; sandbox via `EBAY_ENV=sandbox`. Never logs the cert id or the token.
- `src/lib/marketplaces/ebay.ts` — Browse first when keys are present, fall through to Jina / Brave / direct scrape as before. `EBAY_SCAN_CAP` raised 16 → 50.
- `src/lib/marketplaces/mercari.ts` — `MERCARI_SCAN_CAP` raised 16 → 50.
- `src/lib/marketplaces/scan.ts` — `MATCH_POOL` concurrency raised 3 → 6.
- `src/lib/observability/sentry-server.ts` — new span names: `scan.ebay.api`, `scan.ebay.page2`, `scan.auto_buy.preview`.
- 21 new unit tests in `src/lib/marketplaces/ebay-browse.test.ts`.
- Verification: `npm run typecheck` clean; `npm run lint` 0 errors; 33/33 marketplace tests pass.

**PR #340 — Auto-buy schema + server preview endpoint + dry-run UI (#336).** Merged 2026-09-20T20:55Z.

- `src/lib/alerts/types.ts` — `AlertRule.autoBuy: AutoBuyConfig` (enabled / dryRun / maxPriceCents / minSpread / maxDailyCents / maxMonthlyCents / coolHours / marketplace = "ebay"). Cents for caps.
- `src/lib/alerts/store.ts` — `normalizeAutoBuy` normalizes legacy localStorage rows that predate the field.
- `src/lib/server/auto-buy.ts` — pure `evaluateAutoBuy` + `applyAutoBuy` + `previewAutoBuy` + `clampAutoBuy`. Hard guardrails (enabled flag, marketplace in rule, marketplace is supported, verdict in rule, condition matches, spread ≥ minSpread, all-in ≤ cap, listing id not on cooldown, daily/monthly cap respected). Every decision carries a reason so the dry-run is auditable.
- `src/lib/server/auto-buy-preview.ts` — `createServerFn` POST endpoint, auth-gated, returns accepted + rejected with reasons + totals.
- `src/routes/alerts.tsx` — `AutoBuyBlock` section per rule with the fields and a Preview button. Reads the last scan rows from localStorage if cached (empty otherwise — the honest answer).
- `migrations/0008_alert_rules.sql` — server-side `alert_rules` table for the runner.
- iOS + Android `AlertRule` gained an `autoBuy` field (Codable / data class).
- 19 unit tests in `src/lib/server/auto-buy.test.ts`.
- Verification: 52/52 marketplace + auto-buy tests pass.

**PR #341 — Sentry parity + proxy pool + scan-runner cron + native alerts parity.** Open at writing.

- Android Sentry parity: enable `profilesSampleRate` 0.1, `isEnableUserInteractionTracing`, add `SentryOkHttpIntegration` / `FragmentLifecycleIntegration` / `SentryComposeIntegration` in `DealDexApp.kt`; `build.gradle.kts` adds the new `sentry-android-*` modules; `proguard-rules.pro` adds explicit `-keep` for the new integrations; `Market.scan` wraps in `Sentry.startTransaction("scan")` with `scan.ondevice` + `scan.site` child spans matching the web span names.
- Rotating-IP proxy fallback: `src/lib/server/proxy-pool.ts` reads `PROXY_URL_LIST` (comma-separated), `fetchWithPool` rotates on 403 / 408 / 425 / 429 / 5xx, retires at the per-proxy concurrency cap, `redactProxyUrl` strips `user:pass` from any span attribute. Wired into `src/lib/marketplaces/ebay.ts` as the final direct-fetch fallback. 7 unit tests.
- Background scan-runner: `migrations/0009_scan_runs.sql` adds `scan_runs` keyed on `(user_id, id)`; `src/lib/server/alert-rules-store.ts` does `loadAlertRules` / `upsertAlertRule` / `persistScanRun` / `listScanRunsSince` through `getSql()`; `src/lib/server/scan-runner.ts` exports `runScanRunner` (auth-gated server function) that reads enabled rules, runs `scanAndScore`, evaluates auto-buy, persists a row; `src/routes/api/alerts/run.ts` is the bearer-token-gated POST endpoint; `.github/workflows/scan-runner.yml` runs every minute, `cancel-in-progress`, no-op when `SCAN_RUNNER_URL` / `SCAN_RUNNER_TOKEN` are absent.
- Native alerts parity: `iOS Models.swift` adds `AlertChannels` struct; `iOS AlertsView.swift` adds the "Out-of-app channels" + "Auto-buy" sections mirroring web; same for Android `Models.kt` + `AlertsScreen.kt`. Channel fields are saved locally; the runner picks them up once the providers are wired (server-side PR #7, deferred).

## Verification (PR #341)

- `npm run typecheck` clean.
- `npm run lint` 0 errors (8 pre-existing warnings).
- 47/47 tests pass (auto-buy, proxy-pool, ebay-browse, marketplace html).

## Files (PR #341)

- `src/lib/server/proxy-pool.ts` (new), `src/lib/server/proxy-pool.test.ts` (new)
- `src/lib/marketplaces/ebay.ts`
- `native/android/app/src/main/java/me/grok/dealdex/DealDexApp.kt`
- `native/android/app/src/main/java/me/grok/dealdex/data/Market.kt`
- `native/android/app/build.gradle.kts`
- `native/android/app/proguard-rules.pro`
- `src/lib/server/scan-runner.ts` (new)
- `src/lib/server/alert-rules-store.ts` (new)
- `src/routes/api/alerts/run.ts` (new)
- `migrations/0009_scan_runs.sql` (new)
- `.github/workflows/scan-runner.yml` (new)
- `src/routeTree.gen.ts` (auto-generated entries for `/api/alerts/run` so local typecheck stays green)
- `native/ios/DealDex/Models.swift`
- `native/ios/DealDex/AlertsView.swift`
- `native/android/app/src/main/java/me/grok/dealdex/data/Models.kt`
- `native/android/app/src/main/java/me/grok/dealdex/ui/AlertsScreen.kt`

## Owners / boards

- @MM (MiniMax), [MM] in Slack #ag***-s**c.
- Boards claimed (In Progress): `b4146f75`, `6c800b9c`, `d362b287`, `f808a67c`, `476c1efa`, `e88a8c69`, `3cf2abcd`, `111ab67c`.
- Issues: #335, #336, #337, #338.
- PRs: #339 (merged), #340 (merged), #341 (open at writing, CI green).

## Open follow-ups (deliberately deferred, not silent)

- eBay Order API write scope: needed to flip `dryRun=false` in production. Owner must grant on developer.ebay.com.
- Email / SMS / Pushover providers: fields are wired on iOS + Android + web, but the runner's send path is not yet. Next PR.
- Mercari scan resilience: still cascade-falls through Brave Search + DDG; no first-party API exists. Bumping the cap + the eBay Browse path largely closes the data-center IP gap for eBay.
- iOS / Android UI for auto-buy preview: the web `AutoBuyBlock` lands in this PR; native screens can re-use the same `evaluateAutoBuy` module via a future `appraisalService.previewAutoBuy(...)` server endpoint once a UI thread wants it.

## Owner-only knobs to wire next

1. Infisical: add `EBAY_APP_ID` + `EBAY_CERT_ID` (production, dealdex scope: buy.browse.readonly + buy.item.feed).
2. Infisical: add `SCAN_RUNNER_URL` (the deployed dealdex origin) + `SCAN_RUNNER_TOKEN` (32+ char random; the cron needs it).
3. Infisical: add `PROXY_URL_LIST` only if you want rotating IP for the direct-fetch fallback (Bright Data / Smartproxy / self-hosted).
4. (Later) provider keys for email / SMS / Pushover when the runner's send path lands.
