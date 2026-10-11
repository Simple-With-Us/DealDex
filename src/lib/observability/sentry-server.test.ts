import assert from "node:assert/strict";
import { afterEach, test } from "node:test";
import {
  resetSentryServerForTests,
  SCAN_SPAN,
  sentryServerBeforeBreadcrumb,
  sentryServerBeforeSendSpan,
  sentryServerDsn,
  sentryServerIntegrations,
  sentryServerRelease,
  sentryServerTracesSampleRate,
  setSentryServerForTests,
  withScanCacheLookup,
  withScanSpan,
  withScanTransaction,
} from "./sentry-server";

afterEach(() => {
  resetSentryServerForTests();
});

test("scan hop span names are the Sentry Performance contract", () => {
  assert.equal(SCAN_SPAN.parent, "scan");
  assert.equal(SCAN_SPAN.ebay, "scan.ebay");
  assert.equal(SCAN_SPAN.mercari, "scan.mercari");
  assert.equal(SCAN_SPAN.match, "scan.match");
  assert.equal(SCAN_SPAN.enrich, "scan.enrich");
  assert.equal(SCAN_SPAN.cacheHit, "scan.cache.hit");
  assert.equal(SCAN_SPAN.cacheMiss, "scan.cache.miss");
});

test("server DSN reuses SENTRY_DSN then VITE_SENTRY_DSN and invents no names", () => {
  assert.equal(sentryServerDsn({}), undefined);
  assert.equal(sentryServerDsn({ VITE_SENTRY_DSN: " vite " }), "vite");
  assert.equal(sentryServerDsn({ SENTRY_DSN: " server ", VITE_SENTRY_DSN: "vite" }), "server");
  assert.equal(sentryServerTracesSampleRate({}), 0.2);
  assert.equal(sentryServerTracesSampleRate({ SENTRY_TRACES_SAMPLE_RATE: "1" }), 1);
});

test("server release prefers SENTRY_RELEASE then VERCEL_GIT_COMMIT_SHA then GITHUB_SHA", () => {
  assert.equal(sentryServerRelease({}), undefined);
  assert.equal(sentryServerRelease({ VERCEL_GIT_COMMIT_SHA: " abc " }), "abc");
  assert.equal(sentryServerRelease({ GITHUB_SHA: "ghi", VERCEL_GIT_COMMIT_SHA: "abc" }), "abc");
  assert.equal(
    sentryServerRelease({ SENTRY_RELEASE: "rel", VERCEL_GIT_COMMIT_SHA: "abc", GITHUB_SHA: "ghi" }),
    "rel",
  );
});

test("server SDK drops HTTP and SQL auto-spans so search URLs stay off the wire", () => {
  const kept = sentryServerIntegrations([
    { name: "InboundFilters" },
    { name: "Http" },
    { name: "NodeFetch" },
    { name: "Undici" },
    { name: "Postgres" },
    { name: "OnUncaughtException" },
  ]);
  assert.deepEqual(
    kept.map((row) => row.name),
    ["InboundFilters", "OnUncaughtException"],
  );
  assert.equal(sentryServerBeforeBreadcrumb({ category: "http", type: "http" }), null);
  assert.equal(sentryServerBeforeBreadcrumb({ category: "console" })?.category, "console");

  const span = sentryServerBeforeSendSpan({
    description: "GET https://www.ebay.com/sch?_nkw=charizard",
    data: {
      "http.url": "https://www.ebay.com/sch?_nkw=charizard",
      "listing.count": 3,
      query: "charizard",
    },
  });
  assert.equal(span.description, "GET https://www.ebay.com/sch");
  assert.equal(span.data?.["http.url"], undefined);
  assert.equal(span.data?.query, undefined);
  assert.equal(span.data?.["listing.count"], 3);
});

test("withScanSpan is a no-op without an SDK and still returns the callback value", async () => {
  const value = await withScanSpan(SCAN_SPAN.ebay, async () => 7);
  assert.equal(value, 7);
});

test("withScanSpan records the hop name and listing count on a mock SDK", async () => {
  const calls: Array<{ name: string; attributes?: Record<string, unknown> }> = [];
  setSentryServerForTests({
    init() {},
    startSpan(opts, callback) {
      const rec = { name: opts.name, attributes: { ...(opts.attributes ?? {}) } };
      calls.push(rec);
      return callback({
        setAttribute(key, value) {
          rec.attributes[key] = value;
        },
        updateName(name) {
          rec.name = name;
        },
      });
    },
    async flush() {
      return true;
    },
  });

  const rows = await withScanSpan(SCAN_SPAN.ebay, async (span) => {
    span?.setAttribute("listing.count", 3);
    return ["a", "b", "c"];
  });
  assert.deepEqual(rows, ["a", "b", "c"]);
  assert.equal(calls.length, 1);
  assert.equal(calls[0]?.name, "scan.ebay");
  assert.equal(calls[0]?.attributes?.["listing.count"], 3);
});

test("cache lookup names the span hit or miss and never sends the query", async () => {
  const calls: Array<{ name: string; op?: string; attributes: Record<string, unknown> }> = [];
  setSentryServerForTests({
    init() {},
    startSpan(opts, callback) {
      const rec = { name: opts.name, op: opts.op, attributes: { ...(opts.attributes ?? {}) } };
      calls.push(rec);
      return callback({
        setAttribute(key, value) {
          rec.attributes[key] = value;
        },
        updateName(name) {
          rec.name = name;
        },
      });
    },
    async flush() {
      return true;
    },
  });

  const hit = await withScanCacheLookup(async () => ({ q: "charizard" }), () => true);
  assert.deepEqual(hit.fresh, { q: "charizard" });
  assert.deepEqual(hit.stored, { q: "charizard" });
  assert.equal(calls[0]?.name, "scan.cache.hit");
  assert.equal(calls[0]?.op, "cache");
  assert.equal(calls[0]?.attributes["cache.hit"], true);
  assert.equal(calls[0]?.attributes.q, undefined);

  calls.length = 0;
  const miss = await withScanCacheLookup(async () => null, () => true);
  assert.equal(miss.fresh, null);
  assert.equal(miss.stored, null);
  assert.equal(calls[0]?.name, "scan.cache.miss");
  assert.equal(calls[0]?.attributes["cache.hit"], false);

  calls.length = 0;
  const stale = await withScanCacheLookup(async () => ({ at: 1 }), () => false);
  assert.equal(stale.fresh, null);
  assert.deepEqual(stale.stored, { at: 1 });
  assert.equal(calls[0]?.name, "scan.cache.miss");
});

test("scan parent transaction tags web vs native and flushes", async () => {
  const calls: Array<{ name: string; forceTransaction?: boolean; attributes?: Record<string, unknown> }> =
    [];
  let flushed = 0;
  setSentryServerForTests({
    init() {},
    startSpan(opts, callback) {
      calls.push({
        name: opts.name,
        forceTransaction: opts.forceTransaction,
        attributes: opts.attributes,
      });
      return callback({
        setAttribute() {},
        updateName() {},
      });
    },
    withIsolationScope(fn) {
      return fn();
    },
    async flush() {
      flushed += 1;
      return true;
    },
  });

  const native = await withScanTransaction("native", async () => "ok");
  assert.equal(native, "ok");
  assert.equal(calls[0]?.name, "scan");
  assert.equal(calls[0]?.forceTransaction, true);
  assert.equal(calls[0]?.attributes?.["scan.source"], "native");
  assert.equal(flushed, 1);

  calls.length = 0;
  const web = await withScanTransaction("web", async () => 2);
  assert.equal(web, 2);
  assert.equal(calls[0]?.attributes?.["scan.source"], "web");
  assert.equal(flushed, 2);
});

test("withScanTransaction flushes even when the scan throws", async () => {
  let flushed = 0;
  setSentryServerForTests({
    init() {},
    startSpan(_opts, callback) {
      return callback({
        setAttribute() {},
        updateName() {},
      });
    },
    async flush() {
      flushed += 1;
      return true;
    },
  });

  await assert.rejects(
    () =>
      withScanTransaction("web", async () => {
        throw new Error("boom");
      }),
    /boom/,
  );
  assert.equal(flushed, 1);
});
