import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { test } from "node:test";
import {
  DEFAULT_DD_SITE,
  failClosedMessage,
  firstEnv,
  isProductionObservability,
  missingProductionKeys,
  missingRumKeys,
  missingServerKeys,
  requireRumPublicConfig,
  requireServerObservability,
  resolveApiKey,
  resolveSite,
} from "../src/lib/observability/config.ts";
import { datadogTraceHeaders, decimalToHex, hexToDecimal, parseIncomingTrace } from "../src/lib/observability/ids.ts";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

function read(rel) {
  return readFileSync(join(ROOT, rel), "utf8");
}

test("reuses existing Datadog env names and the US5 site", () => {
  assert.equal(DEFAULT_DD_SITE, "us5.datadoghq.com");
  assert.equal(resolveSite({}), "us5.datadoghq.com");
  assert.equal(resolveSite({ DD_SITE: "us5.datadoghq.com" }), "us5.datadoghq.com");
  assert.equal(resolveApiKey({ DATADOG_API_KEY: "abc" }), "abc");
  assert.equal(resolveApiKey({ DD_API_KEY: "from-dd", DATADOG_API_KEY: "from-alias" }), "from-dd");
  assert.equal(firstEnv({ VITE_DD_APPLICATION_ID: "app" }, ["DD_APPLICATION_ID", "VITE_DD_APPLICATION_ID"]), "app");
});

test("explicit Datadog requirement is fail-closed when the server API key is missing", () => {
  const env = { VERCEL_ENV: "production", DD_REQUIRE: "1" };
  assert.equal(isProductionObservability(env), true);
  assert.deepEqual(missingServerKeys(env), ["DD_API_KEY"]);
  assert.deepEqual(missingProductionKeys(env), ["DD_API_KEY"]);
  assert.deepEqual(missingRumKeys(env), ["DD_APPLICATION_ID", "DD_CLIENT_TOKEN"]);
  assert.throws(() => requireServerObservability(env), /fail-closed/);
  assert.equal(requireRumPublicConfig(env), null);
  assert.match(failClosedMessage(["DD_API_KEY"]), /DD_API_KEY/);
});

test("production APM without RUM tokens stays up and leaves RUM dark", () => {
  const env = {
    VERCEL_ENV: "production",
    DD_API_KEY: "server-key",
  };
  assert.deepEqual(missingServerKeys(env), []);
  assert.deepEqual(missingRumKeys(env), ["DD_APPLICATION_ID", "DD_CLIENT_TOKEN"]);
  const server = requireServerObservability(env);
  assert.ok(server);
  assert.equal(requireRumPublicConfig(env), null);
});

test("preview and local skip instrumentation when keys are absent", () => {
  assert.equal(requireServerObservability({ VERCEL_ENV: "preview" }), null);
  assert.equal(requireRumPublicConfig({ NODE_ENV: "test" }), null);
});

test("production succeeds only when server and RUM keys are present", () => {
  const env = {
    VERCEL_ENV: "production",
    DD_API_KEY: "server-key",
    DD_APPLICATION_ID: "rum-app",
    DD_CLIENT_TOKEN: "rum-token",
    DD_SERVICE: "dealdex",
  };
  const server = requireServerObservability(env);
  assert.ok(server);
  assert.equal(server.site, "us5.datadoghq.com");
  assert.equal(server.service, "dealdex");
  const rum = requireRumPublicConfig(env);
  assert.ok(rum);
  assert.equal(rum.applicationId, "rum-app");
  assert.equal(rum.clientToken, "rum-token");
  assert.ok(!("apiKey" in rum));
});

test("malformed traceparent does not throw on header emit", () => {
  const headers = new Headers({ traceparent: "00-not-hex-zzzz-01" });
  const ctx = parseIncomingTrace(headers);
  assert.doesNotThrow(() => datadogTraceHeaders(ctx));
  assert.match(datadogTraceHeaders(ctx).traceparent, /^00-[0-9a-f]+-[0-9a-f]+-/);
  assert.equal(hexToDecimal("zzzz"), "0");
});

test("trace header round-trip keeps Datadog and W3C ids", () => {
  const headers = new Headers({
    "x-datadog-trace-id": "42",
    "x-datadog-parent-id": "7",
    "x-datadog-sampling-priority": "1",
    "x-datadog-origin": "rum",
  });
  const ctx = parseIncomingTrace(headers);
  assert.equal(hexToDecimal(decimalToHex("42", 16)), "42");
  assert.equal(ctx.origin, "rum");
  const out = datadogTraceHeaders(ctx);
  assert.equal(out["x-datadog-trace-id"], "42");
  assert.match(out.traceparent, /^00-/);
});

test("root mounts Datadog RUM and privacy discloses it", () => {
  const root = read("src/routes/__root.tsx");
  assert.match(root, /from "@\/lib\/observability\/rum"/);
  assert.match(root, /<DatadogRum /);
  assert.match(root, /getRumPublicConfig/);
  const privacy = read("src/routes/privacy.tsx");
  assert.match(privacy, /Real User Monitoring to Datadog/);
  assert.match(privacy, /Session Replay is off/);
});

test("no invented secrets and no iOS Datadog SDK", () => {
  const config = read("src/lib/observability/config.ts");
  assert.match(config, /DD_API_KEY/);
  assert.match(config, /DATADOG_API_KEY/);
  assert.doesNotMatch(config, /pubb[a-f0-9]{20,}/i);
  const ios = read("native/ios/project.yml");
  assert.doesNotMatch(ios, /Datadog/);
  const middleware = read("server/middleware/datadog.ts");
  assert.match(middleware, /throw err/);
  assert.match(middleware, /missingServerKeys/);
  assert.doesNotMatch(middleware, /missingProductionKeys/);
  assert.doesNotMatch(middleware, /--force-ship/);
  assert.match(middleware, /name: "web.request"/);
  assert.doesNotMatch(middleware, /scan\.ebay/);
  assert.doesNotMatch(middleware, /scan\.mercari/);
  assert.doesNotMatch(middleware, /scan\.match/);
  assert.doesNotMatch(middleware, /scan\.enrich/);
});
