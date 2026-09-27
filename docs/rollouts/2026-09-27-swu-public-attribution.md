# DealDex public attribution and footer copy — 2026-09-27

## Scope

PR #361 adds a quiet Simple With Us link in the public footer with the complete official SWU logo.  The footer now says reference values may come from the named desks when available, since not every scan receives every source.  The README names the live site and SWU provenance.  Scanning, accounts, key handling, and native apps are unchanged.

## Verification and release

Local `npm run typecheck` and `git diff --check` passed.  The full 1920×200 WebP asset was checked locally, and `https://dealdex.net/swu-logo-wide.webp` returned HTTP 200 after merge.  Confirm the visible footer and the production deployment commit before marking the work Deployed.  Vercel production builds from `main`; `docs/HOSTING.md` documents its three-hour automatic guard and manual final-release exception.

Board `f1f1f303e51a44d9bfd76e1738f49e99`; GitHub issue #360; PR #361.  This note addresses the required chronological handoff flagged on PR #361.
