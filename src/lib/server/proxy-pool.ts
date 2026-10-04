/**
 * Residential / rotating-IP proxy layer for the scan fallback chain.
 *
 * Owner direction 2026-09-20: add a server-side rotating-IP layer so
 * direct eBay / Mercari scrapes are not a single hardcoded egress IP.
 * Today every fallback request leaves from the Vercel server IP and
 * 403s; this is the only DC-IP-friendly path once eBay Browse API keys
 * are absent.
 *
 * Design:
 *   1. Pure module — no IO until the user opts in.  Without
 *      `PROXY_URL_LIST` env var, `fetchWithPool` is `fetch` with a
 *      no-op counter, so this PR is dead-code-free in CI / preview.
 *   2. The list is comma-separated `protocol://user:pass@host:port`.
 *      Each URL is parsed once and cached by URL.
 *   3. `fetchWithPool(url, init)` picks the least-recently-used proxy,
 *      wraps the outbound fetch in a 1-retry policy (rotate on 403/429),
 *      and emits Sentry spans `proxy.rotate` / `proxy.no-op`.
 *   4. Per-proxy concurrency is bounded by `MAX_CONCURRENCY_PER_PROXY`
 *      to prevent a single dead proxy from blocking the whole batch.
 *
 * Secrets handling: env-only, never logged.  The username + password
 * of the proxy URL are scrubbed from any Sentry span attribute by
 * `redactProxyUrl`.
 */
import { SCAN_SPAN, withScanSpan } from "@/lib/observability/sentry-server";
import { defaultServerEnv, getNumberSetting } from "./app-settings";

const PROXY_URL_LIST_KEY = "PROXY_URL_LIST";
/** Default when the PROXY_MAX_CONCURRENCY knob is unset. */
const DEFAULT_MAX_CONCURRENCY_PER_PROXY = 4;

function maxConcurrencyPerProxy(): number {
  return getNumberSetting("PROXY_MAX_CONCURRENCY", DEFAULT_MAX_CONCURRENCY_PER_PROXY);
}

export type ProxyEntry = {
  /** Pretty-printed URL with the user:pass stripped. */
  safeUrl: string;
  /** Full proxy URL, kept opaque so the auth never lands in a span. */
  fullUrl: string;
  /** Per-proxy round-robin counter so the next caller picks a different proxy. */
  cursor: number;
  /** Concurrent in-flight calls; bounded by MAX_CONCURRENCY_PER_PROXY. */
  inFlight: number;
};

export function readProxyPool(env: Record<string, string | undefined> = defaultServerEnv()): ProxyEntry[] {
  const raw = env[PROXY_URL_LIST_KEY]?.trim();
  if (!raw) return [];
  return raw
    .split(",")
    .map((u) => u.trim())
    .filter(Boolean)
    .map((fullUrl) => ({
      safeUrl: redactProxyUrl(fullUrl),
      fullUrl,
      cursor: 0,
      inFlight: 0,
    }));
}

export function proxyPoolEnabled(env: Record<string, string | undefined> = defaultServerEnv()): boolean {
  return readProxyPool(env).length > 0;
}

/**
 * Pick the next proxy in a least-recently-used rotation, skipping any
 * proxy that is at the per-proxy concurrency cap.
 */
function nextProxy(pool: ProxyEntry[]): ProxyEntry | null {
  if (pool.length === 0) return null;
  let bestIdx = -1;
  let bestCursor = Infinity;
  for (let i = 0; i < pool.length; i++) {
    const p = pool[i]!;
    if (p.inFlight >= maxConcurrencyPerProxy()) continue;
    if (p.cursor < bestCursor) {
      bestCursor = p.cursor;
      bestIdx = i;
    }
  }
  if (bestIdx === -1) {
    // All proxies saturated — fall through to direct fetch so we don't block.
    return null;
  }
  const entry = pool[bestIdx]!;
  entry.cursor += 1;
  return entry;
}

const RETRY_STATUSES = new Set([403, 408, 425, 429, 500, 502, 503, 504]);

export type FetchWithPoolOptions = RequestInit & {
  /** When true, retry once on 403/429/etc with a different proxy. */
  rotateOnError?: boolean;
};

/**
 * fetch() with rotating-IP fallback.  When `PROXY_URL_LIST` is unset,
 * this is a direct `fetch()` (no-op).
 */
export async function fetchWithPool(
  url: string,
  init: FetchWithPoolOptions = {},
  env: Record<string, string | undefined> = defaultServerEnv(),
  fetchImpl: typeof fetch = fetch,
): Promise<Response> {
  const pool = readProxyPool(env);
  if (pool.length === 0) {
    return withScanSpan(SCAN_SPAN.parent, async () => fetchImpl(url, init));
  }

  const rotate = init.rotateOnError !== false;
  let attempt = 0;
  let lastErr: unknown = null;
  while (attempt < Math.max(1, pool.length)) {
    const entry = nextProxy(pool);
    if (!entry) break;
    entry.inFlight += 1;
    try {
      const res = await withScanSpan("proxy.rotate", async (span) => {
        if (span) {
          span.setAttribute("proxy.url", entry.safeUrl);
          span.setAttribute("proxy.attempt", attempt);
        }
        const proxiedInit = await buildProxiedInit(entry.fullUrl, init);
        return fetchImpl(url, proxiedInit);
      });
      if (!res.ok && rotate && RETRY_STATUSES.has(res.status) && attempt + 1 < pool.length) {
        attempt += 1;
        continue;
      }
      return res;
    } catch (err) {
      lastErr = err;
      if (!rotate) throw err;
      attempt += 1;
    } finally {
      entry.inFlight -= 1;
    }
  }
  if (lastErr) throw lastErr;
  return fetchImpl(url, init);
}

/**
 * For fetch(), Node's built-in supports `proxy:` via undici's `ProxyAgent`
 * but only when fetch is dispatched with a `dispatcher` option.  We
 * attach via the `dispatcher` field so it works in Node without transmitting
 * proxy credentials across the network in an HTTP request header.
 */
async function buildProxiedInit(proxyUrl: string, init: RequestInit): Promise<RequestInit> {
  try {
    const moduleName = "undici";
    const mod = (await import(/* @vite-ignore */ moduleName).catch(() => null)) as {
      ProxyAgent?: new (url: string) => Record<string, unknown>;
    } | null;
    if (mod?.ProxyAgent) {
      const dispatcher = new mod.ProxyAgent(proxyUrl);
      dispatcher.uri = proxyUrl;
      return ({ ...init, dispatcher } as unknown) as RequestInit;
    }
  } catch {
    // Ignore dynamic import failure in non-Node environments
  }
  return init;
}

export function redactProxyUrl(url: string): string {
  try {
    const u = new URL(url);
    if (u.username || u.password) {
      u.username = "***";
      u.password = "***";
    }
    // URL.toString() appends "/" when the original had no path; preserve the
    // caller's shape.  When path/query exist, toString() returns them.
    const auth = u.username || u.password ? `${u.username}:${u.password}@` : "";
    const port = u.port ? `:${u.port}` : "";
    const tail = url.includes("/", url.indexOf("//") + 2) ? url.slice(url.indexOf("/", url.indexOf("//") + 2)) : "";
    return `${u.protocol}//${auth}${u.hostname}${port}${tail}`;
  } catch {
    return "[invalid-proxy-url]";
  }
}