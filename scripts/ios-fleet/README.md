# DealDex-local iOS fleet ship copy

Vendored from Congress.Trade `scripts/ios-fleet` so this repo can ship
without `/Users/jay/apps/ios-fleet` on the runner.  `apps.json` here is
DealDex-only: bundle `net.dealdex`, team `CC8UTF7ATG`, SKU `dealdex`,
train `1.0`. `ship-testflight.sh` accepts
the same first-arg keys as Congress/Socratic (`socratic|congress|usage|usage-local`)
plus `dealdex`. `R2FAW69NPD` is the Apple bundle resource ID, not the team.

## Version numbering (owner directive 2026-10-24, AFC-517 / CT-2444)

The marketing version and the build number are independent:

- `MARKETING_VERSION` is `<prefix>.<P+1>`: the next patch on the train,
  where `P` is the highest patch App Store Connect already holds on that
  train (App Store versions AND TestFlight trains, drift trains ignored). 
  `--version <X.Y.Z>` pins it exactly.
- `CURRENT_PROJECT_VERSION` is the repo commit count
  (`git rev-list --count HEAD`), raised above every build already in the
  target train and above the app's own plain-integer builds below
  `1000000000` (on macOS: above every build of any size).  `--build <N>`
  pins it exactly, and it never moves the marketing version.

The two are not the same number, so App Store Connect shows
`1.0.237 (2360)`, not `1.0.N (N)`.  The rules live in
`version-plan.mjs` (pure, unit-tested by `version-plan.test.mjs`) and the
App Store Connect state they need is read by `asc-api.mjs`
(`latest-marketing-patch`, `build-floor`).  The retired local build-seq
counter and `project.pbxproj` are not sources any more: App Store Connect
is the only record that shipping advances.

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
