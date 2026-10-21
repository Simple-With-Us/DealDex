import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

// Guards for the two review-autofix callers.  Both call a reusable workflow in another repo, so
// actionlint cannot see the callee and a bad pin only shows up as a failed run on every bot review.

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

function read(rel) {
  return readFileSync(join(ROOT, rel), "utf8");
}

// Secret names passed under the job's `secrets:` map (six-space keys, comments skipped).
function passedSecrets(yml) {
  const lines = yml.split("\n");
  const start = lines.findIndex((line) => /^ {4}secrets:\s*$/.test(line));
  assert.notEqual(start, -1, "job has a secrets: map");
  const names = [];
  for (const line of lines.slice(start + 1)) {
    if (/^ {0,4}\S/.test(line)) break;
    const match = /^ {6}([A-Za-z0-9_]+):/.exec(line);
    if (match) names.push(match[1]);
  }
  return names;
}

function pin(yml) {
  const uses = yml.match(/^ {4}uses:\s*(\S+)\s*$/m);
  assert.ok(uses, "job has a job-level uses:");
  const [path, ref] = uses[1].split("@");
  return { path, ref: ref ?? "" };
}

test("both autofix callers pin their reusable workflow to a full commit SHA", () => {
  const autofix = pin(read(".github/workflows/autofix.yml"));
  assert.equal(autofix.path, "Simple-With-Us/AI-Fleet-Coordinator/.github/workflows/pr-autofix-reusable.yml");
  assert.match(autofix.ref, /^[0-9a-f]{40}$/);

  const claude = pin(read(".github/workflows/claude-code-autofix.yml"));
  assert.equal(claude.path, "Simple-With-Us/AI-Fleet-Coordinator/.github/workflows/claude-code-autofix-reusable.yml");
  assert.match(claude.ref, /^[0-9a-f]{40}$/);
});

test("PR Autofix is not pinned to a reusable revision that deadlocks", () => {
  // 2e671004 (AI-Fleet-Coordinator #520) up to its #611 (c525150d) gave the reusable job the same
  // concurrency group the caller holds, so GitHub cancelled every run as a deadlock before a
  // step ran (DealDex runs 39012546290, 39012547064).
  const { ref } = pin(read(".github/workflows/autofix.yml"));
  for (const bad of ["2e671004", "3fac4c3c"]) {
    assert.ok(!ref.startsWith(bad), `pr-autofix-reusable.yml is pinned to deadlocking ${bad}`);
  }
});

test("autofix callers pass only secrets their reusable declares", () => {
  assert.deepEqual(passedSecrets(read(".github/workflows/autofix.yml")), ["MINIMAX_API_KEY", "AUTOFIX_GITHUB_APP_PRIVATE_KEY", "USAGE_INGEST_TOKEN"]);
  assert.deepEqual(passedSecrets(read(".github/workflows/claude-code-autofix.yml")), ["MINIMAX_API_KEY", "USAGE_INGEST_TOKEN"]);
});

test("autofix callers keep their least-privilege and fork guards", () => {
  const autofix = read(".github/workflows/autofix.yml");
  assert.match(autofix, /^permissions: \{\}\s*$/m);
  assert.match(autofix, /^ {6}contents: write\n {6}pull-requests: read\n/m);
  const claude = read(".github/workflows/claude-code-autofix.yml");
  assert.match(claude, /github\.event\.pull_request\.head\.repo\.full_name == github\.repository/);
});

test("Claude Autofix keeps the Sentry-capable pin and same-repository bot gate", () => {
  const claude = read(".github/workflows/claude-code-autofix.yml");
  // AFC #657 was inspected: only sentry and sentry[bot] were added to the
  // prior bot list.  Do not override that reviewed policy or restore the old pin.
  assert.match(
    claude,
    /claude-code-autofix-reusable\.yml@c79c7840d4d3d71bffad08067ce4a1084f0bbb34/,
  );
  assert.doesNotMatch(claude, /^\s+allowed_bots:/m);
  const guard = claude.match(/^ {4}if: >-\n([\s\S]*?)^ {4}uses:/m)?.[1];
  assert.ok(guard, "Claude Autofix has a job-level guard");
  assert.equal(
    guard.replace(/\s+/g, " ").trim(),
    "github.event_name == 'workflow_dispatch' || " +
      "(github.event_name == 'pull_request_review' && " +
      "github.event.review.user.type == 'Bot' && " +
      "github.event.pull_request.head.repo.full_name == github.repository)",
  );
});


test("PR Autofix retains the reviewed stream-json CLI repair", () => {
  // Exact consumed workflow diff from b634b511: add --verbose to claude --print.
  assert.equal(
    pin(read(".github/workflows/autofix.yml")).ref,
    "00def8545947e21ffe285ea67c1812c7bd321dfc",
  );
});
