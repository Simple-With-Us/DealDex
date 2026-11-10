import { createFileRoute } from "@tanstack/react-router";
import { ALL_POKEMON_QUERY } from "@/lib/marketplaces/html";
import { scanAndScore } from "@/lib/marketplaces/scan";
import type { ScanSource } from "@/lib/marketplaces/types";
import { nativeScanRows } from "@/lib/native/scan-payload";
import { withScanCacheLookup, withScanTransaction } from "@/lib/observability/sentry-server";
import {
  readScanCache,
  SCAN_FRESH_MS,
  scanCacheKey,
  writeScanCache,
} from "@/lib/server/scan-cache";
import { clientKey, rateLimit } from "@/lib/server/rate-limit";

function sourcesOf(input: unknown): ScanSource[] {
  if (!Array.isArray(input)) return ["ebay", "mercari"];
  const next = input.filter((s): s is ScanSource => s === "ebay" || s === "mercari");
  return next.length ? next : ["ebay", "mercari"];
}

async function json(request: Request) {
  try {
    return (await request.json()) as Record<string, unknown>;
  } catch {
    return {};
  }
}

export const Route = createFileRoute("/api/native/scan")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        // Deliberately unauthenticated — the phone apps scan without sign-in —
        // so this is the only thing standing between a stranger and an
        // unmetered fan-out to eight third-party services plus a database write.
        const limit = rateLimit(clientKey(request, "native-scan"), 20, 60_000);
        if (!limit.ok) {
          return Response.json(
            { error: "Too many scans from this connection. Give it a minute." },
            {
              status: 429,
              headers: { "retry-after": String(Math.ceil(limit.retryAfterMs / 1000)) },
            },
          );
        }
        const body = await json(request);

        // /privacy, README and AGENTS.md all say this endpoint REFUSES a keys
        // payload. Silently ignoring one would have made that word untrue and,
        // worse, would have let a regressed client keep POSTing credentials with
        // nothing to notice. A 400 is the loud signal.
        if (body.keys != null) {
          return Response.json(
            {
              error:
                "This endpoint does not accept desk keys. Scan paid desks on the device instead.",
            },
            { status: 400 },
          );
        }

        const q = String(body.q ?? "").slice(0, 160);
        const sources = sourcesOf(body.sources);
        const query = q.trim() || ALL_POKEMON_QUERY;
        // Paid desk keys are NEVER accepted here.
        //
        // `/privacy` promises "they do not send those keys to DealDex servers",
        // and the phone clients used to POST all three on every scan. Refusing
        // them server-side means that promise cannot quietly regress the next
        // time someone edits a native client: the phones run their paid desks
        // on-device, and this endpoint only ever serves the free-desk book.
        const cacheKey = scanCacheKey(query, sources);
        return withScanTransaction("native", async () => {
          const cache = await withScanCacheLookup(
            () => readScanCache(cacheKey),
            (row) => Date.now() - row.at < SCAN_FRESH_MS,
          );
          if (cache.fresh) {
            return Response.json({
              query,
              ebay: cache.fresh.ebay,
              mercari: cache.fresh.mercari,
              notes: cache.fresh.notes,
              rows: nativeScanRows(cache.fresh.rows),
              fromCache: true,
            });
          }
          try {
            const result = await scanAndScore(query, sources);
            if (result.rows.length) {
              await writeScanCache(cacheKey, query, sources, {
                ebay: result.ebay,
                mercari: result.mercari,
                notes: result.notes,
                rows: result.rows,
              });
            }
            return Response.json({
              query,
              ebay: result.ebay,
              mercari: result.mercari,
              notes: result.notes,
              rows: nativeScanRows(result.rows),
              fromCache: false,
            });
          } catch (err) {
            if (cache.stored) {
              return Response.json({
                query,
                ebay: cache.stored.ebay,
                mercari: cache.stored.mercari,
                notes: cache.stored.notes,
                rows: nativeScanRows(cache.stored.rows),
                fromCache: true,
              });
            }
            const message = err instanceof Error ? err.message : "Scan failed";
            return Response.json({ error: message }, { status: 502 });
          }
        });
      },
    },
  },
});
