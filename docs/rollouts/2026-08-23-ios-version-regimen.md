# 2026-08-23 — iOS version regimen (1.0.N + UTC build)

> **Superseded 2026-10-18.** The UTC `YYYYMMDDHHMM` build stamp this file
> describes is retired. The fleet now takes both numbers from the repo's
> commit count: marketing `1.0.<commit_count>`, build `<commit_count>`, so
> the pair always describes one commit. This file stays as the record of what
> was done on 2026-08-23; the current regimen is AGENT-SYNC.md
> (section "Version Numbers") and `scripts/ios-fleet/ship-testflight.sh`.

## Problem

App Store Connect showed DealDex as **`1.0 (1)`** instead of the fleet format other
apps use: **`1.0.N (YYYYMMDDHHMM)`** (for example `1.0.2 (202608230250)`).

Root cause: `native/ios/project.yml` kept `CURRENT_PROJECT_VERSION: "1"` while
`MARKETING_VERSION` was already `1.0.2`. ASC renders marketing version and build
number as a pair; a literal build `1` with an early `1.0` train produced the
unwanted `1.0 (1)` label.

## Fleet regimen as of 2026-08-23 (historical fleet regimen, now retired)

| Field                                              | Role                | Example        |
| -------------------------------------------------- | ------------------- | -------------- |
| `MARKETING_VERSION` / `CFBundleShortVersionString` | App Store "Version" | `1.0.2`        |
| `CURRENT_PROJECT_VERSION` / `CFBundleVersion`      | Build stamp         | `202608230250` |

- Marketing version: `1.0.<seq>`, +1 on every rebuild.
- Build number: UTC `YYYYMMDDHHMM` when the archive was cut (monotonic, never
  reuse `1`).
- `Info.plist` must stay on `$(MARKETING_VERSION)` / `$(CURRENT_PROJECT_VERSION)`
  so XcodeGen regen does not hardcode `1.0` / `1` again.

Both rows above are historical. On 2026-10-18 the build stamp was replaced by
the commit count, and the marketing version moved onto the same number.

## Changes

- `native/ios/project.yml` — sync to last shipped `1.0.2` / `202608230250`; add
  regimen comments.
- `native/ios/DealDex.xcodeproj/project.pbxproj` — match `project.yml` (via
  XcodeGen on Mac, or manual sync when Linux agents cannot run XcodeGen).
- `native/ios/CLAUDE.md` — document regimen for future agents.
- `scripts/ios-identity.test.mjs` — guard `1.0.N` + 12-digit build + plist
  substitutions. (That guard now asserts the commit-count pair instead.)

## After merge

1. Mac `ios-ship` workflow archives with the fleet script, which resolves the
   next `1.0.3` (or higher) + fresh UTC build even if `project.yml` lags.
2. After a successful ship, sync `project.yml` to the printed versions and run
   `xcodegen generate` from `native/ios` on the Mac.
3. ASC "Latest" should read like `1.0.3 (202608232213)` — not `1.0 (1)`.

Cannot fix ASC from cloud agents (no `~/.secrets/appstore-connect.env` on the
runner). The next Mac TestFlight ship is what updates the live ASC record.
