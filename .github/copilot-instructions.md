DealDex: https://github.com/Simple-With-Us/DealDex

Read AGENTS.md and CONTRIBUTING.md first.  Work on your seat prefix
(`grok-build/` for Grok Build, `grok/` for Mac Grok, `claude/`, `cursor/`, …).
Pull rebase from origin/main before editing.  Commit, open a PR, merge
when CI is green.  Never force-push main.  Never invent a second repo.

GitHub `main` is the product.  Public host is https://dealdex.online on
Vercel (current, not leftover).  Do not migrate the site to Coolify.
Do not invent a live URL.  Native apps are Kotlin/Compose
(`me.grok.dealdex`) and Swift (`online.dealdex`, team `CC8UTF7ATG`),
not a website wrapper.
