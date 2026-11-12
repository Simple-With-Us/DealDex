# 2026-08-14 — GROK-BUILD standing fleet seat

## Context & Objective

The owner asked this Grok Build TUI session to set itself up in the full
fleet infrastructure using
[ONBOARDING-NEW-APP.md](https://github.com/jaywedgeworth22/ai-fleet-coordinator/blob/main/docs/ONBOARDING-NEW-APP.md)
(and the sibling new-agent playbook).  DealDex is already a fleet app
(PR #1).  The missing piece was the **Grok Build seat** in the coordinator
inventory.

## Changes Made

- Mac lane: `~/apps/dealdex-grok-build` on `grok-build/fleet-setup` from
  `origin/main` (never `~/Code/DealDex`).
- Coordinator lane: `~/apps/fleet-grok-build` on `grok-build/grok-build-seat`.
- `onboard-new-agent.sh --tag GROK-BUILD` appended the seat to
  `fleet-apps.json` (Notes name `Grok Build`, suffix `grok-build`, prefix
  `grok-build/`).
- Slack intro + claim posted as `GROK-BUILD` (`cadence: per-turn-poll`).
- Live board `~/apps/DEALDEX-EFFORT-LOG.md` reconciled with this mirror.
- Honored GROK `->FLEET` keepout on `AG***-S**C.md`, `TEMPLATE-AGENTS.md`,
  both ONBOARDING docs, and `AGENTS.md`.  Asked Mac Grok to add the
  matching Agent Seat table row.

## DealDex app checklist (already true on main)

- Integration tree is `jaywedgeworth22/DealDex` (dirty/behind locally —
  do not pull until the uncommitted pbxproj/xcuserdata is handled).
- `AGENTS.md` tracked and forbids `~/Code/DealDex`.
- Live board + `docs/EFFORT-LOG.md`.
- Effort Issues Sync + CI workflows on `main`.
- `fleet-apps.json` row, digest/calendar `DEFAULT_REPOS`, Slack `repo: DealDex`,
  acronym `DD`.
- `check-fleet-registry.py` exits 0.
- iOS: `native/ios/CLAUDE.md`, Claude pbxproj hook, `ios-fleet/apps.json`
  entry (`me.grok.dealdex`, do not ship until ASC exists).

## Owner dashboard (not invented)

| Surface | Status |
|---------|--------|
| Infisical project (prod env) | Not created |
| Coolify / Vercel host | Not wired.  `/vercel /+` parked for after this PR |
| `SENTRY_FLEET_DSN` | Not set; sentry-ci-report not added |
| `FLEET_GITHUB_TOKEN` includes this private repo | Unknown / likely missing |
| App Store Connect record | Not created |
| UptimeRobot / PagerDuty | No prod URL yet |
| Usage-Monitor producer | Not requested |

## Verification State

- Slack post returned OK as `GROK-BUILD`.
- Worktrees exist and are not `~/Code/DealDex`.
- `python3 scripts/check-fleet-registry.py` still clean after the seat append
  (checker is app-scoped, not seat-scoped).

## Next

- Merge this PR + the coordinator `fleet-apps.json` PR.
- Mac Grok adds the AG***-S**C seat row under their keepout.
- Resume Vercel import.
