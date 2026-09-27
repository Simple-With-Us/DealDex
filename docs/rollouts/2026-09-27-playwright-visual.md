# Playwright visual regression testing — 2026-09-27

## Scope

Fleet-wide rollout (owner approved 2026-09-27: "Yes, update the policy and roll out Playwright everywhere").  DealDex already had a Playwright smoke scaffold (`playwright.config.ts`, `tests/e2e/smoke.spec.ts`); this change adds the visual layer on top.  No app code changed.

Files:
- `tests/e2e/visual.spec.ts` — six full-page `toHaveScreenshot` assertions: `/` (home), `/login`, `/install`, `/alerts`, `/saved`, `/privacy`.  Baselines committed under `tests/e2e/visual.spec.ts-snapshots/` (Chromium, Linux, 1280x720).
- `tests/e2e/visual.spec.ts-snapshots/` — six committed baseline PNGs.
- `package.json` — new `test:e2e` script (`playwright test`).
- `.github/workflows/e2e.yml` — renamed from "E2E smoke" to "E2E (Playwright)"; now runs the full suite (smoke + visual), npm cache enabled, Playwright report uploaded as an artifact on failure.
- `AGENTS.md` — automated visual-verification policy added to "Verify before claiming done": web UI is verified via Playwright screenshot assertions with committed baselines; Jay never takes manual screenshots or runs local UI preview sessions; native Mac UI is verified through code review and CI.
- `.gitignore` — `test-results/` and `playwright-report/` ignored (Playwright run artifacts).

## Deterministic controls

`animations: "disabled"` for the whole file.  Vercel Analytics / Speed Insights and the Grok App Builder bridge are aborted at the network layer.  Google Fonts are aborted, so text always renders in system fallback fonts — a slow or failed font fetch can never shift text metrics between runs (this was a real flake: scattered 340px text diffs on repeat runs).  TanStack Start server functions (`/_serverFn/**`) are aborted: the home page's MarketBoard and Scanner plus the install page's phone mockup all fire live market scans on mount, so aborting forces their designed empty states (empty board grid, empty scan results, empty phone list).  The scan-failure toast this triggers is hidden via CSS — it is a stubbing artifact, not app behavior, and its auto-dismiss timing would flake pixels.  The header auth slot renders a skeleton while the session check is pending, so each test waits for the settled guest hamburger menu before screenshotting (this was a real flake: 340px header diffs when the shot landed mid-transition).  The MarketBoard card grid is additionally masked as defense-in-depth.  The saved/alerts pages read localStorage when logged out and are unaffected by the stubs.

## Deliberately excluded

- `/settings` renders the app's error boundary under the Playwright dev server ("Module node:crypto has been externalized for browser compatibility" via the server-module import chain: `src/routes/settings.tsx` imports `testDeskKey` from `@/lib/server/tcg` and `getAccountKeys` from `@/lib/server/desk-keys` into the client bundle).  That is a pre-existing app bug, not a visual state worth baselining.  Follow-up: fix the server import chain and add the page to the visual suite.
- `/card/$cardId` shows live per-card market data with no stable fixture.
- `/privacy-policy` redirects to `/privacy`.

## Verification

Baselines generated locally with stock Chrome-for-Testing 153 (`--no-sandbox`) against the dev server.  The first baselines flaked on repeat runs (header auth-slot race, live scan results changing page height and phone-mockup content, font-rendering drift); the deterministic controls above were added to fix each root cause, baselines were regenerated, and then the suite passed **two consecutive clean runs** without `--update-snapshots` (7/7 both times: smoke + six visual).  `npm run lint` (0 errors), `npm run typecheck`, `npm test` (278 pass), and `npm run build` all green.  CI runs the same suite on every PR and push to main.

Board: fleet Playwright rollout (parent-orchestrated).  Branch `muse/playwright-visual-dealdex`.
