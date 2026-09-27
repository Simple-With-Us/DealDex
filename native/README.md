# DealDex native apps

Android and iPhone apps.  They talk to eBay, Mercari, TCGDex, JustTCG, PriceCharting, and pokemontcg.io **from the phone**.  The website is optional.  These are not React Native, Expo, Capacitor, or a web wrapper.

Keys you paste in **Settings** live on the device.  If the website is down, scan still uses those keys.

**Settings** also has optional sign-in.  Use the same Google, Apple, or X account as the website only when you want to copy keys to or from your account.

Play is not shipping yet.  Android package is `me.grok.dealdex` (build from
`native/android` on `main`; dealdex.net does not host an APK).  iOS is
`net.dealdex` (team `CC8UTF7ATG`, Apple app SKU `dealdex`, appleId `6802474288`).
Internal TestFlight exists.  Do not restore a public APK until a signed,
device-tested release build exists.

## Android

Sentry Android (`io.sentry:sentry-android`) inits in `DealDexApp` when
`BuildConfig.SENTRY_DSN` is set from env `SENTRY_DSN` at compile time.
Empty DSN stays dark.  Privacy: no default PII, no screenshots, no view
hierarchy.  Masked Session Replay is 10% session / 100% error;
`profilesSampleRate` is 0.1.  Mapping upload plugin is not wired yet.

Build the debug APK locally (there is no sideload file on dealdex.net):

```
cd native/android
JAVA_HOME="$(/usr/libexec/java_home -v 17 2>/dev/null || echo /opt/homebrew/opt/openjdk@17)"
ANDROID_HOME="${ANDROID_HOME:-/opt/homebrew/share/android-commandlinetools}"
ANDROID_HOME="$ANDROID_HOME" JAVA_HOME="$JAVA_HOME" ./gradlew :app:assembleDebug --no-daemon
```

The repo ships a Gradle 8.7 wrapper.  Point `local.properties` `sdk.dir` at your Android SDK (copy `local.properties.example`).  Need JDK 17.

- Package `me.grok.dealdex`, min SDK 26, target 35.
- Launcher name: DealDex.

## iOS

1. From `native/ios`, run `xcodegen generate` after editing `project.yml` (then `xcodegen-post.py` sets Xcode 26.3 / objectVersion 100).
2. Open `DealDex.xcodeproj` in Xcode 26.3 (team `CC8UTF7ATG`).  Display name **DealDex**.  Minimum iOS **17.0**.
3. Run on a phone or simulator.  Scan talks to `https://dealdex.net/api/native/scan` and does not require sign-in.  Google website accounts use **Sign in with Google**.

Home-screen icon is the official overlapping red + blue DD (yellow rim) on
the Socratic.Trade tiled field (soft top-left light, recessed grout, no
candlesticks) in `DealDex/Assets.xcassets`.  `CFBundleIconName` is
`AppIcon`.  iPad `UISupportedInterfaceOrientations` includes
PortraitUpsideDown.  Android launcher mipmaps and the adaptive icon use
the isolated transparent DD mark.  Do not put the in-app wordmark on the home
screen.

In-app / web **title** is `DealDexWordmark` (glossy 3D DealDex PNG).  Scan subtitle
guidance is Compare Pokémon card listing prices.  Native binaries may retain older
copy until their next release; the website wording does not establish a native update.

```
xcodebuild -project native/ios/DealDex.xcodeproj -scheme DealDex \
  -destination 'generic/platform=iOS Simulator' build
```

Bundle id: `net.dealdex`.  Display name: DealDex.  Min iOS: 17.0.  Project format: Xcode 26.3.  Team: `CC8UTF7ATG`.  Apple bundle resource id `R2FAW69NPD` is not a team id.

TestFlight archive + upload is `.github/workflows/ios-ship.yml` on GitHub-hosted `macos-latest` (app key `dealdex`, bundle `net.dealdex`).  Manual: `bash scripts/ios-ship-testflight.sh`.  ASC app DealDex SKU `dealdex`, appleId `6802474288`.

AppIcon catalog is the DD on the ST tiled field.  Older preview variants
live in `native/brand/icon-options/`.
