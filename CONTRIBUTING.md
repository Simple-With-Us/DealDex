# DealDex — how work ships

**GitHub `main` is the product.**  Repo: https://github.com/jaywedgeworth22/DealDex (public).

Every agent (Grok, Grok Build, Claude, Codex, Cursor, Antigravity, Monet) and
every human uses the same loop.  Durable rules live in [`AGENTS.md`](AGENTS.md).
This file is the short version.

## Loop

1. Work in your seat's lane / branch prefix (`grok-build/`, `grok/`, `claude/`,
   `cursor/`, …).  Do not edit `/Users/jay/Code/DealDex` and do not push
   straight to `main`.
2. `git fetch origin && git rebase origin/main` before you start.
3. Finish one coherent unit.  Update `STATUS.md`, `docs/EFFORT-LOG.md`, and a
   `docs/rollouts/` note.
4. Commit, push the branch, open a PR, merge when CI is green.

That merge is what other agents pull.  It is also what Vercel Production
builds from.

## Live site

**Vercel is the host.**  It is current, not a leftover.  Public URL:
**https://dealdex.net**.  GitHub About homepage is that URL.  Do not
use `dealdex-psi.vercel.app` as the homepage.  Do not migrate the site
to Coolify.

GitHub `main` is the code.  This preview (`/workspace`) is a workbench,
not production.  Vercel Production builds `main` (team
`jaywedgeworth22s-projects`, project `dealdex`).

Owner registered `dealdex.net` 2026-08-22.  Public host is **https://dealdex.net**.
`https://dealdex.vercel.app` is a different Next.js site
("DealDeX - Revolutionizing E-commerce").  Do not point About at it.

Do not invent a second live URL.

Native shipping is separate: Android package `me.grok.dealdex`, iOS bundle
`net.dealdex`, team `CC8UTF7ATG`.  Internal TestFlight exists (ASC appleId
`6802474288`).  Play stays blocked on owner records.  See `README.md` and
`docs/store-listing.md`.

## Grok Build

Grok Build (`GROK-BUILD`) is a standing seat, distinct from Mac Grok (`GROK`).
Branch prefix `grok-build/`.  Cloud App Builder preview lane is `/workspace`.
Mac Grok Build TUI lane is `~/apps/dealdex-grok-build`.  Never edit
`/Users/jay/Code/DealDex`.  GitHub is source of truth: rebase first, land a PR
when the change is real.  If this checkout drifted, GitHub wins.

## Local

```bash
npm install
npm run dev      # 0.0.0.0:8080
npm run lint && npm run typecheck && npm test && npm run build
```
