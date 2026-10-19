# 2026-10-18 — Repaired AFC Autofix Pin

Refs AFC-350 and PR #493. Continue the existing CTS-to-AFC migration by pinning `.github/workflows/claude-code-autofix.yml` to AFC `b718446588a365406cb0eb3aca7feec3a3fe5903` after AFC #651 merged. That revision resolves the diagnostics action at AFC `070fdbfacadbd9e90cbb54098123df7d3fef737f`; the prior caller revision attempted an unavailable diagnostics dependency.

## Scope

- Preserve the existing `scripts/autofix-workflows.test.mjs` expectation for the AFC Claude reusable.
- Keep trigger guards, concurrency, permissions, prompts, and secret names unchanged.
- Keep PR Autofix at `b634b5113a3293e3b6f7f534abc3594f92c3c900` and Kody at CTS `31659885f58f08e129b6dc092f3493d7cdb74a11`. The older PR Autofix revision uses CTS diagnostics and is unaffected by the broken AFC pin.
- Update `STATUS.md` with the narrow repair and remaining verification.

## Verification

The caller's required prompt and passed secret names match the pinned reusable's declared contract, and the repaired diagnostics action path was inspected. All four workflow-guard tests passed under `node --test scripts/autofix-workflows.test.mjs` in an isolated fixture containing the exact caller files and guard test. The existing migration guard expectation is preserved. Full local lint, typecheck, tests, E2E, and build were not run in this connector-driven update; hosted checks on the final commit are the remaining gate. A green PR check does not establish a successful autofix execution; that needs a later eligible run reaching beyond job setup.

Existing squash auto-merge was already armed by the PR author before this continuation. This update does not enable automation or issue a merge command.
