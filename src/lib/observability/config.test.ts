import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  isDatadogRequired,
  missingServerKeys,
  requireServerObservability,
} from "./config";

describe("datadog opt-in defaults", () => {
  it("stays dark in production without DD_* keys instead of throwing", () => {
    const env = { VERCEL_ENV: "production" };
    assert.equal(isDatadogRequired(env), false);
    assert.equal(requireServerObservability(env), null);
  });

  it("DD_REQUIRE=1 restores the fail-closed guard", () => {
    const env = { VERCEL_ENV: "production", DD_REQUIRE: "1" };
    assert.equal(isDatadogRequired(env), true);
    assert.deepEqual(missingServerKeys(env), ["DD_API_KEY"]);
    assert.throws(() => requireServerObservability(env), /fail-closed/);
  });

  it("returns the server config when the existing key names are present", () => {
    const config = requireServerObservability({
      VERCEL_ENV: "production",
      DD_API_KEY: "key",
      DD_SITE: "us5.datadoghq.com",
      DD_SERVICE: "dealdex",
      DD_ENV: "production",
    });
    assert.equal(config?.service, "dealdex");
    assert.equal(config?.site, "us5.datadoghq.com");
  });
});
