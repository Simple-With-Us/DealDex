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

1. **`native/android/build.gradle.kts`** — AGP **9.4.1** (required for Gradle 9.8; supersedes open #436 intent) and `org.jetbrains.kotlin.plugin.compose` **2.4.20** apply-false entry; drop `org.jetbrains.kotlin.android`.
2. **`native/android/app/build.gradle.kts`** — apply Compose compiler plugin; remove `kotlin.android`, `kotlinOptions`, and `composeOptions.kotlinCompilerExtensionVersion`; **`compileSdk = 37`** with **`targetSdk` 35** (Play policy comment retained); Sentry deps on `sentry-okhttp` + `sentry-compose-android` **8.60.0**.
3. **`native/android/app/src/main/java/me/grok/dealdex/DealDexApp.kt`** — `FragmentLifecycleIntegration(this)`; removed deprecated `SentryOkHttpIntegration` / `SentryComposeIntegration` (artifacts no longer exist on Maven).
4. **`native/android/app/src/main/java/me/grok/dealdex/data/SentryHttp.kt`** plus **`Market.kt`**, **`AccountApi.kt`**, **`PaidDesks.kt`**, **`NativeAuth.kt`** — explicit `SentryOkHttpInterceptor` / `SentryOkHttpEventListener` on every `OkHttpClient.Builder`.
5. **`native/android/app/src/main/java/me/grok/dealdex/MainActivity.kt`** — root `setContent` wrapped in `SentryTraced("MainActivity")` for Compose user-interaction tracing.
6. **`native/android/app/proguard-rules.pro`** — `-keep` roots for `io.sentry.okhttp.**` and `io.sentry.compose.**`.
7. **`.github/workflows/ci.yml`** — `android` job (JDK 21, Gradle cache, SDK 37, `./gradlew :app:assembleDebug`).

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

## Next steps / blockers

- **Merge:** land PR #442 when reviewed; CI must stay green (`android`, `verify`, `e2e`).
- **Renovate #436:** superseded by this branch (AGP 9.4.1 already here); **leave #436 open** per owner — close it manually after merge if desired, do not merge it separately.
- **Blockers:** none known at handoff.
- **Optional follow-ups (not merge-blocking):** document compileSdk 37 vs targetSdk 35 in a short ADR if we want that outside rollout notes; consider Sentry Android Gradle plugin later for bytecode OkHttp instrumentation (explicit interceptors are sufficient for now).
