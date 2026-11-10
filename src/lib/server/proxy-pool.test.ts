import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { fetchWithPool, proxyPoolEnabled, readProxyPool, redactProxyUrl } from "./proxy-pool";

describe("redactProxyUrl", () => {
  it("strips user:pass from any proxy URL", () => {
    assert.equal(
      redactProxyUrl("http://user:pass@proxy.example.com:8080"),
      "http://***:***@proxy.example.com:8080",
    );
    assert.equal(
      redactProxyUrl("https://alice:s3cr3t@10.0.0.1:9000"),
      "https://***:***@10.0.0.1:9000",
    );
    assert.equal(
      redactProxyUrl("http://proxy.example.com:8080"),
      "http://proxy.example.com:8080",
    );
  });
  it("returns a safe placeholder on parse failure", () => {
    assert.equal(redactProxyUrl("not-a-url"), "[invalid-proxy-url]");
  });
});

describe("proxy pool config", () => {
  it("is disabled with no env var", () => {
    assert.equal(proxyPoolEnabled({}), false);
    assert.deepEqual(readProxyPool({}), []);
  });
  it("parses comma-separated URLs into one entry each", () => {
    const env = {
      PROXY_URL_LIST:
        "http://a:p1@proxy1.example.com:8080, https://b:p2@proxy2.example.com:3128 ",
    };
    const pool = readProxyPool(env);
    assert.equal(pool.length, 2);
    assert.equal(pool[0]!.safeUrl, "http://***:***@proxy1.example.com:8080");
    assert.equal(pool[1]!.safeUrl, "https://***:***@proxy2.example.com:3128");
    assert.equal(proxyPoolEnabled(env), true);
  });
});

describe("fetchWithPool", () => {
  it("is a no-op when PROXY_URL_LIST is unset (calls fetchImpl directly)", async () => {
    let called = 0;
    const fetchImpl: typeof fetch = async () => {
      called += 1;
      return new Response("ok", { status: 200 });
    };
    const res = await fetchWithPool("https://example.com/x", {}, {}, fetchImpl);
    assert.equal(res.status, 200);
    assert.equal(called, 1);
  });

  it("rotates through the pool on 403", async () => {
    const env = {
      PROXY_URL_LIST: "http://p1@h1:1, http://p2@h2:2, http://p3@h3:3",
    };
    const seen: string[] = [];
    const fetchImpl: typeof fetch = async (_input, init) => {
      // @ts-expect-error - dispatcher is set by buildProxiedInit
      const proxyUrl = init?.dispatcher?.uri ?? "direct";
      seen.push(proxyUrl);
      return seen.length === 1
        ? new Response("denied", { status: 403 })
        : new Response("ok", { status: 200 });
    };
    const res = await fetchWithPool("https://example.com/x", {}, env, fetchImpl);
    assert.equal(res.status, 200);
    // First call used proxy 1 and 403'd; we retried on proxy 2 and got 200.
    assert.equal(seen.length, 2);
  });

  it("returns the last response if all proxies return a non-rotating status", async () => {
    const env = { PROXY_URL_LIST: "http://p1@h1:1, http://p2@h2:2" };
    const fetchImpl: typeof fetch = async () =>
      new Response("not found", { status: 404 });
    const res = await fetchWithPool("https://example.com/x", {}, env, fetchImpl);
    assert.equal(res.status, 404);
  });
});