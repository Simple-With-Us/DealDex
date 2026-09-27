import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { test } from "node:test";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const SUBTITLE = "Compare Pokémon card listing prices";
const LEGACY_NATIVE_SUBTITLE = "Find the best-priced Pokémon card listings";

function read(rel) {
  return readFileSync(join(ROOT, rel), "utf8");
}

test("shared subtitle describes listing-price comparisons", () => {
  const copy = read("src/lib/copy.ts");
  assert.match(copy, new RegExp(SUBTITLE.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
});

test("site uses shared comparison subtitle and native copy remains release-scoped", () => {
  assert.match(read("src/routes/index.tsx"), /APP_SUBTITLE/);
  assert.match(read("src/routes/__root.tsx"), /APP_SUBTITLE/);
  const og = read("scripts/og-dealdex.html");
  assert.doesNotMatch(og, new RegExp(SUBTITLE.replace("é", "é")));
  assert.match(og, /dealdex-wordmark\.png/);
  assert.match(read("native/android/app/src/main/res/values/strings.xml"), new RegExp(LEGACY_NATIVE_SUBTITLE));
  assert.doesNotMatch(read("src/routes/index.tsx"), /Find the best listings/);
  assert.doesNotMatch(read("src/routes/__root.tsx"), /Find the best listings/);
});

test("scan box has no suggested Pokémon chips and one marketplace toggle pair", () => {
  const scan = read("src/components/scanner.tsx");
  assert.doesNotMatch(scan, /charizard/);
  assert.doesNotMatch(scan, /umbreon/);
  assert.doesNotMatch(scan, /CHIPS/);
  assert.match(scan, /size="lg"/);
  assert.match(scan, /count=\{ebayCount\}/);
  assert.match(scan, /count=\{mercariCount\}/);
  assert.match(scan, /md:grid-cols-2/);
  assert.match(scan, /grid-cols-3/);
  assert.match(scan, /bg-scan/);
  assert.equal((scan.match(/MarketplaceToggle/g) || []).length, 3);
});

test("scan source toggles stay on one mobile row without redundant scanner copy", () => {
  const scan = read("src/components/scanner.tsx");
  assert.doesNotMatch(scan, /Live Market Scanner/);
  assert.doesNotMatch(scan, /Hunts Buy It Now singles and scores asks/);
  assert.doesNotMatch(scan, /Scan Sources:/);
  assert.match(scan, /grid grid-cols-2 gap-2/);
  assert.equal(
    (scan.match(/className="w-full min-w-0 max-sm:gap-1 max-sm:px-2"/g) || []).length,
    2,
  );
});

test("OG card is logo-only and centers a large wordmark", () => {
  const og = read("scripts/og-dealdex.html");
  assert.match(og, /align-items:\s*center/);
  assert.match(og, /justify-content:\s*center/);
  assert.match(og, /width:\s*88%/);
  assert.doesNotMatch(og, /DealDex\.net/i);
  assert.doesNotMatch(og, /eBay/i);
});

test("Android scan has no suggested chips and shows counts on source toggles", () => {
  const kt = read("native/android/app/src/main/java/me/grok/dealdex/ui/ScanScreen.kt");
  assert.doesNotMatch(kt, /charizard/);
  assert.doesNotMatch(kt, /POKÉMON LISTING DESK/);
  assert.match(kt, /MarketplaceSourceToggle/);
  assert.match(kt, /GridCells\.Fixed/);
});
