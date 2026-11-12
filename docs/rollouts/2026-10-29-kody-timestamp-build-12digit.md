# 2026-10-29 — Kody review on ios-fleet/timestamp-build: 12-digit ceiling, N >= S

Three Kody threads, handled per the owner decisions. Fixed: `nextSharedBuild`
(`scripts/ios-fleet/shared-build.mjs`) throws `planned build exceeds 12 digits`
when max(S, M + 1) would exceed 12 digits, and the `pairedBuildFeed` floor in
`asc_next_shared_build` fails closed above 12 digits naming the feed URL and
value; the 12-digit acceptance gate is unchanged. New test
`a planned build past 12 digits throws instead of shipping it` in
`shared-build.test.mjs` covers the ceiling (18-digit floor, 18-digit ASC
build, 12-digit rollover, top-12-digit OK). Disputed by design (owner rule
Oct 29 2026): fixed `--build` skips the shared-max re-check because plan-build
runs once per release and the paired platform uploads the same N; the ship
still rejects a non-12-digit N at or below this platform's max
(`ship-testflight.sh:1229-1231`), and cheaply added: N must reach this HEAD's
merge stamp S (only rejects a value planned for an older commit), covered by
`test-fixed-version.sh` ("build below the HEAD merge stamp is rejected").
Disputed: the `ios-identity.test.mjs` fixed-0.1.0 title follows the Oct 29
2026 owner rule, which supersedes AFC-517's 1.0.N train for TestFlight
versioning; `STATUS.md` now says so at the top. The `ios-ship-workflow`
"at most 18 digits" assertion, the `asc-api.mjs` / `README.md` "no cap"
comments, and the feed-floor wording moved to the 12-digit ceiling.

Checks: `node --test` on the four `scripts/ios-fleet/*.test.mjs` files (45
pass) and `scripts/ios-ship-workflow.test.mjs` (9 pass), `bash -n` on the two
changed shell scripts, `test-fixed-version.sh` (11 pass),
`test-log-redact.sh` and `test-asc-credentials.sh` (pass). No pin script in
this tree, so that step was skipped.
