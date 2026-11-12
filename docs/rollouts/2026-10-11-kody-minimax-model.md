# Kody Autofix Switched to MiniMax M3

## Change

DealDex’s Kody autofix caller now selects `minimax/minimax-m3` through the existing Vercel AI Gateway endpoint, `https://ai-gateway.vercel.sh/v1`.  The caller’s `web` profile, `src/` and `server/` source scope, `check_run` qualification and other runtime gates, concurrency group, five-attempt daily limit, and explicit `VERCEL_AI_GATEWAY_API_KEY` forwarding remain unchanged.  The reusable workflow stays pinned to `e28fefcd12d4747e3ed66cb5c5b3f3dd7ea2db88`.

## Verification

Original PR #448 head `716933f210bea24f92ad7d83c424cac35cfef8d8` completed with `verify`, `e2e`, `gitleaks`, and `android` passing; `autofix / autofix` was skipped.  Local caller validation passed with `actionlint`, YAML parsing, exact-diff checks, and assertions for the protected caller settings.  The shared helper’s synthetic MiniMax canary passed through provider selection, request construction, edit extraction, and edit application: one synthetic subtract-to-add edit applied with no remote writes.

## Handoff

PR #448 merged as `a9e6ce38752d509e4a8ec90e520e1fc82a8cceb9`.  This follow-up adds the missing status and rollout record; no application code or effort log changed.  The documentation follow-up is on `codex/cts-330-kody-handoff` and awaits CODEX review before landing.
