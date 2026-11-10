# 2026-09-04 — Sentry Performance child spans on scan hops (Grok, `grok/sentry-scan-hop-spans`)

## Summary

DealDex already had Datadog one-span-per-request (`web.request`) and client Sentry (browser tracing + Replay).  Scan latency is mostly server-side marketplace fetch + match/enrich.  This seat adds Sentry Performance child spans on the Nitro/API scan path and leaves Datadog at the parent request span.

## Spans

Parent: `scan` (`scan.source` = `web` | `native`).

Children:

- `scan.ebay`
- `scan.mercari`
- `scan.match`
- `scan.enrich`
- `scan.cache.hit`
- `scan.cache.miss`

Attributes are counts, marketplace ids, and booleans only (`listing.count`, `matched.count`, `candidate.count`, `cache.hit`, `scan.marketplace`, `scan.source`).  Listing titles, search queries, and desk keys stay off the wire.  `@sentry/node` HTTP/Fetch/Postgres auto-integrations are dropped so marketplace URLs cannot leak the search term.

## Wiring

- `@sentry/node` ^10.73, lazy-loaded after `SENTRY_DSN` or the existing `VITE_SENTRY_DSN`.
- `src/lib/observability/sentry-server.ts` — `withScanSpan` / `withScanCacheLookup` / `withScanTransaction`.
- `src/lib/marketplaces/scan.ts` — eBay, Mercari, match, enrich hops.
- `src/lib/server/scan.ts` and `src/routes/api/native/scan.ts` — parent + cache hit/miss.
- `server/middleware/sentry.ts` — init + flush on Vercel isolates.  Missing DSN is a no-op and never 503s.

## Verify

- `npm run lint` — 0 errors (8 pre-existing warnings)
- `npm run typecheck` — clean
- `npm test` — 217/217
- `npm run build` — Vite + Nitro Vercel output green.  `@sentry/node` is in the server function only (`_libs/@sentry/node+[...].mjs`).  Client `dist/assets` has no `scan.ebay` and no `@sentry/node`.

No extra-ship.  No `--force-ship`.  Did not merge.

PR https://github.com/jaywedgeworth22/DealDex/pull/282.  SHA `6665302`.

Board `9fb9cccafb9c40b889466516a18e8dd5`.
