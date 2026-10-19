# 2026-10-19 — Real market scan capture for the catalog page

Refs SWU-15 (the Simple-With-Us DealDex page shipped with no screenshot).

## What changed

- `docs/screenshots/scan-results.png` (new) is a real capture of the live web
  app at `https://dealdex.net`: a completed scan for `Umbreon VMAX Evolving
  Skies` that returned 11 Mercari listings and no eBay singles.  The frame is
  1440 x 900 CSS pixels at device pixel ratio 2, so the PNG is 2880 x 1800.
  Live verdicts, ask prices and desk ranges are visible in the listing cards.
- `docs/screenshots/README.md` (new) records the provenance: capture date,
  source host, viewport, tool, and the fact that the figures are a snapshot
  of that day's market.
- `STATUS.md` records this unit at the top.

No product code, copy or behaviour changed.  The app is untouched.

## Why

The `Simple-With-Us` catalog page for DealDex was the only app page with no
screenshot at all, and the one that had a screenshot previously shipped a
generated mockup that was removed in `Simple-With-Us` PR #61.  A real capture
is the only replacement that keeps that promise.

The raw frame lives in this repo so the published WebP can be regenerated
from a source of truth rather than trusted in place.

## Verify

The PNG opens and reports 2880 x 1800 RGB.  The published WebP is produced
from this file by `scripts/prepare_screenshots.py` in `Simple-With-Us`, which
resizes to 1280 px wide and enforces the page image budget.

The scan is rate limited.  Consecutive scans can return empty with "No live
listings right now.  Try again in a minute.", so a recapture has to wait
between attempts and confirm a non-zero `All (N)` before the frame is taken.
