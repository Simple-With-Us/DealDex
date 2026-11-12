import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const ICONSET = "apps/ios/DealDex/Assets.xcassets/AppIcon.appiconset";

function read(rel) {
  return readFileSync(join(ROOT, rel), "utf8");
}

function pngSize(rel) {
  const buf = readFileSync(join(ROOT, rel));
  assert.equal(buf.subarray(0, 8).toString("binary"), "\x89PNG\r\n\x1a\n");
  return { width: buf.readUInt32BE(16), height: buf.readUInt32BE(20), bytes: buf.length };
}

test("Info.plist sets CFBundleIconName to AppIcon", () => {
  const plist = read("apps/ios/DealDex/Info.plist");
  assert.match(
    plist,
    /<key>CFBundleIconName<\/key>\s*<string>AppIcon<\/string>/,
  );
});

test("iPad multitasking lists all four orientations including PortraitUpsideDown", () => {
  const plist = read("apps/ios/DealDex/Info.plist");
  const required = [
    "UIInterfaceOrientationPortrait",
    "UIInterfaceOrientationPortraitUpsideDown",
    "UIInterfaceOrientationLandscapeLeft",
    "UIInterfaceOrientationLandscapeRight",
  ];
  for (const key of [
    "UISupportedInterfaceOrientations",
    "UISupportedInterfaceOrientations~ipad",
  ]) {
    const block = plist.match(
      new RegExp(`<key>${key}</key>\\s*<array>([\\s\\S]*?)</array>`),
    );
    assert.ok(block, `missing ${key}`);
    for (const orientation of required) {
      assert.match(block[1], new RegExp(`<string>${orientation}</string>`));
    }
  }
});

test("XcodeGen spec names the AppIcon catalog", () => {
  const spec = read("apps/ios/project.yml");
  assert.match(spec, /^\s+ASSETCATALOG_COMPILER_APPICON_NAME: AppIcon$/m);
  assert.match(spec, /^\s+INFOPLIST_KEY_CFBundleIconName: AppIcon$/m);
});

test("AppIcon catalog includes 120, 152, and 1024 PNGs", () => {
  const contents = JSON.parse(read(`${ICONSET}/Contents.json`));
  const files = new Set(contents.images.map((img) => img.filename));
  assert.ok(files.has("Icon-60@2x.png"), "120px iPhone app icon");
  assert.ok(files.has("Icon-76@2x.png"), "152px iPad app icon");
  assert.ok(files.has("Icon-1024.png"), "1024 marketing icon");

  const iphone120 = pngSize(`${ICONSET}/Icon-60@2x.png`);
  assert.deepEqual({ width: iphone120.width, height: iphone120.height }, { width: 120, height: 120 });
  const ipad152 = pngSize(`${ICONSET}/Icon-76@2x.png`);
  assert.deepEqual({ width: ipad152.width, height: ipad152.height }, { width: 152, height: 152 });
  const store = pngSize(`${ICONSET}/Icon-1024.png`);
  assert.deepEqual({ width: store.width, height: store.height }, { width: 1024, height: 1024 });
  assert.ok(store.bytes > 50_000, "1024 icon should be real artwork, not a stub");
});

test("generated pbxproj compiles AppIcon from the asset catalog", () => {
  const pbx = read("apps/ios/DealDex.xcodeproj/project.pbxproj");
  assert.match(pbx, /ASSETCATALOG_COMPILER_APPICON_NAME = AppIcon;/);
  assert.match(pbx, /Assets\.xcassets/);
  assert.match(pbx, /PBXResourcesBuildPhase/);
  assert.doesNotMatch(pbx, /R2FAW69NPD/);
});

test("Android launcher uses the DD adaptive icon and mipmaps", () => {
  const adaptive = read(
    "apps/android/app/src/main/res/mipmap-anydpi-v26/ic_launcher.xml",
  );
  assert.match(adaptive, /@drawable\/ic_launcher_foreground/);
  assert.match(adaptive, /@color\/launcher_bg/);
  assert.doesNotMatch(adaptive, /ic_delta/);
  const colors = read("apps/android/app/src/main/res/values/colors.xml");
  assert.match(colors, /<color name="launcher_bg">#FFFFFF<\/color>/);
  const xxx = pngSize(
    "apps/android/app/src/main/res/mipmap-xxxhdpi/ic_launcher.png",
  );
  assert.deepEqual({ width: xxx.width, height: xxx.height }, { width: 192, height: 192 });
  const xxxBuf = readFileSync(join(ROOT, "apps/android/app/src/main/res/mipmap-xxxhdpi/ic_launcher.png"));
  assert.equal(xxxBuf[25], 6, "Android mipmaps must keep the isolated DD alpha");
  const fg = readFileSync(join(ROOT, "apps/android/app/src/main/res/drawable/ic_launcher_foreground.png"));
  assert.equal(fg[25], 6, "Android adaptive foreground must keep the isolated DD alpha");
});

test("web favicon is a transparent DD PNG/ICO, not an SVG letter tile", () => {
  const png = readFileSync(join(ROOT, "public/favicon.png"));
  assert.equal(png.subarray(0, 8).toString("binary"), "\x89PNG\r\n\x1a\n");
  assert.equal(png[25], 6, "favicon.png must be RGBA");
  const fav32 = pngSize("public/favicon-32.png");
  assert.deepEqual({ width: fav32.width, height: fav32.height }, { width: 32, height: 32 });
  const fav16 = pngSize("public/favicon-16.png");
  assert.deepEqual({ width: fav16.width, height: fav16.height }, { width: 16, height: 16 });
  assert.ok(existsSync(join(ROOT, "public/favicon.ico")), "Safari looks up /favicon.ico");
  const head = read("src/routes/__root.tsx");
  assert.match(head, /favicon\.ico/);
  assert.match(head, /favicon-32\.png/);
  assert.doesNotMatch(head, /rel: "icon", type: "image\/svg\+xml"/);
  const pwa = pngSize("public/__grok/icon-180.png");
  assert.deepEqual({ width: pwa.width, height: pwa.height }, { width: 180, height: 180 });
  const pwaBuf = readFileSync(join(ROOT, "public/__grok/icon-180.png"));
  assert.equal(pwaBuf[25], 6, "PWA 180 must keep the isolated DD alpha");
  assert.ok(pwa.bytes > 4_000, "PWA 180 should be the glossy DD, not a stub");
  const source = pngSize("assets/brand/dealdex-dd-icon-1024.png");
  assert.deepEqual({ width: source.width, height: source.height }, { width: 1024, height: 1024 });
});

test("AppIcon generator resizes owner art and does not invent a tiled field", () => {
  const gen = read("scripts/generate-app-icons.py");
  assert.match(gen, /dealdex-dd-icon-1024\.png/);
  assert.doesNotMatch(gen, /st_background/);
  assert.doesNotMatch(gen, /MARK_SCALE/);
  assert.doesNotMatch(gen, /compose_app_icon/);
  assert.match(gen, /favicon_mark\(mark, 180\)/);
});

test("header wordmark is not wrapped in a global img outline", () => {
  const css = read("src/styles.css");
  assert.doesNotMatch(css, /img\s*\{[^}]*outline:/);
  const mark = read("src/components/app-mark.tsx");
  assert.match(mark, /outline-none/);
});
