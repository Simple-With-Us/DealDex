# Playwright visual regression testing — 2026-09-27

## Scope

Fleet-wide rollout (owner approved 2026-09-27: "Yes, update the policy and roll out Playwright everywhere").  DealDex already had a Playwright smoke scaffold (`playwright.config.ts`, `tests/e2e/smoke.spec.ts`); this change adds the visual layer on top.  No app code changed.

Files:
- `tests/e2e/visual.spec.ts` — six full-page `toHaveScreenshot` assertions: `/` (home), `/login`, `/install`, `/alerts`, `/saved`, `/privacy`.  Baselines committed under `tests/e2e/visual.spec.ts-snapshots/` (Chromium, Linux, 1280x720).
- `tests/e2e/visual.spec.ts-snapshots/` — six committed baseline PNGs.
- `package.json` — new `test:e2e` script (`playwright test`).
- `.github/workflows/e2e.yml` — renamed from "E2E smoke" to "E2E (Playwright)"; now runs the full suite (smoke + visual), npm cache enabled, Playwright report uploaded as an artifact on failure.
- `AGENTS.md` — automated visual-verification policy added to "Verify before claiming done": web UI is verified via Playwright screenshot assertions with committed baselines; Jay never takes manual screenshots or runs local UI preview sessions; native Mac UI is verified through code review and CI.
- `playwright.config.ts` — `snapshotPathTemplate` pins a single canonical baseline set (`{arg}{ext}`, no per-project/per-platform suffixes) so the baselines generated locally are the exact files CI compares against; HTML reporter added so the failure artifact the workflow uploads actually exists.
- `.gitignore` — `test-results/` and `playwright-report/` ignored (Playwright run artifacts).

## Deterministic controls

`animations: "disabled"` for the whole file.  Vercel Analytics / Speed Insights and the Grok App Builder bridge are aborted at the network layer.  Google Fonts are loaded for real and explicitly awaited (every family/weight the app uses) before each screenshot — aborting them was tried first, but then text fell back to system fonts, and the GitHub runner's system fonts differ from the baseline machine's, so every text pixel drifted in CI (24k+ diff pixels).  Identical webfonts on both sides is the only cross-environment-stable choice.  TanStack Start server functions (`/_serverFn/**`) are aborted: the home page's MarketBoard and Scanner plus the install page's phone mockup all fire live market scans on mount, so aborting forces their designed empty states (empty board grid, empty scan results, empty phone list).  The scan-failure toast this triggers is hidden via CSS — it is a stubbing artifact, not app behavior, and its auto-dismiss timing would flake pixels.  The header auth slot renders a skeleton while the session check is pending, so each test waits for the settled guest hamburger menu before screenshotting (this was a real flake: 340px header diffs when the shot landed mid-transition).  The MarketBoard card grid is additionally masked as defense-in-depth.  The saved/alerts pages read localStorage when logged out and are unaffected by the stubs.

## Deliberately excluded

- `/settings` renders the app's error boundary under the Playwright dev server ("Module node:crypto has been externalized for browser compatibility" via the server-module import chain: `src/routes/settings.tsx` imports `testDeskKey` from `@/lib/server/tcg` and `getAccountKeys` from `@/lib/server/desk-keys` into the client bundle).  That is a pre-existing app bug, not a visual state worth baselining.  Follow-up: fix the server import chain and add the page to the visual suite.
- `/card/$cardId` shows live per-card market data with no stable fixture.
- `/privacy-policy` redirects to `/privacy`.

## Verification

Baselines generated locally with stock Chrome-for-Testing 153 (`--no-sandbox`) against the dev server.  The first baselines flaked on repeat runs (header auth-slot race, live scan results changing page height and phone-mockup content, font-rendering drift); the deterministic controls above were added to fix each root cause, baselines were regenerated, and then the suite passed **two consecutive clean runs** without `--update-snapshots` (7/7 both times: smoke + six visual).  `npm run lint` (0 errors), `npm run typecheck`, `npm test` (278 pass), and `npm run build` all green.  CI runs the same suite on every PR and push to main.

Follow-up fix (PR #374, branch `muse/playwright-visual-snapshot-naming`): the first CI run failed all six visual tests with "A snapshot doesn't exist" — the repo config had no `snapshotPathTemplate`, so CI used Playwright's default (`{arg}-{projectName}-{platform}{ext}`) and looked for e.g. `home-full-chromium-linux.png` while the committed baselines are the canonical `home-full.png`.  Fixed by pinning `snapshotPathTemplate` to `{testDir}/{testFileDir}/{testFileName}-snapshots/{arg}{ext}` and verified locally (7/7 against the committed baselines).  Note: PR #372 auto-merged while the e2e check was still pending (verify + gitleaks were green; e2e is not a required check in branch protection), so the failure landed on main and the follow-up repairs it there.

Second follow-up (branch `muse/playwright-visual-webfonts`): with naming fixed, CI still failed all six visual tests — this time real pixel diffs (6k–34k pixels, ratio 0.01–0.03).  Root cause: the baselines were generated with Google Fonts aborted, so text rendered in system fallback fonts, and the GitHub runner's system fonts differ from the baseline machine's.  Fixed by loading the real webfonts (Fraunces, IBM Plex Sans, IBM Plex Mono — every weight the app uses, explicitly awaited via `document.fonts.load` before each screenshot) and regenerating the baselines; two consecutive clean local runs (7/7) confirm determinism.  If CI still shows small renderer deltas between Chrome-for-Testing 153 (baselines) and Playwright's bundled Chromium, the next step is a pixel-ratio tolerance — not yet needed.

Board: fleet Playwright rollout (parent-orchestrated).  Branch `muse/playwright-visual-dealdex`.

## Follow-up 3 — committed webfont fixtures (branch `muse/playwright-visual-font-rendering`, PR #377)

PR #376 (real webfonts, awaited via `document.fonts.load`) still failed all six visual tests in CI with 6k–34k pixel diffs — even though CI downloads the exact same Chrome-for-Testing 153.0.8010.12 (Playwright chromium v1243) that generated the baselines.  Root-causing with the CI failure artifact showed two real problems, and the "webfonts" fix had never actually worked:

1. **The baselines never contained webfonts at all.**  The baseline machine's browser cannot reach the public internet (`net::ERR_EMPTY_RESPONSE` for every external host through the egress proxy), so Google Fonts never loaded during baseline generation — `document.fonts` was empty and every baseline rendered fallback serif/sans.  CI (GitHub runner) reaches Google Fonts fine and rendered the real Fraunces/Plex, hence the diff on every text pixel.  The earlier `document.fonts.load` wait could not catch this: `load()` resolves with an empty array (never rejects) when the request fails.  Verified by cropping the h1 from both: old baseline = generic serif, CI actual = Fraunces.
2. **Same binary, different OS font stack.**  Chrome-for-Testing links the system libfreetype/libfontconfig/libharfbuzz, whose defaults (subpixel order, hintstyle, fractional advances) differ between machines and shift glyphs by subpixels even with identical font files.

Fix: `tests/e2e/fixtures/fonts/` commits the exact Google Fonts css2 response plus all 19 woff2 files it references (fetched once with a Chrome-on-Linux UA, ~572KB); the spec serves them via route interception, so no test depends on the network for fonts — byte-identical files locally and in CI, immune to Google silently updating files or a font outage.  The font wait now asserts at least one face reached `"loaded"` (fails loudly instead of silently rendering fallback text).  `playwright.config.ts` pins OS-independent rendering (`--disable-lcd-text`, `--font-render-hinting=none`, `--disable-font-subpixel-positioning`) so identical files rasterize identically.  The "⚡" in the home SCAN MARKET button (not in IBM Plex Sans — falls back to a per-machine system symbol/emoji font) is wrapped in a span and masked.

Verified: baselines regenerated with the required Chrome-for-Testing binary (`--no-sandbox`); the h1 crop confirms real Fraunces.  Two consecutive clean runs without `--update-snapshots` (7/7 both times).  `npm run lint` (0 errors, 28 pre-existing warnings), `npm run typecheck`, `npm test` (278 pass), `npm run build` all green.

Process lesson: PRs #372, #374, and #376 all auto-merged while the e2e check was still pending (e2e is not a required branch-protection check), landing red on main each time.  For this PR, auto-merge is armed only after the e2e check is observed green.  Recommendation for Jay stands: make "E2E (Playwright)" a required check so a red visual suite blocks merges.
