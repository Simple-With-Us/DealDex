import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { test } from "node:test";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "../../..");

function read(rel: string): string {
  return readFileSync(join(ROOT, rel), "utf8");
}

test("package.json ships @sentry/node next to @sentry/react", () => {
  const pkg = read("package.json");
  // Both Sentry SDKs must stay on the same major: the v10 -> v11 bump breaks
  // the build if they drift apart, and it removed `enableLogs` from
  // BrowserOptions. Pin the major rather than an exact version so a patch
  // bump does not need a test edit.
  const major = (name: string) => {
    const m = pkg.match(new RegExp(`"${name}":\\s*"\\^(\\d+)\\.`));
    assert.ok(m, `${name} not found in package.json`);
    return m[1];
  };
  assert.equal(major("@sentry/node"), major("@sentry/react"));
  assert.equal(major("@sentry/react"), "11", "expected the v11 Sentry bump");
});

test("privacy discloses Sentry scan-hop traces without listing titles", () => {
  const privacy = read("src/routes/privacy.tsx");
  assert.match(privacy, /Website Analytics/);
  assert.match(privacy, /Sentry Performance/);
  assert.match(privacy, /do not include listing titles, search queries, or desk/);
  assert.match(privacy, /Datadog Session Replay is off/);
});

test("Replay stays 100% on error, 10% session, masked, with Feedback widget", () => {
  const src = read("src/lib/observability/sentry.ts");
  assert.match(src, /VITE_SENTRY_DSN/);
  assert.match(src, /replaysSessionSampleRate[\s\S]*\?\? "0\.1"/);
  assert.match(src, /replaysOnErrorSampleRate[\s\S]*\?\? "1\.0"/);
  assert.match(src, /maskAllText:\s*true/);
  assert.match(src, /blockAllMedia:\s*true/);
  assert.match(src, /feedbackIntegration\(/);
  assert.match(src, /autoInject:\s*false/);
  assert.match(src, /formTitle:\s*"Report a Problem"/);
  assert.match(src, /export function openSentryFeedback/);
  assert.match(src, /colorScheme:\s*"light"/);
  // The Sentry v11 SDK no longer accepts the top-level option that enabled
  // logs in v10; it is unconditional there, so the init call must not set it.
  // Assert on the call body only, so this rule is not confused by prose.
  const initBody = src.slice(src.indexOf("Sentry.init("), src.indexOf("initialized = true"));
  assert.doesNotMatch(initBody, /enableLogs/);
});

test("iOS Cocoa reads SENTRY_DSN from Info.plist only", () => {
  const swift = read("native/ios/DealDex/SentryTelemetry.swift");
  assert.match(swift, /forInfoDictionaryKey: "SENTRY_DSN"/);
  assert.match(swift, /profilesSampleRate = 0\.1/);
  assert.match(swift, /sessionReplay\.onErrorSampleRate = 1\.0/);
  assert.doesNotMatch(swift, /ingest\.sentry\.io/);
  assert.doesNotMatch(swift, /\?\? "https:\/\//);

  const plist = read("native/ios/DealDex/Info.plist");
  assert.match(plist, /<key>SENTRY_DSN<\/key>/);
  assert.match(plist, /<string>\$\(SENTRY_DSN\)<\/string>/);
  assert.doesNotMatch(plist, /<string>https:\/\//);

  const yml = read("native/ios/project.yml");
  assert.match(yml, /^\s+SENTRY_DSN:\s*""\s*$/m);
  assert.match(yml, /^\s+SENTRY_DSN:\s*\$\(SENTRY_DSN\)\s*$/m);
  assert.doesNotMatch(yml, /SENTRY_DSN:\s*"https:\/\//);
});

test("server scan hops use named Sentry spans and keep Datadog at web.request", () => {
  const server = read("src/lib/observability/sentry-server.ts");
  assert.match(server, /scan\.ebay/);
  assert.match(server, /scan\.mercari/);
  assert.match(server, /scan\.match/);
  assert.match(server, /scan\.enrich/);
  assert.match(server, /scan\.cache\.hit/);
  assert.match(server, /scan\.cache\.miss/);
  assert.match(server, /SENTRY_DSN/);
  assert.match(server, /VITE_SENTRY_DSN/);
  assert.match(server, /sendDefaultPii:\s*false/);
  assert.match(server, /registerEsmLoaderHooks:\s*false/);
  assert.match(server, /sentryServerIntegrations/);
  assert.match(server, /beforeSendSpan:\s*sentryServerBeforeSendSpan/);
  assert.match(server, /await import\("@sentry\/node"\)/);
  assert.doesNotMatch(server, /listing\.title/);
  assert.match(server, /never attaches listing titles, search queries, or desk keys/);

  const hops = read("src/lib/marketplaces/scan.ts");
  assert.match(hops, /SCAN_SPAN\.ebay/);
  assert.match(hops, /SCAN_SPAN\.mercari/);
  assert.match(hops, /SCAN_SPAN\.match/);
  assert.match(hops, /SCAN_SPAN\.enrich/);
  assert.match(hops, /scan\.marketplace/);

  const web = read("src/lib/server/scan.ts");
  assert.match(web, /withScanTransaction\("web"/);
  assert.match(web, /withScanCacheLookup/);

  const native = read("src/routes/api/native/scan.ts");
  assert.match(native, /withScanTransaction\("native"/);
  assert.match(native, /withScanCacheLookup/);

  const middleware = read("server/middleware/sentry.ts");
  assert.match(middleware, /initSentryServer/);
  assert.match(middleware, /flushSentryServer/);
  assert.doesNotMatch(middleware, /status: 503/);

  const datadog = read("server/middleware/datadog.ts");
  assert.match(datadog, /name: "web.request"/);
  assert.doesNotMatch(datadog, /scan\.ebay/);
  assert.doesNotMatch(datadog, /scan\.mercari/);
});

test("Android Sentry SDK is present, DSN-gated, and privacy-safe", () => {
  const gradle = read("native/android/app/build.gradle.kts");
  assert.match(gradle, /io\.sentry:sentry-android/);
  assert.match(gradle, /buildConfigField\("String", "SENTRY_DSN"/);
  assert.match(gradle, /System\.getenv\("SENTRY_DSN"\)/);
  assert.doesNotMatch(gradle, /ingest\.sentry\.io/);

  const app = read("native/android/app/src/main/java/me/grok/dealdex/DealDexApp.kt");
  assert.match(app, /SentryAndroid\.init/);
  assert.match(app, /isSendDefaultPii\s*=\s*false/);
  assert.match(app, /isAttachScreenshot\s*=\s*false/);
  assert.match(app, /isAttachViewHierarchy\s*=\s*false/);
  assert.match(app, /tracesSampleRate\s*=\s*0\.2/);
  assert.match(app, /profilesSampleRate\s*=\s*0\.1/);
  assert.match(app, /isAnrEnabled\s*=\s*true/);
  assert.match(app, /sessionReplay\.sessionSampleRate\s*=\s*0\.1/);
  assert.match(app, /sessionReplay\.onErrorSampleRate\s*=\s*1\.0/);
  assert.match(app, /setMaskAllText\(true\)/);
  assert.match(app, /setMaskAllImages\(true\)/);

  const manifest = read("native/android/app/src/main/AndroidManifest.xml");
  assert.match(manifest, /io\.sentry\.auto-init/);
  assert.match(manifest, /android:value="false"/);

  const native = read("native/README.md");
  assert.match(native, /io\.sentry:sentry-android/);
  assert.doesNotMatch(native, /iOS only until Android tracks ship/i);
});
