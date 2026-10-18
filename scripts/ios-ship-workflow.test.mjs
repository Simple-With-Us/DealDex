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

test("ios-ship.yml targets dealdex / native/ios on GitHub-hosted macos-latest", () => {
  const yml = read(".github/workflows/ios-ship.yml");
  const wrapper = read("scripts/ios-ship-testflight.sh");
  const prepare = read("scripts/ios-appstore-gm-prepare.sh");

  assert.match(yml, /native\/ios\/\*\*/);
  assert.match(yml, /--path-prefix 'native\/ios\/'/);
  assert.match(yml, /scripts\/ios-fleet\/\*\*/);
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

test("vendored ios-fleet ships net.dealdex on the 1.0.N train", () => {
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
  assert.match(ship, /MARKETING_VERSION\s+= 1\.0\.<seq>/);
  assert.match(ship, /CURRENT_PROJECT_VERSION = <UTC YYYYMMDDHHMM>/);
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
