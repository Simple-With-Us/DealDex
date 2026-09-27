import { defineConfig } from '@playwright/test';

// Fleet rollout scaffold: chromium-only smoke tests against a local server.
// Point PLAYWRIGHT_BASE_URL at a deployed environment to run against it.
//
// NOTE: the webServer runs the *dev* server, not `vite preview`. This app's
// production build uses the Vercel nitro preset (output in .vercel/output),
// which TanStack Start's `vite preview` cannot serve — it looks for the
// node-server preset bundle at dist/server/server.js and crashes with
// ERR_MODULE_NOT_FOUND, so Playwright times out waiting for the server.
const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? 'http://127.0.0.1:4173';

export default defineConfig({
  testDir: './tests/e2e',
  timeout: 60_000,
  // Single canonical baseline set: no per-project / per-platform suffixes,
  // so baselines generated locally (stock Chrome-for-Testing) are the exact
  // files CI compares against.
  snapshotPathTemplate:
    '{testDir}/{testFileDir}/{testFileName}-snapshots/{arg}{ext}',
  reporter: [['list'], ['html', { open: 'never' }]],
  use: { baseURL },
  projects: [{ name: 'chromium', use: { browserName: 'chromium' } }],
  webServer: {
    command: 'npm run dev -- --port 4173 --host 127.0.0.1',
    url: baseURL,
    timeout: 180_000,
    reuseExistingServer: !process.env.CI,
  },
});
