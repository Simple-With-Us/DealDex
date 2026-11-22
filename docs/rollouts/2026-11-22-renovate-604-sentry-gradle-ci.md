# 2026-11-22 — Renovate PR #604 verify green (Sentry Gradle 6.27.0)

Renovate PR #604 ("Update non-major dependencies") bumps `io.sentry.android.gradle` from **6.26.0** to **6.27.0** in `apps/android/build.gradle.kts`.  The branch merges `main` twice, so its net diff against `main` is that one line; the npm dependency updates listed in the PR body are already on `main` and are not part of this branch's diff.

## Failure

`verify` (npm test) failed with one assertion out of 422 tests:

    test at src/lib/observability/sentry.test.ts:144:1
    ✖ Android Sentry SDK is present, DSN-gated, and privacy-safe
    AssertionError: The input did not match the regular expression
    /id\("io\.sentry\.android\.gradle"\) version "6\.26\.0"/

The observability contract test pins the exact Sentry Gradle plugin version, so the Renovate bump made the pin stale.  This is the same trap as DD-411 / PR #579 (`docs/rollouts/2026-11-12-dd-411-renovate-579-ci.md`), where the pin was aligned from 6.25.0 to 6.26.0.

The other checks on the head were green: `android`, `ios-changes`, `e2e`, `gitleaks`, `autofix` succeeded, `ios` skipped, and `Kody Code Review` skipped with `Code Review Skipped`.

## Fix

- Align the observability contract test pin with `6.27.0` in `src/lib/observability/sentry.test.ts`.

The Sentry Android Gradle plugin 6.27.0 is a feature release: it adds the experimental `sentry.snapshots.previews.testClassCount` option and bumps the bundled Android SDK from 8.63.0 to 8.64.0. It carries no breaking change for this repo's usage (`includeProguardMapping`, `includeSourceContext`, `autoInstallation` disabled, `buildConfigField` DSN).

## Note

Renovate posted an artifact-update warning on the PR: it could not resolve `package-lock.json` for `congress-trading-shared@v2.9.0`.  The branch carries no npm changes against `main`, and `npm ci` succeeds in `verify`, so the warning does not block this head.  The Gradle wrapper is pinned at 9.9.1 on both sides, so no wrapper refresh is needed.
