# DealDex-local iOS fleet ship copy

Vendored from Congress.Trade `scripts/ios-fleet` so this repo can ship
without `/Users/jay/apps/ios-fleet` on the runner.  `apps.json` here is
DealDex-only: bundle `net.dealdex`, team `CC8UTF7ATG`, SKU `dealdex`,
fixed version `0.1.0`. `ship-testflight.sh` accepts
the same first-arg keys as Congress/Socratic (`socratic|congress|usage|usage-local`)
plus `dealdex`. `R2FAW69NPD` is the Apple bundle resource ID, not the team.

## Version numbering (owner directive 2026-10-29)

DealDex ships a fixed marketing version with a shared merge-timestamp build:

- `MARKETING_VERSION` is the fixed `0.1.0` from `apps.json`
  (`fixedMarketingVersion`).  It does not count up per ship.
  `--version <X.Y.Z>` pins it exactly.
- `CURRENT_PROJECT_VERSION` is `max(S, M + 1)` as a plain integer, where
  `S` is the committer date of the commit being built (HEAD, the
  squash-merge commit on main) in America/Chicago as `YYYYMMDDHHMM`
  and `M` is the highest first numeric component among every build of
  the app and its paired app on both platforms (expired included, all
  trains, old timestamp-style builds included) plus every extra floor.  No
  floor, no cap: a rebuild of the same commit still goes up.

The release workflow computes that build ONCE per release (the `plan-build`
step runs `ship-testflight.sh --plan-build-only`, which plans through
`asc-api.mjs plan-release-build`) and hands the single value to every ship
job via `--build <N>`.  A fixed-mode `--build` must be a 12-digit stamp
greater than every existing build of that app record on that platform; the
paired platform may reuse the same number.  Without `--build`, fixed mode
plans `max(S, M + 1)` itself through the same code path, for operators
running locally.  The rule lives in `shared-build.mjs` (pure, unit-tested
by `shared-build.test.mjs`); the non-fixed next-patch scheme still lives in
`version-plan.mjs` for apps without `fixedMarketingVersion`.

`scripts/ios-ship-testflight.sh` prefers this directory, then falls back
to `/Users/jay/apps/ios-fleet` on Jay's Mac.

On a Mac the ASC credentials come from Infisical (`fleet-secrets get` from `/asc`: `ASC_KEY_ID`, `ASC_ISSUER_ID`, `ASC_KEY_P8`); CI publishes the hosted base64 trio (`APPLE_API_KEY_ID`, `APPLE_API_ISSUER_ID`, `APPLE_API_KEY_P8_BASE64`) in the job environment.
A path is not a credential source: `asc-api.mjs` never reads a key file, and a named `ASC_KEY_PATH` is ignored. `ship-testflight.sh` stages its own short-lived, owner-only copy from the resolved credential for the Apple tools that can only read a key from disk, and hands the key to the client in the environment as `ASC_KEY_P8` (AFC-459 / Kody rule 42).
Do not put ASC keys in GitHub secrets or this tree.

When fleet ship behavior changes, copy `ship-testflight.sh`, `asc-api.mjs`, `asc-key.mjs`,
`publish-ios-versions.sh`, and the ExportOptions plists from Congress.Trade
and keep this `apps.json` DealDex-only.

`publish-ios-versions.sh` must seed from the live
`Simple-With-Us/AI-Fleet-Coordinator` `site/ios-versions.json` (or `--base-json`).
This directory does not carry a full local snapshot. Publishing
`{apps:{net.dealdex}}` would wipe sibling fleet apps from the shared
manifest the in-app update prompt reads.

## In-app update prompt (pin)

`AppUpdatePrompt.swift` in this directory is the in-repo pin. Copy it
into `native/ios/DealDex/AppUpdatePrompt.swift`. Keep the two files
byte-identical. Do not make a Swift package. Do not fork behavior.

Apple IDs are not hardcoded in the Swift file. Live DealDex is
`net.dealdex` / `6804249232` in `apps.json` here and in
`Simple-With-Us/AI-Fleet-Coordinator` `site/ios-versions.json`. The iOS target
also sets Info.plist `AppUpdateAppleId` to that same number as a
local fallback. Public host is https://dealdex.net.
