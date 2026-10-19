# 2026-10-19 — iOS ship scripts read Infisical, not the old secrets folder

Refs AFC-359 (retire the local secrets folder).

## What changed

- `scripts/ios-fleet/ship-testflight.sh` and `scripts/ios-fleet/asc-api.mjs` take `ASC_KEY_ID`, `ASC_ISSUER_ID` and `ASC_KEY_PATH` from the environment first (CI sets them). On a Mac they fall back to Infisical Fleet-OPS through `fleet-secrets get`: `/asc` for `ASC_KEY_ID`, `ASC_ISSUER_ID` and the `.p8` (`ASC_KEY_P8`). The shell writes the key to a mode-600 temp file and deletes it on exit; the Node client keeps it in memory.
- `scripts/ios-appstore-gm-prepare.sh` no longer writes `appstore-connect.env` or the `.p12` under the old folder. It uses a private temp dir, and the job environment already carries the ASC names to the ship step.
- `scripts/ios-fleet/test-asc-credentials.sh` (new, run in CI) covers env-first, Infisical fallback and temp-key cleanup with a fake `fleet-secrets`.
- Docs and `.gitignore` comment updated. Historical rollout notes still mention the old folder and stay as they were.

## Verify

`node --test scripts/ios-ship-workflow.test.mjs`, `bash scripts/test-ios-stage-asc-key.sh`, `bash scripts/ios-fleet/test-asc-credentials.sh` and `bash -n` on the changed scripts pass. The Mac asc-api path was proved read-only (apps list, status and count only) with a temporary HOME.
