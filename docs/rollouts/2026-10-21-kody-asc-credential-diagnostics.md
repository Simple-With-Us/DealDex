# 2026-10-21 — Kody review: iOS credential resolution failures are named

Refs the Kody review comment on the iOS credential paths ("Credential file
read failures are silently swallowed").

## Problem

`asc-api.mjs` caught every credential failure and turned it into a bare "no
App Store Connect credential found".  A missing, unreadable or invalid
`ASC_KEY_PATH` was indistinguishable from an absent credential, and a broken
`fleet-secrets` lookup left no trace at all.  `ship-testflight.sh` wrote the
staged `.p8` without checking the write, so a failed write left an empty key
file behind and the real reason was lost.

## Changes

- `scripts/ios-fleet/asc-api.mjs`
  - `fromFile` throws an error that names `ASC_KEY_PATH` (with the source and
    the OS error code) when the staged key cannot be read.
  - `resolveCredential` records that failure as a note and falls through to the
    other credential sources instead of aborting, matching the `[[ -f ]]`
    fallthrough in `ship-testflight.sh`.  It also records a note when
    `ASC_KEY_PATH` is set but the file is missing, when the environment only
    names part of a credential trio, and when the `APPLE_API_*` trio is
    incomplete.
  - `fleetSecretsGet` records the failing secret name and folder (never a
    value) instead of dropping the reason.
  - The recorded notes are printed on every path — the "no credential found"
    message lists the Infisical `/asc` source and every note, and a successful
    resolution prints the notes before the `asc-auth: using ...` line.  A
    source that was skipped (an unreadable `ASC_KEY_PATH`, a failed
    `fleet-secrets` call) therefore stays visible even when another source
    resolves the credential and the ship proceeds.
- `scripts/ios-fleet/ship-testflight.sh` — a failed write of the staged `.p8`
  is logged and the load fails closed (`AUTH_MODE` stays `none`); a failed
  `chmod 600` is logged.

No credential source was added or removed: the environment, `fleet-secrets`
(Infisical `/asc`) and the staged `ASC_KEY_PATH` remain the approved sources.

## Not changed: `.github/workflows/ios-ship.yml`

The same rule also matched the standing-tester step in `ios-ship.yml`.  That
step is already covered by the script: `asc-api.mjs ensure-standing-testers`
fails with `ASC_STANDING_TESTERS is empty; set the repo secret to the standing
tester emails` when the secret is unset, and the step turns that exit code
into a loud workflow warning.  A workflow-level warning was still drafted, but
this seat's push token has no `workflows` permission, so the server refuses any
push that touches `.github/workflows/*`.  The draft is therefore not included;
a seat with that permission can add the two-line warning if it is still wanted.

## Verify

- `node --test scripts/ios-fleet/test-asc-credentials.mjs` — 10/10 pass.
- `node --test scripts/ios-ship-workflow.test.mjs` — 5/5 pass.
- `bash scripts/ios-fleet/test-asc-credentials.sh` — pass.
- `bash scripts/test-ios-stage-asc-key.sh` — pass.
- `node --check scripts/ios-fleet/asc-api.mjs`, `bash -n` on the changed
  shell script and a YAML parse of `ios-ship.yml` — pass.
- Manual: an unreadable `ASC_KEY_PATH` now exits 1 with
  `asc-auth: Unable to resolve required secret ASC_KEY_PATH (...)`; a missing
  credential lists the failed secret variables; an unreadable `ASC_KEY_PATH`
  that falls through to another source still logs
  `asc-auth:   - ASC_KEY_PATH could not be read (...)` before the
  `asc-auth: using ...` line.
