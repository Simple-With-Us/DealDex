#!/usr/bin/env node
/**
 * Wrap ios-ship-testflight.sh so Actions can gate post-sync recheck on a real upload.
 * Skipped ships (rate/same-HEAD gate) must not look like uploaded == true.
 */
import { spawn } from "node:child_process";
import fs from "node:fs";

const TAIL_MAX = 8 * 1024;
const uploadedRe =
  /upload path succeeded via xcodebuild export \(destination=upload\)|build .+ submitted for |upload submitted; watch TestFlight processing/;
const skippedRe =
  /ship-gate: exiting 0 before any version is resolved \(nothing consumed\)/;

const cmd = process.argv.slice(2);
if (cmd.length === 0) {
  console.error("usage: ios-observe-ship.mjs <command> [args...]");
  process.exit(2);
}

const githubOutput = process.env.GITHUB_OUTPUT?.trim();

function trimTail(buf) {
  return buf.length > TAIL_MAX ? buf.slice(-TAIL_MAX) : buf;
}

function createStreamScanner(markUploaded, markSkipped) {
  let carry = "";
  let tail = "";

  const scanText = (text) => {
    if (uploadedRe.test(text)) markUploaded();
    if (skippedRe.test(text)) markSkipped();
  };

  return {
    onData(chunk) {
      carry += chunk.toString();
      let nl;
      while ((nl = carry.indexOf("\n")) !== -1) {
        const line = `${carry.slice(0, nl)}\n`;
        carry = carry.slice(nl + 1);
        tail = trimTail(tail + line);
        scanText(line);
      }
      if (carry.length > TAIL_MAX) {
        carry = carry.slice(-TAIL_MAX);
      }
    },
    flush() {
      if (carry) {
        tail = trimTail(tail + carry);
        scanText(carry);
        carry = "";
      }
      scanText(tail);
    },
  };
}

let stdoutUploaded = false;
let stderrUploaded = false;
let stdoutSkipped = false;
let stderrSkipped = false;

const stdoutScan = createStreamScanner(
  () => {
    stdoutUploaded = true;
  },
  () => {
    stdoutSkipped = true;
  },
);
const stderrScan = createStreamScanner(
  () => {
    stderrUploaded = true;
  },
  () => {
    stderrSkipped = true;
  },
);

const child = spawn(cmd[0], cmd.slice(1), {
  stdio: ["inherit", "pipe", "pipe"],
  shell: false,
});

child.stdout.on("data", (chunk) => {
  stdoutScan.onData(chunk);
  process.stdout.write(chunk);
});
child.stderr.on("data", (chunk) => {
  stderrScan.onData(chunk);
  process.stderr.write(chunk);
});

let settled = false;

function writeGithubOutput(uploaded, shipObserved) {
  if (!githubOutput) return;
  fs.appendFileSync(githubOutput, `uploaded=${uploaded}\nship_observed=${shipObserved}\n`);
}

function settle(exitCode, shipObserved, uploadedValue) {
  if (settled) return;
  settled = true;
  writeGithubOutput(uploadedValue, shipObserved);
  process.exit(exitCode);
}

child.on("error", (err) => {
  console.error(err.message);
  settle(1, "spawn_error", "false");
});

child.on("close", (code, signal) => {
  stdoutScan.flush();
  stderrScan.flush();

  const sawUploaded = stdoutUploaded || stderrUploaded;
  const sawSkipped = stdoutSkipped || stderrSkipped;
  const exitCode = signal ? 1 : (code ?? 1);

  if (sawUploaded) {
    settle(exitCode, "uploaded", "true");
  } else if (sawSkipped) {
    settle(exitCode, "skipped", "false");
  } else if (exitCode === 0) {
    settle(exitCode, "unknown_success", "unknown");
  } else {
    settle(exitCode, "failed", "false");
  }
});
