# Android build after Gradle 9 / Kotlin 2 / Compose BOM 2026 bumps

**Seat:** CURSOR (cloud).  **Branch:** `cursor/android-gradle9-build-fix-2f16`.

## Context

Renovate merged Gradle 9.8, Kotlin Android plugin 2.4.20, Compose BOM 2026.09.00, and OkHttp 5.5.0 without a CI job that runs `./gradlew :app:assembleDebug`.  AGP remained at 8.13.2 (open Renovate PR #436 for AGP 9).

## VM verification (2026-10-11)

- JDK: OpenJDK 21 (project targets Java 17 bytecode via `compileOptions`).
- Android SDK: API 35/37 platforms, Build-Tools 35/36, installed under `$HOME/Android/Sdk`.
- Command: `cd native/android && ANDROID_HOME=… ./gradlew :app:assembleDebug :app:testDebugUnitTest --no-daemon`.

### Main @ `fb9f523` (before fix)

**FAIL** — AGP 8.13.2 + Gradle 9.8.0: `com.android.internal.application` uses removed Gradle `InternalProblems` API (Gradle 9.6+).

### After fix (this branch)

**SUCCESS** — `DealDex-debug.apk` produced; `:app:testDebugUnitTest` NO-SOURCE (no unit tests in tree).

## Code changes

1. **AGP 9.4.1** — required for Gradle 9.8 (supersedes open #436 intent).
2. **Kotlin Compose compiler plugin** (`org.jetbrains.kotlin.plugin.compose` 2.4.20); removed legacy `composeOptions.kotlinCompilerExtensionVersion` and `org.jetbrains.kotlin.android` (AGP 9 built-in Kotlin).
3. **`compileSdk = 37`** — Compose BOM 2026 / OkHttp 5 / androidx deps require API 37 compile; **`targetSdk` stays 35** for Play policy called out in `app/build.gradle.kts`.
4. **Sentry Android coordinates** — `sentry-android-okhttp` / `sentry-android-compose` at non-existent versions blocked resolution; aligned on `sentry-okhttp` + `sentry-compose-android` 8.60.0 (npm `@sentry/*` v9 is unrelated).  Removed deprecated `SentryOkHttpIntegration` / `SentryComposeIntegration` registrations; fragment integration now `FragmentLifecycleIntegration(this)`.

## CI

`.github/workflows/ci.yml` gains an `android` job (JDK 21, `actions/setup-java` Gradle cache, runner SDK + `sdkmanager` platform 37 + build-tools 35/36, then `./gradlew :app:assembleDebug :app:testDebugUnitTest`).

## Acceptance criteria

1. `./gradlew :app:assembleDebug` produces `DealDex-debug.apk` on a clean cloud VM with JDK 21 + Android SDK 37 (Cloud agent run on this branch: **BUILD SUCCESSFUL**).
2. `./gradlew :app:testDebugUnitTest` is **NO-SOURCE** today (no unit tests in tree); the task is kept in CI so future tests fail loudly instead of being silently skipped.
3. `targetSdk` stays **35** (Play Store requirement since 31 Aug 2025) even though `compileSdk` jumps to 37 — Play Console policy, not dependency policy, decides target.
4. CI `android` job runs on every push to `main` so future Renovate bumps cannot silently break the Android build the way this one did.
5. No native app behavior change: keys stay on device, scan path unchanged, Sentry integrations still wire Fragment + OkHttp + Compose.

## Business rules

- **Stack pins are explicit and version-checked:** AGP 9.4.1, Kotlin Compose compiler plugin 2.4.20, Compose BOM 2026.09.00, OkHttp 5.5.0, Sentry Android 8.60.0.
- **`compileSdk` follows dependency requirements; `targetSdk` follows Play policy** — they are decoupled on purpose; do not "tidy" them to match.
- **Supersedes Renovate #436** (AGP 9 → 9.4.1).  Do not merge #436 separately; this branch already includes that bump.
- **Sentry Maven coordinates** are the Android 8.60.0 set: `sentry-android`, `sentry-okhttp`, `sentry-android-fragment`, `sentry-compose-android`.  The npm `@sentry/*` v9 packages are unrelated — do not mix.
- **AGP 9 owns Kotlin** — drop `org.jetbrains.kotlin.android`, `kotlinOptions { jvmTarget }`, and `composeOptions.kotlinCompilerExtensionVersion`; AGP 9 derives JVM target from `compileOptions` and Compose compiler from the dedicated plugin.
- **Native scan stays on device**: this fix is build-only; the iOS / Android "keys never reach a DealDex server" guarantee and `/api/native/scan` key-refusal stay intact.

## Edge cases & constraints

- **sdkmanager license prompt:** `yes | sdkmanager --licenses` closes stdin early → exit 141 under `pipefail`.  Tolerated with `|| true`; the subsequent real `sdkmanager` install still runs.
- **Sentry `-keep` Proguard rules** must track the new package roots (`io.sentry.okhttp.**`, `io.sentry.compose.**`) or R8 strips the OkHttp + Compose integrations reflectively wired by ServiceLoader and scan-span tracing silently degrades to crash-only.
- **`FragmentLifecycleIntegration(this)`** now takes the `Application` (the old no-arg signature was deprecated alongside `SentryOkHttpIntegration` / `SentryComposeIntegration`); calling without `this` is a silent no-op.
- **Gradle wrapper / cache:** repo pins Gradle 9.8; `actions/setup-java` Gradle cache keys on `**/*.gradle*` + `gradle-wrapper.properties` so wrapper upgrades invalidate the cache.
- **CI runs JDK 21** while project bytecode targets Java 17 via `sourceCompatibility` / `targetCompatibility` — JDK 21 only runs Gradle, not the bytecode target.
- **AGP 9 + Gradle 9.6+ removed `InternalProblems`** — staying on AGP 8.x on Gradle 9.x is not an option; AGP must move with Gradle.
