# DealDex Status — 2026-09-20 (MM comprehensive review)

## Active lane

- **Seat:** MM (MiniMax), Slack tag `[MM]`, branch prefix `mm/`.
- **Branch:** `mm/comprehensive-review`.
- **Worktree:** `~/apps/dealdex-mm`.
- **Owner direction 2026-09-20:** comprehensive top-to-bottom review across web + iOS + Android + all integrations.  File findings, then implement.  Explicit asks: enable official eBay API, avoid DC-IP issues, raise listings analyzed, Sentry + all features on Android, opt-in auto-purchase on saved filters within user caps.

## In Progress

| PR | Title | State |
|----|-------|-------|
| #339 | feat(scan): eBay Browse API path + raise cap to 50 (#335, #338) | **MERGED** 2026-09-20T20:41Z |
| #340 | feat(alerts): auto-buy schema + server preview endpoint + dry-run UI (#336) | **MERGED** 2026-09-20T20:55Z |
| #341 | feat: Sentry parity + proxy pool + scan-runner cron + native alerts parity | **OPEN**, auto-merge armed, CI green at writing |

## Boards (claimed, In Progress)

- `b4146f75` eBay official Browse API path
- `6c800b9c` raise scan cap to 50 with paging
- `d362b287` auto-purchase architecture (saved filter + UI + dry-run preview)
- `f808a67c` Android Sentry parity (profiling + scan spans + ProGuard)
- `476c1efa` residential / rotating-IP proxy fallback
- `e88a8c69` server-side background scan-runner cron + scan_runs migration
- `3cf2abcd` Android / iOS alert-channel parity + iOS Saved status mutator
- `111ab67c` doc / typecheck / perf sweep across the new adapters

## Issues

- #335 eBay Browse API path (closed by #339)
- #336 auto-buy (closed by #340)
- #337 Android Sentry parity (closed by #341)
- #338 scan cap raise (closed by #339)

## Next action

- PR #341 to merge when CI is green (auto-merge armed).
- Then: rollout doc post-Slack (`#ag***-s**c` `[MM]` post per merge).
- Then: book the owner-only knobs on Infisical:
  - `EBAY_APP_ID` + `EBAY_CERT_ID` (production, scope: `buy.browse.readonly` + `buy.item.feed`)
  - `SCAN_RUNNER_URL` (deployed origin) + `SCAN_RUNNER_TOKEN` (32+ char)
  - `PROXY_URL_LIST` (only if owner wants the rotating-IP fallback)

## Deliberate follow-ups (not blocking)

- eBay Order API write scope: needed to flip `autoBuy.dryRun = false` in production.  Owner grants on developer.ebay.com.
- Email / SMS / Pushover providers: UI fields are wired on all 3 platforms; the runner's send path is the next PR.
- Mercari scan resilience: still cascade-falls through Brave + DDG; no first-party API exists.  The cap raise + eBay Browse path closes most of the data-center IP gap on the eBay side.
- iOS / Android auto-buy preview UI: re-uses the same `evaluateAutoBuy` module via a future server endpoint.