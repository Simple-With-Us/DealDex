# 2026-10-15 — Android Sentry scan hops (DD-367)

**Seat:** CURSOR  **Branch:** `cursor/android-sentry-scan-spans-5558`

## What was already on main

PR #341 and the later Gradle 9 / Sentry release work already shipped Android profiling (`profilesSampleRate` 0.1), `tracesSampleRate` 0.2, masked Session Replay, OkHttp, Compose (`SentryTraced`), fragment integration, R8 keep rules, and the Gradle mapping upload.  `sentry-android` 8.60.0 already pulls `sentry-android-ndk`.  View hierarchy stays off on Android and iOS so a crash attachment cannot include card titles.

## What this change adds

`Market.scan` still opens the `scan` transaction and the coarse `scan.ondevice` / `scan.site` children.  Under the on-device hop it now emits the web names:

- `scan.ebay`
- `scan.mercari`
- `scan.match`
- `scan.cache.hit`
- `scan.cache.miss`

Span data is `scan.marketplace`, `listing.count`, and `cache.hit`.  The search text and listing title are not attached.

Boot also turns on NDK, auto session tracking (crash-free sessions), and Sentry logs, then writes `dealdex.android.sentry_ready`.  OkHttp spans and HTTP breadcrumbs drop `http.query` so `_nkw`, `keyword`, and `name` do not leave the phone.  Event request URLs lose their query string the same way.

## Not in this change

A live scan against the Sentry dashboard needs a device build with `SENTRY_DSN` set.  This seat verifies the debug assemble and the source assertions.  Deployer ships.  No production deploy from this branch.

DD-374 and DD-380 are duplicates of DD-367.
