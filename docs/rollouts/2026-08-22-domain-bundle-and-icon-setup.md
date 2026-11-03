# 2026-08-22 DealDex.net Domain, net.dealdex Bundle ID, iOS 17.0, and Icon Setup

## Scope & Objective
Update the official domain to `DealDex.net`, configure GitHub repo metadata, switch iOS bundle ID to `net.dealdex`, set iOS minimum deployment target to 17.0 with Xcode 26.3 document format, sync official brand icon assets across iOS/Android/Web, build both native platform targets, and codify Apple Notes aesthetics and line-height protocols into fleet coordination standards.

---

## 1. Domain & GitHub Repository Metadata
- **Official Domain**: Set canonical host to `https://dealdex.net` across all docs, configs, and endpoints (`dealdex.online` maintains 301 redirects to `dealdex.net`).
- **GitHub Homepage**: Updated repo homepage URL via `gh repo edit jaywedgeworth22/DealDex --homepage "https://dealdex.net"`.

---

## 2. Icon & Brand Asset Pipeline
- **iOS AppIcon**: Sourced from the owner's subtle white/silver tiled grid interlocking DD (`native/brand/dealdex-dd-icon-1024.png`), generating all 15 iOS icon slots (`Icon-20` through `Icon-1024`).
- **Website Favicon & Android**: Sourced from the isolated transparent interlocking DD (`native/brand/dealdex-dd-isolated.png`), generating `favicon.png`, `favicon-32.png`, `favicon-16.png`, `favicon.ico`, `favicon.svg`, Android `mipmap-*/ic_launcher.png`, and `ic_launcher_foreground.png`.
- **Wordmark**: Updated glossy 3D `DealDex` title across web (`public/marks/`), iOS (`DealDexWordmark.imageset`), and Android (`drawable-nodpi/dealdex_wordmark.png`).

---

## 3. iOS Configuration & Build
- **Bundle Identifier**: Switched from `online.dealdex` to `net.dealdex` (`project.yml`, `Info.plist`, `AppUpdatePrompt.swift`).
- **Deployment Target**: Configured for **iOS 17.0** (`IPHONEOS_DEPLOYMENT_TARGET: "17.0"`).
- **Xcode Compatibility**: Xcode 26.3 document format (`objectVersion = 100`, `LastUpgradeCheck = 2630`).
- **Metadata**: Display Name `DealDex`, Category `public.app-category.shopping`, Team `CC8UTF7ATG`.
- **Authentication**: `NativeAuth.swift` updated with iOS 17.0-compatible `ASWebAuthenticationSession(url:callbackURLScheme:)`.
- **Verification**: `xcodebuild -project native/ios/DealDex.xcodeproj -scheme DealDex -destination 'generic/platform=iOS Simulator' build` -> **BUILD SUCCEEDED**.

---

## 4. Android Build
- Assembled debug APK using OpenJDK 17 and Android SDK 34 (`./gradlew :app:assembleDebug --no-daemon`).
- Copied updated APK to `public/DealDex.apk` for sideloading from `/install`.

---

## 5. Fleet Protocol Standards (`ag***-s**c.md`)
- Codified standard Apple Notes formatting rules:
  - 1.5x line spacing (`line-height: 1.5;`) within paragraphs and list items.
  - 2.0x section spacing breaks between major topics.
  - Formatted HTML tables and matrices for multi-column metrics and verification statuses.
  - Clear visual hierarchy with section emoji icons.
