# 2026-09-03 — NativeAuth Swift 6 main-actor hop (ios-ship archive)

Seat: GROK.  Branch `grok/ios-nativeauth-mainactor`.  Worktree `~/apps/dealdex-grok-nativeauth`.  Board `bce3ad82869f4f438851f60bdcf85145`.  Rebased onto #273 (`f26bcc7`).  PR https://github.com/jaywedgeworth22/DealDex/pull/276.

## Why

ios-ship run [33721859665](https://github.com/jaywedgeworth22/DealDex/actions/runs/33721859665) failed after #271 (`e9d3e347`) with archive rc=65:

```
NativeAuth.swift:75: call to main actor-isolated initializer 'init(continuation:)' in a synchronous nonisolated context
NativeAuth.swift:79: main actor-isolated static property 'held' can not be mutated from a nonisolated context
```

`withCheckedThrowingContinuation`'s body is `@Sendable` / nonisolated.  `AppleSignInDelegate` is `@MainActor`.  Required verify was SUCCESS.  Not pin-drift.  Not ASC bearer.

## Fix

Hop Apple Sign In controller + delegate setup onto `Task { @MainActor in }` before `init` / `held` / `performRequests()`.  Keep a strong `controller` on the delegate so it outlives the Task.  Resume the continuation once.

## Verification

Reproduced the two CI errors with `swiftc -typecheck -swift-version 5 -strict-concurrency=targeted` against `iphonesimulator26.5.sdk` (`arm64-apple-ios17.0-simulator`) on `HEAD` NativeAuth.swift (`old_rc=1`, lines 75 and 79).  Same command is clean after the hop (`new_rc=0`).  A leftover warning on `NativeAuthPresenter()` is Swift 6 language mode, not a targeted-concurrency error; archive rc=65 was the two errors.

This Mac has no iOS 26.5 CoreSimulator / device runtime (`xcodebuild` destinations ineligible), so the compiler gate is `swiftc` against that SDK, matching the archive compiler family (Xcode 26.6 / Swift 6.3).  Did not extra-ship.  Did not `--force-ship`.

```bash
npm run lint
npm run typecheck
npm test
npm run build
```

## Follow-ups

ios-ship on merge of `native/ios/**` is the normal path.  Do not dispatch extra-ship.
