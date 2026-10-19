import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const BUNDLE_ID = "net.dealdex";
const TEAM_ID = "CC8UTF7ATG";
const BUNDLE_RESOURCE_ID = "R2FAW69NPD";

function read(rel) {
  return readFileSync(join(ROOT, rel), "utf8");
}

test("XcodeGen spec uses net.dealdex and team CC8UTF7ATG", () => {
  const spec = read("native/ios/project.yml");
  assert.match(spec, /^\s{4}bundleId: net\.dealdex$/m);
  assert.match(spec, /^\s+PRODUCT_BUNDLE_IDENTIFIER: net\.dealdex$/m);
  assert.match(spec, /^\s+DEVELOPMENT_TEAM: CC8UTF7ATG$/m);
  assert.doesNotMatch(spec, /me\.grok\.dealdex/);
  assert.doesNotMatch(spec, /DEVELOPMENT_TEAM:\s*R2FAW69NPD/);
});

test("XcodeGen pins display name DealDex, iOS 17.0, and Xcode 26.3 format", () => {
  const spec = read("native/ios/project.yml");
  assert.match(spec, /INFOPLIST_KEY_CFBundleDisplayName: DealDex/);
  assert.match(spec, /iOS: "17\.0"/);
  assert.match(spec, /IPHONEOS_DEPLOYMENT_TARGET: "17\.0"/);
  assert.match(spec, /xcodeVersion: "26\.3"/);
  assert.match(spec, /xcodegen-post\.py/);
  const plist = read("native/ios/DealDex/Info.plist");
  assert.match(
    plist,
    /<key>CFBundleDisplayName<\/key>\s*<string>DealDex<\/string>/,
  );
  assert.match(plist, /<string>dealdex<\/string>/);
});

test("generated pbxproj is Xcode 26.3 format on iOS 17", () => {
  const pbx = read("native/ios/DealDex.xcodeproj/project.pbxproj");
  assert.match(pbx, /objectVersion = 100;/);
  assert.match(pbx, /preferredProjectObjectVersion = 100;/);
  assert.match(pbx, /LastUpgradeCheck = 2630;/);
  assert.match(pbx, /IPHONEOS_DEPLOYMENT_TARGET = 17\.0;/);
  assert.match(pbx, /INFOPLIST_KEY_CFBundleDisplayName = DealDex;/);
  assert.doesNotMatch(pbx, /IPHONEOS_DEPLOYMENT_TARGET = 16/);
});

test("Info.plist CFBundleIdentifier is net.dealdex", () => {
  const plist = read("native/ios/DealDex/Info.plist");
  assert.match(
    plist,
    /<key>CFBundleIdentifier<\/key>\s*<string>net\.dealdex<\/string>/,
  );
  assert.doesNotMatch(plist, /me\.grok\.dealdex/);
});

test("generated pbxproj matches XcodeGen identity", () => {
  const pbx = read("native/ios/DealDex.xcodeproj/project.pbxproj");
  const bundleHits = pbx.match(/PRODUCT_BUNDLE_IDENTIFIER = [^;]+;/g) ?? [];
  assert.ok(bundleHits.length >= 2, "expected Debug and Release bundle ids");
  for (const hit of bundleHits) {
    assert.equal(hit, `PRODUCT_BUNDLE_IDENTIFIER = ${BUNDLE_ID};`);
  }
  const teamHits = pbx.match(/DEVELOPMENT_TEAM = [^;]+;/g) ?? [];
  assert.ok(teamHits.length >= 2, "expected DEVELOPMENT_TEAM on configs");
  for (const hit of teamHits) {
    assert.equal(hit, `DEVELOPMENT_TEAM = ${TEAM_ID};`);
  }
  assert.match(pbx, /DevelopmentTeam = CC8UTF7ATG;/);
  assert.doesNotMatch(pbx, /me\.grok\.dealdex/);
  assert.doesNotMatch(pbx, /DEVELOPMENT_TEAM = R2FAW69NPD;/);
  assert.doesNotMatch(pbx, /DevelopmentTeam = R2FAW69NPD;/);
});

test("iOS identity includes DealDexWordmark imageset and official marketplace paths", () => {
  const wordmark = read(
    "native/ios/DealDex/Assets.xcassets/DealDexWordmark.imageset/Contents.json",
  );
  assert.match(wordmark, /dealdex-wordmark\.png/);
  const marks = read("native/ios/DealDex/MarketplaceMarks.swift");
  assert.match(marks, /struct EbayWordmark/);
  assert.match(marks, /struct MercariWordmark/);
  assert.match(marks, /viewBox\.width/);
});

test("iOS version regimen uses 1.0.<commit_count> marketing and the same build", () => {
  const spec = read("native/ios/project.yml");
  const plist = read("native/ios/DealDex/Info.plist");
  const pbx = read("native/ios/DealDex.xcodeproj/project.pbxproj");

  const marketing = spec.match(/^ {4}MARKETING_VERSION: "([^"]+)"/m)?.[1];
  const build = spec.match(/^ {4}CURRENT_PROJECT_VERSION: "([^"]+)"/m)?.[1];
  assert.ok(marketing, "project.yml MARKETING_VERSION");
  assert.ok(build, "project.yml CURRENT_PROJECT_VERSION");
  assert.match(marketing, /^1\.0\.\d+$/);
  // Fleet regimen (owner 2026-10-18): the build number is the repo commit
  // count and the marketing version carries that same number, so the pair
  // always describes one value.  UTC YYYYMMDDHHMM stamps are retired.
  assert.match(build, /^\d+$/);
  assert.doesNotMatch(build, /^\d{12}$/, "UTC build stamps are retired");
  assert.equal(marketing, `1.0.${build}`);

  assert.match(
    plist,
    /<key>CFBundleShortVersionString<\/key>\s*<string>\$\(MARKETING_VERSION\)<\/string>/,
  );
  assert.match(
    plist,
    /<key>CFBundleVersion<\/key>\s*<string>\$\(CURRENT_PROJECT_VERSION\)<\/string>/,
  );
  assert.doesNotMatch(plist, /<key>CFBundleShortVersionString<\/key>\s*<string>1\.0<\/string>/);
  assert.doesNotMatch(plist, /<key>CFBundleVersion<\/key>\s*<string>1<\/string>/);

  const marketingHits = pbx.match(/MARKETING_VERSION = ([^;]+);/g) ?? [];
  const buildHits = pbx.match(/CURRENT_PROJECT_VERSION = ([^;]+);/g) ?? [];
  assert.ok(marketingHits.length >= 2);
  assert.ok(buildHits.length >= 2);
  for (const hit of marketingHits) {
    assert.equal(hit, `MARKETING_VERSION = ${marketing};`);
  }
  for (const hit of buildHits) {
    assert.equal(hit, `CURRENT_PROJECT_VERSION = ${build};`);
  }
});

test("AppUpdatePrompt iOS target matches the in-repo ios-fleet pin", () => {
  const pin = read("scripts/ios-fleet/AppUpdatePrompt.swift");
  const target = read("native/ios/DealDex/AppUpdatePrompt.swift");
  assert.equal(target, pin, "iOS target must be a byte-identical copy of the pin");
  assert.doesNotMatch(pin, /static let knownAppleIds/);
  assert.doesNotMatch(pin, /"online\.dealdex"/);
  assert.doesNotMatch(pin, /"me\.grok\.dealdex"/);
  assert.match(pin, /raw\.githubusercontent\.com\/Simple-With-Us\/AI-Fleet-Coordinator\/main\/site\/ios-versions\.json/);
  assert.match(pin, /Do not wrap this in a Swift package/);
  assert.match(pin, /Do not hardcode knownAppleIds here/);
});

test("live DealDex Apple ID lives in apps.json and Info.plist, not Swift", () => {
  const apps = JSON.parse(read("scripts/ios-fleet/apps.json"));
  const dealdex = apps.apps.dealdex;
  assert.equal(dealdex.bundleId, "net.dealdex");
  assert.equal(dealdex.appleId, 6804249232);
  assert.match(dealdex.notes, /net\.dealdex/);
  assert.match(dealdex.notes, /dealdex\.net/);
  assert.doesNotMatch(dealdex.notes, /online\.dealdex/);
  assert.doesNotMatch(dealdex.notes, /dealdex\.online/);

  const plist = read("native/ios/DealDex/Info.plist");
  assert.match(
    plist,
    /<key>AppUpdateAppleId<\/key>\s*<integer>6804249232<\/integer>/,
  );
  assert.doesNotMatch(plist, /online\.dealdex/);

  const spec = read("native/ios/project.yml");
  assert.match(spec, /AppUpdateAppleId: 6804249232/);
});

test("Apple bundle resource id is documented, never a team setting", () => {
  const spec = read("native/ios/project.yml");
  const onboarding = read("native/ios/CLAUDE.md");
  assert.match(spec, new RegExp(BUNDLE_RESOURCE_ID));
  assert.match(onboarding, new RegExp(BUNDLE_RESOURCE_ID));
  assert.match(onboarding, /not.*team/i);
  const pbx = read("native/ios/DealDex.xcodeproj/project.pbxproj");
  assert.doesNotMatch(pbx, new RegExp(BUNDLE_RESOURCE_ID));
});
