# 2026-10-21 — Kody reusable pin advanced to the M3.1-Flash helper

Refs PR #519 and Congress.Trade #2832. Advances `.github/workflows/kody-fleet-autofix.yml` from CTS `31659885f58f08e129b6dc092f3493d7cdb74a11` to `917a49dfb77e4fce307a985510ab814a6f684ef6`. Upstream congress-trading-shared #393 (`cb956e7a`) shipped native `MiniMax-M3.1-Flash` handling in the trusted helper, and #398 (`917a49df`) advanced the reusable's checkout refs to it. The helper at the old pin covers only the exact `MiniMax-M3` id, so kody autofix runs at the previous pin mishandle the `MiniMax-M3.1-Flash` id this caller passes.

## Scope

- Single-pin change in the kody caller; trigger guards, permissions, budget inputs, model value, and secret names unchanged.
- Workflow display label and header comment aligned from "M3" to "M3.1 Flash"; the caller's `model:` was already `MiniMax-M3.1-Flash`.
- PR Autofix and Claude Code Autofix callers untouched; they already pin AFC `c97a2dae96762eb9ffc122c753f0dfb0a7840650`.

## Verification

Caller and callee contracts inspected through GitHub: the reusable at `917a49df` declares the same inputs this caller passes, and its job `timeout-minutes` values (5/5/8/5/3) are unchanged from the previous pin. Hosted PR checks are the remaining gate. A green PR check does not establish a successful autofix execution; that needs a later eligible run reaching beyond job setup.
