# 2026-08-13 — Grok Build joins the fleet

Seat: GROK-BUILD

## What shipped

- Named seat **Grok Build** in `AGENTS.md`. Branch prefix `grok-build/`.
  Lane is the App Builder preview (`/workspace`). Mac Grok stays on
  `~/apps/dealdex-grok` / `grok/`.
- Marketplace logos (PR #10) marked Completed on the effort board.
- CONTRIBUTING / STATUS updated so the next agent does not treat this
  preview as a second repo.

## Coordination

- Slack `#ag***-s**c` is a no-op from this preview (no `SLACK_BOT_TOKEN`).
  Announce via this PR. Mac seats can mirror to Slack if needed.
- Live board `~/apps/DEALDEX-EFFORT-LOG.md` should be mirrored by a Mac
  seat after merge; this checkout cannot write that path.

## Follow-up

Owner still needs the one-time Vercel/Coolify import. Product work from
Grok Build uses `grok-build/<slug>` + PR + merge.
