import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, unlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

function runObserve(argv, env = {}) {
  const outFile = join(tmpdir(), `observe-out-${process.pid}-${Math.random()}`);
  const r = spawnSync("node", ["scripts/ios-observe-ship.mjs", ...argv], {
    cwd: ROOT,
    env: { ...process.env, GITHUB_OUTPUT: outFile, ...env },
    encoding: "utf8",
  });
  const githubOutput = (() => {
    try {
      return readFileSync(outFile, "utf8");
    } catch {
      return "";
    }
  })();
  try {
    unlinkSync(outFile);
  } catch {
    /* ignore */
  }
  return { ...r, githubOutput };
}

test("ios-observe-ship spawn error writes spawn_error outputs once", () => {
  const r = runObserve(["/no-such-cmd-ios-observe-test", "arg"]);
  assert.notEqual(r.status, 0);
  assert.match(r.githubOutput, /uploaded=false\n/);
  assert.match(r.githubOutput, /ship_observed=spawn_error\n/);
  assert.equal((r.githubOutput.match(/uploaded=/g) ?? []).length, 1);
});

test("ios-observe-ship detects upload after large stdout without full buffering", () => {
  const fake = mkdtempSync(join(tmpdir(), "fake-ship-"));
  const fakeShip = join(fake, "ship.sh");
  const marker =
    "upload path succeeded via xcodebuild export (destination=upload)";
  writeFileSync(
    fakeShip,
    `#!/bin/sh\ni=0; while [ "$i" -lt 20000 ]; do echo "pad-$i"; i=$((i+1)); done\necho "${marker}"\nexit 0\n`,
    { mode: 0o755 },
  );
  const r = runObserve(["sh", fakeShip]);
  assert.equal(r.status, 0);
  assert.match(r.githubOutput, /uploaded=true/);
  assert.match(r.githubOutput, /ship_observed=uploaded/);
});

test("ios-observe-ship marks skip as uploaded false", () => {
  const fake = mkdtempSync(join(tmpdir(), "fake-skip-"));
  const fakeShip = join(fake, "skip.sh");
  writeFileSync(
    fakeShip,
    '#!/bin/sh\necho "ship-gate: exiting 0 before any version is resolved (nothing consumed)"\nexit 0\n',
    { mode: 0o755 },
  );
  const r = runObserve(["sh", fakeShip]);
  assert.equal(r.status, 0);
  assert.match(r.githubOutput, /uploaded=false/);
  assert.match(r.githubOutput, /ship_observed=skipped/);
});

test("ios-observe-ship exit 0 without markers yields uploaded unknown", () => {
  const fake = mkdtempSync(join(tmpdir(), "fake-unk-"));
  const fakeShip = join(fake, "unk.sh");
  writeFileSync(fakeShip, "#!/bin/sh\necho ok\nexit 0\n", { mode: 0o755 });
  const r = runObserve(["sh", fakeShip]);
  assert.equal(r.status, 0);
  assert.match(r.githubOutput, /uploaded=unknown/);
  assert.match(r.githubOutput, /ship_observed=unknown_success/);
});
