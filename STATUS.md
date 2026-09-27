## 2026-09-27 — Public comparison wording (CODEX, #367)

The website subtitle, intro, metadata, README, and current copy guidance now describe listing-price comparisons instead of promising the best price.  Reference coverage is conditional on listing/source access and configured paid services.  Native binaries and scan/key behavior are unchanged; native wording updates belong to a later native release.  PR #365 contains this copy unit plus the corrected effort-log lifecycle placement.  Hosted verification and E2E passed.  PR #365 merged as `333a0d0788c5bc786221ae23f8695a4e5cbe97d8`; exact-source Vercel production `dpl_GrXCSNHt4E2AjtW6SYKkSNjKx9Mf` is READY.  The live homepage and metadata returned the revised text, and the full footer logo was visually checked and byte-matched to source.  The documented one-off `VERCEL_FORCE_DEPLOY=1` exception was used after the automatic cooldown canceled its build; project deployment settings were unchanged.

# Current Handoff

## 2026-09-27 CODEX — ASC signing file handoff

PR #366 merged as `f9d0dcb7`; issue #364 and board `332fe8d6` are complete for source repair.  Source changes stage the multiline signing key in a private file and pass only its path between Actions steps.  Synthetic workflow-block and shell syntax checks pass.  The `ios-ship` workflow remains manually disabled pending credential recovery; no release or signing validation is claimed.  Next: complete credential replacement separately, and validate the repaired release path before re-enabling the workflow.  See `docs/rollouts/2026-09-27-ios-signing-file-handoff.md`.

## 2026-09-27 CODEX — Public footer attribution and reference-value wording

PR #361 merged the Simple With Us footer attribution and qualified reference-value availability on the public site; PR #363 added the required handoff docs.  The live `dealdex.net` footer was visually checked, the full SWU WebP returned HTTP 200, and board `f1f1f303e51a44d9bfd76e1738f49e99` is Deployed with issue #360 closed.  No manual Vercel override was needed.  See `docs/rollouts/2026-09-27-swu-public-attribution.md`.

## 2026-09-19 BF-FIXER — iOS listings lost their photos (on-device parser dropped the image)

Branch `fixer/ios-listing-images`, worktree `~/apps/dealdex-fixer`.  Owner-reported: iOS rows used to show a thumbnail and now only show one after tapping into the listing.

Root cause: `121ea10` flipped iOS to scan on-device first, but `native/ios/DealDex/Market.swift` `parseEbay`/`parseMercari` built rows with a hard-coded `image: nil`.  The site parser (`src/lib/marketplaces/jina.ts`) and the Android parser (`native/android/.../data/Market.kt`) read the thumbnail from the same Jina markdown, so iOS silently regressed when the on-device path became primary.

Fix: mirror both — eBay `i.ebayimg.com`, Mercari `u-mercari-images.mercdn.net` with a deterministic `photos/<id>_1.jpg` fallback — via one shared `firstMatch` helper.  Same PR also removes the native iOS `"LIVE MARKET SCAN"` header (`ScanView.swift`), the last surviving copy of a line the owner asked to drop; the web scanner already lost it in PR #213.  No layout redesign, no ship change.  Rollout: `docs/rollouts/2026-09-19-ios-listing-images.md`.

Also answered the owner's open questions on the scan desk (Hide Proxies is a **card** filter, not a network proxy; eBay is empty because Jina's eBay fetch gets a 403 and the Vercel egress IP looks datacenter; the scan caps at 16 listings/market with top-5 cross-desk verification; there is no residential-proxy support in the stack).  Follow-up work routed in-room: UI/copy to @Designer, user-defined count + per-user proxy + auto-scan to @Builder, Vercel Hobby daily-deploy cap decision to @Director/@Deployer.

## 2026-09-18 CURSOR — Effort Issues Sync Crons margin (FLEET-INFRA-CG)

Daily `18 6 * * *` board mirror always succeeds; GitHub starts it 4.3-6.5h late so the 15-minute Sentry margin pages at 06:33Z.  Same override as ST #3194 / #3387 / #3389 / #3390, Autorotate #219, and UM #1491: `CRON_CHECKIN_MARGIN_MINUTES["Effort Issues Sync"] = 600`.  Existing iOS-ship 100 stays.  Cron unchanged.  Extra-ship no.  No Coolify.  Do not resolve CG on merge — wait for the next scheduled upsert of `ci-dealdex-effort-issues-sync`.  Rollout: `docs/rollouts/2026-09-18-effort-issues-sync-monitor-margin.md`.

## 2026-09-18 CLAUDE — Seer Code Review fixup for ios-ship cache (PR #291 follow-up)

Full handoff: **`docs/rollouts/2026-09-12-ios-ship-state-cache.md`** (rewritten; branch `claude/seer-fixup-20260918`).

Seer Code Review on the original ios-ship-state-cache fix (#291, merged 2026-09-12) flagged two findings that were not addressed before merge.  This follow-up:

- **P2 — fix:** added `github.run_attempt` to both `actions/cache/restore` and `actions/cache/save` keys.  Cache keys are immutable and GH reuses `run_id` on rerun, so without `run_attempt` a successful retry of a partially-failed run could never overwrite the stale save from the prior attempt, leaving the next scheduled tick to restore bad state.  Two-level `restore-keys` for the latest attempt of the current run, then any previous run.
- **P1 — fix:** rewrote `docs/rollouts/2026-09-12-ios-ship-state-cache.md` with two-space sentence separators and updated it to reflect current main (v6.1.0 from Dependabot PRs #317/#320) and the new `run_attempt` key.

Also wrote a fleet RAG lesson that Seer findings must be read, evaluated, and either acted on or formally dismissed with reason — see fleet-recall contribution `contrib/CLAUDE/2026-09-18/...`.  Board `30abb003`.

Branch `claude/seer-fixup-20260918`.  Worktree `~/apps/dealdex-claude-seerfix`.  PR TBD; will arm auto-merge after verify + Seer clean.

## 2026-09-15 ANTIGRAVITY — Native auth tests, Desk Keys deduplication & Dependabot

Full handoff: **`docs/rollouts/2026-09-15-auth-tests-and-desk-keys-dedup.md`**

- **Native Auth Tests**: Added comprehensive functional test suite in `src/lib/server/native-auth-codes.test.ts` verifying single-use consumption, PKCE challenge verifier burns, and timeout expiration.
- **Desk Keys Deduplication**: Extracted shared `fetchUserDeskKeys`, `upsertUserDeskKeys`, and `cleanDeskKeys` helpers into `src/lib/server/desk-keys.ts`, removing duplicate encryption and SQL statements from `/api/native/keys`. Added `src/lib/server/desk-keys.test.ts`.
- **Database Test Fallback**: Added Node.js `fs` fallback in `src/lib/db.ts` for PGLite migrations during direct test execution outside Vite.
- **Automated CVE Scanning**: Added `.github/dependabot.yml` for npm and GitHub Actions ecosystem scanning with pinned groups.
- **Verification**: `npm run typecheck` clean, `npm run lint` clean (0 errors), `npm test` (227/227 pass), `npm run build` clean.

## 2026-09-13 FX — skip pointless Vercel production deploys

Skip when site files did not change.  Cap one READY production deploy per hour.  Previews skipped.  Board `0934111e`.  Branch `fx/vercel-skip-pointless`.

## 2026-09-13 FX — merge to main is Vercel production

`vercel-ignore-hourly.sh` only skips preview auto-deploys.  Production git deploys always build (owner: sites go live on merge).  Board `ef71d6c1`.  Branch `fx/merge-equals-live`.

## 2026-09-12 CLAUDE — Fix TestFlight ship spam: persist ship-state across ephemeral runners

Full handoff: **`docs/rollouts/2026-09-12-ios-ship-state-cache.md`**

Owner asked why TestFlight kept updating with no one shipping.  Root cause:
`ios-ship.yml` runs on ephemeral `macos-latest`, so `~/.cache/ios-fleet/last-ship-dealdex.txt`
never survived between runs — both the scheduled-ship gate and
`ship-testflight.sh`'s own 1-hour min-interval/same-HEAD gate always saw "no
prior ship" and shipped, every tick, verified across 5 separate run logs.
Fixed with `actions/cache/restore` + `actions/cache/save` (unique
`github.run_id` key + prefix `restore-keys`, since cache keys are immutable
and this state must change every run).

Branch `claude/investigate-testflight-cadence`.  Board `30abb003`.  `actionlint` clean.  Not yet merged — next scheduled tick after merge is the real-world check.

## 2026-09-04 GROK — Sentry Performance child spans on scan hops

Full handoff: **`docs/rollouts/2026-09-04-sentry-scan-hop-spans.md`**

Server scan hops now emit Sentry Performance spans: `scan.ebay`, `scan.mercari`, `scan.match`, `scan.enrich`, `scan.cache.hit`, `scan.cache.miss`, under parent `scan`.  Datadog stays one `web.request` parent.  HTTP/Fetch/Postgres auto-integrations are dropped so marketplace URLs cannot leak the search term.  Gated on `SENTRY_DSN` / `VITE_SENTRY_DSN`.  Extra-ship no.

Branch `grok/sentry-scan-hop-spans`.  PR https://github.com/jaywedgeworth22/DealDex/pull/282 (`6665302`).  Board `9fb9cccafb9c40b889466516a18e8dd5`.  Local gates: lint 0 errors, typecheck clean, 217 tests, build green.  Did not merge.

## 2026-09-03 GROK — NativeAuth Swift 6 main-actor hop (ios-ship archive)

Full handoff: **`docs/rollouts/2026-09-03-ios-nativeauth-mainactor.md`**

ios-ship run 33721859665 failed after #271 (`e9d3e347`) with archive rc=65: `AppleSignInDelegate.init(continuation:)` and `held` were MainActor-isolated and mutated from the nonisolated continuation body.  Hop setup onto `Task { @MainActor in }`.  Rebased onto #273 (`f26bcc7`).  PR https://github.com/jaywedgeworth22/DealDex/pull/276.  Board `bce3ad82869f4f438851f60bdcf85145`.  No extra-ship.  No `--force-ship`.

## 2026-09-03 GROK — Pickup AG cap: native Apple Sign In (PR #271)

Full handoff: **`docs/rollouts/2026-09-03-native-apple-signin.md`**

AG left `ag/fix-apple-native-form-post` open with verify red (route tree missing `/api/native/apple-signin`, Better Auth `idToken.user.name` shape).  Uncommitted Swift/TS payload fix adopted with credit.  Session token stays on HTTPS JSON, not `dealdex://`.

## Identity (living)

Public name is **DealDex.net**.  Public host is **https://dealdex.net** on Vercel.  iOS bundle is **`net.dealdex`** (team `CC8UTF7ATG`, ASC appleId `6802474288`).  Android package stays **`me.grok.dealdex`**.  Dated stanzas below that name another host or iOS bundle are archaeology.

## 2026-09-02 ANTIGRAVITY — Social auth UX: login auto-dismiss + Apple JWT generation (PR #254)

Full handoff: **`docs/rollouts/2026-09-02-social-auth-fix.md`**

- Login page auto-navigates to `callbackURL` when session becomes active (OAuth pop-up/redirect feel fixed).
- Apple Sign In: JWT generated from `APPLE_TEAM_ID` + `APPLE_KEY_ID` + `APPLE_PRIVATE_KEY` so it never expires silently.
- Old `APPLE_CLIENT_SECRET` (pre-generated JWT) path still works.

## 2026-09-01 GROK — Sentry fleet adoption (Feedback + Vercel DSN)

Full handoff: **`docs/rollouts/2026-09-01-sentry-fleet-adoption.md`**

- User Feedback widget on the web client.  Replay stays 100% error / 10% session, masked.
- `VITE_SENTRY_DSN` baked into the existing Vercel `dealdex` project (production + preview).
- iOS `SENTRY_DSN` is Info.plist only (hardcoded fallback already removed on main).
- Android Sentry: iOS only until Android tracks ship.

Branch `grok/sentry-fleet-adoption`.  Board `d3f01c60eb4f457c855af60b4c196706`.

## 2026-09-01 GROK — Living identity is DealDex.net / net.dealdex

Owner: living copy must say DealDex.net and `net.dealdex`.  Other hosts and iOS bundles are abandoned.  Android Play package is still `me.grok.dealdex`.  Branch `grok/identity-net-dealdex`.  Board `053cdba5`.  Rollout: `docs/rollouts/2026-09-01-identity-net-dealdex.md`.

## 2026-09-01 GROK — iOS pbxproj Sources membership for SentryTelemetry.swift

Full handoff: **`docs/rollouts/2026-09-01-sentry-telemetry-pbxproj.md`**

Scheduled ios-ship run 33524415676 failed on `main` `ab1390e`:
`DealDexApp.swift` cannot find `SentryTelemetry` in scope.  The Swift file was
on disk; the committed `project.pbxproj` did not compile it.

- PBXBuildFile `6E68536A0591E1EAA8F9DF30`
- PBXFileReference `BF5CF2870999472BC27D2F40`
- sentry-cocoa SPM also added (pbxproj on `main` had the yml package but no
  packageReferences)
- No extra-ship.  No `--force-ship`.

Branch `grok/sentry-telemetry-pbxproj`.  Board `9dd5fa7786a6428b9162000bc11c55a7`.

## 2026-08-31 ANTIGRAVITY — Sentry client observability integration (PR #214)

Full handoff: **`docs/rollouts/2026-08-31-sentry-client-observability.md`**

- **@sentry/react**: Integrated client error tracking, Session Replay (100% on error, 10% baseline session, text/media masked), and distributed browser tracing in `src/lib/observability/sentry.ts` and `src/routes/__root.tsx`.
- **Gated & Inert**: Gated on `VITE_SENTRY_DSN` with zero overhead or network traffic in local development/CI when unset.
- **Verification**: `npm run typecheck` (0 errors) and `npm test` (197/197 tests passed).

## 2026-08-31 BF-FIXER — Mobile scanner source row deployed (PR #213)

Full handoff: **`docs/rollouts/2026-08-31-mobile-scanner-source-row.md`**

- Removed the redundant Live Market Scanner heading, explanatory sentence, and Scan Sources label.
- Kept eBay and Mercari source toggles in one equal-width row down to a 320px viewport.  Large desktop wordmarks remain unchanged; compact wordmarks render only below the `sm` breakpoint.
- Verified at 320×800 in headless Chrome: both toggles are 124px wide, requested copy has zero matches, and the document has no horizontal overflow.
- Merged as `25ace11`.  Live-verified the same bounds and copy state on `https://dealdex.net` after production updated.

## 2026-08-28 ANTIGRAVITY — Auth Fix, Fixed Origin & Polished Sign-In Buttons (PR #211)

Full handoff: **`docs/rollouts/2026-08-28-auth-buttons-and-fixed-url.md`**

- **Web OAuth & Datadog 503**: Resolved 503 fail-closed error on Vercel by injecting missing Datadog and OAuth API keys, and added `scripts/copy-pglite.mjs` to copy PGlite WASM binaries into Vercel serverless function libraries.  Live-verified on `https://dealdex.net`.
- **iOS Origin Locked**: Removed the editable URL input field; locked origin to `https://dealdex.net` unmodifiable.  Migrated and cleared stale foreign preview session tokens.
- **Polished Provider Sign-In Buttons**: Added custom vector Google (4-color Canvas), Apple, and X sign-in buttons matching Congress.Trade / Socratic.Trade aesthetic standards.  Verified in iOS Simulator with screenshot.
- **Verification**: `npm test` (196/196 pass), `npm run typecheck`, `npm run build`, and `xcodebuild` all pass cleanly.

## 2026-08-28 CLAUDE — READ THIS FIRST: Android has never been compiled

Full handoff: **`docs/rollouts/2026-08-28-handoff-android-build-and-open-items.md`**

iOS is compiled and shipped (`1.0.59 (202608272038)`, TestFlight internal).
Android is not.  There is no Android equivalent of `ios-ship.yml`, so 581 changed
lines of Kotlin across 13 files have had no compiler look at them at all.

On a machine with Android Studio, in order:

1. `cd native/android && ANDROID_HOME=~/Library/Android/sdk ./gradlew :app:assembleDebug --no-daemon`
2. `./gradlew :app:assembleRelease --no-daemon` — **R8 is newly enabled alongside
   `androidx.security:security-crypto`**, and Tink registers its key managers
   reflectively.  `app/proguard-rules.pro` guards this; the rules are unverified.
3. Install the **release** APK, sign in, add a desk key, force-stop, reopen.  If
   the session is gone, the keep rules failed — a green build does not prove
   them, because R8 strips at runtime.

Also open: the iOS scanner has never been pointed at a real card
(`DataScannerViewController` does not run in the Simulator).  The public
APK was pulled in Wave 0 (PR #226).  dealdex.net does not host an APK.


## 2026-08-27 DEPLOYER — rebase DealDex #183 Datadog onto main

Rebased `cursor/datadog-web-observability-4edf` onto current main.  Production fail-closes only without `DD_API_KEY`.  Missing RUM tokens leave RUM dark (#184).  Infisical is source of truth.  Vercel gets machine identity only.  No pasted `DD_*` on Vercel.  Extra-ship no.

## 2026-08-27 CLAUDE — Landed and shipped: PR #203

Merged as `121ea10` (squash).  The push fired `ios-ship.yml` run #212 on
GitHub-hosted macOS, which compiled the Swift for the first time:
**`** ARCHIVE SUCCEEDED **`**.  `1.0.59 (202608272038)` is on TestFlight for
`net.dealdex`, build `f00d54b5-9552-41c5-b9d4-f414d2e8c30b`,
`internal=IN_BETA_TESTING`.

So the branch-long "Swift is compile-unverified" blocker is **closed for iOS**.
Swift autolinking pulled in VisionKit and AVFoundation with no `project.yml`
`dependencies:` entry — leave that file alone.

**Kotlin is still compile-unverified.**  There is no Android ship workflow, so
nothing has ever built `native/android` from this work.  Run
`./gradlew :app:assembleDebug :app:assembleRelease` on a machine with the SDK:
R8 is newly enabled, AGP was bumped, and `androidx.security:security-crypto` is
a new dependency.

**The scanner itself is still unproven.**  A green archive says it compiles, not
that it reads a card, and `DataScannerViewController` does not run in the
Simulator.  Nobody has yet pointed a real iPhone at a card.  Four-step device
check in `docs/rollouts/2026-08-27-ios-card-scanner.md`.

Two non-blocking loose ends from the ship: `project.yml` / `project.pbxproj`
still record `1.0.2 (202608230250)` while `1.0.59` shipped (they agree with each
other, so syncing needs `xcodegen generate` on a Mac), and release notes were a
DRY RENDER only — `IOS_TF_RELEASE_NOTES=1` is unset, so testers see the build
with no notes.

## 2026-08-27 CLAUDE — A real iOS card scanner

Owner asked whether the iOS app was updated and whether it has a real card
scanner.  Both answers were no: PR #203 is still a draft, so `main` and
TestFlight `1.0.2 (202608230250)` still carry the fake, and the 08-26 branch had
only **deleted** it.  This adds the replacement.

`CardScannerView` in `native/ios/DealDex/ScanView.swift` runs VisionKit
`DataScannerViewController` live text recognition on the camera feed, on the
device.  It cannot fake a result: `CardTextReader.query(from:)` returns `nil`
unless a name was actually read, the button then reads "No card name read yet"
and is disabled, and every recognised line is printed verbatim under the
viewfinder so a misread is visible before the user taps.  Unsupported hardware,
the Simulator, denied permission and `becameUnavailableWithError` each get their
own plain-language screen.  `NSCameraUsageDescription` added to **both**
`Info.plist` and `project.yml` — the plist alone would vanish on the next
`xcodegen generate`, and its absence is a hard crash on first camera use.

The scanner lives inside `ScanView.swift` deliberately: a new `.swift` file only
joins the target after `xcodegen generate` runs on a Mac, and hand-editing
`project.pbxproj` is forbidden.  Split it out when someone regenerates.

`npm test` 187/187 · typecheck clean · lint 0 errors · build green.

**STILL BLOCKED ON A MAC AND A PHONE:** the Swift is compile-unverified, and
`DataScannerViewController` does not run in the Simulator at all — the scanner
needs a physical iPhone before it can be called working.  Checklist in
`docs/rollouts/2026-08-27-ios-card-scanner.md`.

## 2026-08-26 CLAUDE — Full-app review remediation

Owner asked for a full evaluation of the website, backend, iOS app and Android
app, then for every finding to be fixed.  Branch
`claude/full-app-evaluation-893vtd`, based on `2440dc9`.

**The pattern behind almost every P0:** something was written down before it was
built and the writing was never revisited.  `/privacy` said the phone apps never
send desk keys to a DealDex server; both clients POSTed all three on every scan,
as the primary path.  iOS shipped a "Card & Slab Scanner" that reported
"Charizard 4/102" 1.2s after opening, with no `AVCaptureSession` in the target.
The Alerts page offered Email and SMS; the server recorded both as delivered
without attempting a send.

Fixed: on-device scanning is now primary and `/api/native/scan` **refuses** a
`keys` payload so the promise cannot regress; the website's server-side scan is
disclosed separately.  Native sign-in is PKCE — the `dealdex://` redirect
carries a single-use code, not a live session token any installed app could
claim.  Credentials moved to EncryptedSharedPreferences / Keychain,
`allowBackup=false`.  `desk_keys` encrypted at rest.  The valuation engine's
circular matcher, unreachable grade basis, within-desk "Desks Differ", and the
HP-stat-as-condition bug are all fixed on all three clients.  Android is on
targetSdk 35 with R8 and a signing config.  `npm ci` works again, so CI runs the
same install command `vercel.json` does.

`npm test` went from 97 source-grep guards to 155 including 51 that exercise
real prices — two of which caught bugs while being written.

An adversarial review of this branch caught that the FIRST version of the PKCE
fix did not work: binding the code to a challenge is useless when the challenge
is caller-supplied, and a `SameSite=Lax` cookie rides a top-level GET, so a
malicious app could mint itself a code in one request.  Leg 1 now issues a
single-use server-side `state` (`migrations/0007`) and the hand-off requires a
tap.  Residual risk is the private-use URI scheme itself — **App Links /
Universal Links is the next piece of native auth work**, blocked on a release
signing fingerprint and an entitlement change.

**BLOCKER FOR NATIVE SHIPS:** Swift and Kotlin are compile-unverified — that
session had no Xcode and no Android SDK.  Run `xcodegen generate`, both
`xcodebuild` and `./gradlew` builds, and a real-device sign-in before shipping
either app.  `CameraScannerView.swift`'s four `project.pbxproj` entries were
removed by hand; confirm a regenerate matches.  Full list in
`docs/rollouts/2026-08-26-full-app-review-remediation.md`, plus the scanner
checklist in `docs/rollouts/2026-08-27-ios-card-scanner.md`.

## 2026-08-25 ANTIGRAVITY — Configure Google/Apple/X OAuth & Polish Web Scan UI

- **OAuth Authentication Configuration**:
  - Wired provider resolution in `src/lib/auth/social.ts` to support all DealDex key aliases (`DD_WEB_GOOGLE_ID`, `DD_WEB_GOOGLE_SECRET`, `DEALDEX_X_CLIENT_ID`, `DEALDEX_X_CLIENT_SECRET`, `APPLE_CLIENT_ID`, etc.).
  - Placed Google client configs in native projects (`native/ios/DealDex/GoogleService-Info.plist` and `native/android/app/google-services.json`).
  - Added brand SVG icons and polished styling to the OAuth buttons on `/login`.
- **Web Scan UI Redesign**:
  - Replaced cramped scan bar with an integrated, high-contrast, prominent **⚡ SCAN MARKET** button featuring animated spinning state and a live scanning status banner.
  - Sized and padded eBay and Mercari source toggle buttons to render official logos with full proportions, active dot indicators, and live hit count badges.
  - Balanced 6-column filter controls (Verdict, Max Ask, Condition, Min Discount, Finish, and Hide Proxies switch) with clean Quick View tabs.
- **Verification & Native Builds**:
  - `npm test` (78/78 passing), `npm run lint` (0 errors), `npm run typecheck` (0 errors), and `npm run build` (clean production build).
  - iOS Simulator build verified with `xcodebuild` (**BUILD SUCCEEDED**).
  - Android debug APK verified with Gradle 8.7 (**BUILD SUCCESSFUL**) and copied to `public/DealDex.apk`.

## 2026-08-25 CURSOR — Pin AppUpdatePrompt.swift; move Apple IDs off Swift

One in-repo pin at `scripts/ios-fleet/AppUpdatePrompt.swift`, copied
byte-identical into `native/ios/DealDex/AppUpdatePrompt.swift`.  No
Swift package.  `knownAppleIds` is gone from Swift.  Live bundle is
`net.dealdex` appleId `6802474288` in `scripts/ios-fleet/apps.json` and
Info.plist `AppUpdateAppleId`.  Public manifest already has the same id
on `net.dealdex` in `jaywedgeworth22/ios-app-versions` `versions.json`
(not rewritten here; a one-app PUT would wipe siblings).  Did not upload
any other iOS bundle.  testers.json untouched.  No
`--force-ship`.  No spend.  KEEPOUT DealDex #183 Datadog / Vercel keys.
Branch `cursor/ios-app-update-prompt-pin-525d`.

## 2026-08-25 CURSOR — testers.json Comcast typo

`scripts/ios-fleet/testers.json` had `johnwedeworth@comcast.net`.  Spelling
is `johnwedgeworth@comcast.net`.  Left `mail@jays.services`.  Did not add
testers, expand invite-on-ship, change ios-ship, or use `--force-ship`.
Invite-on-ship comments/tests are not on `main` (only an unmerged leftover
on `cursor/android-pwa-update-alerts-c953`).  Remaining emails:
`johnwedgeworth@comcast.net`, `mail@jays.services`.  Branch
`cursor/testers-comcast-typo-160f`.

## 2026-08-25 CURSOR — Center iOS Scan empty-loading spinner

TestFlight Scan (2026-08-24) showed the gray spinner and
"Reading eBay and Mercari…" left of center in the empty results area.
`ScanView` parent `VStack` is `alignment: .leading`; the labeled
`ProgressView` had no `maxWidth` / center frame, so it hugged leading.
Now it uses `.frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .center)`.
Caption unchanged.  No ship-path / runner / `--force-ship` change.
Branch `cursor/ios-scan-loading-center-1b16`.

## 2026-08-25 CURSOR — Android Play + PWA skippable update alerts

On-open update alert on Android (Play In-App Updates, flexible) and a
PWA “update available / reload” banner when a waiting service worker
exists.  Both are skippable (Update or Reload / Not Now).  Silent when
already current or the check fails.  iOS AppUpdatePrompt left as-is:
`knownAppleIds` already maps `net.dealdex`.  `versions.json` lives only
in `jaywedgeworth22/ios-app-versions` (DealDex `net.dealdex` still
`1.0.2` / `202608230250`).  Did not clone that repo or bump it.  Did
not touch `scripts/ios-fleet`, testers, invite-on-ship, or ios-ship YAML.
Branch `cursor/android-pwa-update-alerts-c953`.

## 2026-08-25 CURSOR — Accept dealdex in vendored ship-testflight.sh

ios-ship run 32791798491 imported signing on `macos-latest`, then Ship
failed with `unknown arg: dealdex`.  The wrapper always passes `dealdex`.
Vendored `scripts/ios-fleet/ship-testflight.sh` still only accepted
`socratic|congress|usage|usage-local` (copied from Congress.Trade).
`apps.json` already had the DealDex row (bundle `net.dealdex`, team
`CC8UTF7ATG`, SKU `dealdex`).  Added `dealdex` to the usage header and
positional case.  No `--force-ship`.  No secrets YAML.  Runner stays
GitHub-hosted `macos-latest`.  Branch `cursor/ios-ship-dealdex-case-5bfb`.

## 2026-08-24 CURSOR — GH-hosted macos-latest for iOS ship (protocol)

#170 wrongly restored a local Mac self-hosted runner.  Updated fleet protocol
bans that: iOS ships and all other Actions use GitHub-hosted runners
(`macos-latest` here).  Keep vendored `scripts/ios-fleet` (bundle
`net.dealdex`, train `1.0.N`).  Import ASC + Distribution secrets the same
way Congress.Trade does (`scripts/ios-appstore-gm-prepare.sh`).  Branch
`cursor/ios-gh-hosted-runners-709e`.

## 2026-08-24 CURSOR — Vendor ios-fleet so hosted ships can find 1.0.N

#165 landed the project regimen (`1.0.2` / `202608230250`).  #167 hosted
ships died because `/Users/jay/apps/ios-fleet` is not on `macos-latest`.
#170 vendored `scripts/ios-fleet`.  Do not send this job back to a local
Mac runner.

## 2026-08-23 CURSOR — iOS version regimen (1.0.N + UTC build)

DealDex ASC showed `1.0 (1)` because `CURRENT_PROJECT_VERSION` was stuck at `1`
while marketing was `1.0.2`.  Fleet regimen: marketing `1.0.<seq>`, build UTC
`YYYYMMDDHHMM` so ASC reads `1.0.2 (202608230250)`.  `project.yml`, `pbxproj`,
`CLAUDE.md`, and `ios-identity.test.mjs` updated.  Next Mac `ios-ship` run
ships the next patch via `ios-fleet/ship-testflight.sh`.  Branch
`cursor/ios-version-regimen-709e`.

## 2026-08-22 CURSOR — Publish native apps against dealdex.net

Android Scan now POSTs to `https://dealdex.net/api/native/scan` first (same unsigned website scoring as iOS), then falls back to on-device scrape.  Scan chrome matches the site: SCAN, filters, Hide proxies, All/Deals/Verified.  Sideload APK is `public/DealDex.apk` (versionName 1.0.2).  iOS already used the website; TestFlight ship uses bundle `net.dealdex`.  Branch `cursor/native-publish`.

## 2026-08-22 CURSOR — OG logo-only card

Social sharing image (`public/og.jpg`) is logo-only: centered DealDex wordmark
fills ~88% width on white, no subtitle or footer.  Re-render:
`node scripts/render-og.mjs`.  Cache-bust `og.jpg?v=logo-only-20260822`.
Branch `cursor/og-logo-only-4780`.

## 2026-08-22 CURSOR — Vercel Speed Insights

Mount `@vercel/speed-insights` on the TanStack Start root
(`@vercel/speed-insights/react` + `computeRoute`, not the Next.js import).
Service worker already skips `/_vercel/` so vitals beacons are not intercepted.
Privacy page discloses cookie-less Core Web Vitals.  After merge, Vercel
Production on `dealdex.net` collects FCP/LCP/INP/CLS.  Branch
`cursor/vercel-speed-insights-4a42`.

## 2026-08-22 ANTIGRAVITY — DealDex.net domain, net.dealdex bundle ID, iOS 17.0, and icon sync

- **Domain & GitHub**: DealDex.net is the official canonical domain name.  Updated GitHub repo details (`homepageUrl: https://dealdex.net`) and all docs.
- **Icons & Brand**: Updated master brand assets from owner uploads.  iOS AppIcon uses the subtle tiled silver grid DD; website favicon, Android launcher mipmaps/adaptive icons, and PWA icon use the isolated transparent DD; 3D DealDex title wordmark updated across web, iOS, and Android.
- **iOS Xcode & Bundle**: Switched bundle identifier to `net.dealdex` (`PRODUCT_BUNDLE_IDENTIFIER`, `bundleId`, `CFBundleIdentifier`).  Deployment target set to **iOS 17.0** (Xcode document format 26.3 / objectVersion 100).  Display name `DealDex`, team `CC8UTF7ATG`, category `public.app-category.shopping`.
- **Native Builds**: iOS Simulator build (**BUILD SUCCEEDED**), Android debug APK built (**BUILD SUCCESSFUL**) and copied to `public/DealDex.apk`.
- **Fleet Protocols**: Updated `AGENT-SYNC.md` with typography, line spacing (1.5x body, 2.0x section breaks), and table/diagram aesthetics standards for Apple Notes.

## 2026-08-22 GROK — Public host dealdex.net

Owner registered `dealdex.net` (Namecheap).  Canonical website host is
`https://dealdex.net`.  iOS bundle is `net.dealdex`.  Android stays
`me.grok.dealdex`.  Branch `grok/dealdex-net`.  Board `b16e5c74`.

Need owner: Vercel project Domains → add `dealdex.net` (and www).  Then
Namecheap Advanced DNS for `dealdex.net` using the records Vercel prints.

## 2026-08-22 GROK — Scan box contrast + SCAN label

Portrait web layout kept.  Filter headings and select values are centered.
LIVE MARKET SCAN is nudged 1ch right.  The brown button is SCAN at 2.5x
with no radar icon.  Hide Proxies has no REPACKS label and no bubble
border.  Muted/subtle/border tokens are darker for AA.  Phone Account
Website already defaults to https://dealdex.net.  Native iOS ScanView
matches the web filters and SCAN button.  Branch `grok/scan-row-contrast`.
Board `952f57b3`.

## 2026-08-22 GROK — Scan desk + Android/PWA isolated DD

Scan is dark brown, full width of the eBay/Mercari column, with those
toggles under it.  Six filters sit 3-per-row to the left.  Android and
PWA 180 use the isolated transparent DD.  iOS AppIcon stays the tiled
1024 PNG.  Branch `grok/dd-android-pwa-transparent`.

## 2026-08-22 GROK — Tighter DD AppIcon

AppIcon is the owner 1024 DD PNG, resized to iOS/Android/PWA slots.
Favicon is the isolated transparent DD.  Branch `grok/dd-appicon-tight`.

## 2026-08-22 GROK — Vercel Web Analytics

Mount `@vercel/analytics` on the TanStack Start root (`@vercel/analytics/react`, not the Next.js import).  Service worker skips `/_vercel/` so insight beacons are not intercepted.  Privacy page discloses cookie-less page-view counting.  After merge, Vercel Production on `dealdex.net` collects visits.  Branch `grok/vercel-analytics`.

## 2026-08-21 ANTIGRAVITY — Cross-Platform Power Enhancements (#119)

Cross-platform power valuation engine, Mobile Card Dossier, Evaluator desk, Saved Appraisals ledger, and camera OCR integration across Web, iOS, and Android.

- **Web Appraisal Engine**: Added PSA 10 and PSA 9 grading arbitrage calculator, net margin % factoring seller fees, proxy/repack heuristic banner & filter toggle, and 1-tap "Share Deal" clipboard badge.
- **Native iOS Parity**:
  - `CardDossierView.swift`: High-res artwork, multi-finish pricing, Cardmarket EUR comps, direct deep links to TCGPlayer, eBay Solds, and Mercari.
  - `EvaluatorView.swift`: Interactive ad-hoc listing calculator with condition/grade selectors, net flip margin, and PSA grading arbitrage matrix.
  - `SavedStore.swift` + `SavedView.swift`: Saved Appraisals ledger persisting portfolio deals with status (`Watching`, `Bought`, `Passed`) to `UserDefaults`.
  - `CameraScannerView.swift`: Vision-based OCR camera scanner extracting card names/numbers and opening directly in Evaluator.
  - Updated `DealDexApp.swift` TabView with Scan, Evaluator, Saved, Alerts, and Settings tabs.
- **Native Android Parity**:
  - `CardDossierScreen.kt`, `EvaluatorScreen.kt`, and `SavedScreen.kt` Jetpack Compose screens.
  - Bottom navigation bar updated with Scan, Evaluator, Saved, Alerts, and Settings.
  - Direct Card Dossier navigation and save-to-ledger actions added to `ListingCard`.
- **Build & Test Verification**:
  - Web: `npm run lint` (0 errors), `npm run typecheck` (0 errors), `npm test` (72/72 passing), `npm run build` (clean Vercel build).
  - iOS: `xcodebuild -project native/ios/DealDex.xcodeproj -scheme DealDex -destination 'generic/platform=iOS Simulator' build` (**BUILD SUCCEEDED**).
  - Android: `gradlew :app:assembleDebug` with OpenJDK 17 & Android SDK 34 (**BUILD SUCCESSFUL**).

## 2026-08-21 CURSOR — scan layout, OG wordmark, subtitle (#118 / #117)

Merged squash `5474ef1`.  User-facing subtitle is **Identify Best-Priced Pokémon Card Listings** on the
site, login, OG card, iOS, Android, store listing (in-app; App Store 30-char
field is `Best-priced card listings`), and README.

Scan box: no suggested Pokémon chips.  One large eBay/Mercari pair with listing
counts on the toggles (those are the scan sources; no second filter pair).
All / Deals / Verified plus compact filter selects stay in the same card.
Desktop and iPad show two listing cards per row (`md:grid-cols-2`, iOS
`horizontalSizeClass == .regular`, Android `screenWidthDp >= 600`).

OG wordmark fills ~88% width, centered on white (logo only).  Re-render:
`node scripts/render-og.mjs`.  Cache-bust `og.jpg?v=logo-only-20260822`.


## 2026-08-20 CURSOR — transparent DD favicon + ST-grid AppIcon

Safari tab icon is a transparent interlocking DD (`favicon.ico` /
`favicon-32.png`), not the old SVG that showed a letter tile.  Header
wordmark no longer has a rectangular `img` outline.  iOS AppIcon is the
DD on the Socratic.Trade tiled field (soft top-left light, recessed
grout, no candlesticks).  Rebuild: `python3 scripts/generate-app-icons.py`.

## 2026-08-21 GROK — merge origin/main into iOS TestFlight ship workflow (#85)

Union of the TestFlight ship-workflow handoff and the 3D title / iOS desk
handoff.  Workflow contract unchanged.  No TestFlight upload from this seat.

## 2026-08-20 GROK — rebase iOS TestFlight ship workflow (#85)

Added `.github/workflows/ios-ship.yml` plus a scheduled-ship gate so cron
cannot ship web-only commits.  Path filter is `native/ios/**`.  Fleet app
key is `dealdex`.  Runner `[self-hosted, macOS, ARM64, xcode26]`.  Secrets
stay on the Mac.  Bundle `net.dealdex` and team `CC8UTF7ATG` are
unchanged.  Android package `me.grok.dealdex` is unchanged.  This seat
does not upload to TestFlight.  Rebased onto current `main`.  PR #85.

## 2026-08-20 GROK — 3D title wordmark + iOS desk

Jay's glossy 3D DealDex title (red Deal + blue Dex, yellow rim) is the
website header, login, OG card, iPhone Scan title, and Android Scan title.
Isolated interlocking DD is stored at `public/marks/dealdex-dd.png` and
`DealDexMark.imageset`.  **Live AppIcon is unchanged** (white-field DD).
Preview icon options stay in `native/brand/icon-options/`.

iOS desk (same lane): display name DealDex, iOS 18.0, Xcode 26.3
(objectVersion 100), official white eBay/Mercari SVG chips, unsigned
`POST /api/native/scan`, Sign in with Google via `dealdex://` OAuth.

## 2026-08-20 CURSOR — shipping docs + GitHub About

Vercel is the current host, not a leftover.  Public host is
**https://dealdex.net**.  GitHub About homepage is that URL, not
`dealdex-psi.vercel.app`.  Repo is **public**.  Keep the site on Vercel.
Do not migrate copy to Coolify.  Native: Android `me.grok.dealdex`, iOS
`net.dealdex`, team `CC8UTF7ATG`.  Docs only.

## 2026-08-20 CURSOR — Apache License 2.0 at repo root

Root `LICENSE` is the official Apache License, Version 2.0 text from
https://www.apache.org/licenses/LICENSE-2.0.txt with
`Copyright 2026 Jay Wedgeworth` on the first line.  Landed as PR #94.

## 2026-08-19 CURSOR — official DD AppIcon + TestFlight rejects

Home-screen icon is the overlapping glossy red + blue DD with a thick yellow
rim (white background).  iOS has `Assets.xcassets/AppIcon`,
`CFBundleIconName=AppIcon`, and iPad orientations include PortraitUpsideDown
(Apple 90474).  Android adaptive/mipmap launcher and web favicon + PWA 180
use the same DD.  In-app wordmark stays the official title mark (PR #86).
Landed as PR #87.

## 2026-08-19 CURSOR — official DealDex wordmark (in-app / web)

Official title wordmark (red Deal + blue Dex, yellow badge) is the header,
login, Settings "Wordmark" chip, `public/marks/dd.svg`, and OG card
(merged PR #86).

## 2026-08-18 CURSOR — iOS bundle ID (abandoned; live is net.dealdex)

That day's iOS target change is abandoned.  Live iOS bundle is `net.dealdex`.
Team stays `CC8UTF7ATG`.  Apple bundle resource id `R2FAW69NPD` is documented
only.  It is not a team id and must not appear in `DEVELOPMENT_TEAM`.
Internal TestFlight now exists (ASC app DealDex SKU `dealdex`, appleId
`6802474288`).

# Status

Updated: 2026-08-25 (CURSOR — pin AppUpdatePrompt.swift; Apple IDs off Swift)

## Current state

- GitHub: `jaywedgeworth22/DealDex` (public).  Integration tree:
  `/Users/jay/Code/DealDex` stays on `origin/main` (do not edit there).
- Fleet member: acronym **DD**, Slack `repo: DealDex`, live board
  `~/apps/DEALDEX-EFFORT-LOG.md`.
- **Grok Build** (`GROK-BUILD`) is a standing seat.  Prefix `grok-build/`.
- Website is optional.  Stack is React 19, TanStack Start, Tailwind v4,
  Better Auth, Vite.  Not Next.js / Expo / React Native / Capacitor.
- **Public host: https://dealdex.net on Vercel.**  Vercel is current,
  not a leftover.  GitHub About homepage is `https://dealdex.net`.
  Do not point About at `dealdex-psi.vercel.app`.  Do not migrate the
  site to Coolify.
- GitHub `main` is the code.  Vercel Production builds it (team
  `jaywedgeworth22s-projects`, project `dealdex`).  Live check:
  `https://dealdex.net` served the same hashed JS as the GitHub-linked
  alias `https://dealdex-git-main-jaywedgeworth22s-projects.vercel.app`.
  The older "stale Grok publish, not tracking `main`" gap is not visible
  in today's GET.  Both pages still load
  `grok.com/grok-app-builder/extensions.js` (Grok publish chrome).
- `https://dealdex.vercel.app` is a different Next.js product.  Do not
  use it.
- Native Android debug APK builds with the Gradle 8.7 wrapper.  Package
  remains `me.grok.dealdex`.  Launcher is the official DD.  dealdex.net
  does not host an APK.
- iOS XcodeGen spec (`native/ios/project.yml`) uses
  `PRODUCT_BUNDLE_IDENTIFIER=net.dealdex` and
  `DEVELOPMENT_TEAM=CC8UTF7ATG`.  Live ASC app is DealDex SKU `dealdex`
  appleId `6802474288`.  Resource `R2FAW69NPD` is the bundle App ID, not
  a team id.  Do not upload any other iOS bundle.  AppUpdatePrompt is
  pinned at `scripts/ios-fleet/AppUpdatePrompt.swift` and copied into
  the iOS target.  Apple IDs live in `apps.json` / `versions.json` /
  Info.plist `AppUpdateAppleId`, not a Swift `knownAppleIds` map.
- In-app / web title mark is the official DealDex wordmark (PR #86).
  Home-screen AppIcon / Android launcher / PWA 180 are the overlapping
  red + blue DD on the ST tiled field.  Tab favicon is the isolated DD
  on a transparent field.
- iOS TestFlight ship workflow (`.github/workflows/ios-ship.yml`) runs on
  GitHub-hosted `macos-latest`, calls `scripts/ios-ship-testflight.sh`
  (fleet key `dealdex`, in-repo `scripts/ios-fleet`), imports ASC +
  Distribution secrets via `scripts/ios-appstore-gm-prepare.sh`, and
  gates cron on `native/ios/` changes.

## Blockers

- Keepout: DealDex #183 Datadog / Vercel keys stay HOLD.  Do not land
  or extend that PR from this seat.
- Google Play Console credentials are not in `~/.secrets/`.
- Infisical project (prod env), `SENTRY_FLEET_DSN`, and
  `FLEET_GITHUB_TOKEN` still need the owner.
- Integration tree `~/Code/DealDex` is dirty (uncommitted
  `native/ios/DealDex.xcodeproj` bits) and behind `origin/main`.  Do not
  fast-forward it until those files are cleaned by a human or an iOS lane.
- `xcodebuild` on the Mac can hang at Xcode 26's `clang -v` probe.
  Fallback: `swiftc` + `simctl` (see `native/ios/CLAUDE.md`).  This
  Linux preview cannot run Xcode 26.

## Next

- Keep the public host on Vercel at `https://dealdex.net`.  Do not
  move copy to Coolify.
- TestFlight ships stay on GitHub-hosted `macos-latest` via
  `scripts/ios-ship-testflight.sh` (fleet key `dealdex`, bundle
  `net.dealdex`).  Do not `--force-ship` from this seat.
- Remaining seats start from `main` in their own worktrees.
