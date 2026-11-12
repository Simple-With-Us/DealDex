/**
 * Tests for the Infisical sole-source-of-truth settings contract
 * (see INFISICAL.md):
 *
 *   - startup init() populates the in-memory cache from Infisical;
 *   - runtime reads make zero network calls after init;
 *   - write-through saves Infisical FIRST, then the local cache;
 *   - a failed refresh keeps serving the last-known-good cache;
 *   - a failed write-through rejects and leaves the cache untouched;
 *   - without credentials the module degrades to local-only mode
 *     (process.env + defaults) and set() refuses.
 *
 * The Infisical HTTP API is faked via the fetchImpl seam — no network.
 */
import { afterEach, beforeEach, describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  __resetAppSettingsForTests,
  defaultServerEnv,
  getBooleanSetting,
  getNumberSetting,
  getRequiredSetting,
  getSetting,
  initAppSettings,
  refreshSettings,
  resolveAppEnv,
  setSetting,
  settingSource,
  settingsConnected,
} from "./app-settings";

type RecordedCall = { method: string; url: string; body?: any };

function jsonResponse(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function makeFakeFetch(options: {
  secrets?: Record<string, string>;
  failLoad?: boolean;
  failWrite?: boolean;
  /** Called synchronously inside the write handler — observe cache state mid-write. */
  onWrite?: (key: string, value: string) => void;
}) {
  const state = {
    secrets: { ...(options.secrets ?? {}) },
    failLoad: options.failLoad ?? false,
    failWrite: options.failWrite ?? false,
  };
  const calls: RecordedCall[] = [];
  const fetchImpl = (async (input: any, init?: RequestInit): Promise<Response> => {
    const url = String(input);
    const method = (init?.method ?? "GET").toUpperCase();
    let body: any;
    try {
      body = init?.body ? JSON.parse(String(init.body)) : undefined;
    } catch {
      body = undefined;
    }
    calls.push({ method, url, body });
    if (url.includes("/api/v1/auth/universal-auth/login")) {
      return jsonResponse({ accessToken: "test-token" });
    }
    if (/\/api\/v3\/secrets\/raw\//.test(url)) {
      if (state.failWrite) return new Response("boom", { status: 500 });
      const key = decodeURIComponent(url.split("/api/v3/secrets/raw/")[1] ?? "");
      const value = String(body?.secretValue ?? "");
      options.onWrite?.(key, value);
      if (method === "PATCH" && !(key in state.secrets)) {
        return new Response("not found", { status: 404 }); // → client falls back to POST create
      }
      state.secrets[key] = value;
      return jsonResponse({});
    }
    if (url.includes("/api/v3/secrets/raw")) {
      if (state.failLoad) throw new Error("network down");
      return jsonResponse({
        secrets: Object.entries(state.secrets).map(([secretKey, secretValue]) => ({
          secretKey,
          secretValue,
        })),
      });
    }
    return new Response("not found", { status: 404 });
  }) as typeof fetch;
  return { fetchImpl, calls, state };
}

const CREDS = { clientId: "test-id", clientSecret: "test-secret", environment: "prod" as const };

let savedClientId: string | undefined;
let savedClientSecret: string | undefined;

beforeEach(() => {
  savedClientId = process.env.INFISICAL_CLIENT_ID;
  savedClientSecret = process.env.INFISICAL_CLIENT_SECRET;
  delete process.env.INFISICAL_CLIENT_ID;
  delete process.env.INFISICAL_CLIENT_SECRET;
});

afterEach(() => {
  if (savedClientId === undefined) delete process.env.INFISICAL_CLIENT_ID;
  else process.env.INFISICAL_CLIENT_ID = savedClientId;
  if (savedClientSecret === undefined) delete process.env.INFISICAL_CLIENT_SECRET;
  else process.env.INFISICAL_CLIENT_SECRET = savedClientSecret;
  __resetAppSettingsForTests();
});

describe("initAppSettings", () => {
  it("populates the cache from Infisical at startup", async () => {
    const { fetchImpl } = makeFakeFetch({
      secrets: { SCAN_MAX_ROWS_PER_RUN: "25", EBAY_ENV: "sandbox" },
    });
    const connected = await initAppSettings({ ...CREDS, fetchImpl });
    assert.equal(connected, true);
    assert.equal(settingsConnected(), true);
    assert.equal(getSetting("SCAN_MAX_ROWS_PER_RUN"), "25");
    assert.equal(getSetting("EBAY_ENV"), "sandbox");
  });

  it("prefers Infisical over process.env, env over schema defaults", async () => {
    process.env.SCAN_MAX_ROWS_PER_RUN = "10";
    const { fetchImpl } = makeFakeFetch({ secrets: { SCAN_MAX_ROWS_PER_RUN: "25" } });
    await initAppSettings({ ...CREDS, fetchImpl });
    assert.equal(getSetting("SCAN_MAX_ROWS_PER_RUN"), "25"); // Infisical wins
    assert.equal(settingSource("SCAN_MAX_ROWS_PER_RUN"), "infisical");
    delete process.env.SCAN_MAX_ROWS_PER_RUN;
    __resetAppSettingsForTests();
    const { fetchImpl: f2 } = makeFakeFetch({ secrets: {} });
    await initAppSettings({ ...CREDS, fetchImpl: f2 });
    assert.equal(getSetting("SCAN_MAX_ROWS_PER_RUN"), "50"); // schema default
    assert.equal(settingSource("SCAN_MAX_ROWS_PER_RUN"), "default");
  });

  it("runtime reads make zero network calls after init", async () => {
    const { fetchImpl, calls } = makeFakeFetch({ secrets: { EBAY_ENV: "sandbox" } });
    await initAppSettings({ ...CREDS, fetchImpl });
    const baseline = calls.length;
    for (let i = 0; i < 50; i++) {
      getSetting("EBAY_ENV");
      getNumberSetting("SCAN_MAX_ROWS_PER_RUN", 50);
      getBooleanSetting("AUTO_BUY_DRY_RUN_FORCE", false);
      settingSource("DATABASE_URL");
      defaultServerEnv();
    }
    assert.equal(calls.length, baseline, "reads must be memory/env only");
  });
});

describe("write-through set()", () => {
  it("writes Infisical FIRST, then updates the local cache", async () => {
    let cacheValueDuringWrite: string | undefined;
    const { fetchImpl, calls } = makeFakeFetch({
      secrets: { SCAN_MAX_ROWS_PER_RUN: "50" },
      onWrite: () => {
        // While the Infisical write is in flight, the local cache must
        // still hold the OLD value — cache updates only after the write.
        cacheValueDuringWrite = getSetting("SCAN_MAX_ROWS_PER_RUN");
      },
    });
    await initAppSettings({ ...CREDS, fetchImpl });
    await setSetting("SCAN_MAX_ROWS_PER_RUN", "25");
    assert.equal(cacheValueDuringWrite, "50");
    const writeCall = calls.find((c) => /\/api\/v3\/secrets\/raw\//.test(c.url));
    assert.ok(writeCall, "expected an Infisical write call");
    assert.equal(getSetting("SCAN_MAX_ROWS_PER_RUN"), "25");
    assert.equal(settingSource("SCAN_MAX_ROWS_PER_RUN"), "infisical");
  });

  it("creates the secret when it does not exist yet (404 → POST)", async () => {
    const { fetchImpl, calls } = makeFakeFetch({ secrets: {} });
    await initAppSettings({ ...CREDS, fetchImpl });
    await setSetting("EBAY_ENV", "sandbox");
    const methods = calls
      .filter((c) => /\/api\/v3\/secrets\/raw\//.test(c.url))
      .map((c) => c.method);
    assert.deepEqual(methods, ["PATCH", "POST"]);
    assert.equal(getSetting("EBAY_ENV"), "sandbox");
  });

  it("rejects on a failed write and leaves the cache untouched", async () => {
    const { fetchImpl } = makeFakeFetch({
      secrets: { SCAN_MAX_ROWS_PER_RUN: "50" },
      failWrite: true,
    });
    await initAppSettings({ ...CREDS, fetchImpl });
    await assert.rejects(() => setSetting("SCAN_MAX_ROWS_PER_RUN", "25"));
    assert.equal(getSetting("SCAN_MAX_ROWS_PER_RUN"), "50");
  });

  it("rejects unknown keys so the inventory stays honest", async () => {
    const { fetchImpl } = makeFakeFetch({ secrets: {} });
    await initAppSettings({ ...CREDS, fetchImpl });
    await assert.rejects(() => setSetting("NOT_A_REAL_SETTING", "x"), /Unknown app setting/);
  });
});

describe("refresh()", () => {
  it("a failed refresh keeps serving the last-known-good cache", async () => {
    const fake = makeFakeFetch({ secrets: { EBAY_ENV: "sandbox" } });
    await initAppSettings({ ...CREDS, fetchImpl: fake.fetchImpl });
    assert.equal(getSetting("EBAY_ENV"), "sandbox");
    // Simulate an Infisical outage on the next load: refresh must fail
    // loudly (returns false) while the old value keeps serving.
    fake.state.failLoad = true;
    const ok = await refreshSettings();
    assert.equal(ok, false);
    assert.equal(getSetting("EBAY_ENV"), "sandbox");
    // And recovery works on the next attempt.
    fake.state.failLoad = false;
    assert.equal(await refreshSettings(), true);
    assert.equal(getSetting("EBAY_ENV"), "sandbox");
  });

  it("a failed initial load degrades to local-only mode instead of throwing", async () => {
    const { fetchImpl } = makeFakeFetch({ failLoad: true });
    const connected = await initAppSettings({ ...CREDS, fetchImpl });
    assert.equal(connected, false);
    assert.equal(settingsConnected(), false);
  });
});

describe("local-only mode", () => {
  it("falls back to process.env + defaults without credentials", async () => {
    process.env.EBAY_ENV = "sandbox";
    const connected = await initAppSettings();
    assert.equal(connected, false);
    assert.equal(getSetting("EBAY_ENV"), "sandbox");
    assert.equal(settingSource("EBAY_ENV"), "env");
    assert.equal(getSetting("SCAN_MAX_ROWS_PER_RUN"), "50");
    delete process.env.EBAY_ENV;
  });

  it("set() refuses in local-only mode — fail, never diverge", async () => {
    await initAppSettings();
    await assert.rejects(() => setSetting("EBAY_ENV", "sandbox"), /not connected/);
  });

  it("refreshSettings() is a false no-op in local-only mode", async () => {
    await initAppSettings();
    assert.equal(await refreshSettings(), false);
  });
});

describe("typed helpers", () => {
  it("getNumberSetting parses, falls back on garbage", async () => {
    const { fetchImpl } = makeFakeFetch({ secrets: { SCAN_MAX_ROWS_PER_RUN: "not-a-number" } });
    await initAppSettings({ ...CREDS, fetchImpl });
    assert.equal(getNumberSetting("SCAN_MAX_ROWS_PER_RUN", 50), 50);
    __resetAppSettingsForTests();
    const f2 = makeFakeFetch({ secrets: { SCAN_MAX_ROWS_PER_RUN: "25" } });
    await initAppSettings({ ...CREDS, fetchImpl: f2.fetchImpl });
    assert.equal(getNumberSetting("SCAN_MAX_ROWS_PER_RUN", 50), 25);
  });

  it("getBooleanSetting parses true/false variants", async () => {
    const { fetchImpl } = makeFakeFetch({ secrets: { AUTO_BUY_DRY_RUN_FORCE: "true" } });
    await initAppSettings({ ...CREDS, fetchImpl });
    assert.equal(getBooleanSetting("AUTO_BUY_DRY_RUN_FORCE", false), true);
    __resetAppSettingsForTests();
    const f2 = makeFakeFetch({ secrets: {} });
    await initAppSettings({ ...CREDS, fetchImpl: f2.fetchImpl });
    assert.equal(getBooleanSetting("AUTO_BUY_DRY_RUN_FORCE", false), false); // default
    assert.equal(getBooleanSetting("AUTO_BUY_DRY_RUN_FORCE", true), false);
  });

  it("getRequiredSetting throws a clear error naming the key", async () => {
    const { fetchImpl } = makeFakeFetch({ secrets: {} });
    await initAppSettings({ ...CREDS, fetchImpl });
    assert.throws(() => getRequiredSetting("SCAN_RUNNER_TOKEN"), /SCAN_RUNNER_TOKEN/);
  });

  it("defaultServerEnv overlays Infisical onto process.env", async () => {
    process.env.EBAY_ENV = "production";
    const { fetchImpl } = makeFakeFetch({ secrets: { EBAY_ENV: "sandbox" } });
    await initAppSettings({ ...CREDS, fetchImpl });
    const snapshot = defaultServerEnv();
    assert.equal(snapshot.EBAY_ENV, "sandbox");
    delete process.env.EBAY_ENV;
  });
});

describe("resolveAppEnv", () => {
  it("reads Infisical prod in every deploy environment", () => {
    assert.equal(resolveAppEnv({ VERCEL_ENV: "production" }), "prod");
    assert.equal(resolveAppEnv({ VERCEL_ENV: "preview" }), "prod");
    assert.equal(resolveAppEnv({ VERCEL_ENV: "development" }), "prod");
    assert.equal(resolveAppEnv({ DEALDEX_ENV: "staging" }), "prod");
    assert.equal(resolveAppEnv({ APP_ENV: "dev" }), "prod");
    assert.equal(resolveAppEnv({}), "prod");
    assert.equal(resolveAppEnv({ DEALDEX_INFISICAL_ENV: "prod" }), "prod");
  });

  it("refuses a non-prod DEALDEX_INFISICAL_ENV override: warns once, never throws", () => {
    const warnings: string[] = [];
    const realWarn = console.warn;
    console.warn = (...args: unknown[]) => {
      warnings.push(args.map(String).join(" "));
    };
    try {
      assert.equal(resolveAppEnv({ DEALDEX_INFISICAL_ENV: "dev" }), "prod");
      assert.equal(resolveAppEnv({ DEALDEX_INFISICAL_ENV: "staging", VERCEL_ENV: "preview" }), "prod");
      assert.equal(resolveAppEnv({ DEALDEX_INFISICAL_ENV: "nope", VERCEL_ENV: "production" }), "prod");
    } finally {
      console.warn = realWarn;
    }
    assert.equal(warnings.length, 1);
    assert.match(warnings[0], /DEALDEX_INFISICAL_ENV/);
    assert.match(warnings[0], /prod only/);
  });

  it("asks Infisical for the prod environment when no override is given", async () => {
    const { fetchImpl, calls } = makeFakeFetch({ secrets: { SCAN_MAX_ROWS_PER_RUN: "25" } });
    await initAppSettings({ clientId: "test-id", clientSecret: "test-secret", fetchImpl });
    const loads = calls.filter((c) => /\/api\/v3\/secrets\/raw\?/.test(c.url));
    assert.ok(loads.length > 0, "expected at least one secrets load");
    for (const call of loads) {
      assert.equal(new URL(call.url).searchParams.get("environment"), "prod");
    }
  });
});
