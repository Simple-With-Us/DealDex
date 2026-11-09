#!/usr/bin/env bash
# Post-sync ensure-tf-ready recheck for hosted ios-ship.yml (OPS-1052).
# Read-only ASC polling; uses the same readiness labels as ship-testflight.sh.
set -euo pipefail

APP_KEY="${1:?app key (dealdex)}"
BUILD_NUM="${2:?12-digit CFBundleVersion (merge-stamp build)}"

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
FLEET_DIR="${ROOT}/scripts/ios-fleet"
# shellcheck source=scripts/ios-fleet/tf-ready-rc.sh
source "${FLEET_DIR}/tf-ready-rc.sh"

APPS_JSON_PATH="${APPS_JSON_PATH:-${FLEET_DIR}/apps.json}"
_APP_META_FILE="$(mktemp)"
set +e
python3 - "$APP_KEY" "$APPS_JSON_PATH" >"$_APP_META_FILE" 2>&1 <<'PY'
import json, sys

app_key, path = sys.argv[1], sys.argv[2]
try:
    with open(path, encoding="utf-8") as f:
        payload = json.load(f)
except (OSError, json.JSONDecodeError) as e:
    print(f"::error::recheck-tf-ready: cannot read apps config at {path}: {e}", file=sys.stderr)
    sys.exit(2)

apps = payload.get("apps")
if not isinstance(apps, dict):
    print(f"::error::recheck-tf-ready: missing apps object in {path}", file=sys.stderr)
    sys.exit(2)

app = apps.get(app_key)
if not isinstance(app, dict):
    print(f"::error::recheck-tf-ready: unknown app key {app_key!r} in {path}", file=sys.stderr)
    sys.exit(2)

bundle_id = app.get("bundleId")
apple_id = app.get("appleId")
if not bundle_id or apple_id in (None, ""):
    print(
        f"::error::recheck-tf-ready: app {app_key!r} missing bundleId or appleId in {path}",
        file=sys.stderr,
    )
    sys.exit(2)

marketing = app.get("fixedMarketingVersion") or app.get("marketingVersionDefault") or "1.0.0"
print(bundle_id)
print(marketing)
print(apple_id)
PY
_meta_rc=$?
set -e
if [[ $_meta_rc -ne 0 ]]; then
  cat "$_APP_META_FILE" >&2
  rm -f "$_APP_META_FILE"
  exit 2
fi
BUNDLE_ID=""
MARKETING=""
APPLE_ID=""
{
  IFS= read -r BUNDLE_ID
  IFS= read -r MARKETING
  IFS= read -r APPLE_ID
} < "$_APP_META_FILE"
rm -f "$_APP_META_FILE"
if [[ -z "$BUNDLE_ID" || -z "$MARKETING" || -z "$APPLE_ID" ]]; then
  echo "::error::recheck-tf-ready for ${APP_KEY}: apps metadata incomplete (expected bundleId, marketing, appleId)"
  exit 2
fi

[[ "$BUILD_NUM" =~ ^[1-9][0-9]{11}$ ]] || {
  echo "::error::recheck-tf-ready for ${APP_KEY}: build '${BUILD_NUM}' is not a 12-digit merge-stamp build"
  exit 1
}

LOG_DIR="${TMPDIR:-/tmp}/ios-tf-recheck-${APP_KEY}-$$"
mkdir -p "$LOG_DIR"
set +e
node "${FLEET_DIR}/asc-api.mjs" ensure-tf-ready "$BUNDLE_ID" "$BUILD_NUM" "$MARKETING" "$APPLE_ID" \
  >"${LOG_DIR}/ensure-tf-ready.json" 2>"${LOG_DIR}/ensure-tf-ready.err"
rc=$?
set -e

if [[ -s "${LOG_DIR}/ensure-tf-ready.err" ]]; then
  while IFS= read -r line; do log "tf-ready (post-sync): $line"; done <"${LOG_DIR}/ensure-tf-ready.err"
fi

handle_ensure_tf_ready_rc "$rc"
summary="$(tf_ready_rc_summary_label "$rc")"
log "post-sync readiness for ${APP_KEY} (${BUNDLE_ID} build ${BUILD_NUM}): rc=${rc} — ${summary}"

if [[ -n "${GITHUB_OUTPUT:-}" ]]; then
  {
    echo "tf_ready_rc=${rc}"
    echo "tf_ready_summary=${summary}"
    echo "tf_ready_bundle=${BUNDLE_ID}"
    echo "tf_ready_build=${BUILD_NUM}"
  } >>"$GITHUB_OUTPUT"
fi

exit 0
