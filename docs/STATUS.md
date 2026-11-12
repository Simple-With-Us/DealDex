# DealDex Status — 2026-10-15 (Cursor cloud)

## Active lane

- **Seat:** Cursor cloud agent, branch prefix `cursor/`.
- **Branch:** `cursor/dd-369-alert-runs-34a8`.
- **Worktree:** `/workspace` (Grok Build preview checkout).

## This turn

- **DD-368** / **DD-370:** verified on `main` — shipped in PR #341 (proxy pool + native alert channels + iOS Saved status menu).
- **DD-369:** PR in flight adds missing `migrations/0011_alert_runs.sql` and persists one `alert_runs` row per `POST /api/alerts/run` tick (`scan_runs` + cron already on `main`).

## Next action

- Land DD-369 PR when CI is green.
- Owner knobs unchanged: `SCAN_RUNNER_URL`, `SCAN_RUNNER_TOKEN`, optional `PROXY_URL_LIST` (see `INFISICAL.md`).
