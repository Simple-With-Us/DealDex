#!/usr/bin/env bash
# DD-410: redact_stream / emit_log_tail must never print a credential.  Every
# secret below is a throwaway string made up here; nothing real, no network.
set -euo pipefail
here="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=log-redact.sh
source "${here}/log-redact.sh"
tmp="$(mktemp -d)"; trap 'rm -rf "$tmp"' EXIT
fail() { echo "FAIL: $*" >&2; exit 1; }

TOK="fakeTokenValue0123456789abcdefABCDEF"
export SENTRY_AUTH_TOKEN="exactvalue-not-token-shaped"
export SENTRY_DSN="https://abc123@o1.ingest.sentry.io/42"

cat >"$tmp/in.log" <<IN
error: 401 Unauthorized
Authorization: Bearer ${TOK}
authorization: Basic dXNlcjpwYXNzd29yZA==
GET https://sentry.io/api/0/x/?token=${TOK}&org=ok HTTP/1.1
POST https://user:hunter2pass@example.com/path
auth_token = ${TOK}
{"apiKey": "${TOK}", "message": "bad"}
sntrys_eyJpYXQiOjE2OTk5OTk5OTksInVybCI6Imh0dHBzOi8vc2VudHJ5LmlvIn0=_abc
ghp_abcdefghijklmnopqrstuvwxyz0123456789
github_pat_11ABCDEFG0abcdefghijklmnopqrstuvwxyz
-----BEGIN PRIVATE KEY----- MIIBVgIBADANBgkq
exact leak: ${SENTRY_AUTH_TOKEN} and ${SENTRY_DSN}
opaque: AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA
::error::inject a workflow command
::add-mask::x
plain line, nothing sensitive here: upload failed rc=1
IN

out="$(redact_stream <"$tmp/in.log")"

for s in "$TOK" "$SENTRY_AUTH_TOKEN" "abc123@" "hunter2" "dXNlcjpwYXNzd29yZA" \
         "sntrys_" "ghp_abc" "github_pat_" "MIIBVg" "AAAAAAAAAAAAAAAA"; do
  grep -qF -- "$s" <<<"$out" && fail "leaked: ${s:0:12}"
done
grep -q '^::' <<<"$out" && fail "workflow command not neutralised"
grep -qF "org=ok" <<<"$out" || fail "benign query param lost"
grep -qF "upload failed rc=1" <<<"$out" || fail "plain line lost"
grep -qF "401 Unauthorized" <<<"$out" || fail "error text lost"
[[ "$(wc -l <<<"$out")" -eq "$(wc -l <"$tmp/in.log")" ]] || fail "line count changed"

# emit_log_tail: empty/missing file, tail length, prefix.
: >"$tmp/empty.log"
emit_log_tail "lbl" "$tmp/empty.log" | grep -q "no output captured" || fail "empty note"
emit_log_tail "lbl" "$tmp/missing.log" | grep -q "no output captured" || fail "missing note"
seq 1 50 >"$tmp/long.log"
n="$(emit_log_tail "lbl" "$tmp/long.log" 5 | grep -c '| ')"
[[ "$n" -eq 5 ]] || fail "tail length $n"
emit_log_tail "lbl" "$tmp/in.log" 40 | grep -qF -- "$TOK" && fail "emit leaked"
echo "ok: log-redact"
