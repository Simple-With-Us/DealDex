# 2026-09-04 — Sentry Max Features (DealDex)

Board `af1ab6e9`.  Branch `grok/sentry-max-features`.  Worktree
`~/apps/dealdex-grok-sentry-max`.

## Changes

- iOS `profilesSampleRate = 0.1` plus masked Session Replay (10% session /
  100% error).
- Web Replay/Feedback already on main.
- **Android native Sentry ENABLE** (Designer override of prior hold):
  `DealDexApp` now sets masked Session Replay 10% / 100% error plus
  `profilesSampleRate = 0.1`.  Empty `SENTRY_DSN` still stays dark.

## Verification

- `node --test src/lib/observability/sentry.test.ts`
