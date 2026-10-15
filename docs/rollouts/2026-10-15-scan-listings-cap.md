# 2026-10-15 — DD-365 scan listing cap

Linear **DD-365** asked to stop truncating live scans at 16 rows per marketplace and to record a `scan.ebay.page2` span when Browse fetches another page.  PR #339 had already raised the named constants and `MATCH_POOL` to 6.  The parsers that actually return rows were still short.

## What

- `src/lib/marketplaces/caps.ts` holds `EBAY_SCAN_CAP` and `MERCARI_SCAN_CAP` (both 50).  eBay and Mercari re-export them.
- Jina eBay and Jina Mercari, plus Brave, stop at that cap.  Skip-list and query checks still run before a row counts.
- Jina eBay no longer lets a 700-character tail swallow the next listing link.
- `searchEbayBrowse` keeps query matches only, advances the offset by the raw `itemSummaries` length, and stops after five pages, an empty page, or the cap.  Follow-up pages run under Sentry span `scan.ebay.page2`.  The whole Browse read runs under `scan.ebay.api`.  Span attributes are counts and the page number.
- Sort stays `pricePlusShipping`.  The 5-row cross-desk enrichment cap is unchanged.

## Verify

- `npm run lint` -> ok (0 errors, 26 pre-existing warnings)
- `npx tsc --noEmit` -> ok
- `npm test` -> ok (325 passed, including `src/lib/marketplaces/scan-cap.test.ts`)
- `npm run build` -> ok
- `npm run typecheck` -> ok (repo TypeScript 7 checker; `npx tsc` above is the TypeScript 6 binary)

Follow-up after Kody on PR #465: the Browse search body is parsed with a loose Zod object before any field is read.  `.strict()` is not used, because eBay adds response fields and a strict object would drop a usable page.
