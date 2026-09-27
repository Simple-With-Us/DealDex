import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
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
  assert.match(yml, /cron:\s*'22,52 \* \* \* \*'/);
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
  assert.equal(dealdex.appleId, 6802474288);
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
