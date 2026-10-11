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

`.github/workflows/ci.yml` gains an `android` job (JDK 21, `android-actions/setup-android`, `gradle/actions/setup-gradle` cache, `sdkmanager` platform 37 + build-tools 35/36, then `./gradlew :app:assembleDebug :app:testDebugUnitTest`).
