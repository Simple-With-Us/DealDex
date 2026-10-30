import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

function read(rel) {
  return readFileSync(join(ROOT, rel), "utf8");
}

// on.push.paths entries, any quote style.  Scoped to the paths: list under
// push: so paths-ignore, branches and other lists never leak in.
function extractPushPaths(ymlText) {
  const block = ymlText.match(
    /push:\s*\n(?:.*\n)*?\s+paths:\s*\n((?:\s+-\s+[^\n]+\n)+)/,
  );
  if (!block) return [];
  return [...block[1].matchAll(/^\s+-\s+['"]?([^'"\s]+)['"]?\s*$/gm)].map(
    (m) => m[1],
  );
}

// --path-prefix values from the scheduled gate step only, any quote style.
// Full-line comments are stripped so a prose mention like
// "--path-prefix per ..." is never read as a prefix.
function extractGatePrefixes(ymlText) {
  const step = ymlText.match(
    /- name: Scheduled ship gate[\s\S]*?(?=\n\s+- name:|$)/,
  );
  if (!step) return [];
  const code = step[0]
    .split("\n")
    .filter((line) => !/^\s*#/.test(line))
    .join("\n");
  return [...code.matchAll(/--path-prefix\s+['"]?([^'"\s]+)['"]?/g)].map(
    (m) => m[1],
  );
}

test("ios-ship.yml targets dealdex / native/ios on GitHub-hosted macos-latest", () => {
  const yml = read(".github/workflows/ios-ship.yml");
  const wrapper = read("scripts/ios-ship-testflight.sh");
  const prepare = read("scripts/ios-appstore-gm-prepare.sh");

  assert.match(yml, /native\/ios\/\*\*/);
  assert.match(yml, /scripts\/ios-fleet\/\*\*/);
  // The scheduled gate covers the same set a push would have shipped: one
  // --path-prefix per on.push.paths entry, or a missed push of a
  // tooling-only merge never ships (owner Oct 29 2026).
  const pushPaths = extractPushPaths(yml);
  assert.ok(pushPaths.length, "on.push.paths block found");
  assert.deepEqual(pushPaths, [
    "native/ios/**",
    ".github/workflows/ios-ship.yml",
    "scripts/ios-fleet/**",
    "scripts/ios-ship-testflight.sh",
    "scripts/ios-appstore-gm-prepare.sh",
    "scripts/ios-stage-asc-key.sh",
  ]);
  const gatePrefixes = extractGatePrefixes(yml);
  assert.deepEqual([...gatePrefixes].sort(), [...pushPaths].sort());
  assert.match(yml, /runs-on:\s*macos-latest/);
  assert.doesNotMatch(yml, /runs-on:\s*\[self-hosted/);
  assert.match(yml, /DEVELOPER_DIR:\s*\/Applications\/Xcode\.app\/Contents\/Developer/);
  assert.match(yml, /fetch-depth:\s*0/);
  assert.match(yml, /cancel-in-progress:\s*false/);
  assert.match(yml, /github\.event\.repository\.fork == false/);
  assert.match(yml, /bash scripts\/ios-ship-testflight\.sh/);
  assert.doesNotMatch(yml, /--force-ship/);
  assert.match(yml, /ios-appstore-gm-prepare\.sh/);
  assert.match(yml, /Load Infisical signing secrets/);
  assert.match(yml, /secrets\.INFISICAL_PROJECT_ID/);
  assert.match(yml, /secrets\.INFISICAL_UNIVERSAL_AUTH_CLIENT_ID/);
  assert.match(yml, /infisical login --method=universal-auth/);
  assert.match(yml, /ASC_KEY_ID/);
  assert.doesNotMatch(yml, /secrets\.ASC_KEY_ID/);
  assert.doesNotMatch(yml, /ASC_KEY_ID: \$\{\{ secrets\.ASC_KEY_ID \}\}/);
  assert.doesNotMatch(yml, /if:.*secrets\./);
  assert.match(yml, /cron:\s*'22 \* \* \* \*'/);
  assert.doesNotMatch(yml, /cron:\s*'22,52 /);

  // The cron park only existed while ios-ship was disabled.  With ships
  // resumed, the real hourly run feeds the Sentry Crons monitor through
  // sentry-ci-report.yml, so the park heartbeat must be gone (two check-in
  // sources would mask a stalled ship).
  assert.equal(
    existsSync(join(ROOT, ".github/workflows/ios-ship-cron-park.yml")),
    false,
    "ios-ship-cron-park.yml must be deleted while ios-ship ships",
  );

  const reporter = read("scripts/sentry-ci-report.py");
  assert.match(reporter, /--park-ios-ship/);
  assert.match(reporter, /"iOS TestFlight ship \(GitHub-hosted macOS\)": "22 \* \* \* \*"/);
  assert.match(yml, /workflow_dispatch/);

  assert.doesNotMatch(yml, /DEVELOPMENT_TEAM/);
  assert.doesNotMatch(yml, /R2FAW69NPD/, "resource id must not appear in the ship workflow");
  assert.doesNotMatch(yml, /me\.grok\.dealdex/);
  assert.doesNotMatch(yml, /PRODUCT_BUNDLE_IDENTIFIER/);

  assert.match(wrapper, /scripts\/ios-fleet\/ship-testflight\.sh/);
  assert.match(wrapper, /IN_REPO="\$\{ROOT\}\/scripts\/ios-fleet\/ship-testflight\.sh"/);
  assert.match(wrapper, /if \[\[ -f "\$IN_REPO" \]\]/);
  assert.match(wrapper, /exec bash "\$IN_REPO" dealdex --repo-root "\$ROOT"/);
  assert.match(wrapper, /dealdex --repo-root/);
  assert.doesNotMatch(wrapper, /--force-ship/);
  assert.doesNotMatch(wrapper, /R2FAW69NPD/);
  assert.doesNotMatch(wrapper, /me\.grok\.dealdex/);

  assert.match(prepare, /ASC_KEY_P8 or ASC_KEY_PATH required/);
  assert.doesNotMatch(prepare, /echo "\$ASC_KEY_P8"/);
  assert.doesNotMatch(prepare, /echo "\$IOS_DIST_P12/);
});

test("ship-gate coverage extractors accept any quote style (owner Oct 29 2026)", () => {
  const pushSample = [
    "on:",
    "  push:",
    "    branches: [main]",
    "    paths:",
    "      - 'single/**'",
    '      - "double/**"',
    "      - unquoted/**",
    "    paths-ignore:",
    "      - 'ignored/**'",
    "",
  ].join("\n");
  assert.deepEqual(extractPushPaths(pushSample), [
    "single/**",
    "double/**",
    "unquoted/**",
  ]);

  const gateSample = [
    "      - name: Scheduled ship gate (skip unless iOS code changed)",
    "        run: |",
    "          # One --path-prefix per on.push.paths entry",
    "          bash scripts/ios-scheduled-ship-gate.sh \\",
    "            --path-prefix 'single/**' \\",
    '            --path-prefix "double/**" \\',
    "            --path-prefix unquoted/** \\",
    "            dealdex",
    "      - name: Next step",
    "        run: echo --path-prefix 'elsewhere/**'",
    "",
  ].join("\n");
  assert.deepEqual(extractGatePrefixes(gateSample), [
    "single/**",
    "double/**",
    "unquoted/**",
  ]);
});

test("the ASC credential crosses a step boundary as the hosted base64 trio", () => {
  const yml = read(".github/workflows/ios-ship.yml");

  // The hosted trio is one line per value, so the runner's environment file
  // stays well formed and the raw PEM never enters GITHUB_ENV.
  assert.match(yml, /printf 'APPLE_API_%s=%s\\n' "\$\{name#ASC_\}" "\$val" >> "\$GITHUB_ENV"/);
  assert.match(yml, /printf 'APPLE_API_KEY_P8_BASE64=%s\\n' "\$key_b64" >> "\$GITHUB_ENV"/);
  // base64 output is folded at 76 columns by GNU base64, so the newlines go.
  assert.match(yml, /base64 \| tr -d '\\n'/);

  // The client never reads a key file, and the workflow never hands it one.
  assert.doesNotMatch(yml, /asc-key\.mjs/);

  const ship = read("scripts/ios-fleet/ship-testflight.sh");
  assert.match(ship, /ASC_KEY_PATH is not a credential source/);
  assert.doesNotMatch(ship, /asc-key\.mjs exec/);
  assert.doesNotMatch(ship, /asc-key\.mjs read/);
});

test("a rejected ASC key is reported masked, and no test reads an environment", () => {
  const client = read("scripts/ios-fleet/asc-api.mjs");
  assert.match(client, /function maskedPreview\(/);
  assert.match(client, /preview: \$\{maskedPreview\(/);

  const shell = read("scripts/ios-fleet/ship-testflight.sh");
  assert.match(shell, /key_preview\(\) \{/);

  // No test may read another process's environment:  on macOS `ps -E` prints
  // it and on Linux it sits in /proc/<pid>/environ, and either way the dump
  // carries the private key and every unrelated credential.
  for (const file of [
    "scripts/ios-fleet/test-asc-key.test.mjs",
    "scripts/ios-fleet/test-asc-credentials.sh",
    "scripts/ios-fleet/test-asc-credentials.mjs",
  ]) {
    const code = read(file)
      .split("\n")
      .filter((line) => !/^\s*\/\//.test(line))
      .join("\n");
    assert.doesNotMatch(code, /ps\s+-E/, `${file} reads another process's environment`);
    assert.doesNotMatch(code, /\/proc\/[^\s]*environ/, `${file} reads another process's environment`);
  }
});

test("vendored ios-fleet ships net.dealdex (fixed 0.1.0; next-patch scheme kept for non-fixed apps)", () => {
  const apps = JSON.parse(read("scripts/ios-fleet/apps.json"));
  const dealdex = apps.apps.dealdex;
  assert.equal(apps.teamId, "CC8UTF7ATG");
  assert.equal(dealdex.bundleId, "net.dealdex");
  assert.equal(dealdex.scheme, "DealDex");
  assert.equal(dealdex.appleId, 6804249232);
  assert.match(dealdex.marketingVersionDefault, /^1\.0\.\d+$/);
  assert.doesNotMatch(JSON.stringify(dealdex), /online\.dealdex/);
  assert.doesNotMatch(JSON.stringify(dealdex), /dealdex\.online/);
  assert.equal(dealdex.bundleId === "me.grok.dealdex", false);

  const ship = read("scripts/ios-fleet/ship-testflight.sh");
  // The version scheme (owner 2026-10-24, AFC-517 / CT-2444):  the marketing
  // version is the next patch on the train (App Store Connect is the only
  // record of which patches that train holds) and the build number is the
  // repo commit count, independent of it.  Assert the mechanism, not the old
  // 1.0.<commit_count> shape.
  assert.match(ship, /MARKETING_VERSION\s+= <prefix>\.<P\+1>/);
  assert.match(ship, /CURRENT_PROJECT_VERSION = the repo commit count/);
  assert.match(ship, /rev-list --count HEAD/);
  // The client answers the two questions the scheme asks App Store Connect.
  const asc = read("scripts/ios-fleet/asc-api.mjs");
  assert.match(asc, /method === "latest-marketing-patch"/);
  assert.match(asc, /method === "build-floor"/);
  assert.match(asc, /from "\.\/version-plan\.mjs"/);
  // The retired local-sequence paths must not come back:  they consumed a
  // number from a local cache and made the marketing version a function of
  // the build number.
  assert.doesNotMatch(ship, /resolve_seq_floor|next_build_seq|asc_latest_seq/);
  assert.doesNotMatch(ship, /local_seq\(\)\s*\{/);
  assert.match(
    ship,
    /<socratic\|congress\|usage\|usage-local\|dealdex/,
    "usage header must list dealdex",
  );
  // Positional APP_KEY is accepted then validated against apps.json (no closed case).
  assert.match(
    ship,
    /if \[\[ -z "\$APP_KEY" \]\]; then/,
    "positional APP_KEY assignment must exist",
  );
  assert.match(
    ship,
    /app key required \(e\.g\. socratic, congress, usage, usage-local, dealdex/,
  );
  assert.match(ship, /dealdex\) echo "dealdex"/);

  const publish = read("scripts/ios-fleet/publish-ios-versions.sh");
  assert.match(publish, /fetch_remote_json/);
  assert.match(publish, /refusing to publish an empty apps map/);
  assert.doesNotMatch(publish, /data = \{"schemaVersion": 1, "apps": \{\}\}/);
});

test("ship-testflight.sh --help lists dealdex and the case accepts it", () => {
  const script = join(ROOT, "scripts/ios-fleet/ship-testflight.sh");

  const help = spawnSync("bash", [script, "--help"], { encoding: "utf8" });
  assert.equal(help.status, 2);
  assert.match(help.stdout, /socratic\|congress\|usage\|usage-local\|dealdex/);
  assert.doesNotMatch(help.stderr, /unknown arg: dealdex/);

  const accepted = spawnSync("bash", [script, "dealdex", "--help"], {
    encoding: "utf8",
  });
  assert.equal(accepted.status, 2);
  assert.doesNotMatch(accepted.stderr, /unknown arg: dealdex/);
  assert.match(accepted.stdout, /socratic\|congress\|usage\|usage-local\|dealdex/);

  const rejected = spawnSync("bash", [script, "not-an-app"], {
    encoding: "utf8",
  });
  assert.notEqual(rejected.status, 0);
  assert.match(
    rejected.stderr,
    /unknown app key or incomplete registry: not-an-app|missing required command: xcodebuild/,
  );
});

test("ios-ship.yml is the auto-ship path: Fleet-OPS /asc, no standing overrides", () => {
  const yml = read(".github/workflows/ios-ship.yml");

  // A merge to main that touches the native tree ships, plus a manual run.
  assert.match(yml, /push:\s*\n\s+branches: \[main\]\s*\n\s+paths:\s*\n\s+- 'native\/ios\/\*\*'/);
  assert.match(yml, /workflow_dispatch:/);
  assert.match(yml, /schedule:/);
  // The scheduled catch-up is behind the path gate, never a blind cron.
  assert.match(yml, /scripts\/ios-scheduled-ship-gate\.sh/);
  assert.match(yml, /--event "\$\{\{ github\.event_name \}\}"/);

  // Ship through the fleet script with What to Test published.
  assert.match(yml, /IOS_TF_RELEASE_NOTES:\s*"1"/);
  assert.match(yml, /bash scripts\/ios-ship-testflight\.sh/);

  // The rate gate and same-HEAD skip stay at the script defaults.
  assert.doesNotMatch(yml, /IOS_TF_MIN_INTERVAL_SEC/);
  assert.doesNotMatch(yml, /--force-ship/);
  assert.doesNotMatch(yml, /IOS_SHIP_PRIORITY/);

  // ASC credentials come from Fleet-OPS /asc first; the project root is only a
  // warned fallback.
  assert.match(yml, /FLEET_ASC_PROJECT_ID="8dae6d03-8f12-48b2-adf3-e5c1b881c8c5"/);
  assert.match(yml, /FLEET_ASC_PATH="\/asc"/);
  assert.match(yml, /Fleet-OPS \/asc is not readable in full/);
  assert.match(yml, /key_material="\$\(asc_get ASC_KEY_P8 "\$ASC_SRC_PROJECT" "\$ASC_SRC_PATH"\)"/);

  // Beta Xcode or a beta host OS must fail the job before any archive.
  assert.match(yml, /Assert stable Xcode and a non-beta host OS/);
  assert.match(yml, /INVALID_BINARY/);

  // The Sentry Crons mapping keys on this exact name.
  assert.match(yml, /^name: iOS TestFlight ship \(GitHub-hosted macOS\)$/m);
});

test("fixed marketing version plans one shared merge-stamp build (owner Oct 29 2026)", () => {
  const ship = read("scripts/ios-fleet/ship-testflight.sh");
  const asc = read("scripts/ios-fleet/asc-api.mjs");
  const apps = JSON.parse(read("scripts/ios-fleet/apps.json"));

  // DealDex pins its marketing version; the build is the shared merge stamp.
  assert.equal(apps.apps.dealdex.fixedMarketingVersion, "0.1.0");

  // The dotted M.m.<n> fixed-mode build and the four-digit counter are both
  // retired, and fixed mode works on macOS (the build sits above every Mac
  // build).
  assert.doesNotMatch(ship, /next-dotted-build|asc_next_dotted_build/);
  assert.doesNotMatch(ship, /dotted build/);
  assert.doesNotMatch(asc, /next-dotted-build/);
  assert.doesNotMatch(ship, /fixedMarketingVersion is not supported on macOS/);
  assert.doesNotMatch(ship, /four-digit/);
  assert.doesNotMatch(asc, /four-digit/);
  assert.doesNotMatch(asc, /ignored \d+ .*timestamp/);
  assert.doesNotMatch(asc, /ignoredIos/);

  // Fixed mode plans build max(S, M + 1): S is the merge stamp from the exact
  // git command, M the max across iOS and macOS (optional macBundleId and
  // pairedBuildFeed join the same max).
  assert.match(ship, /asc_next_shared_build\(\) \{/);
  assert.match(ship, /macBundleId/);
  assert.match(ship, /pairedBuildFeed/);
  assert.match(ship, /plan-release-build/);
  assert.match(ship, /merge_stamp\(\) \{/);
  assert.match(
    ship,
    /TZ=America\/Chicago git show -s --format=%cd --date=format-local:%Y%m%d%H%M HEAD/,
  );
  assert.match(ship, /\[1-9\]\[0-9\]\{11\}/);
  assert.match(ship, /fixed mode requires a 12-digit merge-stamp build/);
  assert.match(ship, /cannot verify the build floor of/);
  assert.match(ship, /at or below the highest existing build/);
  assert.match(
    ship,
    /shared merge-stamp build \$\{BUILD_NUM\} for fixed version/,
  );
  assert.match(asc, /method === "plan-release-build"/);
  assert.match(asc, /method === "next-shared-build"/);
  assert.match(asc, /method === "platform-build-max"/);
  assert.match(asc, /from "\.\/shared-build\.mjs"/);

  // The paired feed joins the max under the 12-digit ceiling: https-only,
  // numeric, >= 1, at most 12 digits.  The old four-digit cap is gone.
  assert.match(ship, /https:\/\//);
  assert.match(ship, /at most 12 digits/);
  assert.doesNotMatch(ship, /\$\{#max\} > 4/);
});

test("ios-ship.yml plans the build once and hands it to the ship via --build", () => {
  const yml = read(".github/workflows/ios-ship.yml");

  // One upstream plan step per release, behind the same gate, feeding --build.
  assert.match(yml, /Plan release build \(once per release\)/);
  assert.match(yml, /id: plan-build/);
  assert.match(yml, /--plan-build-only/);
  assert.match(yml, /steps\.plan-build\.outputs\.build/);
  assert.match(yml, /bash scripts\/ios-ship-testflight\.sh --build "/);
  assert.match(
    yml,
    /id: plan-build\n {8}if: steps\.gate\.outputs\.should_ship == '1'/,
  );

  // Triggers, throttle, concurrency and runners are unchanged.
  assert.match(yml, /cron:\s*'22 \* \* \* \*'/);
  assert.match(yml, /group: ios-ship-dealdex/);
  assert.match(yml, /cancel-in-progress:\s*false/);
  assert.doesNotMatch(yml, /--force-ship/);
  assert.doesNotMatch(yml, /IOS_TF_MIN_INTERVAL_SEC/);
});

test("main carries an unsigned iOS build check (ci.yml calls ios-build.yml)", () => {
  const ci = read(".github/workflows/ci.yml");
  const build = read(".github/workflows/ios-build.yml");

  // ci.yml: push to main always builds; a PR only when the native tree changed.
  assert.match(ci, /\n {2}ios-changes:\n/);
  assert.match(ci, /\n {2}ios:\n\s+needs: ios-changes\n\s+if: needs\.ios-changes\.outputs\.native == 'true'\n\s+uses: \.\/\.github\/workflows\/ios-build\.yml/);
  assert.match(ci, /\^\(native\/ios\/\|\\\.github\/workflows\/ios-build\\\.yml\$\)/);
  assert.match(ci, /pull_request:/);
  assert.match(ci, /push:\s*\n\s+branches: \[main\]/);

  // ios-build.yml: reusable + manual, hosted macOS, unsigned, never uploads.
  assert.match(build, /^name: iOS build$/m);
  assert.match(build, /workflow_call:/);
  assert.match(build, /workflow_dispatch:/);
  assert.match(build, /runs-on:\s*macos-latest/);
  assert.doesNotMatch(build, /runs-on:\s*\[?self-hosted/);
  assert.match(build, /-project native\/ios\/DealDex\.xcodeproj/);
  assert.match(build, /-scheme DealDex/);
  assert.match(build, /-configuration Release/);
  assert.match(build, /CODE_SIGNING_ALLOWED=NO/);
  assert.match(build, /github\.event\.pull_request\.head\.repo\.full_name == github\.repository/);
  assert.match(build, /INVALID_BINARY/);
  // Comments may say "archive"; the executable lines must never sign or upload.
  const buildCode = build.replace(/^\s*#.*$/gm, "");
  assert.doesNotMatch(buildCode, /archive|exportArchive|altool|ASC_KEY|INFISICAL|secrets\./);
});
