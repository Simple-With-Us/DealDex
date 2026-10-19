# Sentry Review Autofix And CLI Repair

Refs BF-2487. Follow-up to #493 after AFC #657 merged.

The Claude Code Autofix caller now uses AFC `c79c7840d4d3d71bffad08067ce4a1084f0bbb34` for Claude Code Autofix. The consumed Claude workflow differs from `b718446588a365406cb0eb3aca7feec3a3fe5903` only by adding the exact `sentry` and `sentry[bot]` accounts to its existing bot allowlist. No wildcard, credential, permission, trigger, concurrency, prompt, turn limit, or verification change is introduced in that workflow.

## DealDex PR Autofix Repair

The independent PR Autofix caller moves from AFC `b634b5113a3293e3b6f7f534abc3594f92c3c900` to `00def8545947e21ffe285ea67c1812c7bd321dfc`. Comparing the exact consumed reusable files shows one change: `--verbose` is added to `claude --print --output-format stream-json`. This fixes the CLI validation error observed in [run 39181773920](https://github.com/Simple-With-Us/DealDex/actions/runs/39181773920), job 117835923874.

PR Autofix retains its existing actor default, which excludes Sentry. There is no new `.autofix.yml` or actor override, so this repair does not activate an additional Sentry loop. Its existing diagnostics action/reducer are available at CTS `2644321a5107372bf7bda55909552f8abee4ad61`. Permissions, passed secrets, trusted policy, fork rejection, iteration budget, and commit/push behavior are unchanged.

## Verification

- `node --test scripts/autofix-workflows.test.mjs`: 6/6 pass in an isolated fixture using the exact caller and test files.
- YAML parsing passes for both callers; existing secret-scope and least-privilege guards pass.
- Regression coverage locks the reviewed Sentry-capable Claude pin, inherited actor policy, same-repository bot gate, and PR Autofix CLI repair pin.
- Full local lint/typecheck/test/E2E/build are not run in this connector-driven change. Hosted CI and review on the final head remain the readiness gate.

## Acceptance Boundary

A subsequent eligible same-repository Sentry bot review must reach the Claude action beyond actor validation before live execution is established. Green CI alone does not prove an autofix commit or review-thread resolution. Fork and human reviews remain excluded by the caller; the pinned action enforces bot identity. No manual paid run, merge, new auto-merge, credential grant, or Sentry project setting change is performed.
