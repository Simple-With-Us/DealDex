import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { copyFileSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));
const CATCH_UP_WATCH = JSON.parse(
  readFileSync(join(ROOT, "scripts/deploy/vercel-config.json"), "utf8"),
).watch;

test("production ignore step excludes platform and source artwork changes but watches served web files", () => {
  const dir = mkdtempSync(join(tmpdir(), "ignore-paths-"));
  const git = (...args) => execFileSync("git", args, { cwd: dir, encoding: "utf8" }).trim();
  try {
    copyFileSync(join(ROOT, "vercel-ignore-hourly.sh"), join(dir, "vercel-ignore-hourly.sh"));
    git("init", "-q");
    git(
      "-c",
      "user.name=Fixture",
      "-c",
      "user.email=fixture@example.invalid",
      "commit",
      "--allow-empty",
      "-qm",
      "baseline",
    );
    for (const [path, excluded] of [
      ["apps/ios/DealDex/ScanView.swift", true],
      ["apps/android/app/build.gradle.kts", true],
      ["assets/brand/dealdex-dd-icon-1024.png", true],
      ["docs/native-apps.md", true],
      ["public/marks/dealdex-dd.png", false],
      ["src/routes/install.tsx", false],
      ["vite.config.ts", false],
    ]) {
      const previous = git("rev-parse", "HEAD");
      mkdirSync(dirname(join(dir, path)), { recursive: true });
      writeFileSync(join(dir, path), "fixture\n");
      git("add", path);
      git(
        "-c",
        "user.name=Fixture",
        "-c",
        "user.email=fixture@example.invalid",
        "commit",
        "-qm",
        "path fixture",
      );
      const catchUpChanges = git("diff", "--name-only", previous, "HEAD", "--", ...CATCH_UP_WATCH);
      assert.equal(catchUpChanges.length === 0, excluded, `${path}: catch-up watch drift`);
      const result = spawnSync("bash", ["vercel-ignore-hourly.sh"], {
        cwd: dir,
        encoding: "utf8",
        env: {
          ...process.env,
          VERCEL_ENV: "production",
          VERCEL_FORCE_DEPLOY: "",
          VERCEL_IGNORE_WATCH: "",
          VERCEL_TOKEN: "",
          VERCEL_PROJECT_ID: "",
          VERCEL_GIT_PREVIOUS_SHA: previous,
          VERCEL_GIT_COMMIT_SHA: git("rev-parse", "HEAD"),
        },
      });
      assert.equal(result.status, 0, result.stderr);
      assert.equal(
        result.stdout.includes("no site-file changes"),
        excluded,
        `${path}: ${result.stdout}`,
      );
      if (!excluded) assert.match(result.stdout, /cooldown cannot be checked/);
    }
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
