import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

function read(rel) {
  return readFileSync(join(ROOT, rel), "utf8");
}

/**
 * Source with comments removed.
 *
 * Needed because these files deliberately DESCRIBE the attacks they defend
 * against, and a doc comment quoting `?done=1&challenge=` would otherwise trip
 * an assertion that the code never builds such a URL.
 */
function readCode(rel) {
  return read(rel)
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/^\s*\/\/.*$/gm, "");
}

test("native scan payload maps adjustedMarket to adjusted for the iPhone parser", () => {
  const src = read("src/lib/native/scan-payload.ts");
  assert.match(src, /export function nativeScanRows/);
  assert.match(src, /adjusted: row\.appraisal\.adjustedMarket/);
  assert.match(src, /grade: row\.parsed\.grade/);
  assert.match(src, /marketplace: row\.listing\.marketplace/);
});

test("native scan and oauth routes exist and are public (no session gate on scan)", () => {
  const scan = read("src/routes/api/native/scan.ts");
  assert.match(scan, /createFileRoute\("\/api\/native\/scan"\)/);
  assert.match(scan, /scanAndScore/);
  assert.doesNotMatch(scan, /getSessionUser/);
  const oauth = read("src/routes/api/native/oauth.ts");
  assert.match(oauth, /createFileRoute\("\/api\/native\/oauth"\)/);
  assert.match(oauth, /NATIVE_SCHEME = "dealdex"/);
  assert.match(oauth, /:\/\/auth\?/);
  assert.match(oauth, /signInSocial/);
  assert.match(oauth, /"google"/);
});

test("the native scan endpoint refuses desk keys, because /privacy promises it", () => {
  const scan = readCode("src/routes/api/native/scan.ts");
  // No key plumbing: nothing reads a key, nothing passes one to the scorer.
  assert.doesNotMatch(scan, /cleanKeys/);
  assert.doesNotMatch(scan, /DeskKeys/);
  assert.match(scan, /scanAndScore\(query, sources\)/);

  // And "refuses" has to mean refuses. Silently ignoring a keys payload would
  // make the published word untrue and let a regressed client keep POSTing
  // credentials with nothing to notice.
  assert.match(scan, /body\.keys != null/);
  assert.match(scan, /status: 400/);

  const privacy = read("src/routes/privacy.tsx");
  assert.match(privacy, /the scan endpoint refuses one outright/);
});

test("native scan records Sentry cache and parent spans without accepting keys", () => {
  const scan = read("src/routes/api/native/scan.ts");
  assert.match(scan, /withScanTransaction\("native"/);
  assert.match(scan, /withScanCacheLookup/);
  assert.match(scan, /scanAndScore\(query, sources\)/);
});

test("the phone apps' 'never sends a key' claim is qualified wherever it appears", () => {
  // Both clients expose "Push Phone Keys to Account", which POSTs to
  // /api/native/keys. An unqualified "never sends a key" is contradicted by a
  // button in the app it describes.
  for (const [file, re] of [
    ["src/routes/privacy.tsx", /Scanning never sends a key/],
    ["src/routes/settings.tsx", /A scan never sends a key/],
    ["src/routes/install.tsx", /A scan never sends a paid desk key/],
    ["README.md", /scanning never sends one/],
  ]) {
    assert.match(read(file), re, `${file} states the claim without qualifying it`);
  }
});

test("/install does not hand out the pre-fix APK", () => {
  const install = read("src/routes/install.tsx");
  assert.match(install, /No sideload build on this site right now/);
  assert.doesNotMatch(install, /href="\/DealDex\.apk"/);
  assert.doesNotMatch(install, /href="\/DealDex-source\.zip"/);
  assert.equal(existsSync(join(ROOT, "public/DealDex.apk")), false);
  assert.equal(existsSync(join(ROOT, "public/DealDex-source.zip")), false);
});

test("native sign-in hands over a single-use code, never a session token", () => {
  const oauth = read("src/routes/api/native/oauth.ts");
  // The hand-off must carry `code`, and must NOT carry the session token.
  assert.match(oauth, /handoffPage\(code, email\)/);
  assert.doesNotMatch(oauth, /nativeRedirect\(\{ token/);
  assert.match(oauth, /isValidChallenge/);

  const exchange = read("src/routes/api/native/exchange.ts");
  assert.match(exchange, /createFileRoute\("\/api\/native\/exchange"\)/);
  assert.match(exchange, /redeemCode/);

  // Both clients must send a challenge and redeem with a verifier.
  const swift = read("native/ios/DealDex/NativeAuth.swift");
  assert.match(swift, /challenge=/);
  assert.match(swift, /api\/native\/exchange/);
  assert.doesNotMatch(swift, /dict\["token"\]/);

  const kotlin = read("native/android/app/src/main/java/me/grok/dealdex/data/NativeAuth.kt");
  assert.match(kotlin, /appendQueryParameter\("challenge"/);
  assert.match(kotlin, /api\/native\/exchange/);
  assert.doesNotMatch(kotlin, /getQueryParameter\("token"\)/);
});

test("the return leg trusts a server-issued state, never a caller's challenge", () => {
  // Without this, a malicious app could open
  //   /api/native/oauth?done=1&challenge=<its own>
  // as a top-level navigation, ride the SameSite=Lax session cookie, catch
  // dealdex://auth?code=… on its own intent filter, and redeem the code with the
  // verifier it picked. PKCE would have bought nothing.
  const oauth = readCode("src/routes/api/native/oauth.ts");
  const doneLeg = oauth.slice(oauth.indexOf('get("done")'), oauth.indexOf("const providerId"));
  assert.doesNotMatch(
    doneLeg,
    /searchParams\.get\("challenge"\)/,
    "the done=1 leg must never read a challenge from the query string",
  );
  assert.match(doneLeg, /takePendingAuth\(state\)/);
  assert.match(doneLeg, /sign_in_expired/);

  // Leg 1 must mint and persist the state, and send only the state onward.
  assert.match(oauth, /storePendingAuth\(state, challenge\)/);
  assert.match(oauth, /done=1&state=\$\{encodeURIComponent\(state\)\}/);
  assert.doesNotMatch(oauth, /done=1&challenge=/);
});

test("the hand-off needs a tap, so a flow the user did not start cannot finish silently", () => {
  const oauth = read("src/routes/api/native/oauth.ts");
  assert.match(oauth, /function handoffPage/);
  assert.match(oauth, /text\/html/);
  assert.match(oauth, /escapeHtml\(target\)/);
  assert.match(oauth, /If you did not start this sign-in/);
});

test("native Apple Sign In uses the system sheet and HTTPS identity-token exchange", () => {
  const route = read("src/routes/api/native/apple-signin.ts");
  assert.match(route, /createFileRoute\("\/api\/native\/apple-signin"\)/);
  assert.match(route, /signInSocial/);
  assert.match(route, /provider:\s*"apple"/);
  assert.match(route, /idToken/);
  // Better Auth Apple idToken.user.name is { firstName, lastName }, not a string.
  assert.match(route, /firstName/);
  assert.match(route, /lastName/);
  assert.doesNotMatch(readCode("src/routes/api/native/apple-signin.ts"), /name:\s*string/);

  const tree = read("src/routeTree.gen.ts");
  assert.match(tree, /\/api\/native\/apple-signin/);
  assert.match(tree, /ApiNativeAppleSigninRoute/);

  const swift = read("native/ios/DealDex/NativeAuth.swift");
  assert.match(swift, /ASAuthorizationAppleIDProvider/);
  assert.match(swift, /api\/native\/apple-signin/);
  assert.match(swift, /identityToken/);
  // Continuation bodies are nonisolated; AppleSignInDelegate is @MainActor.
  // ios-ship archive (run 33721859665) failed without this hop.
  assert.match(swift, /Task \{ @MainActor in/);
  assert.match(swift, /@MainActor\nfinal class AppleSignInDelegate/);
  // Session token must travel over HTTPS JSON, never the dealdex:// query.
  assert.doesNotMatch(swift, /dict\["token"\]/);
  assert.match(swift, /json\["token"\]/);
});

test("credentials are kept in the platform keystore, not a plain prefs file", () => {
  const prefs = read("native/android/app/src/main/java/me/grok/dealdex/data/Prefs.kt");
  assert.match(prefs, /EncryptedSharedPreferences/);
  const manifest = read("native/android/app/src/main/AndroidManifest.xml");
  assert.match(manifest, /android:allowBackup="false"/);

  const store = read("native/ios/DealDex/DeskStore.swift");
  assert.match(store, /kSecClassGenericPassword/);
  assert.match(store, /kSecAttrAccessibleAfterFirstUnlockThisDeviceOnly/);
});

test("a keystore failure loses the session, it does not write secrets in the clear", () => {
  // R8 strips Tink's reflectively-registered key managers unless kept, so
  // `EncryptedSharedPreferences.create` can throw in the RELEASE build only.
  // Falling back to a MODE_PRIVATE file there would have put the session token
  // and all three paid desk keys on disk in plaintext, silently, in exactly the
  // build that ships.
  const prefs = readCode("native/android/app/src/main/java/me/grok/dealdex/data/Prefs.kt");
  assert.match(prefs, /getOrElse \{ MemoryStore\(\) \}/);
  assert.doesNotMatch(
    prefs,
    /getSharedPreferences\("dealdex\.secure/,
    "the fallback must not be a file",
  );

  const keep = read("native/android/app/proguard-rules.pro");
  assert.match(keep, /com\.google\.crypto\.tink/);
  assert.match(keep, /shaded\.protobuf/);
});

test("the sign-in redirect is consumed once, so rotation cannot spend the code twice", () => {
  const main = readCode("native/android/app/src/main/java/me/grok/dealdex/MainActivity.kt");
  assert.match(main, /intent\.data = null/);
});

test("notification permission is asked for when alerts are on, not at cold start", () => {
  const main = readCode("native/android/app/src/main/java/me/grok/dealdex/MainActivity.kt");
  // Not in onCreate any more...
  const onCreate = main.slice(main.indexOf("override fun onCreate"), main.indexOf("override fun onResume"));
  assert.doesNotMatch(onCreate, /askNotify\.launch/);
  // ...but the default rule ships enabled, so the switch's rising edge is not
  // enough on a fresh install. The Alerts screen asks on arrival.
  const alerts = readCode("native/android/app/src/main/java/me/grok/dealdex/ui/AlertsScreen.kt");
  assert.match(alerts, /LaunchedEffect\(rule\.enabled\)/);
  assert.match(alerts, /requestNotificationPermission\(\)/);
});

test("the iOS card scanner reads the camera instead of faking a result", () => {
  // What this replaced: CameraScannerView showed a viewfinder-shaped rectangle
  // with nothing behind it, then `simulateScan()` set "Charizard" / "4/102"
  // after a 1.2s timer no matter what the phone was pointed at.
  //
  // These are source assertions, not a camera test.  They can prove the fake is
  // gone and that a real capture path is wired up; only a run on a physical
  // iPhone proves it recognises a card, and the Simulator cannot do it at all
  // (DataScannerViewController.isSupported is false there).
  const scanView = read("native/ios/DealDex/ScanView.swift");
  const pbx = read("native/ios/DealDex.xcodeproj/project.pbxproj");

  // The fake is gone from the source and from the target.
  assert.doesNotMatch(scanView, /CameraScannerView/);
  assert.doesNotMatch(pbx, /CameraScannerView/);
  assert.doesNotMatch(scanView, /simulateScan/);

  // A real capture path: VisionKit live text on the camera feed.
  assert.match(scanView, /^import VisionKit$/m);
  assert.match(scanView, /^import AVFoundation$/m);
  assert.match(scanView, /DataScannerViewController\(\s*\n?\s*recognizedDataTypes: \[\.text\(\)\]/);
  assert.match(scanView, /try controller\.startScanning\(\)/);
  assert.match(scanView, /controller\.stopScanning\(\)/);
  assert.match(scanView, /DataScannerViewControllerDelegate/);

  // Permission is asked for, and refusal is stated rather than swallowed.
  assert.match(scanView, /AVCaptureDevice\.authorizationStatus\(for: \.video\)/);
  assert.match(scanView, /await AVCaptureDevice\.requestAccess\(for: \.video\)/);
  assert.match(scanView, /DealDex has no camera access/);
  // The Simulator and pre-A12 devices are told the truth, not shown a dead view.
  assert.match(scanView, /!DataScannerViewController\.isSupported/);
  assert.match(scanView, /does not run in the Simulator/);

  // No fabricated result: the query is nil unless a name was actually read, and
  // nothing reaches the scan box until the user taps.
  assert.match(scanView, /guard let name = cardName\(in: lines\) else \{ return nil \}/);
  assert.match(scanView, /No card name read yet/);
  assert.match(scanView, /\.disabled\(suggestion == nil\)/);
  assert.match(scanView, /onQuery\(suggestion\)/);
  // The only place a scan query is written from the camera is the sheet callback.
  const writes = scanView.match(/desk\.query = /g) ?? [];
  assert.equal(writes.length, 1, `desk.query written ${writes.length} times`);

  // No hardcoded card anywhere in the reader.
  assert.doesNotMatch(readCode("native/ios/DealDex/ScanView.swift"), /Charizard/i);
});

test("the iOS camera scanner has a usage string, in the plist and in the generator", () => {
  // Reading the camera without NSCameraUsageDescription is a hard crash on
  // first use.  project.yml is the generator input, so a key added only to
  // Info.plist disappears the next time someone runs `xcodegen generate`.
  const plist = read("native/ios/DealDex/Info.plist");
  const yml = read("native/ios/project.yml");
  assert.match(plist, /<key>NSCameraUsageDescription<\/key>/);
  assert.match(yml, /NSCameraUsageDescription:/);

  const copy = plist.match(
    /<key>NSCameraUsageDescription<\/key>\s*<string>([\s\S]*?)<\/string>/,
  )?.[1];
  assert.ok(copy && copy.length > 40, "the usage string has to say what the camera is for");
  assert.ok(yml.includes(copy), "project.yml and Info.plist must carry the same string");
  // /privacy says the image never leaves the phone; the prompt has to agree.
  assert.match(copy, /stays on your iPhone/);
});

test("Android scans on the device first and sends no keys to the website", () => {
  const market = read("native/android/app/src/main/java/me/grok/dealdex/data/Market.kt");
  assert.match(market, /\/api\/native\/scan/);
  assert.match(market, /scanViaSite/);
  // On-device is the primary path, which is what /privacy describes.
  // The 1500-char window accommodates the Sentry transaction wrapper
  // around scanOnDevice + scanViaSite in the on-device-first ordering
  // (added in PR #341 of the MM comprehensive review).  The extra
  // onDeviceSpan argument is the parent for scan.ebay / scan.mercari hops.
  assert.match(
    market,
    /scanOnDevice\(query, keys, sources(?:, onDeviceSpan)?\)[\s\S]{0,1500}scanViaSite\(site, query, sources\)/,
  );
  // The site payload carries no credential of any kind.
  assert.doesNotMatch(market, /put\("keys"/);
  assert.doesNotMatch(market, /"justtcg", keys\.justTcg/);
  const scan = read("native/android/app/src/main/java/me/grok/dealdex/ui/ScanScreen.kt");
  assert.match(scan, /Text\("SCAN"/);
  assert.match(scan, /Hide proxies/);
  assert.match(scan, /leave blank to scan everything/);
  assert.doesNotMatch(scan, /Text\("Scan"\)/);
});

test("iOS scans on the device first and sends no keys to the website", () => {
  const market = read("native/ios/DealDex/Market.swift");
  assert.match(market, /\/api\/native\/scan/);
  assert.match(market, /scanViaSite/);
  assert.match(market, /scanOnDevice\(query, keys: keys, sources: src\)[\s\S]{0,400}scanViaSite\(site, query, sources: src\)/);
  assert.doesNotMatch(market, /"keys": \[/);
  assert.doesNotMatch(market, /"justtcg": keys\.justTcg/);
  const settings = read("native/ios/DealDex/SettingsView.swift");
  assert.match(settings, /Sign in with Google/);
  assert.match(settings, /Sign in with Apple/);
  assert.match(settings, /Sign in with X/);
  assert.doesNotMatch(settings, /Sign In with email/);
  assert.doesNotMatch(settings, /Create Account/);
  const scanView = read("native/ios/DealDex/ScanView.swift");
  const marks = read("native/ios/DealDex/MarketplaceMarks.swift");
  assert.match(scanView, /MarketplaceToggle/);
  assert.match(scanView, /desk\.sources\.contains\("ebay"\)/);
  assert.match(scanView, /count: desk\.ebayCount/);
  assert.match(scanView, /count: desk\.mercariCount/);
  assert.match(scanView, /DealDexCopy\.subtitle/);
  assert.match(scanView, /ProgressView\("Reading eBay and Mercari…"\)/);
  assert.match(
    scanView,
    /ProgressView\("Reading eBay and Mercari…"\)\s*\.frame\(maxWidth: \.infinity, maxHeight: \.infinity, alignment: \.center\)/,
  );
  assert.doesNotMatch(scanView, /charizard/);
  assert.doesNotMatch(scanView, /POKÉMON LISTING DESK/);
  assert.match(marks, /EbayWordmark/);
  assert.match(marks, /MercariWordmark/);
  assert.match(marks, /eoFill: true/);
  assert.match(marks, /width: 35 \* scale, height: 14 \* scale/);
  assert.match(marks, /width: 64 \* scale, height: 14 \* scale/);
  assert.doesNotMatch(scanView, /Text\("e"\)/);
  assert.doesNotMatch(scanView, /Text\("MERCARI"\)/);
});

test("iOS Sentry stays dark without a configured DSN", () => {
  const sentry = read("native/ios/DealDex/SentryTelemetry.swift");
  assert.doesNotMatch(sentry, /ingest\.us\.sentry\.io/);
  assert.match(sentry, /SENTRY_DSN/);
  assert.match(sentry, /guard !dsn.isEmpty else \{ return \}/);
});
