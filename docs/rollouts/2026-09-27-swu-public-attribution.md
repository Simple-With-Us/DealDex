# DealDex public attribution and footer copy — 2026-09-27

## Scope

PR #361 adds a quiet Simple With Us link in the public footer with the complete official SWU logo.  The footer now says reference values may come from the named desks when available, since not every scan receives every source.  The README names the live site and SWU provenance.  Scanning, accounts, key handling, and native apps are unchanged.

## Verification and release

Local `npm run typecheck` and `git diff --check` passed.  The full 1920×200 WebP asset was checked locally, and `https://dealdex.net/swu-logo-wide.webp` returned HTTP 200 after merge.  The live footer was visually verified in a browser with the complete signature and conditional reference-value wording, so the board is Deployed.  Vercel production builds from `main`; `docs/HOSTING.md` documents its three-hour automatic guard and manual final-release exception.

Board `f1f1f303e51a44d9bfd76e1738f49e99`; GitHub issue #360; PR #361.  This note addresses the required chronological handoff flagged on PR #361.

## Follow-up public comparison copy

Issue #367 / board `b6445c54` qualifies the homepage subtitle and introduction, search metadata, README, and current copy guidance.  “Compare Pokémon card listing prices” replaces the best-price claim; references depend on listing/source access and configured data services.  Files: `src/lib/copy.ts`, `src/routes/index.tsx`, `src/routes/__root.tsx`, `README.md`, `AGENTS.md`, `docs/store-listing.md`, `native/README.md`, `STATUS.md`, and `docs/EFFORT-LOG.md`.  No scanner, key handling, or pricing logic changed.  Existing native binaries may retain older wording until their next release.

Validation: `git diff --check` passed.  Existing hosted CI will typecheck, test, build, and run the smoke suite.  Production text verification remains pending; the earlier SWU footer release stays verified.
