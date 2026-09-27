import { test, expect, type Page } from "@playwright/test";

// Automated visual verification (owner directive 2026-09-27): Playwright
// screenshot assertions with committed baselines for the DealDex web
// surfaces.  The owner never takes manual screenshots and does not run local
// UI preview sessions.
//
// Deterministic controls used here:
//   - CSS animations/transitions are disabled for every test.
//   - Telemetry and third-party scripts (Vercel Analytics/Speed Insights,
//     the Grok App Builder bridge) are aborted at the network layer: they
//     can neither change the render nor flake it.
//   - Google Fonts are aborted: text always renders in system fallback
//     fonts, so a slow or failed font fetch can never shift text metrics
//     between runs (local or CI).
//   - TanStack Start server functions (`/_serverFn/**`) are aborted.  The
//     home page's MarketBoard and Scanner, and the install page's phone
//     mockup, all fire live market scans on mount; aborting forces their
//     designed empty states (empty board grid, empty scan results, empty
//     phone list), which are pixel-stable.  The scan-failure toast this
//     triggers is hidden via CSS: it is a stubbing artifact, not app
//     behavior, and its auto-dismiss timing would flake pixels.
//     The saved/alerts pages read localStorage when logged out, so they are
//     unaffected.
//   - The header auth slot renders a skeleton while the session check is
//     pending; tests wait for the settled guest menu before screenshotting.
//   - The MarketBoard card grid on the home page is additionally masked:
//     it is the live-data region (masked as defense-in-depth even though the
//     server-function abort already empties it).
//
// Deliberately NOT covered here:
//   - /settings renders the app's error boundary under the Playwright dev
//     server (client bundle hits "node:crypto has been externalized for
//     browser compatibility" via the server-module import chain).  That is
//     a pre-existing app bug, not a visual state worth baselining.
//   - /card/$cardId shows live per-card market data with no stable fixture.
//   - /privacy-policy 301-redirects to /privacy.
test.use({ animations: "disabled" });

test.beforeEach(async ({ page }) => {
  await page.route("https://va.vercel-scripts.com/**", (route) => route.abort());
  await page.route("https://vitals.vercel-insights.com/**", (route) => route.abort());
  await page.route("https://grok.com/grok-app-builder/**", (route) => route.abort());
  await page.route("https://fonts.googleapis.com/**", (route) => route.abort());
  await page.route("https://fonts.gstatic.com/**", (route) => route.abort());
  // Live market scans (MarketBoard, install-page phone mockup) -> designed
  // empty states.  See the header comment.
  await page.route("**/_serverFn/**", (route) => route.abort());
});

async function gotoSettled(
  page: Page,
  path: string,
  opts: { awaitAuthSlot?: boolean } = {},
): Promise<void> {
  await page.goto(path, { waitUntil: "networkidle" });
  // The home page auto-runs a market scan on mount; with server functions
  // aborted that scan fails and sonner shows a "Failed to fetch" toast.
  // The toast is a stubbing artifact, not app behavior under test, and its
  // auto-dismiss timing would flake pixels — keep it out of the render.
  await page.addStyleTag({
    content: "[data-sonner-toaster] { display: none !important; }",
  });
  if (opts.awaitAuthSlot ?? true) {
    // The header auth slot renders a pulsing skeleton while the session
    // check is pending, then the guest hamburger menu.  Screenshotting in
    // between flakes the header pixels, so wait for the settled state.
    await page.getByRole("button", { name: "Menu" }).waitFor({ timeout: 15000 });
  }
  // Web fonts (Fraunces / IBM Plex) shift text metrics if they land late.
  await page
    .evaluate(() =>
      Promise.race([
        document.fonts.ready,
        new Promise((resolve) => setTimeout(resolve, 5000)),
      ]),
    )
    .catch(() => undefined);
  await page.waitForTimeout(500);
}

test("home: full-page screenshot", async ({ page }) => {
  await gotoSettled(page, "/");
  await expect(
    page.getByRole("heading", { name: "Compare Pokémon card listing prices" }),
    "home page hero heading should render",
  ).toBeVisible();
  // Live TCGPlayer board: mask the card grid (prices, art, skeletons).
  const boardGrid = page
    .locator("section", {
      has: page.getByRole("heading", { name: "A few cards on TCGPlayer" }),
    })
    .locator("div.grid");
  await expect(page, "home page should match the committed baseline").toHaveScreenshot(
    "home-full.png",
    { fullPage: true, mask: [boardGrid] },
  );
});

test("login: full-page screenshot", async ({ page }) => {
  // The login page renders outside the Shell, so there is no header auth
  // slot to wait for.
  await gotoSettled(page, "/login", { awaitAuthSlot: false });
  await expect(
    page.getByRole("heading", { name: "Sign in to DealDex" }),
    "login card should render",
  ).toBeVisible();
  await expect(page, "login page should match the committed baseline").toHaveScreenshot(
    "login-full.png",
    { fullPage: true },
  );
});

test("install: full-page screenshot", async ({ page }) => {
  await gotoSettled(page, "/install");
  await expect(
    page.getByRole("heading", { name: "Android and iPhone", level: 1 }),
    "install page h1 should render",
  ).toBeVisible();
  await expect(
    page,
    "install page should match the committed baseline",
  ).toHaveScreenshot("install-full.png", { fullPage: true });
});

test("alerts: full-page screenshot", async ({ page }) => {
  await gotoSettled(page, "/alerts");
  await expect(
    page.getByRole("heading", { name: "Alerts", level: 1 }),
    "alerts page h1 should render",
  ).toBeVisible();
  await expect(page, "alerts page should match the committed baseline").toHaveScreenshot(
    "alerts-full.png",
    { fullPage: true },
  );
});

test("saved: full-page screenshot", async ({ page }) => {
  await gotoSettled(page, "/saved");
  await expect(
    page.getByRole("heading", { name: "Saved Appraisals", level: 1 }),
    "saved page h1 should render",
  ).toBeVisible();
  await expect(page, "saved page should match the committed baseline").toHaveScreenshot(
    "saved-full.png",
    { fullPage: true },
  );
});

test("privacy: full-page screenshot", async ({ page }) => {
  await gotoSettled(page, "/privacy");
  await expect(
    page.getByRole("heading", { name: "Privacy", level: 1 }),
    "privacy page h1 should render",
  ).toBeVisible();
  await expect(
    page,
    "privacy page should match the committed baseline",
  ).toHaveScreenshot("privacy-full.png", { fullPage: true });
});
