import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { test } from "node:test";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

function read(rel) {
  return readFileSync(join(ROOT, rel), "utf8");
}

test("root layout mounts Vercel Analytics via the React import, not Next.js", () => {
  const root = read("src/routes/__root.tsx");
  assert.match(root, /from "@vercel\/analytics\/react"/);
  assert.match(root, /<Analytics \/>/);
  assert.doesNotMatch(root, /@vercel\/analytics\/next/);
});

test("root layout mounts Vercel Speed Insights via the React import, not Next.js", () => {
  const root = read("src/routes/__root.tsx");
  assert.match(root, /from "@vercel\/speed-insights\/react"/);
  assert.match(root, /<SpeedInsights /);
  assert.match(root, /computeRoute/);
  assert.doesNotMatch(root, /@vercel\/speed-insights\/next/);
});

test("service worker does not intercept Vercel insight requests", () => {
  const sw = read("public/sw.js");
  assert.match(sw, /pathname\.startsWith\("\/_vercel\/"\)/);
});

test("privacy page discloses website analytics and Speed Insights", () => {
  const privacy = read("src/routes/privacy.tsx");
  assert.match(privacy, /Vercel Web Analytics/);
  assert.match(privacy, /Vercel\s+Speed Insights/);
  assert.match(privacy, /do not use cookies/);
  assert.match(privacy, /Datadog/);
});
