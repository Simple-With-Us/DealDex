import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  loadRunUserCredentials,
  loadUserSettings,
  upsertUserSettings,
  type UserSettings,
} from "./user-settings-store";

/**
 * These tests run against an in-process pglite instance via getSql().  When
 * DATABASE_URL is unset (CI / preview), getSql() falls back to PGlite.
 * The tests focus on the run-credential view contract that the scan-runner
 * reads every tick — the rest of the schema is exercised by the migration
 * itself.
 */

const NOW = Date.UTC(2026, 8, 21, 18, 0, 0);
const EXPIRED_AT = new Date(NOW - 60_000).toISOString();
const FRESH_AT = new Date(NOW + 3_600_000).toISOString();

describe("loadRunUserCredentials", () => {
  it("returns the safe-view defaults when the row does not exist", async () => {
    const settings = await loadUserSettings("missing-user");
    assert.equal(settings, null);
    const view = await loadRunUserCredentials("missing-user", NOW);
    assert.equal(view.has_ebay, false);
    assert.equal(view.ebay_username, null);
    assert.equal(view.ebay_oauth_expired, false);
    assert.equal(view.proxy_url_override, null);
    assert.equal(view.pushover_user_key, null);
  });

  it("marks ebay_connected when a refresh token is stored, and expired=false for a fresh token", async () => {
    await upsertUserSettings("user-1", {
      ebay_refresh_token: "rt-1",
      ebay_oauth_expiry: FRESH_AT,
      ebay_username: "powerbuyer42",
      pushover_user_key: "u-key",
      pushover_api_token: "a-token",
      proxy_url_override: "http://u:p@home.example.com:8080",
    });
    const view = await loadRunUserCredentials("user-1", NOW);
    assert.equal(view.has_ebay, true);
    assert.equal(view.ebay_oauth_expired, false);
    assert.equal(view.ebay_username, "powerbuyer42");
    assert.equal(view.proxy_url_override, "http://u:p@home.example.com:8080");
    assert.equal(view.pushover_user_key, "u-key");
  });

  it("marks ebay_oauth_expired=true once the expiry is in the past", async () => {
    await upsertUserSettings("user-2", {
      ebay_refresh_token: "rt-2",
      ebay_oauth_expiry: EXPIRED_AT,
      ebay_username: "expireduser",
    });
    const view = await loadRunUserCredentials("user-2", NOW);
    assert.equal(view.has_ebay, true);
    assert.equal(view.ebay_oauth_expired, true);
    assert.equal(view.ebay_username, "expireduser");
  });

  it("preserves untouched fields when a partial patch is applied", async () => {
    await upsertUserSettings("user-3", {
      ebay_refresh_token: "rt-3",
      ebay_username: "starter",
      pushover_user_key: "u-key",
    });
    // Partial patch: only change the proxy override.
    await upsertUserSettings("user-3", {
      proxy_url_override: "http://next.example.com:3128",
    });
    const row = (await loadUserSettings("user-3")) as UserSettings;
    assert.ok(row);
    assert.equal(row.ebay_refresh_token, "rt-3");
    assert.equal(row.ebay_username, "starter");
    assert.equal(row.pushover_user_key, "u-key");
    assert.equal(row.proxy_url_override, "http://next.example.com:3128");
  });
});