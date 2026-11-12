# 2026-10-29 — Scheduled iOS gate covers every push path

Owner rule (Oct 29 2026): unless a merge built recently, the scheduled TestFlight backstop should build it.  The ship workflow's push trigger watches the native tree plus ship tooling (`scripts/ios-fleet/**`, the workflow file, wrapper scripts), but the scheduled gate only diffed `native/ios/`.  A merge that touched only tooling sat unshipped whenever its push run never dispatched (workflow disabled at merge time, dropped event, bot merge).

`scripts/ios-scheduled-ship-gate.sh` now takes a repeatable `--path-prefix`, one per `on.push.paths` entry.  Each value is passed to git as a pathspec, so `dir/` prefixes, exact files, and `*`/`**` globs work, and a leading `!` excludes the same way push does (one documented difference: git exclusions always win, while push re-includes on a later positive match).  The old single-prefix call shape still works.

`.github/workflows/ios-ship.yml` passes all six push entries to the gate.  Cron, push paths, the rate gate, the same-HEAD skip, the no-git fail-safe skip, and non-schedule always-ship are unchanged, and no `--force-ship` was added.  `scripts/ios-ship-workflow.test.mjs` now pins the gate's prefix list to `on.push.paths` so the two cannot drift.

Tests: `scripts/test-ios-scheduled-ship-gate.sh` mirrors the workflow pattern set and adds tooling-only ships, workflow-file-only ships, wrapper-only ships, `!`-exclusion skips, single-prefix compat, and README/server unrelated-skips (19 checks).  `node --test` on the two pinning test files passes 10/10.  No pin script exists in this repo, so step 4 was a no-op.
