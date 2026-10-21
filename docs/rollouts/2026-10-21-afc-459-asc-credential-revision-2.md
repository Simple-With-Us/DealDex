# 2026-10-21 — AFC-459 revision 2: the ASC credential is never a path

Refs AFC-459.  Revision 1 of this port merged as PR #523; this is the
follow-up pass that brings the same hardening to revision 2.

## Problem

Revision 1 stopped the node client from reading a key file, but the rest of
the path still treated a path on disk as a credential:

- `ship-testflight.sh` accepted a named `ASC_KEY_PATH` as the credential in
  play and handed it to `asc-key.mjs exec`, so the file was the source.
- The ship workflow published `ASC_KEY_PATH` into `GITHUB_ENV` and called
  `asc-key.mjs exec "$ASC_KEY_PATH" -- node .../asc-api.mjs`.  The raw PEM
  never crossed the step boundary, which is right, but the thing that crossed
  it was a path, and the hardened client refuses a path — so the standing
  tester step could not work the way the workflow assumed.
- A rejected key was reported without a preview, so an operator could not
  tell which value was wrong, and the ways to report it did not agree between
  the shell layer and the node client.
- The base64 branch of the credential resolution piped the encoded key into
  the decoder, which puts a credential in an output stream.
- The client test read another process's environment to prove the handoff.
  On macOS that is `ps -E` and on Linux it is `/proc/<pid>/environ`;  either
  dump carries the private key and every unrelated credential the process
  holds.

The owner's ruling is binding:  the process environment, then
`fleet-secrets`/Infisical.  A path on disk is never a credential source, not
as a fallback, not at a lower priority, not at all.

## Changes

### `scripts/ios-fleet/asc-key.mjs`

Replaced with the revision-2 key module, verbatim from the fleet reference.
The module validates a key, writes one to an owner-only file and reports the
status of a key;  it has no `read` subcommand and no `exec` subcommand, so
there is no way to read a key out of a file and no way to run a child with a
key that came from one.  The child's environment is an allowlist, not a copy
of the parent's.

### `scripts/ios-fleet/asc-api.mjs`

- A rejected key is reported with a MASKED PREVIEW:  the first eight and the
  last four characters, nothing else.  A value too short to mask safely is
  withheld whole, so a preview can never become the secret it describes.
  Both rejections (the base64 branch and the ambient `ASC_KEY_P8` branch)
  carry it.
- The header now says that the shell layer stages its own copy from the
  resolved credential, which is what it does now.

### `scripts/ios-fleet/ship-testflight.sh`

- `load_secrets` resolves the credential from the environment first — the
  hosted `APPLE_API_*` trio, then an ambient `ASC_KEY_P8` — and from
  Infisical `/asc` (or `/authkey-<id>-p8`) otherwise.
- A named `ASC_KEY_PATH` is ignored wherever it appears, and the run says so:
  "ASC_KEY_PATH is not a credential source; the credential came from the
  environment or from Infisical".  The missing-credentials branch says it
  too, so the run says so even when no credential resolves.
- The base64 branch decodes through a here-string, never a `printf` pipe:  a
  credential belongs in no output stream.
- The only file written is a short-lived, owner-only materialization for the
  Apple tools that can only read a key from disk (`altool`,
  `xcodebuild -authenticationKeyPath`).  It is written FROM the resolved
  credential and is never read back as one.
- Every rejection of a key carries the masked preview, including a failed
  write of the staged file.
- `asc_client` no longer wraps the client in `asc-key.mjs exec`:  the key is
  in the environment of the shell, and the client resolves it from there.

### `scripts/ios-fleet/test-asc-key.test.mjs`, `scripts/ios-fleet/test-asc-credentials.sh`

Ported to revision 2.  No test reads another process's environment any more:
the handoff is proved with the signed request instead.  The shell suite
covers the masked preview, the named path being ignored, the hosted trio,
the environment winning over the vault, and the credential never travelling
in a command argument.

### `scripts/ios-fleet/test-asc-credentials.mjs`

Kept, and extended with the masked preview:  the blessed preview of
`not a private key at all`, a value too short to mask withheld whole, and the
base64 branch previewed the same way.

### `scripts/ios-ship-workflow.test.mjs`

Two new tests:  the workflow hands the credential over as the hosted base64
trio and never calls `asc-key.mjs`, and a rejected key is reported masked
while no test reads an environment.

### `.github/workflows/ios-ship.yml`

This is the CI handoff fix.  The job environment now carries the hosted
base64 trio — `APPLE_API_KEY_ID`, `APPLE_API_ISSUER_ID` and
`APPLE_API_KEY_P8_BASE64` — because base64 is one line and the raw PEM never
enters `GITHUB_ENV`.  The standing tester step calls the client directly
instead of through `asc-key.mjs exec`.  The staged mode-600 file stays for
`scripts/ios-appstore-gm-prepare.sh` and the Apple tools;  only its path
crosses the step boundary, and nothing treats that path as a credential.

### `scripts/ios-fleet/README.md`, `scripts/ios-fleet/appstore-connect.env.example`

The documented sources now name the hosted trio and say that a named
`ASC_KEY_PATH` is ignored.

## Verify

- `bash scripts/ios-fleet/test-asc-credentials.sh` — pass.
- `node --test scripts/ios-fleet/test-asc-key.test.mjs` — 11/11 pass.
- `node --test scripts/ios-fleet/test-asc-credentials.mjs` — 15/15 pass.
- `node --test scripts/ios-ship-workflow.test.mjs` — 7/7 pass.
- `bash scripts/test-ios-stage-asc-key.sh` — pass.
- `npm run lint` — 0 errors, 26 warnings, all of them pre-existing in
  `src/routes/`.  `npx eslint` on the four changed `.mjs` files — clean.
- `npm run typecheck` — pass.
- `npm test` — 359/359 pass.
- `npm run build` — pass.
- `bash -n` on every changed shell script and `node --check` on every changed
  `.mjs` — pass.
- Manual:  the hosted trio resolves the credential and stages a mode-600 file
  holding that key;  a named `ASC_KEY_PATH` next to the trio is ignored and
  the run says so;  a named path on its own is ignored;  a bad `ASC_KEY_P8`
  is rejected with the preview `not a pr... all` and the key is never
  reported whole.

## Not changed

- `scripts/ios-stage-asc-key.sh` and `scripts/ios-appstore-gm-prepare.sh`
  keep writing a mode-600 file.  That is the allowed case:  a short-lived
  owner-only materialization for `security import`, `altool` and
  `xcodebuild -authenticationKeyPath`.  The file is written from the
  credential and is not read back as one.
- No web UI changed, so no Playwright baselines moved.
