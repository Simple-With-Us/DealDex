# Kody Autofix Direct MiniMax API Follow-Up

## Caller Change

This follow-up corrects the initial gateway configuration from PR #448.  The DealDex Kody caller now uses model `MiniMax-M3` at MiniMax’s OpenAI-compatible endpoint, `https://api.minimax.io/v1`, with the existing organization secret `MINIMAX_API_KEY`.  The workflow name remains exactly `Kody MiniMax M3 Fix Proposals` so Sentry continues to match completed workflow runs.

The `web` profile, `src/` and `server/` source scope, `check_run` trigger qualification, enable flag, sender and app checks, retry and concurrency gates, permissions, and five-attempt daily budget stay unchanged.  The caller pins the direct-MiniMax-capable shared-workflow revision `77ac4cd11c05d2c883d2e0b3b28c4cf1bf82ebb9`.

## Verification Evidence

The original PR #448’s final checks passed: `verify`, `e2e`, `gitleaks`, and `android`.  Those checks cover the earlier Vercel Gateway configuration and do not validate the direct MiniMax helper.  The scoped caller workflow passes `actionlint`, and all changed files pass `git diff --check`.  The shared-workflow revision was pushed and validated by the shared-workflow owner.  No paid provider API call was made during this caller validation.

## Handoff

This follow-up is on `codex/cts-330-direct-minimax` for DealDex.  The parent owns landing.  `AGENTS.md` now directs reservation and tracking writes to Linear via `board` and marks `docs/EFFORT-LOG.md` as archived, read-only history.  The bot-added archived-log row was removed; prior history is unchanged.
