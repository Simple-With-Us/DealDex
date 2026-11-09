# OPS-1052 phase 2 — post-sync TestFlight readiness recheck

In-ship `ensure-tf-ready` still runs before standing-tester sync.  The hosted
workflow now re-runs a read-only `ensure-tf-ready` after sync and reports that
second verdict on `$GITHUB_STEP_SUMMARY` (rc labels match `tf-ready-rc.sh`).

- `scripts/ios-fleet/tf-ready-rc.sh` — shared rc handlers (extracted from ship).
- `scripts/ios-recheck-tf-ready.sh` — post-sync caller (`IOS_TF_READY_TIMEOUT_SEC=300`).
- `.github/workflows/ios-ship.yml` — recheck + summary steps after sync.
- `scripts/ios-observe-ship.mjs` — sets `uploaded=true` only when ship logs a real submit; post-sync recheck is gated on that output.
- Kody follow-ups: three-line apps.json metadata via portable `IFS= read -r` (no `mapfile` — bash 3.2 on `macos-latest`), no duplicate `GITHUB_STEP_SUMMARY` write in the recheck script, distinct-rc test strips case prefixes before comparing bodies.
- Hardening: `ios-observe-ship.mjs` streams logs with per-stream line scan + 8 KiB tail (no full-buffer concat), `spawn_error` settlement, `uploaded=unknown` for unconfirmed success; recheck validates `apps.json` before use (exit 2).

Verified: `bash -n` on changed shell, `node --test scripts/ios-ship-workflow.test.mjs`,
`node --test scripts/ios-fleet/test-ensure-tf-ready-rc.node-test.mjs`, `actionlint`
on `ios-ship.yml`.
