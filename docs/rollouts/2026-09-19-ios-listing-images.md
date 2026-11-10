# 2026-09-19 — iOS listings lost their photos + the stale "LIVE MARKET SCAN" header

**Seat:** BF-FIXER  **Branch:** `fixer/ios-listing-images`  **Worktree:** `~/apps/dealdex-fixer`

## Also in this change: remove the iOS "LIVE MARKET SCAN" header

Owner asked (twice, on 2026-09-19) to drop the redundant "LIVE MARKET SCAN" /
"Scan Sources" line.  The web scanner already had it removed in PR #213
(`docs/rollouts/2026-08-31-mobile-scanner-source-row.md`), and the deployed
`https://dealdex.net` serves no such string.  The only surviving instance was
the native iOS header at `native/ios/DealDex/ScanView.swift:27`, so this change
removes it.  The wordmark + one-line subtitle stay.

## Symptom

Owner, 2026-09-19: listings used to show a thumbnail on iOS but now do not —
the photo only appears after tapping through to the eBay/Mercari listing.

## Root cause

`native/ios/DealDex/Market.swift` scans eBay/Mercari **on the device** first and
only falls back to the website when that returns nothing
(`121ea10`, "full-app review remediation", flipped the order from
website-first to on-device-first to honour `/privacy`).

The on-device parsers `parseEbay` / `parseMercari` built their `LiveListing`
rows with a hard-coded `image: nil`.  The site parser
(`src/lib/marketplaces/jina.ts`) has always read the thumbnail out of the same
Jina markdown, and the Android parser
(`native/android/.../data/Market.kt`) reads it too.  So the photo silently
disappeared from iOS the moment scans started going through the on-device path:
`ListingRow` renders `row.listing.image ?? row.card?.image`, both of which were
nil.

## Fix

Mirror the Android / site behaviour in the iOS parsers:

- `parseEbay` — lift `https://i.ebayimg.com/images/g/...` out of the Jina chunk.
- `parseMercari` — lift `https://u-mercari-images.mercdn.net/...` from the
  snippet, falling back to Mercari's deterministic
  `.../photos/<id>_1.jpg` when the snippet carries no image.
- New `firstMatch(_:_:)` helper (NSRegularExpression) shared by both.

No layout change, no copy change, no extra-ship.  One behaviour: rows scanned on
the phone keep the same thumbnail the website rows already showed.

## Verification

- `xcodebuild -project native/ios/DealDex.xcodeproj -scheme DealDex -destination 'generic/platform=iOS Simulator' build` — see PR.
- Visual: a scanned row must render a thumbnail in the Simulator before this is
  called shipped (per `native/ios/CLAUDE.md`, "BUILD SUCCEEDED is not visual QA").

## Board

Claimed as BF-FIXER on the DealDex effort board in the same change.
