#!/usr/bin/env bash
# test-ios-scheduled-ship-gate.sh - Offline tests for ios-scheduled-ship-gate.sh.
#
# The gate is the only thing standing between a half-hourly cron and a
# TestFlight build for every web-only commit. It runs exclusively on the owned
# Mac runner, so without these tests a defect in it is invisible until either
# testers get spammed or an iOS change silently never ships. Everything here is
# a throwaway git repo in a scratch dir: no network, no credentials, no
# xcodebuild, no App Store Connect.
#
# Usage: bash scripts/test-ios-scheduled-ship-gate.sh
#
# ASCII-only (Apple bash 3.2 safe).

set -uo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
GATE="${SCRIPT_DIR}/ios-scheduled-ship-gate.sh"
[[ -f "$GATE" ]] || { echo "missing $GATE"; exit 1; }

TMP="$(mktemp -d "${TMPDIR:-/tmp}/ship-gate-test.XXXXXX")"
cleanup() { rm -rf "$TMP"; }
trap cleanup EXIT

REPO="${TMP}/repo"
STATE="${TMP}/state"
mkdir -p "$REPO" "$STATE"

git -C "$REPO" init --quiet -b main
git -C "$REPO" config user.email "test@example.invalid"
git -C "$REPO" config user.name "gate test"

commit() {
  # commit <path> <content> <message>
  mkdir -p "$(dirname "${REPO}/$1")"
  printf '%s\n' "$2" >"${REPO}/$1"
  git -C "$REPO" add -A
  git -C "$REPO" commit --quiet -m "$3"
  git -C "$REPO" rev-parse HEAD
}

PASS=0
FAIL=0
check() {
  # check <label> <expected> <actual>
  if [[ "$2" == "$3" ]]; then
    echo "  ok  : $1 (=$3)"
    PASS=$((PASS + 1))
  else
    echo "  FAIL: $1 (expected '$2', got '$3')"
    FAIL=$((FAIL + 1))
  fi
}

run_gate() {
  # run_gate <event> [apps...] -> prints "key=value" lines. The pattern set
  # mirrors .github/workflows/ios-ship.yml on.push.paths exactly: the gate
  # must see what a push would have shipped (owner Oct 29 2026).
  local event="$1"; shift
  bash "$GATE" \
    --event "$event" \
    --path-prefix "native/ios/**" \
    --path-prefix ".github/workflows/ios-ship.yml" \
    --path-prefix "scripts/ios-fleet/**" \
    --path-prefix "scripts/ios-ship-testflight.sh" \
    --path-prefix "scripts/ios-appstore-gm-prepare.sh" \
    --path-prefix "scripts/ios-stage-asc-key.sh" \
    --repo-root "$REPO" \
    --state-dir "$STATE" \
    "$@" 2>&1
}

field() {
  # field <output> <key>
  printf '%s\n' "$1" | awk -F= -v k="$2" '$1 == k {print $2}' | tail -1
}

set_state() {
  # set_state <app> <sha>
  printf '%s %s\n' "$(date +%s)" "$2" >"${STATE}/last-ship-$1.txt"
}

echo "== syntax =="
bash -n "$GATE" && echo "  ok  : ios-scheduled-ship-gate.sh parses"

echo "== fixture =="
BASE="$(commit README.md base "base")"
echo "  base commit ${BASE:0:10}"

echo "== 1. push/dispatch events bypass the gate entirely =="
out="$(run_gate push dealdex)"
check "push -> should_ship" 1 "$(field "$out" should_ship)"
out="$(run_gate workflow_dispatch dealdex)"
check "workflow_dispatch -> should_ship" 1 "$(field "$out" should_ship)"

echo "== 2. scheduled tick with no ship history defers to the ship script =="
out="$(run_gate schedule dealdex)"
check "no state -> should_ship" 1 "$(field "$out" should_ship)"

echo "== 3. scheduled tick on an already-shipped HEAD skips =="
set_state dealdex "$BASE"
out="$(run_gate schedule dealdex)"
check "HEAD already shipped -> should_ship" 0 "$(field "$out" should_ship)"

echo "== 4. unrelated commits since the last ship do NOT ship =="
commit "src/routes/index.tsx" "web change" "feat(web): unrelated to iOS" >/dev/null
commit "docs/notes.md" "docs" "docs: nothing an iOS tester can see" >/dev/null
commit "README.md" "readme tweak" "docs: readme tweak" >/dev/null
commit "server/scan.ts" "server change" "feat(server): backend only" >/dev/null
out="$(run_gate schedule dealdex)"
check "unrelated-only -> should_ship" 0 "$(field "$out" should_ship)"

echo "== 5. a native/ios change since the last ship DOES ship =="
commit "native/ios/DealDex/ScanView.swift" "// ui" "fix(ios): visible change" >/dev/null
out="$(run_gate schedule dealdex)"
check "native/ios change -> should_ship" 1 "$(field "$out" should_ship)"

echo "== 6. a ship-tooling-only merge (scripts/ios-fleet/) DOES ship =="
set_state dealdex "$(git -C "$REPO" rev-parse HEAD)"
commit "scripts/ios-fleet/ship-testflight.sh" "# tooling" "fix(ios-fleet): tooling only" >/dev/null
out="$(run_gate schedule dealdex)"
check "scripts/ios-fleet change -> should_ship" 1 "$(field "$out" should_ship)"

echo "== 7. a workflow-file-only merge DOES ship =="
set_state dealdex "$(git -C "$REPO" rev-parse HEAD)"
commit ".github/workflows/ios-ship.yml" "# workflow" "ci(ios): gate comment" >/dev/null
out="$(run_gate schedule dealdex)"
check "workflow file change -> should_ship" 1 "$(field "$out" should_ship)"

echo "== 8. a wrapper-script-only merge DOES ship =="
set_state dealdex "$(git -C "$REPO" rev-parse HEAD)"
commit "scripts/ios-ship-testflight.sh" "# wrapper" "fix(ios): wrapper only" >/dev/null
out="$(run_gate schedule dealdex)"
check "wrapper script change -> should_ship" 1 "$(field "$out" should_ship)"

echo "== 9. '!' exclusions behave like push, and the old single-prefix call still works =="
set_state dealdex "$(git -C "$REPO" rev-parse HEAD)"
commit "native/ios/Generated/mirror.swift" "// generated" "chore(ios): generated mirror" >/dev/null
out="$(bash "$GATE" --event schedule --path-prefix 'native/ios/**' --path-prefix '!native/ios/Generated/**' --repo-root "$REPO" --state-dir "$STATE" dealdex 2>&1)"
check "excluded-only -> should_ship" 0 "$(field "$out" should_ship)"
out="$(bash "$GATE" --event schedule --path-prefix 'native/ios/**' --repo-root "$REPO" --state-dir "$STATE" dealdex 2>&1)"
check "same change without exclusion -> should_ship" 1 "$(field "$out" should_ship)"
out="$(bash "$GATE" --event schedule --path-prefix 'native/ios/' --repo-root "$REPO" --state-dir "$STATE" dealdex 2>&1)"
check "old single-prefix call -> should_ship" 1 "$(field "$out" should_ship)"

echo "== 10. per-app outputs are independent =="
HEAD_SHA="$(git -C "$REPO" rev-parse HEAD)"
set_state dealdex "$HEAD_SHA"          # caught up
set_state dealdex-local "$BASE"        # behind, and iOS changed since BASE
out="$(run_gate schedule dealdex dealdex-local)"
check "caught-up app" 0 "$(field "$out" ship_dealdex)"
check "behind app" 1 "$(field "$out" ship_dealdex_local)"
check "any-app roll-up" 1 "$(field "$out" should_ship)"

echo "== 11. an unreachable last-ship sha falls back to the recorded timestamp =="
# Observed live on Usage-Monitor 2026-08-13: the recorded ship sha was the tip
# of a grok/* ship worktree, not an ancestor of main. The same is possible here
# any time a ship runs from an agent lane. Skipping forever would make the
# backstop useless; shipping blind would spam TestFlight.
rm -f "${STATE}/last-ship-dealdex-local.txt"
FUTURE=$(( $(date +%s) + 600 ))
printf '%s %s\n' "$FUTURE" "0000000000000000000000000000000000000000" >"${STATE}/last-ship-dealdex.txt"
out="$(run_gate schedule dealdex)"
check "unreachable sha, no newer iOS commits -> should_ship" 0 "$(field "$out" should_ship)"

PAST=$(( $(date +%s) - 86400 ))
printf '%s %s\n' "$PAST" "0000000000000000000000000000000000000000" >"${STATE}/last-ship-dealdex.txt"
out="$(run_gate schedule dealdex)"
check "unreachable sha, iOS commits since -> should_ship" 1 "$(field "$out" should_ship)"

printf 'not-a-timestamp deadbeefdeadbeefdeadbeefdeadbeefdeadbeef\n' >"${STATE}/last-ship-dealdex.txt"
out="$(run_gate schedule dealdex)"
check "unreachable sha, unusable ts -> defers to ship script" 1 "$(field "$out" should_ship)"

# Back to a clean skip state for the exit-code assertion below.
set_state dealdex "$(git -C "$REPO" rev-parse HEAD)"

echo "== 12. deciding 'skip' is never an error exit =="
run_gate schedule dealdex >/dev/null
check "exit code on skip" 0 "$?"

echo
echo "passed=${PASS} failed=${FAIL}"
[[ "$FAIL" -eq 0 ]] || exit 1
echo "scheduled-ship-gate: all tests passed"
