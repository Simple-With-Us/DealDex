import { createServerFn } from "@tanstack/react-start";
import { ALL_POKEMON_QUERY } from "@/lib/marketplaces/html";
import { scanAndScore } from "@/lib/marketplaces/scan";
import type { ScanSource } from "@/lib/marketplaces/types";
import { withScanCacheLookup, withScanTransaction } from "@/lib/observability/sentry-server";
import type { DeskKeys } from "@/lib/settings/keys";
import {
  isCacheable,
  readScanCache,
  SCAN_FRESH_MS,
  scanCacheKey,
  writeScanCache,
} from "./scan-cache";
import { RateLimitedError, rateLimit, serverFnClientKey } from "./rate-limit";

function cleanKeys(input: unknown): DeskKeys {
  if (!input || typeof input !== "object") return {};
  const raw = input as Record<string, unknown>;
  const out: DeskKeys = {};
  for (const id of ["justtcg", "pricecharting", "pokemontcg"] as const) {
    const v = raw[id];
    if (typeof v === "string" && v.trim()) out[id] = v.trim().slice(0, 200);
  }
  return out;
}

export const scanMarketplaces = createServerFn({ method: "POST" })
  .validator((input: { q: string; sources?: ScanSource[]; keys?: DeskKeys }) => ({
    q: String(input.q ?? "").slice(0, 160),
    sources: (input.sources?.length ? input.sources : ["ebay", "mercari"]) as ScanSource[],
    keys: cleanKeys(input.keys),
  }))
  .handler(async ({ data }) => {
    // One scan fans out to eight third-party services and writes a database
    // row, so it is not free to serve. See rate-limit.ts on why this is a
    // per-instance mitigation, not a global quota.
    const limit = rateLimit(serverFnClientKey("scan"), 20, 60_000);
    if (!limit.ok) throw new RateLimitedError(limit.retryAfterMs);

    const query = data.q.trim() || ALL_POKEMON_QUERY;
    const paidDesks = Boolean(
      data.keys.justtcg || data.keys.pricecharting || data.keys.pokemontcg,
    );
    const shareable = isCacheable(paidDesks);
    const key = scanCacheKey(query, data.sources);
    return withScanTransaction("web", async () => {
      const cache = shareable
        ? await withScanCacheLookup(
            () => readScanCache(key),
            (row) => Date.now() - row.at < SCAN_FRESH_MS,
          )
        : { fresh: null, stored: null };
      if (cache.fresh) {
        return {
          query,
          ebay: cache.fresh.ebay,
          mercari: cache.fresh.mercari,
          notes: cache.fresh.notes,
          rows: cache.fresh.rows,
          fromCache: true,
        };
      }
      try {
        const result = await scanAndScore(query, data.sources, data.keys);
        if (result.rows.length && shareable) {
          await writeScanCache(key, query, data.sources, {
            ebay: result.ebay,
            mercari: result.mercari,
            notes: result.notes,
            rows: result.rows,
          });
        }
        return { query, ...result, fromCache: false };
      } catch (err) {
        if (cache.stored) {
          return {
            query,
            ebay: cache.stored.ebay,
            mercari: cache.stored.mercari,
            notes: cache.stored.notes,
            rows: cache.stored.rows,
            fromCache: true,
          };
        }
        throw err;
      }
    });
  });
