#!/usr/bin/env bash
# DD-410: print the tail of a failed best-effort step's log into the run log so
# the next ship names the real error, without leaking a credential.
#
# Redaction is deterministic and deliberately broad.  A line is rewritten, never
# dropped, so the shape of the error stays readable.  Order matters: exact
# values the shell knows first, then token shapes, then key=value / header /
# query / URL-userinfo patterns, then any long opaque run.  Lines that start
# with "::" are neutralised so a log line cannot inject an Actions workflow
# command.

# redact_stream: stdin -> stdout.
redact_stream() {
  local exact=() v
  for v in "${SENTRY_AUTH_TOKEN:-}" "${SENTRY_DSN:-}" "${ASC_KEY_ID:-}" \
           "${ASC_ISSUER_ID:-}" "${GH_TOKEN:-}" "${GITHUB_TOKEN:-}" \
           "${INFISICAL_TOKEN:-}"; do
    [[ ${#v} -ge 6 ]] && exact+=("$v")
  done
  # perl, not sed: the ship runs on macOS, where BSD sed has no case-insensitive
  # flag.  perl ships with macOS and behaves the same everywhere.
  local script='
    s{(?i)(Authorization|Proxy-Authorization|X-Api-Key|X-Auth-Token|Cookie|Set-Cookie)\s*:\s*[^\r\n]*}{$1: [REDACTED]}g;
    s{(?i)bearer\s+[A-Za-z0-9._~+/=-]+}{Bearer [REDACTED]}g;
    s{(?i)basic\s+[A-Za-z0-9+/=]{8,}}{Basic [REDACTED]}g;
    s{sntry[su]_[A-Za-z0-9_+/=.-]+}{[REDACTED]}g;
    s{(?:ghp|gho|ghu|ghs|ghr)_[A-Za-z0-9]{20,}}{[REDACTED]}g;
    s{github_pat_[A-Za-z0-9_]{20,}}{[REDACTED]}g;
    s{(?:AKIA|ASIA)[A-Z0-9]{16}}{[REDACTED]}g;
    s{-----BEGIN[^-]*PRIVATE KEY-----.*}{[REDACTED PRIVATE KEY]}g;
    s{(https?://)[^/@\s]+@}{$1\[REDACTED]@}g;
    s{(?i)([?&][A-Za-z0-9_.%-]*(?:token|key|secret|sig|signature|auth|password|passwd|credential|dsn)[A-Za-z0-9_.%-]*=)[^&\s"]*}{$1\[REDACTED]}g;
    s{(?i)("?[A-Za-z0-9_.-]*(?:token|secret|password|passwd|credential|apikey|api_key|private_key|auth|dsn)[A-Za-z0-9_.-]*"?\s*[:=]\s*)(?:"[^"]*"|[^\s,;&]+)}{$1\[REDACTED]}g;
    s{[A-Za-z0-9+/_=-]{32,}}{[REDACTED]}g;
    s{^::}{: :};
  '
  local line e
  while IFS= read -r line || [[ -n "$line" ]]; do
    for e in "${exact[@]:-}"; do
      [[ -n "$e" ]] && line="${line//"$e"/[REDACTED]}"
    done
    printf '%s\n' "$line"
  done | perl -pe "$script"
}

# emit_log_tail LABEL FILE [LINES]: log a redacted tail of FILE, or a note.
# Best-effort by contract: it always returns 0, so a caller running under
# `set -e -o pipefail` is never aborted by a log helper.  Redaction runs on the
# FULL line and truncation comes after it, so a secret that straddles the cut
# column is masked before it can be split.  If redaction itself fails, nothing
# raw is printed.
emit_log_tail() {
  local label="$1" file="$2" lines="${3:-20}" out
  if [[ ! -s "$file" ]]; then
    echo "[ios-ship] ${label}: no output captured"
    return 0
  fi
  if out="$(tail -n "$lines" "$file" | redact_stream | cut -c1-400 2>/dev/null)"; then
    echo "[ios-ship] ${label}: last ${lines} line(s), redacted:"
    if [[ -n "$out" ]]; then
      printf '%s\n' "$out" | sed 's/^/[ios-ship]   | /'
    fi
  else
    echo "[ios-ship] ${label}: log tail unavailable (redaction failed; nothing printed)"
  fi
  return 0
}
