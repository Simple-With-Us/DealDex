/**
 * Official eBay Browse API adapter.
 *
 * Why this file exists: the Vercel server IP gets 403'd by eBay on direct
 * scrapes, which is the largest single source of "fewer than 16 listings"
 * on real scans.  The official Browse API path is auth'd and rate-limit
 * clean, and gives paging up to 10,000 items per query.
 *
 * Auth is OAuth 2.0 client_credentials.  Tokens last 7200s; we cache them
 * in-process keyed by app id so concurrent scans share one token.  When
 * either `EBAY_APP_ID` (Client ID) or `EBAY_CERT_ID` (Client Secret) is
 * missing this module is inert and `searchEbayBrowseEnabled` returns
 * false; the rest of the cascade stays as-is.
 *
 * Secrets handling: read from `process.env` only.  Never log the cert id
 * or the token.  Span attributes are stripped of any url/query/title by
 * `sentryServerBeforeSendSpan`.
 *
 * References:
 *   - https://developer.ebay.com/api-docs/buy/browse/overview
 *   - https://developer.ebay.com/api-docs/buy/browse/resources/item_summary/methods/searchItemSummary
 *   - https://developer.ebay.com/api-docs/buy/static/oauth-client-credentials-grant.html
 */
import {
  ASSUMED_SHIPPING,
  SKIP_LISTING,
  isBroadQuery,
  parseMoney,
  titleMatchesQuery,
} from "./html";
import type { LiveListing } from "./types";
import { defaultServerEnv } from "@/lib/server/app-settings";

export const EBAY_BROWSE_SCOPE = "https://api.ebay.com/oauth/api_scope/buy.item.feed";
const TOKEN_URL = "https://api.ebay.com/identity/v1/oauth2/token";
const SEARCH_URL = "https://api.ebay.com/buy/browse/v1/item_summary/search";
const MARKETPLACE_ID = "EBAY_US";

/**
 * New / used condition filter ids on the Browse API.  We accept all
 * conditions by default but expose the list so a future per-condition
 * UI can pre-fill the filter.
 */
export const EBAY_CONDITION_IDS = {
  NEW: "1000",
  likeNew: "1500",
  veryGood: "2000",
  good: "2500",
  acceptable: "3000",
  refurbished: "2000", // refurbished-cert used to roll up into veryGood on some ids
  used: "3000",
  notWorking: "7000",
} as const;

export type EbayBrowseConfig = {
  appId: string;
  certId: string;
  /** Optional override of the OAuth token URL — sandbox. */
  tokenUrl?: string;
  /** Optional override of the search URL — sandbox. */
  searchUrl?: string;
};

export function readEbayBrowseConfig(env: Record<string, string | undefined> = defaultServerEnv()): EbayBrowseConfig | null {
  const appId = env.EBAY_APP_ID?.trim();
  const certId = env.EBAY_CERT_ID?.trim();
  if (!appId || !certId) return null;
  const sandbox = env.EBAY_ENV?.trim().toLowerCase() === "sandbox";
  return {
    appId,
    certId,
    tokenUrl: sandbox ? "https://api.sandbox.ebay.com/identity/v1/oauth2/token" : TOKEN_URL,
    searchUrl: sandbox
      ? "https://api.sandbox.ebay.com/buy/browse/v1/item_summary/search"
      : SEARCH_URL,
  };
}

export function searchEbayBrowseEnabled(env: Record<string, string | undefined> = defaultServerEnv()): boolean {
  return Boolean(readEbayBrowseConfig(env));
}

type CachedToken = {
  token: string;
  /** epoch ms when this token stops being valid; we refresh ~5 min early. */
  expiresAt: number;
};

const tokenCache = new Map<string, CachedToken>();
/** 5-minute clock skew safety before the actual `expires_in` elapses. */
const TOKEN_REFRESH_SKEW_MS = 5 * 60_000;

export async function getEbayBrowseToken(
  cfg: EbayBrowseConfig,
  fetchImpl: typeof fetch = fetch,
): Promise<string> {
  const cached = tokenCache.get(cfg.appId);
  if (cached && cached.expiresAt > Date.now()) return cached.token;

  const body = new URLSearchParams();
  body.set("grant_type", "client_credentials");
  body.set("scope", EBAY_BROWSE_SCOPE);

  const auth = Buffer.from(`${cfg.appId}:${cfg.certId}`).toString("base64");
  const res = await fetchImpl(cfg.tokenUrl ?? TOKEN_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization: `Basic ${auth}`,
    },
    body: body.toString(),
  });
  if (!res.ok) {
    throw new Error(`eBay token request failed: HTTP ${res.status}`);
  }
  const json = (await res.json()) as { access_token?: unknown; expires_in?: unknown };
  const token = typeof json.access_token === "string" ? json.access_token : "";
  const expires = typeof json.expires_in === "number" ? json.expires_in : 7200;
  if (!token) throw new Error("eBay token response missing access_token");
  const expiresAt = Date.now() + Math.max(60_000, (expires * 1000) - TOKEN_REFRESH_SKEW_MS);
  tokenCache.set(cfg.appId, { token, expiresAt });
  return token;
}

/** Exposed so unit tests can clear the in-process cache between cases. */
export function clearEbayBrowseTokenCache(): void {
  tokenCache.clear();
}

export type EbayBrowseSearchOptions = {
  /** Hard cap on rows returned; the cap is per-page (Browse limit is 200). */
  limit?: number;
  /** Cursor for the next page; offset is zero on the first call. */
  offset?: number;
  /** Optional condition filter; default accepts new + used. */
  conditionIds?: string[];
  /** Optional price range in USD. */
  minPrice?: number;
  maxPrice?: number;
  /** Default sort: price + shipping asc — gives steals first. */
  sort?: "price" | "pricePlusShipping" | "newlyListed" | "endingSoonest" | "bestMatch";
};

export type EbayBrowseSearchResult = {
  listings: LiveListing[];
  /** Raw offset used for this page; useful for paging tests. */
  offset: number;
  /** Total hits as reported by eBay Browse (capped at 10000 by the API). */
  total?: number;
  /** True if eBay returned at least one page, even if `listings` is empty after filters. */
  hadResponse: boolean;
};

/**
 * One page of eBay Browse results.  Caller owns pagination — `limit` is
 * the per-page count (1..200) and `offset` is the cursor.  We surface
 * `total` so the caller can decide whether a second page is worth a
 * second network round trip.
 */
export async function searchEbayBrowsePage(
  query: string,
  options: EbayBrowseSearchOptions = {},
  env: Record<string, string | undefined> = defaultServerEnv(),
  fetchImpl: typeof fetch = fetch,
): Promise<EbayBrowseSearchResult> {
  const cfg = readEbayBrowseConfig(env);
  if (!cfg) return { listings: [], offset: options.offset ?? 0, hadResponse: false };

  const limit = Math.min(200, Math.max(1, options.limit ?? 50));
  const offset = options.offset ?? 0;
  const conditions = options.conditionIds ?? Array.from(new Set(Object.values(EBAY_CONDITION_IDS)));

  const params = new URLSearchParams();
  params.set("q", broadQuery(query));
  params.set("limit", String(limit));
  params.set("offset", String(offset));
  params.set("filter", `buyingOptions:{FIXED}`);
  if (conditions.length) {
    params.append("filter", `conditionIds:{${conditions.join("|")}}`);
  }
  const priceRange: string[] = [];
  if (typeof options.minPrice === "number") priceRange.push(`price:[${options.minPrice}..]`);
  if (typeof options.maxPrice === "number") priceRange.push(`price:[..${options.maxPrice}]`);
  if (priceRange.length === 2) params.append("filter", `${priceRange[0]},${priceRange[1]}`);
  else if (priceRange[0]) params.append("filter", priceRange[0]);
  params.set("sort", options.sort ?? "pricePlusShipping");

  const token = await getEbayBrowseToken(cfg, fetchImpl);
  const url = `${cfg.searchUrl ?? SEARCH_URL}?${params.toString()}`;
  const res = await fetchImpl(url, {
    headers: {
      Authorization: `Bearer ${token}`,
      "X-EBAY-C-MARKETPLACE-ID": MARKETPLACE_ID,
      Accept: "application/json",
    },
  });
  if (!res.ok) {
    throw new Error(`eBay browse search failed: HTTP ${res.status}`);
  }
  const json = (await res.json()) as EbayBrowseResponse;
  const listings = (json.itemSummaries ?? [])
    .map(parseEbayBrowseItem)
    .filter((row): row is LiveListing => row !== null);
  const result: EbayBrowseSearchResult = {
    listings,
    offset,
    hadResponse: true,
  };
  if (typeof json.total === "number") result.total = json.total;
  return result;
}

/**
 * High-level: fetch up to `cap` listings across as many pages as needed.
 * Stops early on empty pages, on total exhaustion, or when the cap is met.
 */
export async function searchEbayBrowse(
  query: string,
  cap = 50,
  env: Record<string, string | undefined> = defaultServerEnv(),
  fetchImpl: typeof fetch = fetch,
): Promise<LiveListing[]> {
  if (cap <= 0) return [];
  const out: LiveListing[] = [];
  let offset = 0;
  let total: number | undefined;
  for (let page = 0; page < 5 && out.length < cap; page++) {
    const result = await searchEbayBrowsePage(query, { limit: Math.min(200, cap - out.length), offset }, env, fetchImpl).catch(
      () => ({ listings: [], offset, hadResponse: false as const }),
    );
    if (!result.hadResponse) break;
    total = result.total;
    if (!result.listings.length) break;
    out.push(...result.listings);
    offset += result.listings.length;
    if (total !== undefined && offset >= total) break;
  }
  return out;
}

/** Visible for tests — broadens "pokemon" / "tcg" / blank into a workable q. */
export function broadQuery(query: string): string {
  const q = query.trim();
  if (!q || isBroadQuery(q)) return "pokemon";
  return /pokemon|pokémon|tcg/i.test(q) ? q : `${q} pokemon`;
}

type EbayBrowseItem = {
  itemId?: unknown;
  title?: unknown;
  price?: { value?: unknown; currency?: unknown };
  shippingOptions?: Array<{ shippingCost?: { value?: unknown }; type?: unknown }>;
  image?: { imageUrl?: unknown };
  itemWebUrl?: unknown;
  itemCreationDate?: unknown;
  condition?: unknown;
  conditionId?: unknown;
  buyingOptions?: unknown;
  seller?: { username?: unknown; feedbackPercentage?: unknown };
};

type EbayBrowseResponse = {
  itemSummaries?: EbayBrowseItem[];
  total?: number;
  offset?: number;
  limit?: number;
  next?: string;
  href?: string;
  warnings?: Array<{ message?: string }>;
};

/** Visible for tests. Maps a single Browse `itemSummary` into our LiveListing shape. */
export function parseEbayBrowseItem(item: EbayBrowseItem): LiveListing | null {
  const id = typeof item.itemId === "string" ? item.itemId : "";
  const titleRaw = typeof item.title === "string" ? item.title : "";
  if (!id || !titleRaw) return null;
  const title = titleRaw.trim();
  if (!title || SKIP_LISTING.test(title)) return null;
  const price = parseMoney(
    typeof item.price?.value === "string" || typeof item.price?.value === "number"
      ? String(item.price.value)
      : undefined,
  );
  if (price == null || price < 2.5 || price >= 1_000_000) return null;
  const shipping = firstShipping(item.shippingOptions) ?? ASSUMED_SHIPPING.ebay;
  const image = typeof item.image?.imageUrl === "string" ? item.image.imageUrl : null;
  const url = typeof item.itemWebUrl === "string" ? item.itemWebUrl : `https://www.ebay.com/itm/${id}`;
  const listedAt =
    typeof item.itemCreationDate === "string" && item.itemCreationDate.length > 0
      ? item.itemCreationDate
      : null;
  const buyingOptions = Array.isArray(item.buyingOptions) ? (item.buyingOptions as string[]) : [];
  const fixed = buyingOptions.includes("FIXED");
  return {
    id,
    marketplace: "ebay",
    title,
    url,
    price,
    shipping,
    shippingEstimated: !firstShipping(item.shippingOptions),
    image,
    listedAt,
    ...(fixed ? {} : {}),
  };
}

function firstShipping(options: EbayBrowseItem["shippingOptions"]): number | null {
  if (!Array.isArray(options)) return null;
  for (const opt of options) {
    const raw = opt.shippingCost?.value;
    if (typeof raw === "number") {
      // 0 is a real, free-shipping figure; parseMoney rejects it as "no money",
      // so we accept any non-negative finite number here.
      return Number.isFinite(raw) && raw >= 0 ? raw : null;
    }
    if (typeof raw === "string") {
      const trimmed = raw.trim();
      if (trimmed === "0" || trimmed === "0.00" || trimmed === "0.0") return 0;
      const n = parseMoney(trimmed);
      if (n != null) return n;
    }
  }
  return null;
}

/**
 * Compat export for the rest of scan.ts — titleMatchesQuery is re-imported from html.ts
 * already; here we expose a thin filter that callers can run against the API output.
 */
export function filterBrowseByQuery(listings: LiveListing[], query: string): LiveListing[] {
  return listings.filter((row) => titleMatchesQuery(row.title, query));
}