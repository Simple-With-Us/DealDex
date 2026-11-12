# 2026-09-12 — CLAUDE — Fix TestFlight ship spam: persist ship-state across ephemeral runners

## What was wrong

Owner reported DealDex updates in TestFlight constantly even when no one is intentionally shipping.  `.github/workflows/ios-ship.yml` runs a 30-minute cron (`22,52 * * * *`) as a backstop for bot-merged PRs that never dispatch `push:`.  Two layers were supposed to stop that cron from spamming builds:

1. `scripts/ios-scheduled-ship-gate.sh` — skip a scheduled tick unless `native/ios/` changed since the last successful ship.
2. `scripts/ios-fleet/ship-testflight.sh` `evaluate_ship_gate()` — a second, independent 1-hour min-interval + same-HEAD gate.

Both read/write the same state file: `~/.cache/ios-fleet/last-ship-dealdex.txt` (`<unix_ts> <git_sha>`).

`ios-ship.yml` runs on `runs-on: macos-latest` — a fresh, disposable VM per job with no persisted `$HOME` and no `actions/cache` step.  So that state file never survived between runs.  Pulled the logs for 5 separate runs spanning 2026-09-07 through 2026-09-12 (scheduled and push) — every single one opened with:

```
[ship-gate] [dealdex] no prior ship recorded (/Users/runner/.cache/ios-fleet/last-ship-dealdex.txt); letting ship-testflight.sh decide.
[ios-ship] ship-gate: no prior ship for dealdex; proceeding
```

Both gates always took the "no prior ship; proceed" branch.  The 1-hour min-interval and "skip if unchanged" protections described in the workflow's own comments were dead code — every scheduled tick that got a runner archived and uploaded a brand-new build, regardless of whether app code changed or how recently the last upload happened.

Confirmed with `gh run list` / `gh run view --log`: nearly every scheduled run's "Ship DealDex to TestFlight" step actually ran the archive+upload (`** ARCHIVE SUCCEEDED **`, `exporting + uploading to App Store Connect...`), not just the gate script.

## Fix

Added `actions/cache/restore` right after checkout, and `actions/cache/save` (`if: always()`) as the last step, both targeting `~/.cache/ios-fleet`.  The action is pinned by commit SHA `55cc8345863c7cc4c66a329aec7e433d2d1c52a9` (v6.1.0, bumped from the v4.3.0 of the original PR by Dependabot PRs #317/#320).

Cache keys are immutable on GitHub Actions — a save can never overwrite an existing key, and this state file's content must change on every run (new sha/timestamp after every ship).  The key is `ios-fleet-state-dealdex-${{ github.run_id }}-${{ github.run_attempt }}`, and `restore-keys` is a two-level prefix match: `ios-fleet-state-dealdex-${{ github.run_id }}-` first (the latest attempt of the current run), then `ios-fleet-state-dealdex-` as a final fallback (the most recent state from any previous run).

`github.run_attempt` is the non-obvious part: GitHub reuses `github.run_id` when a workflow is rerun, and `actions/cache` keys are immutable, so without `run_attempt` a successful retry could never overwrite a stale save from the previous attempt (e.g. when `if: always()` saves state before `record_successful_ship` ever ran).  Seer Code Review caught exactly that on the original PR (#291) as a P2 finding; this rewrite folds the fix into the rollout doc.

## Verification

- `python3 -c "import yaml; yaml.safe_load(...)"` — YAML parses.
- `actionlint .github/workflows/ios-ship.yml` — exit 0, no findings.
- Did not run the workflow live (would ship a real build); the next scheduled tick after merge is the real-world check.  If `native/ios/` hasn't changed and less than an hour has passed since the last ship, the gate log should now say `ship-gate: skip` instead of `no prior ship`.
- Seer Code Review on #291: P2 (cache keys must include `run_attempt`) is fixed here.  P1 (two-space sentence separators) was a separate findings comment about this doc itself — also fixed by this rewrite, per `AGENTS.md` L180-L185 and `/Users/jay/apps/AG***-S**C.md` § Two spaces.  Note that the canonical chat-rendering form is `&nbsp; ` (HTML entity + space), NOT two literal ASCII spaces — GitHub-flavored markdown collapses two literal spaces.  In a markdown file like this one, the literal two-space form renders correctly because it's read as source.

## Not touched

- `build-seq-<app>.txt` (marketing-version sequence counter) lives in the same `~/.cache/ios-fleet` directory and rides along with this same cache now, but it wasn't the reported symptom and wasn't separately investigated beyond confirming it shares the directory.
- No change to `scripts/ios-fleet/ship-testflight.sh` or `scripts/ios-scheduled-ship-gate.sh` gate logic itself — both were already correct once given real state to read.

Branch `claude/seer-fixup-20260918` (follow-up to `claude/investigate-testflight-cadence` PR #291, merged 2026-09-12).  Board `30abb003`.
