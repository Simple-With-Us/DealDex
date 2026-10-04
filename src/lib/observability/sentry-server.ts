/**
 * Server Sentry Performance for DealDex scan hops.
 *
 * Prefer Sentry over Datadog for per-hop timing.  Datadog keeps one parent
 * `web.request` span.  This module is inert without SENTRY_DSN or
 * VITE_SENTRY_DSN, never fail-closes the site, and never attaches listing titles, search queries, or desk keys.
 *
 * `@sentry/node` is loaded only after a DSN is present so the client bundle
 * and CI stay free of the Node SDK.
 */

import { defaultServerEnv } from "@/lib/server/app-settings";

export const SCAN_SPAN = {
  parent: "scan",
  ebay: "scan.ebay",
  ebayApi: "scan.ebay.api",
  ebayPage2: "scan.ebay.page2",
  mercari: "scan.mercari",
  match: "scan.match",
  enrich: "scan.enrich",
  autoBuyPreview: "scan.auto_buy.preview",
  cacheHit: "scan.cache.hit",
  cacheMiss: "scan.cache.miss",
} as const;

export type ScanSpanName = (typeof SCAN_SPAN)[keyof typeof SCAN_SPAN];

export type ScanSpanAttributeValue = string | number | boolean;

export type ScanSpanHandle = {
  setAttribute: (key: string, value: ScanSpanAttributeValue) => void;
  updateName: (name: string) => void;
};

/** Outgoing HTTP/DB auto-spans would carry search URLs and SQL with the query. */
export const SENTRY_SERVER_DROP_INTEGRATIONS = new Set([
  "Http",
  "NodeFetch",
  "Undici",
  "Fetch",
  "Postgres",
  "PostgresJs",
  "Mysql",
  "Mysql2",
  "Redis",
  "Fs",
  "ChildProcess",
]);

const STRIP_SPAN_DATA_KEY =
  /url|query|title|authorization|cookie|token|api[-_]?key|_nkw|desk/i;

export function sentryServerIntegrations<T extends { name: string }>(defaults: T[]): T[] {
  return defaults.filter((integration) => !SENTRY_SERVER_DROP_INTEGRATIONS.has(integration.name));
}

export function sentryServerBeforeBreadcrumb<T extends { category?: string; type?: string }>(
  breadcrumb: T,
): T | null {
  if (breadcrumb.category === "http" || breadcrumb.type === "http") return null;
  return breadcrumb;
}

export function sentryServerBeforeSendSpan<
  T extends { data?: Record<string, unknown>; description?: string },
>(span: T): T {
  if (span.data) {
    for (const key of Object.keys(span.data)) {
      if (STRIP_SPAN_DATA_KEY.test(key)) delete span.data[key];
    }
  }
  if (span.description && /https?:\/\//i.test(span.description)) {
    span.description = span.description.replace(/\?.*$/, "");
  }
  return span;
}

type SpanLike = {
  setAttribute?: (key: string, value: ScanSpanAttributeValue) => void;
  updateName?: (name: string) => void;
};

type StartSpanOptions = {
  name: string;
  op?: string;
  attributes?: Record<string, ScanSpanAttributeValue>;
  forceTransaction?: boolean;
};

type SentryLike = {
  init: (opts: Record<string, unknown>) => void;
  startSpan: <T>(opts: StartSpanOptions, callback: (span: SpanLike) => T) => T;
  withIsolationScope?: <T>(callback: () => T) => T;
  flush?: (timeout?: number) => Promise<boolean>;
};

type EnvMap = Record<string, string | undefined>;

let sdk: SentryLike | null = null;
let injected: SentryLike | null = null;
let loadPromise: Promise<SentryLike | null> | undefined;
let initialized = false;

export function sentryServerDsn(env: EnvMap = defaultServerEnv()): string | undefined {
  const sentry = env.SENTRY_DSN?.trim();
  if (sentry) return sentry;
  const vite = env.VITE_SENTRY_DSN?.trim();
  return vite || undefined;
}

export function sentryServerEnvironment(env: EnvMap = defaultServerEnv()): string {
  return (
    env.SENTRY_ENV?.trim() ||
    env.VITE_SENTRY_ENV?.trim() ||
    env.VERCEL_ENV?.trim() ||
    env.NODE_ENV?.trim() ||
    "production"
  );
}

export function sentryServerTracesSampleRate(env: EnvMap = defaultServerEnv()): number {
  const raw = Number((env.SENTRY_TRACES_SAMPLE_RATE ?? "0.2").trim());
  return Number.isFinite(raw) ? Math.min(Math.max(raw, 0), 1) : 0.2;
}

function handleFromSpan(span: SpanLike | null | undefined): ScanSpanHandle | null {
  if (!span) return null;
  return {
    setAttribute(key, value) {
      try {
        span.setAttribute?.(key, value);
      } catch {
        /* telemetry must never break a scan */
      }
    },
    updateName(name) {
      try {
        span.updateName?.(name);
      } catch {
        /* telemetry must never break a scan */
      }
    },
  };
}

async function loadSentry(env: EnvMap): Promise<SentryLike | null> {
  if (injected) return injected;
  if (typeof window !== "undefined") return null;
  const dsn = sentryServerDsn(env);
  if (!dsn) return null;

  try {
    const mod = (await import("@sentry/node")) as {
      init?: unknown;
      startSpan?: unknown;
      default?: { init?: unknown; startSpan?: unknown };
    };
    const picked = (typeof mod.startSpan === "function" ? mod : mod.default) as SentryLike | undefined;
    if (!picked || typeof picked.init !== "function" || typeof picked.startSpan !== "function") {
      return null;
    }
    const Sentry = picked;
    if (!initialized) {
      Sentry.init({
        dsn,
        environment: sentryServerEnvironment(env),
        tracesSampleRate: sentryServerTracesSampleRate(env),
        sendDefaultPii: false,
        enableLogs: true,
        includeLocalVariables: false,
        registerEsmLoaderHooks: false,
        integrations: sentryServerIntegrations,
        beforeBreadcrumb: sentryServerBeforeBreadcrumb,
        beforeSendSpan: sentryServerBeforeSendSpan,
      });
      initialized = true;
    }
    sdk = Sentry;
    return Sentry;
  } catch {
    return null;
  }
}

export async function initSentryServer(env: EnvMap = defaultServerEnv()): Promise<boolean> {
  if (injected) return true;
  if (sdk && initialized) return true;
  if (!loadPromise) loadPromise = loadSentry(env);
  const loaded = await loadPromise;
  return Boolean(loaded);
}

async function ensureSentry(env: EnvMap = defaultServerEnv()): Promise<SentryLike | null> {
  if (injected) return injected;
  if (sdk) return sdk;
  if (!loadPromise) loadPromise = loadSentry(env);
  return loadPromise;
}

export async function withScanSpan<T>(
  name: string,
  fn: (span: ScanSpanHandle | null) => Promise<T> | T,
  attributes?: Record<string, ScanSpanAttributeValue>,
  opts?: { op?: string; forceTransaction?: boolean },
): Promise<T> {
  const Sentry = await ensureSentry();
  if (!Sentry?.startSpan) return fn(null);
  return Sentry.startSpan(
    {
      name,
      op: opts?.op ?? "scan",
      attributes,
      forceTransaction: opts?.forceTransaction,
    },
    (span) => fn(handleFromSpan(span)),
  );
}

export async function withScanCacheLookup<T>(
  lookup: () => Promise<T | null>,
  isFresh: (value: T) => boolean,
): Promise<{ fresh: T | null; stored: T | null }> {
  return withScanSpan(
    SCAN_SPAN.cacheMiss,
    async (span) => {
      const row = await lookup();
      if (row && isFresh(row)) {
        span?.updateName(SCAN_SPAN.cacheHit);
        span?.setAttribute("cache.hit", true);
        return { fresh: row, stored: row };
      }
      span?.setAttribute("cache.hit", false);
      return { fresh: null, stored: row };
    },
    undefined,
    { op: "cache" },
  );
}

export async function withScanTransaction<T>(
  source: "web" | "native",
  fn: () => Promise<T>,
): Promise<T> {
  const Sentry = await ensureSentry();
  const run = () =>
    withScanSpan(
      SCAN_SPAN.parent,
      () => fn(),
      { "scan.source": source },
      { op: "function", forceTransaction: true },
    );

  try {
    if (Sentry?.withIsolationScope) {
      return await Sentry.withIsolationScope(() => run());
    }
    return await run();
  } finally {
    await flushSentryServer(2000);
  }
}

export async function flushSentryServer(timeoutMs = 2000): Promise<void> {
  const Sentry = injected ?? sdk;
  if (!Sentry?.flush) return;
  try {
    await Sentry.flush(timeoutMs);
  } catch {
    /* a flush failure must not hide the scan result */
  }
}

export function setSentryServerForTests(mock: SentryLike | null): void {
  injected = mock;
  sdk = mock;
  initialized = Boolean(mock);
  loadPromise = mock ? Promise.resolve(mock) : undefined;
}

export function resetSentryServerForTests(): void {
  injected = null;
  sdk = null;
  initialized = false;
  loadPromise = undefined;
}
