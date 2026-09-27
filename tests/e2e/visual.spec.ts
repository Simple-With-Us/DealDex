import { test, expect, type Locator, type Page } from "@playwright/test";
import { existsSync, readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

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
//   - Google Fonts are served from committed fixtures, never the network.
//     tests/e2e/fixtures/fonts/ holds the exact css2 response plus every
//     woff2 it references for the app's font URL (see src/routes/__root.tsx),
//     fetched once with a Chrome-on-Linux UA.  Serving byte-identical files
//     on both sides is the only cross-environment-stable choice: aborting
//     fonts fell back to system fonts (different on the baseline machine
//     vs the CI runner), and even loading them live from Google is fragile —
//     the css2 API can serve different files per UA/region over time, and a
//     font outage would silently render fallback text.  (document.fonts.load
//     resolves with an empty array, never rejects, on failure — the wait
//     below asserts at least one face actually reached "loaded".)
//   - Chromium's font rendering is pinned to OS-independent settings
//     (--disable-lcd-text, --font-render-hinting=none,
//     --disable-font-subpixel-positioning in playwright.config.ts).
//     Chrome-for-Testing links the OS libfreetype/libfontconfig/
//     libharfbuzz, whose defaults (subpixel order, hintstyle, fractional
//     advances) differ between the baseline machine and the CI runner and
//     shifted every glyph by subpixels.  Grayscale, unhinted, integer-
//     positioned text renders identically from identical font files.
//   - The "⚡" in the home page's SCAN MARKET button is not in IBM Plex
//     Sans, so it falls back to a system symbol/emoji font that differs
//     per machine; it is wrapped in a span and masked (the app cannot
//     control that glyph, and it renders differently on every user's
//     machine anyway).
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

// Committed webfont fixtures (see the header comment): serve the exact
// Google Fonts CSS + woff2 files locally so no test depends on the network
// for fonts.
const fontsDir = join(
  dirname(fileURLToPath(import.meta.url)),
  "fixtures",
  "fonts",
);
const fontsCss = readFileSync(join(fontsDir, "fonts.css"), "utf8");
function fontFixturePath(url: string): string | null {
  const file = join(
    fontsDir,
    url.replace("https://fonts.gstatic.com/", "").replaceAll("/", "_"),
  );
  return existsSync(file) ? file : null;
}

async function serveLocalFonts(page: Page): Promise<void> {
  await page.route("https://fonts.googleapis.com/css2**", (route) =>
    route.fulfill({ contentType: "text/css", body: fontsCss }),
  );
  await page.route("https://fonts.gstatic.com/**", async (route) => {
    const file = fontFixturePath(route.request().url());
    // Every URL referenced by the fixture CSS has a committed file; abort
    // loudly on anything unexpected rather than hitting the network.
    if (file) {
      await route.fulfill({ contentType: "font/woff2", path: file });
    } else {
      await route.abort();
    }
  });
}

test.beforeEach(async ({ page }) => {
  await serveLocalFonts(page);
  await page.route("https://va.vercel-scripts.com/**", (route) => route.abort());
  await page.route("https://vitals.vercel-insights.com/**", (route) => route.abort());
  await page.route("https://grok.com/grok-app-builder/**", (route) => route.abort());
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
  // Web fonts must be fully loaded before the screenshot.  They are served
  // from committed fixtures (see serveLocalFonts), so the bytes are
  // identical locally and in CI — explicitly load every family/weight the
  // app uses (see the Google Fonts URL in src/routes/__root.tsx), then wait
  // for the set to settle.
  await page.evaluate(async () => {
    const faces = [
      "500 16px Fraunces",
      "600 16px Fraunces",
      '400 16px "IBM Plex Sans"',
      '500 16px "IBM Plex Sans"',
      '600 16px "IBM Plex Sans"',
      '400 16px "IBM Plex Mono"',
      '500 16px "IBM Plex Mono"',
    ];
    await Promise.race([
      Promise.all(faces.map((f) => document.fonts.load(f))).then(
        () => document.fonts.ready,
      ),
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error("webfont load timed out")), 30000),
      ),
    ]);
    // document.fonts.load() resolves with an empty array when the font
    // request fails — it never rejects.  Without this check a blocked
    // fonts.googleapis.com would silently fall back to system fonts and
    // produce environment-dependent pixels instead of failing loudly.
    const loadedCount = [...document.fonts].filter(
      (f) => f.status === "loaded",
    ).length;
    if (loadedCount === 0) {
      throw new Error(
        "expected webfonts to load, but no font faces reached 'loaded'",
      );
    }
  });
  await page.waitForTimeout(500);
}

// The "⚡" in the SCAN MARKET button is not in IBM Plex Sans, so it falls
// back to a system symbol/emoji font — Noto Color Emoji on one machine, a
// monochrome symbol font on another.  The app cannot control that glyph,
// so wrap it and mask it: everything else on the page stays asserted.
async function maskZapGlyph(page: Page): Promise<Locator> {
  await page.evaluate(() => {
    const walker = document.createTreeWalker(
      document.body,
      NodeFilter.SHOW_TEXT,
    );
    const targets: Text[] = [];
    while (walker.nextNode()) {
      const node = walker.currentNode as Text;
      if (node.nodeValue?.includes("⚡")) targets.push(node);
    }
    for (const node of targets) {
      const fragment = document.createDocumentFragment();
      const parts = node.nodeValue!.split("⚡");
      parts.forEach((part, i) => {
        if (part) fragment.appendChild(document.createTextNode(part));
        if (i < parts.length - 1) {
          const span = document.createElement("span");
          span.setAttribute("data-visual-zap", "");
          span.textContent = "⚡";
          fragment.appendChild(span);
        }
      });
      node.replaceWith(fragment);
    }
  });
  return page.locator("[data-visual-zap]");
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
  const zap = await maskZapGlyph(page);
  await expect(page, "home page should match the committed baseline").toHaveScreenshot(
    "home-full.png",
    { fullPage: true, mask: [boardGrid, zap] },
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
