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
    content="$(base64 < "${state}/remote.json" | tr -d '\n')"
    body="{\"sha\":\"remote-sha\",\"content\":\"${content}\"}"
    ;;
  "GET "*"/git/ref/heads/main")
    body='{"object":{"sha":"main-sha"}}'
    ;;
  "POST "*"/git/refs")
    status=201; body='{"ref":"refs/heads/stub"}'
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
    status=201; body='{"html_url":"https://github.example/pull/7","number":7}'
    ;;
  "GET "*"/pulls/7")
    body='{"node_id":"PR_node_7","number":7}'
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
# Stub gh: only `gh auth token` matters (the fallback credential).
if [[ "${1:-} ${2:-}" == "auth token" && -n "${STUB_GH_TOKEN:-}" ]]; then
  printf '%s\n' "$STUB_GH_TOKEN"
  exit 0
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
out_gh_cli="$(env -u IOS_VERSIONS_PUBLISH_TOKEN -u GH_TOKEN -u GITHUB_TOKEN \
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

echo "test-publish-ios-versions: all tests passed"
