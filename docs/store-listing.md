# DealDex store listing (iOS + Android)

Updated: Fri, Aug 21, 2026.  Two spaces between sentences.  No agent names.

Privacy and support URLs use `https://dealdex.net` because that is the
hostname the website emits.  Checked 2026-08-20: `/` and `/privacy` returned
HTTP 200 DealDex.  `https://dealdex-psi.vercel.app` served the same build.
`https://dealdex.vercel.app` is a different Next.js product.  Do not point
the listing at it.

**Wordmark:** official DealDex title mark (red Deal + blue Dex, yellow badge).  Used in the website header, login, and marketing card.  
**Home-screen icon:** overlapping glossy red + blue bubble-letter Ds, thick yellow rim, on the Socratic.Trade tiled field (no candlesticks).  Not the in-app wordmark.

**iOS bundle:** `net.dealdex`  
**Apple bundle resource ID:** `R2FAW69NPD` (Developer portal App ID resource; **not** a team ID)  
**Team / DEVELOPMENT_TEAM:** `CC8UTF7ATG`  
**Android package:** `me.grok.dealdex`  
**SKU:** `dealdex`  
**App icon:** overlapping glossy red + blue bubble-letter Ds, thick yellow rim, on the Socratic.Trade tiled field (not the in-app wordmark).
**Category:** Shopping  
**Marketing version:** 1.0.2  
**Privacy:** `https://dealdex.net/privacy`  
**Support:** `https://dealdex.net/`

## Name

DealDex

## Subtitle (30)

Best-priced card listings

App Store subtitle is capped at 30 characters.  The in-app, website, and OG
subtitle is Compare Pokémon card listing prices (35 characters).

## Promotional text

Compare Pokémon card listing prices.  Search supported eBay and Mercari singles and compare asking prices with available market references.

## Description

DealDex helps compare Pokémon card listing prices.  Search supported eBay and Mercari Buy It Now singles and compare asking prices with available market references.  Source coverage depends on the listing and configured data services.

Keys you paste in Settings stay on the device.  The phone apps scan from the phone.  They do not wrap the website.  If the website is down, scan still uses those keys.

Sign-in is optional.  Use the same email as the website only when you want to copy keys to or from your account.

Not affiliated with TCGPlayer, eBay, Mercari, PriceCharting, or Pokémon.

## Keywords

pokemon,tcg,ebay,mercari,deals,listings,pricecharting,tcgplayer,cardmarket,singles

## What's New (1.0.1)

[1.0.1] DealDex first store build
Released: Fri, Aug 14, 2026 at 4:20 PM CT

What's New:
- First TestFlight and store build of the native DealDex desk
- Scan eBay and Mercari Buy It Now singles on the device
- Score each ask against free and optional paid desks
- Keys stay on the phone; sign-in is optional for backup

## Review notes (App Store / Play)

This app scans public eBay and Mercari listings and scores the ask against public price desks.  No account is required.  Paste optional API keys in Settings.  Sign-in is only for backing up those keys.

Demo: open Scan, leave the query on All Pokémon, tap Scan.  Results appear if the device can reach the marketplaces.

## Age

4+  (no user-generated chat, no gambling)

## Android Play

Package `me.grok.dealdex`.  Same listing copy as above.  This Mac has no Google Play Console credentials, so the Play upload cannot run until the owner adds a Play developer account and a service-account JSON under `~/.secrets/`.


## Member plan (draft)

See `docs/plans/2026-09-04-member-monetization-and-scan.md` for free 8-result cap, Member pricing, alert speed, auto-buy warm-up, scan cache, and marketplace backup / coverage audit.
