#!/usr/bin/env bash
# test-fixed-version.sh - Offline tests for the fixed-version merge-stamp build.
#
# Fixed mode (apps.json fixedMarketingVersion, e.g. dealdex 0.1.0) ships build
# max(S, M + 1), where S is the committer date of HEAD in America/Chicago as
# YYYYMMDDHHMM and M is the highest first numeric component across every build
# of the app and its paired app on both platforms.  These tests drive
# ship-testflight.sh with a stubbed App Store Connect client (IOS_FLEET_NODE)
# and a stubbed xcodebuild, against a throwaway git repo with a fixed
# GIT_COMMITTER_DATE, so every stamp is deterministic:  no network, no
# credentials, no xcodebuild, no App Store Connect.
#
# Usage: bash scripts/ios-fleet/test-fixed-version.sh
#
# ASCII-only (Apple bash 3.2 safe).
#
# shellcheck shell=bash

set -uo pipefail

FLEET_DIR="$(cd "$(dirname "$0")" && pwd)"
SHIP="${FLEET_DIR}/ship-testflight.sh"
[[ -f "$SHIP" ]] || { echo "missing $SHIP"; exit 1; }

TMP="$(mktemp -d "${TMPDIR:-/tmp}/fixed-version-test.XXXXXX")"
cleanup() { rm -rf "$TMP"; }
trap cleanup EXIT

REPO="${TMP}/repo"
STATE="${TMP}/state"
STUBS="${TMP}/stubs"
mkdir -p "$REPO" "$STATE" "$STUBS"

# Chicago is on daylight time (-05:00) on 2026-10-29, so this commit stamps as
# 202610290930 whatever the system timezone is.
STAMP="202610290930"

git -C "$REPO" init --quiet -b main
git -C "$REPO" config user.email "test@example.invalid"
git -C "$REPO" config user.name "fixed-version test"
printf 'dealdex\n' >"${REPO}/app.txt"
git -C "$REPO" add -A
GIT_AUTHOR_DATE="2026-10-29T09:30:00-05:00" GIT_COMMITTER_DATE="2026-10-29T09:30:00-05:00" \
  git -C "$REPO" commit --quiet -m "fixed-version test commit"

# need_cmd xcodebuild only checks PATH presence; the fixed-version paths under
# test never execute it.
printf '#!/usr/bin/env bash\necho "Xcode 26.3 (stub)"\nexit 0\n' >"${STUBS}/xcodebuild"
chmod +x "${STUBS}/xcodebuild"

# Stub App Store Connect client.  Invoked as: stub <asc-api.mjs> <command> [...].
# Released store version is empty (no released version); the planned build and
# the this-platform max come from the environment.  When STUB_EXPECT_STAMP is
# set, a plan call must carry exactly that --merge-stamp; when STUB_REFUSE_PLAN
# is 1, a plan call fails (proving the --build path never reads the full
# inventory, paired platform included).
cat >"${STUBS}/stub-asc-node" <<'STUB'
#!/usr/bin/env bash
set -uo pipefail
cmd="${2:-}"
stamp_arg() {
  local prev=""
  for arg in "$@"; do
    if [[ "$prev" == "--merge-stamp" ]]; then printf '%s' "$arg"; return 0; fi
    prev="$arg"
  done
  return 1
}
case "$cmd" in
  released-store-version)
    printf ''
    exit 0
    ;;
  platform-build-max)
    printf '%s' "${STUB_THIS_MAX:-0}"
    exit "${STUB_MAX_RC:-0}"
    ;;
  plan-release-build|next-shared-build)
    if [[ "${STUB_REFUSE_PLAN:-0}" == "1" ]]; then
      echo "stub: plan command must not be called on this path" >&2
      exit 3
    fi
    if [[ -n "${STUB_EXPECT_STAMP:-}" ]]; then
      got="$(stamp_arg "$@")" || got=""
      if [[ "$got" != "$STUB_EXPECT_STAMP" ]]; then
        echo "stub: --merge-stamp ${got:-<missing>} is not ${STUB_EXPECT_STAMP}" >&2
        exit 3
      fi
    fi
    printf '%s' "${STUB_PLANNED_BUILD:-202610290930}"
    exit 0
    ;;
  *)
    echo "stub: unexpected command ${cmd:-<missing>}" >&2
    exit 3
    ;;
esac
STUB
chmod +x "${STUBS}/stub-asc-node"

PASS=0
FAIL=0
check() {
  # check <name> <expected_rc> <actual_rc> [output] [must_match]
  local name="$1" want="$2" got="$3" out="${4:-}" match="${5:-}"
  if [[ "$got" != "$want" ]]; then
    echo "FAIL: ${name}: want rc=${want}, got rc=${got}"
    printf '%s\n' "$out" | head -n 20
    FAIL=$((FAIL + 1))
    return 0
  fi
  if [[ -n "$match" ]] && ! printf '%s' "$out" | grep -q -F "$match"; then
    echo "FAIL: ${name}: output lacks <${match}>"
    printf '%s\n' "$out" | head -n 20
    FAIL=$((FAIL + 1))
    return 0
  fi
  echo "ok: ${name}"
  PASS=$((PASS + 1))
}

ship_env() {
  env -i PATH="${STUBS}:/usr/bin:/bin:/usr/sbin:/sbin" HOME="$HOME" TMPDIR="${TMPDIR:-/tmp}" \
    IOS_FLEET_NODE="${STUBS}/stub-asc-node" IOS_FLEET_STATE_DIR="$STATE" \
    FLEET_SECRETS="${TMP}/no-fleet-secrets" \
    STUB_THIS_MAX="${STUB_THIS_MAX:-0}" STUB_MAX_RC="${STUB_MAX_RC:-0}" \
    STUB_PLANNED_BUILD="${STUB_PLANNED_BUILD:-202610290930}" \
    STUB_EXPECT_STAMP="${STUB_EXPECT_STAMP:-}" STUB_REFUSE_PLAN="${STUB_REFUSE_PLAN:-0}" \
    "$@"
}

# 1. The exact merge-stamp command stamps the fixed commit deterministically.
got_stamp="$(cd "$REPO" && TZ=America/Chicago git show -s --format=%cd --date=format-local:%Y%m%d%H%M HEAD 2>/dev/null)"
if [[ "$got_stamp" == "$STAMP" ]]; then
  echo "ok: exact git command stamps the fixed commit as ${STAMP}"
  PASS=$((PASS + 1))
else
  echo "FAIL: exact git command stamped <${got_stamp}>, want <${STAMP}>"
  FAIL=$((FAIL + 1))
fi

# 2. --plan-build-only prints the planned build and carries the exact stamp.
STUB_EXPECT_STAMP="$STAMP" STUB_PLANNED_BUILD="$STAMP"
out="$(ship_env bash "$SHIP" dealdex --repo-root "$REPO" --plan-build-only 2>&1)"
rc=$?
check "plan-build-only prints the planned build" 0 "$rc" "$out" "$STAMP"
if [[ "$(printf '%s' "$out" | tail -n 1)" != "$STAMP" ]]; then
  echo "FAIL: plan-build-only stdout is not exactly the build"
  FAIL=$((FAIL + 1))
fi

# 3. Fixed mode without --build plans max(S, M + 1) through the same command.
out="$(ship_env bash "$SHIP" dealdex --repo-root "$REPO" --dry-run 2>&1)"
rc=$?
check "fixed dry-run without --build plans the merge-stamp build" 0 "$rc" "$out" \
  "build: shared merge-stamp build ${STAMP} for fixed version 0.1.0"

# 4. --build is accepted when it exceeds THIS platform's max, even when it
# equals the paired platform's existing build.  The stub refuses any plan
# call, proving the paired inventory is never consulted on this path.
STUB_THIS_MAX="202610290930" STUB_REFUSE_PLAN=1
out="$(ship_env bash "$SHIP" dealdex --repo-root "$REPO" --dry-run --build 202610291200 2>&1)"
rc=$?
check "build above this-platform max is accepted (paired may reuse it)" 0 "$rc" "$out" \
  "marketing=0.1.0 build=202610291200"

# 5. --build at or below THIS platform's max is rejected.
out="$(ship_env bash "$SHIP" dealdex --repo-root "$REPO" --dry-run --build 202610290930 2>&1)"
rc=$?
check "build equal to this-platform max is rejected" 1 "$rc" "$out" \
  "at or below the highest existing build 202610290930"
out="$(ship_env bash "$SHIP" dealdex --repo-root "$REPO" --dry-run --build 202610180127 2>&1)"
rc=$?
check "build below this-platform max is rejected" 1 "$rc" "$out" "at or below"

# 6. --build must be a 12-digit merge stamp.
STUB_REFUSE_PLAN=0
out="$(ship_env bash "$SHIP" dealdex --repo-root "$REPO" --dry-run --build 1234 2>&1)"
rc=$?
check "short build is rejected" 1 "$rc" "$out" "12-digit merge-stamp build"
out="$(ship_env bash "$SHIP" dealdex --repo-root "$REPO" --dry-run --build 099912312359 2>&1)"
rc=$?
check "leading-zero build is rejected" 1 "$rc" "$out" "12-digit merge-stamp build"

# 7. An unreadable platform max fails closed.
STUB_MAX_RC=2
out="$(ship_env bash "$SHIP" dealdex --repo-root "$REPO" --dry-run --build 202610291200 2>&1)"
rc=$?
check "unreadable this-platform max fails closed" 1 "$rc" "$out" "cannot verify the build floor"
STUB_MAX_RC=0

# 8. An unreadable merge stamp fails closed.
mkdir -p "${TMP}/not-a-repo"
out="$(ship_env bash "$SHIP" dealdex --repo-root "${TMP}/not-a-repo" --plan-build-only 2>&1)"
rc=$?
check "plan without a readable HEAD fails closed" 1 "$rc" "$out" "unreadable merge stamp"

echo "pass=${PASS} fail=${FAIL}"
[[ "$FAIL" -eq 0 ]]
