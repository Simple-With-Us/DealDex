# 2026-10-24 — iOS version numbers come from App Store Connect (AFC-517 / CT-2444)

Owner directive 2026-10-24:  the marketing version and the build number are
INDEPENDENT, and the `1.0.<commit_count>` scheme unified in #2801 on 2026-10-18
is replaced.  This is the DealDex-local port of the change that landed in
Congress.Trade (CT-2444); the vendored `scripts/ios-fleet` copy in this repo
now follows the same rule.

## The rule

- `MARKETING_VERSION` = `<prefix>.<P+1>`.  `P` is the highest patch already used
  on that train in App Store Connect, counting BOTH the App Store versions
  (`appStoreVersions.versionString`) AND the TestFlight trains
  (`preReleaseVersions.version`) for the app's platform.  A drift train (a
  `<prefix>.N` train holding a build whose `CFBundleVersion` is exactly `N`) is
  ignored, so the old "1.0.2358 (2358)" uploads stop pushing the version
  forward.  App Store versions are never ignored.
- `CURRENT_PROJECT_VERSION` = the repo commit count (`git rev-list --count
HEAD`), raised so it is strictly greater than every build already in the
  TARGET train and greater than the app's own plain-integer builds below
  `1000000000` (on macOS: above every build of any size).  The build number
  never names the marketing version, and the marketing version never names the
  build number.
- `--version X.Y.Z` is an exact marketing override; `--build N` is an exact
  build override and does NOT move the marketing version.  With `--version`
  only, the build is still automatic; with `--build` only, the marketing
  version is still the automatic next patch.
- A ship must never read `1.0.N (N)`: when the build number would equal the
  patch number, it moves one up.
- App Store Connect unreachable is fatal.  With `--allow-unverified-seq` the
  run continues with `P=0`, floors of 0 and a loud WARNING.

## What changed in this repo

- `scripts/ios-fleet/version-plan.mjs` (new) and
  `scripts/ios-fleet/version-plan.test.mjs` (new) are the Congress.Trade
  files, copied verbatim.  The rules are pure and unit-tested (18 tests); the
  App Store Connect state they need is read by the client.
- `scripts/ios-fleet/asc-api.mjs` gained `latest-marketing-patch` and
  `build-floor`, plus the `toOneId` / `appIdForBundle` / `fetchTrains` helpers
  they need and the import from `./version-plan.mjs`.  The existing
  `latest-build-seq` method is untouched.  `appstore-version-plan` and
  `appstore-version-prepare` were NOT copied: they are not part of this
  change.
- `scripts/ios-fleet/ship-testflight.sh`: new `ASC_NODE` seam (right after
  the PATH export, so the offline tests can answer App Store Connect from a
  stub), `asc_client` runs through it, new `asc_latest_marketing_patch` and
  `asc_build_floor` helpers, the `ASC_PLATFORM` mapping (`macOS` to `MAC_OS`,
  else `IOS`), and a rewritten version-resolution block.  The old
  `resolve_seq_floor` / `local_seq` / `next_build_seq` paths and the local
  build-seq counter are gone: App Store Connect is the only record that
  shipping advances.  `project.pbxproj` is no longer a source either; it is
  only read for the agreement NOTICE.  The ship-gate ordering and the
  `--upload-only` path are unchanged, and the gate still runs BEFORE any
  version is resolved.
- The three log lines the owner named are kept exactly:
  `[ios-ship] marketing=<m> build=<b>`, `App Store Connect will show this as:
<m> (<b>)`, and the new `version plan: asc_patch=... -> marketing=...;
build floors: train=... app=... commit_count=... -> build=...`.
- `scripts/ios-ship-workflow.test.mjs` now asserts the new mechanism (and that
  the retired seq paths do not come back).  `scripts/ios-identity.test.mjs` no
  longer asserts that `native/ios/project.yml` holds `1.0.<build>`: the two
  numbers are independent now, and the project file is not a source.
- Docs that claimed the marketing version equals the build number were
  reworded: `scripts/ios-fleet/README.md`, the `notes` field in
  `scripts/ios-fleet/apps.json`, and the banner of
  `docs/rollouts/2026-08-23-ios-version-regimen.md`.

## CI

`npm test` runs `node --test 'scripts/**/*.test.mjs'`, and the glob picks up
`scripts/ios-fleet/version-plan.test.mjs` with no CI edit.  This repo has no
`scripts/ios-fleet/test-ship-seq.sh` (the Congress.Trade file that carries the
offline ship tests), so there was no such test to update, and no
`check-drift.sh` FILES list to extend.  The offline ship path was verified
out of tree instead, with a fake `node` behind the `IOS_FLEET_NODE` seam and a
stubbed App Store Connect.

## Verification

- `bash -n scripts/ios-fleet/ship-testflight.sh`, `node --check` on every
  changed `.mjs`: clean.
- `node --test scripts/ios-fleet/version-plan.test.mjs`: 18 pass.
- `node --test` over the three touched test files: 35 pass.
- The full `scripts/**/*.test.mjs` glob: 180 pass.
- Offline ship runs through the `IOS_FLEET_NODE` seam: next patch from ASC
  (drift train ignored), build raised above the floor, `--version` and
  `--build` overrides, the `1.0.N (N)` guard, the ASC-unreachable die and
  `--allow-unverified-seq` path, `--upload-only`, and the gate skipping
  before any version is resolved.
- The client against a stubbed App Store Connect: `latest-marketing-patch`
  returns the patch with the drift train ignored, `build-floor` returns the
  train and app floors (iOS counts only the plain integers below 1000000000,
  macOS counts every build).

## Not done, on purpose

- Nothing was committed or pushed.
- `.github/workflows/ios-ship.yml` still carries a comment that says the
  versioning is `1.0.<commit count>`.  It is now wrong, but that file is a
  ship workflow: editing it triggers a real ship, so it was left alone.
- `native/ios/project.yml` still says `1.0.<commit_count>` in its own comment
  and still records `1.0.305` / `305`.  Native source is out of scope for this
  change, and the recorded pair is now just a record of the last ship.
