# 2026-10-04 — Seller Reputation Indicators for eBay and Mercari

Seat: ANTIGRAVITY, branch `ag/seller-reputation-indicator`.

## What changed

### 1. Seller reputation data model & classification (`src/lib/marketplaces/types.ts` & `src/lib/marketplaces/seller.ts`)
- Defined `SellerReputation` tiers: `"top_rated"`, `"trusted"`, `"new"`, `"low_rated"`, `"standard"`, and `"unknown"`.  
- Added `SellerInfo` to `LiveListing` containing username, feedback count, rating percentage / stars, badge labels, and risk tooltips.  
- Implemented `deriveSellerReputation` supporting both eBay and Mercari metric scales:  
  - **Top Rated / High Volume:** >= 100 sales & >= 98% positive (or eBay Top Rated flag), or Mercari >= 50 sales with >= 4.8★ rating.  
  - **Trusted:** Established seller with >= 20 sales and >= 97% positive (or Mercari >= 15 sales with >= 4.7★).  
  - **Brand New:** 0 to 5 sales / reviews, alerting collectors to unvetted accounts.  
  - **Low Rated:** Below 95% positive feedback (< 4.5★ on Mercari) with enough volume to be statistically significant.  
  - **Standard:** Normal established sellers meeting baseline standards.  
- Added unit tests in `src/lib/marketplaces/seller.test.ts` covering all tier derivations, edge cases, text parsing, and count formatting.  

### 2. Multi-marketplace seller extraction (`ebay-browse.ts`, `ebay.ts`, `jina.ts`, `mercari.ts`, `brave.ts`)
- **eBay Browse API:** Parsed `itemSummary.seller.username`, `feedbackScore`, `feedbackPercentage`, and `topRatedBuyingExperience`.  
- **eBay HTML & Jina Scrapes:** Extracted username, score, percent, and Top Rated flags from result chunks.  
- **Mercari Jina & DuckDuckGo Snippets:** Extracted seller usernames, review counts, and star ratings.  
- **Brave Search fallback:** Extracted seller information across fallback search results.  

### 3. UI Indicators and Filter Controls (`src/components/seller-badge.tsx`, `src/components/scanner.tsx`, `native-phones.tsx`)
- Created `SellerBadge` component rendering customized visual badges:  
  - Emerald sparkles for Top Rated sellers.  
  - Green shield for Trusted sellers.  
  - Amber warning badge for Brand New sellers (0–5 sales).  
  - Red shield alert badge for Low-Rated sellers.  
- Added Seller Filter select in `src/components/scanner.tsx` (`"Any Seller"`, `"Top Rated Only"`, `"Trusted & Top"`, `"Hide Risky"`), allowing buyers to filter out new and low-rated sellers.  
- Surfaced seller username and reputation in `ScanRow` info and mobile phone preview cards.  

## Verification

```bash
npm run typecheck   # 0 errors
npm test            # 313/313 pass (25 suites)
npm run build       # clean
```
