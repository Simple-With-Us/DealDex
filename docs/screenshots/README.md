# Screenshots

Real captures of the live DealDex web app.  These are not mockups and not
redrawn UI: every frame is a browser screenshot of `https://dealdex.net`
serving live marketplace data.

## `scan-results.png`

A completed market scan for the query `Umbreon VMAX Evolving Skies`.

- Captured: 2026-10-19.
- Source: `https://dealdex.net`, the public production site.
- Viewport: 1440 x 900 CSS pixels at a device pixel ratio of 2, so the PNG is
  2880 x 1800.
- Browser: Google Chrome, driven by Playwright.
- Content: the scan returned 11 Mercari listings and no eBay singles, so the
  header shows the Mercari count at 11 and eBay at 0.  The quick-view pills
  read `All (11)`, `Deals (1)` and `Verified Steals (1)`.  The visible
  listing cards carry live verdicts (`Good Deal`, `High Ask`, `Overpriced`),
  live ask prices and live desk ranges.

Listing thumbnails are the sellers' own marketplace images.  Prices, verdicts
and card names are whatever the market returned on the capture date and will
not match a later scan.

## Why these live in the repo

`Simple-With-Us` publishes the processed WebP on the DealDex catalog page at
`https://simplewithus.com/dealdex/`.  Its `scripts/prepare_screenshots.py`
reads the raw frame from this folder, resizes it to 1280 px wide and encodes
it as WebP.  Keeping the raw capture here means the published image can be
regenerated and checked against the source instead of being trusted.

## Recapturing

The scan is rate limited: consecutive scans can come back empty with "No live
listings right now.  Try again in a minute."  Wait between attempts, and
confirm the quick-view pills show a non-zero `All (N)` before capturing.
