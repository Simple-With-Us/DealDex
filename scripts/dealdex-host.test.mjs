import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { test } from "node:test";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

function read(rel) {
  return readFileSync(join(ROOT, rel), "utf8");
}

test("public/ does not ship a sideload APK", () => {
  assert.equal(existsSync(join(ROOT, "public/DealDex.apk")), false);
  assert.equal(existsSync(join(ROOT, "public/DealDex-source.zip")), false);
});

test("robots.txt and sitemap.xml exist and name dealdex.net", () => {
  const robots = read("public/robots.txt");
  assert.match(robots, /Sitemap: https:\/\/dealdex\.net\/sitemap\.xml/);
  assert.match(read("public/sitemap.xml"), /https:\/\/dealdex\.net\//);
});

test("market logos do not inject extra document titles", () => {
  assert.doesNotMatch(read("src/components/market-logo.tsx"), /<title>/);
});

test("canonical public host is dealdex.net", () => {
  assert.match(read("src/routes/__root.tsx"), /VITE_PUBLIC_HOSTNAME \|\| "dealdex\.net"/);
  assert.match(read("apps/ios/DealDex/NativeAuth.swift"), /https:\/\/dealdex\.net/);
  assert.match(read("docs/store-listing.md"), /https:\/\/dealdex\.net\/privacy/);
  assert.doesNotMatch(read("src/routes/__root.tsx"), /dealdex\.online/);
  assert.doesNotMatch(read("vercel.json"), /dealdex\.online/);
});

test("living identity files say DealDex.net and net.dealdex", () => {
  const living = [
    "README.md",
    "PLAN.md",
    "CONTRIBUTING.md",
    "AGENTS.md",
    "STATUS.md",
    "docs/native-apps.md",
    "apps/ios/CLAUDE.md",
    "docs/store-listing.md",
    "docs/EFFORT-LOG.md",
    "docs/AUDIT-2026-09-01.md",
    "scripts/ios-fleet/apps.json",
    "scripts/ios-fleet/README.md",
  ];
  for (const rel of living) {
    const text = read(rel);
    assert.match(text, /dealdex\.net/, `${rel} must name dealdex.net`);
    assert.doesNotMatch(text, /dealdex\.online/, `${rel} must not name dealdex.online`);
    assert.doesNotMatch(text, /online\.dealdex/, `${rel} must not name online.dealdex`);
  }
  assert.match(read("PLAN.md"), /net\.dealdex/);
  assert.match(read("apps/ios/CLAUDE.md"), /net\.dealdex/);
  assert.match(read("scripts/ios-fleet/apps.json"), /"bundleId": "net\.dealdex"/);
});
