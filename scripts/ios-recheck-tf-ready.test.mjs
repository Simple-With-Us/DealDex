import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

test("ios-recheck-tf-ready avoids bash 4 mapfile for macos-latest bash 3.2", () => {
  const sh = readFileSync(join(ROOT, "scripts/ios-recheck-tf-ready.sh"), "utf8");
  assert.doesNotMatch(sh, /\bmapfile\b/);
  assert.match(sh, /IFS= read -r BUNDLE_ID/);
  assert.match(sh, /IFS= read -r MARKETING/);
  assert.match(sh, /IFS= read -r APPLE_ID/);
});

test("ios-recheck-tf-ready fails fast on unknown app key", () => {
  const r = spawnSync(
    "bash",
    ["scripts/ios-recheck-tf-ready.sh", "no-such-app", "100000000001"],
    { cwd: ROOT, encoding: "utf8" },
  );
  assert.equal(r.status, 2);
  assert.match(r.stderr, /::error::.*unknown app key/);
});

test("ios-recheck-tf-ready fails fast when bundleId or appleId missing", () => {
  const dir = mkdtempSync(join(tmpdir(), "apps-json-"));
  const appsPath = join(dir, "apps.json");
  writeFileSync(
    appsPath,
    JSON.stringify({ apps: { stub: { bundleId: "", marketingVersionDefault: "1.0.0" } } }),
  );
  const r = spawnSync(
    "bash",
    ["scripts/ios-recheck-tf-ready.sh", "stub", "100000000001"],
    {
      cwd: ROOT,
      encoding: "utf8",
      env: { ...process.env, APPS_JSON_PATH: appsPath },
    },
  );
  assert.equal(r.status, 2);
  assert.match(r.stderr, /::error::.*missing bundleId or appleId/);
});
