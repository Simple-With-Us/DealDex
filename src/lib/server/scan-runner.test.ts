import assert from "node:assert/strict";
import { test } from "node:test";
import { parseRunnerInput } from "./scan-runner.server";

test("parseRunnerInput accepts a runner body and rejects a mistyped one", () => {
  assert.deepEqual(parseRunnerInput(undefined), {
    forceScan: false,
    cursorMs: 0,
    source: "cron",
  });
  assert.deepEqual(parseRunnerInput({ forceScan: true, cursorMs: 5, source: " manual " }), {
    forceScan: true,
    cursorMs: 5,
    source: "manual",
  });
  assert.throws(() => parseRunnerInput({ forceScan: "yes" }), (err: unknown) => {
    assert.ok(err instanceof Response);
    assert.equal(err.status, 400);
    return true;
  });
  assert.throws(() => parseRunnerInput({ cursorMs: -1 }), (err: unknown) => {
    assert.ok(err instanceof Response);
    assert.equal(err.status, 400);
    return true;
  });
});
