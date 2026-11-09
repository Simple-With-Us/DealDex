# OPS-1052 phase 2 — post-sync TestFlight readiness recheck

In-ship `ensure-tf-ready` still runs before standing-tester sync.  The hosted
workflow now re-runs a read-only `ensure-tf-ready` after sync and reports that
second verdict on `$GITHUB_STEP_SUMMARY` (rc labels match `tf-ready-rc.sh`).

- `scripts/ios-fleet/tf-ready-rc.sh` — shared rc handlers (extracted from ship).
- `scripts/ios-recheck-tf-ready.sh` — post-sync caller (`IOS_TF_READY_TIMEOUT_SEC=300`).
- `.github/workflows/ios-ship.yml` — recheck + summary steps after sync.

Verified: `bash -n` on changed shell, `node --test scripts/ios-ship-workflow.test.mjs`,
`node --test scripts/ios-fleet/test-ensure-tf-ready-rc.node-test.mjs`, `actionlint`
on `ios-ship.yml`.
