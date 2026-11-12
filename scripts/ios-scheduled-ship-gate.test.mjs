import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

test("scheduled ship gate skips web-only commits and ships apps/ios", () => {
  const result = spawnSync(
    "bash",
    [join(ROOT, "scripts/test-ios-scheduled-ship-gate.sh")],
    { encoding: "utf8" },
  );
  assert.equal(
    result.status,
    0,
    `${result.stdout}\n${result.stderr}`,
  );
});
