#!/usr/bin/env bash
# Tests for publish-ios-versions.sh (port CC-202) with a stubbed GitHub API.
# Run: bash scripts/ios-fleet/test-publish-ios-versions.sh
# No network: curl and gh are stubs in a temp bin dir.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
SCRIPT_SRC="${ROOT}/scripts/ios-fleet/publish-ios-versions.sh"
TMP="$(mktemp -d "${TMPDIR:-/tmp}/test-publish-ios.XXXXXX")"
trap 'rm -rf "$TMP"' EXIT

mkdir -p "${TMP}/fleet" "${TMP}/bin" "${TMP}/state"
cp "$SCRIPT_SRC" "${TMP}/fleet/publish-ios-versions.sh"

# Fixture remote manifest: siblings that must survive, plus the old row.
python3 - "${TMP}/state/remote.json" <<'PY'
import json, sys
data = {"schemaVersion": 1, "updatedAt": "2026-08-24T07:44:52Z",
        "apps": {
          "trade.socratic.app": {"marketingVersion": "1.0.68", "appleId": 6799238379, "displayName": "Socratic.Trade"},
          "trade.congress.ios": {"marketingVersion": "1.0.80", "appleId": 6798076688, "displayName": "Congress.Trade"},
          "net.dealdex": {"marketingVersion": "1.0.2", "build": "202608230250", "appleId": 6804249232, "displayName": "DealDex"},
        }}
open(sys.argv[1], "w").write(json.dumps(data))
PY

cat > "${TMP}/bin/curl" <<'STUB'
#!/usr/bin/env bash
# Stub curl: understands -o FILE -w FMT -X METHOD --data @FILE URL and -K FILE.
out=""; method="GET"; data=""; url=""
while [[ $# -gt 0 ]]; do
  case "$1" in
    -o) out="$2"; shift 2 ;;
    -w) shift 2 ;;
    -X) method="$2"; shift 2 ;;
    --data) data="$2"; shift 2 ;;
    -K|-H) shift 2 ;;
    -sS) shift ;;
    *) url="$1"; shift ;;
  esac
done
state="${STUB_STATE_DIR:?}"
printf '%s %s\n' "$method" "$url" >> "${state}/calls.log"
if [[ -n "$data" && "$data" == @* ]]; then
  cp "${data#@}" "${state}/last-${method}.json" 2>/dev/null || true
fi
body='{}'; status=200
case "$method $url" in
  "GET "*"/contents/"*"?ref=main")
    if [[ "${STUB_EMPTY_CONTENT:-}" == "1" ]]; then
      body='{"sha":"remote-sha","content":""}'
    else
      content="$(base64 < "${state}/remote.json" | tr -d '\n')"
      body="{\"sha\":\"remote-sha\",\"content\":\"${content}\"}"
    fi
    ;;
  "GET "*"/git/ref/heads/main")
    if [[ "${STUB_NONJSON_REF:-}" == "1" ]]; then
      body='<html>not json</html>'
    else
      body='{"object":{"sha":"main-sha"}}'
    fi
    ;;
  "POST "*"/git/refs")
    if [[ "${STUB_BRANCH_EXISTS:-}" == "1" ]]; then
      status=422; body='{"message":"Reference already exists"}'
    else
      status=201; body='{"ref":"refs/heads/stub"}'
    fi
    ;;
  "GET "*"/git/ref/heads/ios-versions/"*)
    body='{"object":{"sha":"stale-sha"}}'
    ;;
  "PATCH "*"/git/refs/heads/ios-versions/"*)
    body='{"ref":"refs/heads/stub","object":{"sha":"main-sha"}}'
    ;;
  "GET "*"/contents/"*"?ref=ios-versions/"*)
    status=404; body='{"message":"Not Found"}'
    ;;
  "PUT "*"/contents/"*)
    if [[ "${STUB_FAIL_PUT:-}" == "1" ]]; then
      status=403; body='{"message":"Resource not accessible by integration"}'
    else
      status=201; body='{"content":{"sha":"new-sha"}}'
      cp "${state}/last-PUT.json" "${state}/put.json" 2>/dev/null || true
    fi
    ;;
  "POST "*"/pulls")
    if [[ "${STUB_PR_422_NO_PR:-}" == "1" || "${STUB_PR_422_WITH_PR:-}" == "1" ]]; then
      status=422; body='{"message":"Validation Failed: original-422-cause"}'
    else
      status=201; body='{"html_url":"https://github.example/pull/7","number":7}'
    fi
    ;;
  "GET "*"/pulls?state=open"*)
    if [[ "${STUB_PR_422_WITH_PR:-}" == "1" ]]; then
      body='[{"html_url":"https://github.example/pull/9","number":9}]'
    else
      body='[]'
    fi
    ;;
  "GET "*"/pulls/7")
    body='{"node_id":"PR_node_7","number":7}'
    ;;
  "GET "*"/pulls/9")
    body='{"node_id":"PR_node_9","number":9}'
    ;;
  "POST "*"/graphql")
    body='{"data":{}}'
    ;;
  *)
    status=500; body='{"message":"unstubbed call"}'
    ;;
esac
printf '%s' "$body" > "$out"
printf '%s' "$status"
STUB
chmod +x "${TMP}/bin/curl"

cat > "${TMP}/bin/gh" <<'STUB'
#!/usr/bin/env bash
# Stub gh: only `gh auth token` matters (the fallback credential).  With
# STUB_GH_MIMIC_ENV=1 it echoes an inherited job token like the real gh.
if [[ -n "${STUB_STATE_DIR:-}" ]]; then
  printf 'gh %s GH_TOKEN=%s GITHUB_TOKEN=%s\n' "$*" "${GH_TOKEN:-<unset>}" "${GITHUB_TOKEN:-<unset>}" >> "${STUB_STATE_DIR}/gh.log"
fi
if [[ "${1:-} ${2:-}" == "auth token" ]]; then
  if [[ "${STUB_GH_MIMIC_ENV:-}" == "1" ]]; then
    if [[ -n "${GH_TOKEN:-}" ]]; then printf '%s\n' "$GH_TOKEN"; exit 0; fi
    if [[ -n "${GITHUB_TOKEN:-}" ]]; then printf '%s\n' "$GITHUB_TOKEN"; exit 0; fi
  fi
  if [[ -n "${STUB_GH_TOKEN:-}" ]]; then printf '%s\n' "$STUB_GH_TOKEN"; exit 0; fi
fi
exit 1
STUB
chmod +x "${TMP}/bin/gh"

run_publish() {
  STUB_STATE_DIR="${TMP}/state" PATH="${TMP}/bin:/usr/bin:/bin" \
  IOS_VERSIONS_API_BASE="https://api.github.example" \
  IOS_VERSIONS_PUBLISH_TOKEN="stub-token-for-tests" \
    bash "${TMP}/fleet/publish-ios-versions.sh" \
      --bundle-id net.dealdex --version 1.0.3 \
      --build 202608242345 --apple-id 6804249232 --display-name "DealDex"
}

# Happy path: branch + PR, other apps preserved, row written.
out="$(run_publish 2>"${TMP}/happy.err")"
grep -q "remote-manifest-pr-opened" <<<"$out"
grep -q "PR #7" <<<"$out"
if grep -q "stub-token-for-tests" <<<"$out" "${TMP}/happy.err"; then
  echo "FAIL: token printed" >&2; exit 1
fi
python3 - "${TMP}/state/put.json" <<'PY'
import base64, json, sys
put = json.load(open(sys.argv[1]))
assert put["branch"].startswith("ios-versions/"), put["branch"]
assert put["branch"] == "ios-versions/net.dealdex-1.0.3-202608242345", put["branch"]
assert put["branch"] != "main"
merged = json.loads(base64.b64decode(put["content"]))
row = merged["apps"]["net.dealdex"]
assert row == {"marketingVersion": "1.0.3", "build": "202608242345", "appleId": 6804249232, "displayName": "DealDex"}, row
assert merged["apps"]["trade.socratic.app"]["marketingVersion"] == "1.0.68", "other app row must survive"
assert merged["apps"]["trade.congress.ios"]["marketingVersion"] == "1.0.80", "other app row must survive"
PY
if grep -q "PUT .*contents.*ref=main" "${TMP}/state/calls.log"; then
  echo "FAIL: publisher PUT to main" >&2; exit 1
fi

# GH_TOKEN fallback: the same publish succeeds with only GH_TOKEN set.
: > "${TMP}/state/calls.log"
out_gh="$(env -u IOS_VERSIONS_PUBLISH_TOKEN -u GITHUB_TOKEN \
  STUB_STATE_DIR="${TMP}/state" PATH="${TMP}/bin:/usr/bin:/bin" \
  IOS_VERSIONS_API_BASE="https://api.github.example" \
  GH_TOKEN="stub-token-for-tests" \
  bash "${TMP}/fleet/publish-ios-versions.sh" \
    --bundle-id net.dealdex --version 1.0.3 \
    --build 202608242345 --apple-id 6804249232 --display-name "DealDex" 2>"${TMP}/ghtoken.err")"
grep -q "remote-manifest-pr-opened" <<<"$out_gh"

# gh auth token fallback: no env token, the stub gh supplies one.
: > "${TMP}/state/calls.log"
out_gh_cli="$(env -u IOS_VERSIONS_PUBLISH_TOKEN -u GH_TOKEN -u GITHUB_TOKEN -u GITHUB_ACTIONS \
  STUB_STATE_DIR="${TMP}/state" STUB_GH_TOKEN="stub-token-for-tests" \
  PATH="${TMP}/bin:/usr/bin:/bin" HOME="${TMP}" \
  IOS_VERSIONS_API_BASE="https://api.github.example" \
  bash "${TMP}/fleet/publish-ios-versions.sh" \
    --bundle-id net.dealdex --version 1.0.3 \
    --build 202608242345 --apple-id 6804249232 --display-name "DealDex" 2>"${TMP}/ghcli.err")"
grep -q "remote-manifest-pr-opened" <<<"$out_gh_cli"

# A refused write names its HTTP status and fails (the ship stays non-fatal
# because ship-testflight.sh only warns on this exit).
: > "${TMP}/state/calls.log"
if STUB_FAIL_PUT=1 run_publish >"${TMP}/fail.out" 2>"${TMP}/fail.err"; then
  echo "FAIL: a 403 PUT must make the publisher exit non-zero" >&2; exit 1
fi
grep -q "HTTP 403" "${TMP}/fail.err"
grep -q "Resource not accessible" "${TMP}/fail.err"

# No credential: the cause is printed, including why the ship token cannot work.
if env -u IOS_VERSIONS_PUBLISH_TOKEN -u GH_TOKEN -u GITHUB_TOKEN \
    PATH="${TMP}/bin:/usr/bin:/bin" HOME="${TMP}" bash "${TMP}/fleet/publish-ios-versions.sh" \
    --bundle-id net.dealdex --version 1.0.3 >"${TMP}/notoken.out" 2>"${TMP}/notoken.err"; then
  echo "FAIL: no-credential publish must exit non-zero so the ship log warns" >&2; exit 1
fi
grep -q "no IOS_VERSIONS_PUBLISH_TOKEN" "${TMP}/notoken.err"
grep -q "contents:read" "${TMP}/notoken.err"

# No credential and no local cache (the original ship-log bug): the token
# cause is named instead of only the generic empty-map refusal.
mkdir -p "${TMP}/fleet-fresh"
cp "$SCRIPT_SRC" "${TMP}/fleet-fresh/publish-ios-versions.sh"
if env -u IOS_VERSIONS_PUBLISH_TOKEN -u GH_TOKEN -u GITHUB_TOKEN \
    PATH="${TMP}/bin:/usr/bin:/bin" HOME="${TMP}" bash "${TMP}/fleet-fresh/publish-ios-versions.sh" \
    --bundle-id net.dealdex --version 1.0.3 >"${TMP}/fresh.out" 2>"${TMP}/fresh.err"; then
  echo "FAIL: fresh no-credential publish must exit non-zero" >&2; exit 1
fi
grep -q "no IOS_VERSIONS_PUBLISH_TOKEN" "${TMP}/fresh.err"
grep -q "refusing to publish an empty apps map" "${TMP}/fresh.err"

# Offline merge still works: --skip-push with an explicit base needs no token.
python3 - "${TMP}/state/remote.json" "${TMP}/base.json" <<'PY'
import shutil, sys
shutil.copyfile(sys.argv[1], sys.argv[2])
PY
env -u IOS_VERSIONS_PUBLISH_TOKEN -u GH_TOKEN -u GITHUB_TOKEN \
  PATH="${TMP}/bin:/usr/bin:/bin" HOME="${TMP}" bash "${TMP}/fleet-fresh/publish-ios-versions.sh" \
  --bundle-id net.dealdex --version 1.0.3 --build 202608242345 \
  --apple-id 6804249232 --display-name "DealDex" \
  --base-json "${TMP}/base.json" --out-json "${TMP}/out.json" \
  --skip-push --skip-local-write >"${TMP}/skip.out" 2>"${TMP}/skip.err"
grep -q "skip-push net.dealdex 1.0.3" "${TMP}/skip.out"

# A non-numeric apple id is a named failure, not a bare traceback.
if bash "${TMP}/fleet/publish-ios-versions.sh" --bundle-id net.dealdex \
    --version 1.0.3 --apple-id notanumber >"${TMP}/badid.out" 2>"${TMP}/badid.err"; then
  echo "FAIL: a non-numeric --apple-id must exit non-zero" >&2; exit 1
fi
grep -q "remote-manifest-publish-failed: --apple-id must be a number" "${TMP}/badid.err"
if grep -q Traceback "${TMP}/badid.err"; then echo "FAIL: traceback leaked" >&2; exit 1; fi

# Finding 1: a different build gets a different branch.  A run without a
# build falls back to a timestamped branch.
: > "${TMP}/state/calls.log"
STUB_STATE_DIR="${TMP}/state" PATH="${TMP}/bin:/usr/bin:/bin" \
IOS_VERSIONS_API_BASE="https://api.github.example" \
IOS_VERSIONS_PUBLISH_TOKEN="stub-token-for-tests" \
  bash "${TMP}/fleet/publish-ios-versions.sh" \
    --bundle-id net.dealdex --version 1.0.3 \
    --build 202601010101 --apple-id 6804249232 --display-name "DealDex" \
    >"${TMP}/branch-build.out" 2>"${TMP}/branch-build.err"
grep -q "remote-manifest-pr-opened" "${TMP}/branch-build.out"
python3 - "${TMP}/state/put.json" <<'PY'
import json, sys
put = json.load(open(sys.argv[1]))
assert put["branch"] == "ios-versions/net.dealdex-1.0.3-202601010101", put["branch"]
PY

: > "${TMP}/state/calls.log"
STUB_STATE_DIR="${TMP}/state" PATH="${TMP}/bin:/usr/bin:/bin" \
IOS_VERSIONS_API_BASE="https://api.github.example" \
IOS_VERSIONS_PUBLISH_TOKEN="stub-token-for-tests" \
  bash "${TMP}/fleet/publish-ios-versions.sh" \
    --bundle-id net.dealdex --version 1.0.3 \
    --apple-id 6804249232 --display-name "DealDex" \
    >"${TMP}/branch-nobuild.out" 2>"${TMP}/branch-nobuild.err"
grep -q "remote-manifest-pr-opened" "${TMP}/branch-nobuild.out"
python3 - "${TMP}/state/put.json" <<'PY'
import json, re, sys
put = json.load(open(sys.argv[1]))
assert re.fullmatch(r"ios-versions/net\.dealdex-1\.0\.3-\d{14}", put["branch"]), put["branch"]
PY

# Finding 1: an existing branch is reset onto the fresh main sha.  Stale
# commits from an earlier build must not linger on the branch.
: > "${TMP}/state/calls.log"
rm -f "${TMP}/state/last-PATCH.json"
STUB_BRANCH_EXISTS=1 run_publish >"${TMP}/branchexists.out" 2>"${TMP}/branchexists.err"
grep -q "remote-manifest-pr-opened" "${TMP}/branchexists.out"
grep -q "PATCH .*git/refs/heads/ios-versions/net.dealdex-1.0.3-202608242345" "${TMP}/state/calls.log"
python3 - "${TMP}/state/last-PATCH.json" <<'PY'
import json, sys
payload = json.load(open(sys.argv[1]))
assert payload == {"sha": "main-sha", "force": True}, payload
PY

# Finding 2: a POST 422 with no open pull request reports the original 422.
# The fallback GET must not hide it behind its own HTTP 200.
: > "${TMP}/state/calls.log"
if STUB_PR_422_NO_PR=1 run_publish >"${TMP}/pr422.out" 2>"${TMP}/pr422.err"; then
  echo "FAIL: POST 422 with no open PR must exit non-zero" >&2; exit 1
fi
grep -q "HTTP 422" "${TMP}/pr422.err"
grep -q "original-422-cause" "${TMP}/pr422.err"
if grep -q "HTTP 200" "${TMP}/pr422.err"; then
  echo "FAIL: fallback GET status hid the original 422" >&2; exit 1
fi

# Finding 2: a POST 422 with an open pull request still reuses it.
: > "${TMP}/state/calls.log"
STUB_PR_422_WITH_PR=1 run_publish >"${TMP}/pr422reuse.out" 2>"${TMP}/pr422reuse.err"
grep -q "remote-manifest-pr-opened" "${TMP}/pr422reuse.out"
grep -q "PR #9" "${TMP}/pr422reuse.out"

# Finding 3: an empty content field is a failed fetch.  The clean refusal
# runs instead of a later json.load crash on the empty file.
mkdir -p "${TMP}/fleet-empty"
cp "$SCRIPT_SRC" "${TMP}/fleet-empty/publish-ios-versions.sh"
if STUB_STATE_DIR="${TMP}/state" STUB_EMPTY_CONTENT=1 PATH="${TMP}/bin:/usr/bin:/bin" \
  IOS_VERSIONS_API_BASE="https://api.github.example" \
  IOS_VERSIONS_PUBLISH_TOKEN="stub-token-for-tests" \
  bash "${TMP}/fleet-empty/publish-ios-versions.sh" \
    --bundle-id net.dealdex --version 1.0.3 --build 202608242345 \
    >"${TMP}/empty.out" 2>"${TMP}/empty.err"; then
  echo "FAIL: empty remote content must exit non-zero" >&2; exit 1
fi
grep -q "refusing to publish an empty apps map" "${TMP}/empty.err"
if grep -q Traceback "${TMP}/empty.err"; then echo "FAIL: traceback leaked" >&2; exit 1; fi

# Finding 4: in CI the gh fallback is skipped entirely.  The read-only job
# token cannot bypass the empty-token skip through gh.
: > "${TMP}/state/gh.log"
mkdir -p "${TMP}/fleet-ci"
cp "$SCRIPT_SRC" "${TMP}/fleet-ci/publish-ios-versions.sh"
if env -u IOS_VERSIONS_PUBLISH_TOKEN -u GH_TOKEN \
  STUB_STATE_DIR="${TMP}/state" STUB_GH_TOKEN="stub-token-for-tests" \
  PATH="${TMP}/bin:/usr/bin:/bin" HOME="${TMP}" \
  GITHUB_ACTIONS=true GITHUB_TOKEN="readonly-job-token" \
  IOS_VERSIONS_API_BASE="https://api.github.example" \
  bash "${TMP}/fleet-ci/publish-ios-versions.sh" \
    --bundle-id net.dealdex --version 1.0.3 --build 202608242345 \
    >"${TMP}/ci.out" 2>"${TMP}/ci.err"; then
  echo "FAIL: CI run without a publish token must exit non-zero" >&2; exit 1
fi
grep -q "no IOS_VERSIONS_PUBLISH_TOKEN" "${TMP}/ci.err"
if [[ -s "${TMP}/state/gh.log" ]]; then
  echo "FAIL: gh fallback must be skipped when GITHUB_ACTIONS=true" >&2; exit 1
fi

# Finding 4: a local gh fallback never sees the job token.  Both token
# variables are stripped from its environment.
: > "${TMP}/state/gh.log"
: > "${TMP}/state/calls.log"
out_local="$(env -u IOS_VERSIONS_PUBLISH_TOKEN -u GH_TOKEN -u GITHUB_ACTIONS \
  STUB_STATE_DIR="${TMP}/state" STUB_GH_TOKEN="stored-token-for-tests" \
  STUB_GH_MIMIC_ENV=1 \
  PATH="${TMP}/bin:/usr/bin:/bin" HOME="${TMP}" \
  GITHUB_TOKEN="readonly-job-token" \
  IOS_VERSIONS_API_BASE="https://api.github.example" \
  bash "${TMP}/fleet/publish-ios-versions.sh" \
    --bundle-id net.dealdex --version 1.0.3 \
    --build 202608242345 --apple-id 6804249232 --display-name "DealDex" 2>"${TMP}/localgh.err")"
grep -q "remote-manifest-pr-opened" <<<"$out_local"
grep -q "GH_TOKEN=<unset> GITHUB_TOKEN=<unset>" "${TMP}/state/gh.log"
if grep -q "readonly-job-token" "${TMP}/state/gh.log"; then
  echo "FAIL: gh saw the job token" >&2; exit 1
fi

# Finding 5: a non-JSON API body fails cleanly without a traceback.  The
# existing empty-sha guard reports the failure.
: > "${TMP}/state/calls.log"
if STUB_NONJSON_REF=1 run_publish >"${TMP}/nonjson.out" 2>"${TMP}/nonjson.err"; then
  echo "FAIL: a non-JSON main ref body must exit non-zero" >&2; exit 1
fi
grep -q "returned no sha" "${TMP}/nonjson.err"
if grep -q Traceback "${TMP}/nonjson.err"; then echo "FAIL: traceback leaked" >&2; exit 1; fi

echo "test-publish-ios-versions: all tests passed"
