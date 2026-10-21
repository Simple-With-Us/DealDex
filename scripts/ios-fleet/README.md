# DealDex-local iOS fleet ship copy

Vendored from Congress.Trade `scripts/ios-fleet` so this repo can ship
without `/Users/jay/apps/ios-fleet` on the runner. `apps.json` here is
DealDex-only: bundle `net.dealdex`, team `CC8UTF7ATG`, SKU `dealdex`,
marketing `1.0.<commit_count>`, build `<commit_count>`. `ship-testflight.sh` accepts
the same first-arg keys as Congress/Socratic (`socratic|congress|usage|usage-local`)
plus `dealdex`. `R2FAW69NPD` is the Apple bundle resource ID, not the team.

`scripts/ios-ship-testflight.sh` prefers this directory, then falls back
to `/Users/jay/apps/ios-fleet` on Jay's Mac.

On a Mac the ASC credentials come from Infisical (`fleet-secrets get` from `/asc`: `ASC_KEY_ID`, `ASC_ISSUER_ID`, `ASC_KEY_P8`); CI sets `ASC_KEY_ID`, `ASC_ISSUER_ID` and `ASC_KEY_PATH` in the job environment.
A path is not a credential source: `asc-api.mjs` never reads a key file. `asc-key.mjs` reads the staged file and hands the key to the client in the child's environment as `ASC_KEY_P8` (AFC-459 / Kody rule 42).
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
