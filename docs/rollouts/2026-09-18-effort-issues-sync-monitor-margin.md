# 2026-09-18 - effort-issues-sync-monitor-margin

## Context & Objective

Sentry issue **FLEET-INFRA-CG** (`https://jays-services.sentry.io/issues/7708984611/`)
regressed again at 2026-09-18T06:33Z as `Cron failure: ci-dealdex-effort-issues-sync` /
`A missed check-in was detected`.  The daily effort-board mirror is healthy.
GitHub's `schedule` trigger for `.github/workflows/effort-issues-sync.yml` is
delivered hours late, so the 15-minute Crons margin is structurally guaranteed
to page every day.  Goal: stop that false page without changing the sync
cron, the sync script, or Coolify.

## Changes Made

Widened the Sentry Crons `checkin_margin` for workflow `Effort Issues Sync`
from 15 minutes to 600 minutes (10h), via the existing per-workflow
`CRON_CHECKIN_MARGIN_MINUTES` map in `scripts/sentry-ci-report.py`.  The
iOS-ship override stays 100.  The workflow crontab (`18 6 * * *`) and
`scripts/sync-effort-issues.py` are unchanged.

Evidence:

- Monitor `ci-dealdex-effort-issues-sync` (`ff0dcc78-5e9c-49ea-8d99-9d7fbd635e00`):
  crontab `18 6 * * *`, `checkin_margin` 15, `max_runtime` 60.  16 missed
  events since 2026-09-03.  0 users.  Seer actionability low.  Every
  day misses at 06:33Z and auto-resolves when the late OK lands
  (~10:36-12:49Z).
- Scheduled Actions runs (`gh run list --workflow effort-issues-sync.yml`)
  all start late, then finish in ~12s on `ubuntu-latest`: 2026-09-17 11:42Z,
  09-16 11:35Z, 09-15 11:44Z, 09-14 12:48Z, 09-13 11:53Z (typical delay
  4.3-6.5h).  Worst in the retained window: 2026-09-14 12:48Z (~6h 30m after
  the 06:18Z slot).  All retained scheduled runs are `success`.
- Reporter is `workflow_run` `completed` + schedule-only.  No `in_progress`.
  `in_progress` cannot cover this: GitHub has not created the run yet at
  06:33Z.  Do not add a second in_progress path from this issue.
- Last OK 2026-09-17T11:42:41Z matches reporter run `35217115495` after
  scheduled sync `35217094869` (12s success).  No 2026-09-18 schedule run
  existed at the 06:33Z miss.

Files touched:

- `scripts/sentry-ci-report.py` — `CRON_CHECKIN_MARGIN_MINUTES["Effort Issues Sync"] = 600`
- `scripts/sentry-ci-report-margins_test.py` — AST parse of the override + cron
- `STATUS.md` / `docs/EFFORT-LOG.md` — handoff rows
- `docs/rollouts/2026-09-18-effort-issues-sync-monitor-margin.md` — this note

## Decisions & Trade-offs

600 minutes matches Socratic.Trade #3194 / #3387 / #3389 / #3390, Autorotate
#219, and Usage-Monitor #1491, and sits above the measured 6h 30m worst delay
while still paging ~16:18Z if the daily sync truly never starts.  Do not copy
600 onto the 30-min macos iOS-ship cron (already 100; FLEET-INFRA-CC drops
ticks entirely).  Do not `workflow_dispatch` the sync to "verify" — that is
not a schedule check-in.  Extra-ship no: `ios-ship.yml` `paths` do not include
the reporter.

The 600-minute config only upserts when the next scheduled reporter check-in
runs (~10:36-12:49Z).  Tomorrow 06:33Z will still miss if this merges today,
until that upsert.  Do not `Fixes FLEET-INFRA-CG` on merge; ignore/resolve CG
after the monitor lands ok under the new margin.

## How to Verify

```bash
python3 -m py_compile scripts/sentry-ci-report.py
python3 scripts/sentry-ci-report-margins_test.py
```

Expected: `MARGIN_PARSE_OK` includes `Effort Issues Sync: 600` and the existing
iOS-ship 100; cron stays `18 6 * * *`.
