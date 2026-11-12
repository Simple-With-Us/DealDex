import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { test } from "node:test";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

test("official DealDex wordmark PNG is present", () => {
  const png = readFileSync(join(ROOT, "public/marks/dealdex-wordmark.png"));
  assert.ok(png.length > 8);
  assert.equal(png.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])), true);
  // IHDR color type 6 = RGBA (transparent field, not a white box)
  assert.equal(png[25], 6);
});

test("isolated interlocking DD PNG is present and not the live AppIcon", () => {
  const png = readFileSync(join(ROOT, "public/marks/dealdex-dd.png"));
  assert.ok(png.length > 8);
  assert.equal(png.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])), true);
  assert.equal(png[25], 6);
  const catalog = readFileSync(
    join(ROOT, "apps/ios/DealDex/Assets.xcassets/AppIcon.appiconset/Contents.json"),
    "utf8",
  );
  assert.match(catalog, /Icon-1024\.png/);
  assert.doesNotMatch(catalog, /dealdex-dd\.png/);
});

test("iOS title uses DealDexWordmark imageset, not serif Find the best listings", () => {
  const scan = readFileSync(join(ROOT, "apps/ios/DealDex/ScanView.swift"), "utf8");
  const brand = readFileSync(join(ROOT, "apps/ios/DealDex/DealDexBrand.swift"), "utf8");
  assert.match(brand, /Image\("DealDexWordmark"\)/);
  assert.match(brand, /Compare Pokémon card listing prices/);
  assert.match(scan, /DealDexTitle/);
  assert.match(scan, /DealDexCopy\.subtitle/);
  assert.doesNotMatch(scan, /Find the best listings/);
  assert.doesNotMatch(scan, /POKÉMON LISTING DESK/);
  const imageset = readFileSync(
    join(ROOT, "apps/ios/DealDex/Assets.xcassets/DealDexWordmark.imageset/Contents.json"),
    "utf8",
  );
  assert.match(imageset, /dealdex-wordmark\.png/);
});

test("dd.svg is the official title wordmark, not a DD monogram", () => {
  const svg = readFileSync(join(ROOT, "public/marks/dd.svg"), "utf8");
  assert.match(svg, /DealDex/);
  assert.match(svg, /#E30613/);
  assert.match(svg, /#0066FF/);
  assert.match(svg, /#FFD200/);
  assert.doesNotMatch(svg, />DD</);
});

test("header and login use DealDexWordmark, not a chip plus serif title", () => {
  const shell = readFileSync(join(ROOT, "src/components/shell.tsx"), "utf8");
  const login = readFileSync(join(ROOT, "src/routes/login.tsx"), "utf8");
  assert.match(shell, /DealDexWordmark/);
  assert.doesNotMatch(shell, /<AppMark/);
  assert.match(login, /DealDexWordmark/);
  assert.doesNotMatch(login, /<AppMark/);
});

test("settings has no App Mark picker — the official wordmark is fixed", () => {
  const settings = readFileSync(join(ROOT, "src/routes/settings.tsx"), "utf8");
  assert.doesNotMatch(settings, /App Mark/);
  assert.doesNotMatch(settings, /useAppMark/);
  assert.doesNotMatch(settings, /APP_MARKS/);
});

test("header wordmark PNG is cache-busted so the 3D title replaces the arched mark", () => {
  const mark = readFileSync(join(ROOT, "src/components/app-mark.tsx"), "utf8");
  assert.match(mark, /dealdex-wordmark\.png\?v=/);
});

test("login is social-only: Google, Apple, X — no email/password form", () => {
  const login = readFileSync(join(ROOT, "src/routes/login.tsx"), "utf8");
  assert.match(login, /Continue with \{p\.label\}/);
  assert.match(login, /SOCIAL_PROVIDERS/);
  assert.doesNotMatch(login, /signIn\.email/);
  assert.doesNotMatch(login, /type="password"/);
  assert.doesNotMatch(login, /Create an account/);
});

test("settings has a 3-way appearance toggle above price sources, not in the hamburger", () => {
  const settings = readFileSync(join(ROOT, "src/routes/settings.tsx"), "utf8");
  const menu = readFileSync(join(ROOT, "src/components/account-menu.tsx"), "utf8");
  assert.match(settings, /AppearanceToggle/);
  assert.match(settings, /Price sources/);
  const appearanceAt = settings.indexOf("Appearance");
  const desksAt = settings.indexOf("Price sources");
  assert.ok(appearanceAt > 0 && desksAt > appearanceAt);
  assert.doesNotMatch(menu, /Appearance/);
  const toggle = readFileSync(join(ROOT, "src/components/appearance-toggle.tsx"), "utf8");
  assert.match(toggle, /Light/);
  assert.match(toggle, /Dark/);
  assert.match(toggle, /System/);
});

test("auth talks to Google/Apple/X directly, not the Grok broker", () => {
  const server = readFileSync(join(ROOT, "src/lib/auth/server.ts"), "utf8");
  const providers = readFileSync(join(ROOT, "src/lib/auth/providers.ts"), "utf8");
  const email = readFileSync(join(ROOT, "src/lib/auth/email-password.ts"), "utf8");
  assert.match(server, /socialProviders/);
  assert.doesNotMatch(server, /genericOAuth/);
  assert.doesNotMatch(server, /GROK_AUTH_ISSUER/);
  assert.match(providers, /id: "google"/);
  assert.match(providers, /id: "apple"/);
  assert.match(providers, /id: "twitter"/);
  assert.match(email, /emailAndPasswordEnabled = false/);
});

