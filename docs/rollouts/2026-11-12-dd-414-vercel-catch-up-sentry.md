# 2026-11-12 — DD-414 — Vercel catch-up failures + Sentry Crons (FLEET-INFRA-F9 / F4)

Sentry FLEET-INFRA-F9 grouped CI failures for **Vercel production catch-up** and FLEET-INFRA-F4 reported missed check-ins on monitor `ci-dealdex-vercel-production-catch-up`.

## Root cause

`workflow_run` can fire when **E2E (Playwright)** completes before **CI** is `completed`/`success` on the same main SHA. The gate classified the commit as deploy-eligible, then `assertCi` hard-failed with `Exact-main CI not successful: CI`, red-Xing the deploy job (and paging F9). Scheduled ticks also lacked an `in_progress` check-in at the cron slot, so F4 missed-check-in noise continued when runs failed early.

## Fix

- `scripts/deploy/vercel-catch-up.mjs`: `ciGate` downgrades to `deploy=false` (exit 0) when required workflows are queued, failed, or missing — same class as cooldown / no site changes.
- `.github/workflows/vercel-catch-up.yml`: scheduled runs send Sentry Crons `in_progress` at test start and `ok`/`error` in a final `sentry-cron-finish` job (slug + `41 * * * *`, margin 75 via shared reporter helper).
- `scripts/sentry-ci-report.py`: `--cron-checkin` helper + skip duplicate terminal schedule check-in for this workflow (failure events unchanged).

## Verify

- `node --test scripts/deploy/vercel-catch-up.test.mjs`
- `python3 scripts/sentry-ci-report-margins_test.py`
- `python3 -m py_compile scripts/sentry-ci-report.py`

Branch: `cursor/dd-414-vercel-catch-up-sentry-4eef`.
