# DealDex Member monetization, alerts, and scan plan

Updated: Fri, Sep 4, 2026.  Two spaces between sentences.  No agent names in product copy.

Owner direction captured for notes / plans / docs.  Not shipped yet.

## Product tiers

### Free

- Basic site browsing stays free.
- Scan is capped at **8 results**: **4 eBay + 4 Mercari**, first found.
- Cap applies on **website and apps**.
- Side effect: free scans finish faster (fewer marketplace rows to fetch and score).

### Member

- Name in product: **Member** (not “Premium” unless listing copy later says otherwise).
- Trial: **3 days**.
- Prices: **$3/mo**, **$20/yr**, **$45 lifetime**.
- Member unlocks:
  - Full scan depth (beyond the free 8).
  - Deal push notifications, including optional **time-sensitive / critical** alerts when the user opts in.
- Member edge is **speed**: well-priced or underpriced singles move fast; notification latency is the product.

## Auto-buy (later)

- Optional tools to automatically buy listings after a user has a **detailed saved search** running for about **7 days**.
- The warm-up exists so the user has time to see what the search finds before any auto-purchase is enabled.
- Auto-buy stays off by default until that gate is met and the user opts in.

## Scan cache (current behavior)

- Shared server cache for **free-desk** scans (`scan_cache`, ~8 minute freshness).
- Same query can reuse prior scored rows (listings + enrichment) across visitors.
- Scans that used **any paid desk keys** are **never** written to the shared cache (cross-user paid books must not leak).
- Browser / native also keep local in-memory / device caches for card match helpers.

Implication: if a scan is still slow on a cache miss (or after freshness expires), the bottleneck is almost always **marketplace fetch**, not enrichment.

## Marketplace fetch (current behavior)

DealDex does **not** call official eBay or Mercari seller APIs for live search today.  It uses a scrape ladder:

| Market | Order |
|--------|--------|
| eBay | Jina reader → Brave HTML → direct eBay HTML |
| Mercari | Jina reader → Brave HTML → DuckDuckGo HTML |

Mercari often blocks direct reads; empty Mercari usually means the ladder failed, not that there are zero cards.

### Planned: stronger backups

- Keep the scrape ladder, but add **stable backup connection methods** for both eBay and Mercari (official Browse / partner APIs where terms allow, or another durable mirror).
- Fail over automatically when Jina/Brave/HTML return empty or time out.
- Measure per-hop latency so Member alerts are not stuck behind a dead primary hop.

### Planned: listings coverage audit

Sometime soon, audit whether scans find **all relevant single-card Buy It Now listings**, or whether the query / filters cast too narrow a net.

- Keep specificity (singles, BIN, price floor, Pokémon/TCG cues).
- Check missed inventory: named-card hunts, set/number variants, title phrasing eBay/Mercari use that our parsers drop.
- Decide whether free’s “first 4+4” should still sample from a **wider fetch** then truncate, vs truncating the fetch itself (speed vs coverage tradeoff for free).

## Implementation notes (non-goals for this doc)

- Do not ship App Store / Play IAP from this note alone.
- Free 8-cap and Member paywall need StoreKit + Play Billing + web entitlement when built.
- Push criticality levels need explicit user opt-in copy (no surprise critical alerts).
- Auto-buy needs separate safety review (payment method on file, caps, cancel, marketplace ToS).

## Related

- `docs/store-listing.md` — current public listing copy.
- `migrations/0004_scan_cache.sql`, `src/lib/server/scan-cache.ts` — shared free scan cache.
- `src/lib/marketplaces/ebay.ts`, `mercari.ts`, `jina.ts`, `brave.ts` — fetch ladder.

## Cache policy (owner refinement 2026-09-04)

The shared free-desk window (~8 minutes) only avoids a full rematch for that short span.  Enrichment from appraisal / rating desks and other scored fields changes rarely.  Listing identity (title, URL, marketplace id) also changes rarely.

**Prefer:**

- Keep enrichment and stable listing fields for much longer (hours to a day, with a clear TTL).
- On revisit, primarily re-check **price** (and maybe shipping) against the marketplace.
- Treat a price change as the signal to refresh that row; leave card match / desk quotes alone unless stale by the long TTL or the user forces a full scan.

**Optional / low priority:**

- Detect whether a listing image changed **without** downloading the full image (for example ETag / Last-Modified / URL fingerprint).  May be more effort than reward; do not block Member or free-cap work on this.

## Official marketplace APIs (researched 2026-09-04)

### eBay

- **Exists:** yes — Developers Program + Buy **Browse API** (`item_summary/search`, item detail).
- **Cost:** free to join; **no per-call fees**.  Default quota about **5,000 calls/day per app**.  Higher limits via Application Growth Check / Developer Support (approval, not pay-as-you-go).
- **Caveat:** production Buy/Browse access may need extra approval beyond a sandbox keyset.
- **Refs:** https://developer.ebay.com/api-docs/buy/browse/overview.html · https://developer.ebay.com/develop/get-started/api-call-limits

### Mercari

- **Public search API:** no self-serve developer portal for listing search.
- **Partner API:** partner-only under direct business agreements — not a free tier you can register for.
- **Ref:** https://about.mercari.com/en/business/

### Implication for DealDex

- Prefer **eBay Browse** as the primary official hop; keep Jina → Brave → HTML as fallback.
- Mercari stays on the scrape ladder unless a partnership lands.


## Coverage vs precision (owner 2026-09-04)

Owner feels some real singles may be missing, and is **happy with how few false positives** appear.

- Do **not** loosen title match / filters in a way that floods junk listings.
- Coverage audit should find wider-but-still-specific nets (query variants, set/number phrasing, BIN filters) that recover missed cards **without** raising false positives.
- Prefer measuring missed inventory against a known card sample over blindly raising result caps.
- **Manual browser check:** periodically open the same query on eBay and Mercari in a real browser, count relevant singles, and compare to DealDex results to measure miss rate (not only automated scrapes).
- **Prioritize higher-value cards** in that sample and in any ranking / alert path — expensive or chase singles matter more for Member speed and for judging coverage.


## Scan timing / Datadog (owner 2026-09-04)

- Server scan stores image **URLs** only; it does not download listing pictures.  Thumbnail delay is client-side after results.
- DealDex already ships Datadog logs + one APM span per HTTP request.  That shows total scan request duration, not per-hop (eBay / Mercari / enrichment).
- Next observability step: child spans (or structured duration logs) for marketplace fetch vs card match vs paid-desk quotes so Datadog can answer what is longest.

## Coverage vs precision (owner 2026-09-04)

Owner feels some real singles may be missing, and is happy with how few false positives appear.

- Do not loosen title match / filters in a way that floods junk listings.
- Coverage audit should find wider-but-still-specific nets that recover missed cards without raising false positives.
- Prefer measuring missed inventory against a known card sample over blindly raising result caps.
- **Manual browser check:** periodically open the same query on eBay and Mercari in a real browser, count relevant singles, and compare to DealDex results to measure miss rate.
- **Prioritize higher-value cards** in that sample and in any ranking / alert path.


## Scan hop timing — prefer Sentry (owner 2026-09-04)

DealDex already has Datadog one-span-per-request and client Sentry (browser tracing + Replay).  Scan latency is mostly **server-side** marketplace fetch + match/enrich.

**Prefer Sentry Performance** for hop breakdown (org has ample Sentry credit; Datadog free APM is the tighter limit):

- Server spans on the Nitro/API scan path: `scan.ebay`, `scan.mercari`, `scan.match`, `scan.enrich`, `scan.cache.hit`, `scan.cache.miss`.
- Datadog parent stays `web.request` only; do not spend free APM on deep child spans unless Sentry is insufficient.
- Server still does not download listing images (URLs only) — thumbnail time is client RUM, not scan.

Implemented on `grok/sentry-scan-hop-spans` (Nitro middleware init/flush + `@sentry/node` `startSpan` around web and native scan handlers).  Extra-ship no.