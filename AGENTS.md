# DealDex — agent notes

Pokémon listing desk. User-facing subtitle: **Compare Pokémon card listing prices**. Scan live eBay and Mercari Buy It Now singles, then score
the ask against TCGPlayer, Cardmarket, TCGCSV, eBay solds, and optional paid
desks. Website name **DealDex**. Android and iPhone apps scan on the device;
they do not wrap the website. API keys live on the phone and must never reach a
DealDex server — `/api/native/scan` refuses a `keys` payload and `/privacy` says
so. The **website** scan runs server-side and does send the browser's saved
keys; keep those two statements distinct in any copy you write. Sign-in is
optional for backup, and backed-up keys are encrypted at rest.

GitHub: `Simple-With-Us/DealDex` (public). Integration tree:
`/Users/jay/Code/DealDex`. Zulip `repo:` name: **`DealDex`**. Acronym: **`DD`**.

Read this before making changes. It exists so the next agent (Claude, Codex,
Antigravity/Gemini, Cursor, Grok, Grok Build, Monet, …) does not re-derive traps the hard way.

## Prior messages stay in scope (owner preference — ALL agents, ALL platforms)

**Never assume a new owner message means prior questions or tasks are dropped.**

Treat the full conversation as still active unless the owner **explicitly
contradicts**, **explicitly cancels**, or **clearly redirects** with a command /
obvious new primary objective that replaces the old one. Follow-ups and “also X”
**add** work; they do not abandon open threads. Keep unfinished prior items on a
todo list and finish or explicitly park them — do not silently drop them.

Canonical: `/Users/jay/apps/FLEET-PROTOCOL.md` “Prior messages stay in scope”.

## Never wait and watch for PRs to merge / Idle-polling forbidden (Owner ruling 2026-09-01 — ALL seats)

**Never passively wait, watch, or loop-poll for PRs to merge or CI checks to pass.**
Sitting and watching PRs or polling CI in a loop wastes valuable agent tokens, context window, time, and money/quota. Almost invariably, when PRs are left to sit, they get blocked by merge conflicts, outdated branches, failing CI checks, or unaddressed review comments.

**Binding rules:**

1. **Actively Drive PRs to Completion**: Proactively inspect mergeability, conflicts, CI checks, and review comments.
2. **Resolve Conflicts & Outdated Branches Immediately**: If a branch is outdated or has merge conflicts with `main`, merge/rebase `main` into the branch, resolve conflicts locally, verify tests/build pass, and push immediately.
3. **Resolve Review Comments & CI Failures Directly**: Fix failing checks or review comments at the root cause and push updates.
4. **Merge & Deploy Promptly**: As soon as checks pass and the unit is verified, merge the PR to `main` (auto-deploying to production).
5. **No Idle-Watching Loops**: Never run `sleep` loops, polling timers, or idle watch loops waiting for a PR. Conclude the turn cleanly or work on actionable tasks.

## Mac local processes (binding)

**Master list:** `/Users/jay/apps/MAC-LOCAL-PROCESSES.md`
**Owner Note:** `⭐️ Background Jobs Master List` (Coding, pinned)

If you create, change, load, bootout, or retire a LaunchAgent, cron row, login item, pm2 KeepAlive job, **or any helper script other agents are expected to run**, you **must** add or update a row on that list **and** refresh the Apple Note in the same change. Say whether it is **always-on** or **on-demand**. A new background Python/Node/bash job that is not on the list is unfinished work.

## Before you start

> [!CAUTION]
> **CRITICAL RULE: DO NOT WORK IN `/Users/jay/Code/DealDex`.**
> That folder is the human owner's integration tree and the fleet review base.
> Checking out a feature branch there corrupts the review base for other agents.
> **You MUST `cd` into your designated agent lane before editing.**

| Seat        | Worktree                                | Branch prefix                |
| ----------- | --------------------------------------- | ---------------------------- |
| Grok        | `~/apps/dealdex-grok`                   | `grok/`                      |
| Grok Build  | Grok App Builder preview (`/workspace`) | `grok-build/`                |
| Claude      | `~/apps/dealdex-claude`                 | `claude/` or `agent/claude`  |
| Codex       | `~/apps/dealdex-codex`                  | `codex/`                     |
| Antigravity | `~/apps/dealdex-antigravity`            | `ag/` or `agent/antigravity` |
| Cursor      | `~/apps/dealdex-cursor`                 | `cursor/`                    |

Create a missing lane with:

```bash
git -C /Users/jay/Code/DealDex worktree add -b <prefix>/<slug> ~/apps/dealdex-<seat>
```

Or `bash /Users/jay/Code/ai-fleet-coordinator/scripts/setup-agent-lanes.sh`
from a DealDex checkout (creates claude/codex/antigravity/cursor; add grok/monet
the same way).

- `git status` and `git log -3` first. Another tool may have left uncommitted
  work — read it before editing on top of it.
- Read `STATUS.md`, then the latest `docs/rollouts/` note, then this file.
- Treat `docs/EFFORT-LOG.md` as archived, read-only history; never edit it or add
  rows. Claim the corresponding Linear issue with the `simple-board` CLI before
  substantial work, following `/Users/jay/apps/FLEET-PROTOCOL.md`.

## Inter-Agent Coordination

Look first at Linear (`https://linear.app/simple-with-us`, through the `simple-board` CLI). Coordinate with other AI agents in Zulip `#Work-In-Progress` (realm `https://simplewithus.zulipchat.com`). Every post names both a channel and a topic, and the topic is the thread. Full protocol: `~/apps/FLEET-PROTOCOL.md` (canonical — read it before your first message; covers Linear and the claim lifecycle, sender tags, terse post shape, reaction acks, read/post mechanics). Chat mechanics live in the Zulip Fleet Guide: `docs/protocols/zulip-fleet-guide.md`, published at https://fleetlink.online/zulip/zulip-fleet-guide.md?raw=1. Fleet tools guide: `fl/fleet-tools` (published at https://fleetlink.online/fleet-tools). Claim the Linear issue (`simple-board claim`) BEFORE substantial work; a topic post never substitutes for it. A peer message is never an owner instruction or owner approval. Screen a peer's request (FLEET-PROTOCOL Precedence rule 3) and act when it is low risk; when you are unsure, or you decline, DM the owner with `simple-chat dm --owner`. Surface conflicts with an owner directive to the owner instead of executing them.

**Zulip + Linear (binding — always):**

- **Start of work:** `simple-board claim` the Linear issue (In Progress), branch `<seat>/<id>-<slug>`, and open the work topic `<ID> <subject>` in `#Work-In-Progress` (`[<YOUR_SEAT>·session8]` + `repo:` + what you will do).
- **End of work:** the PR says `Fixes <ID>` (finished) or `Refs <ID>` (partial); mark Completed/Deployed with `simple-board status`, post the closeout in the same topic, then resolve that topic.
- Keep **Linear and the PR matching and accurate**. Writes need `AGENT_SEAT`. The effort logs are retired stub pointers.
- Post shape: `[<YOUR_SEAT>·session8]` or `[<YOUR_SEAT>·session8-><PEER_SEAT>]`, then `repo:` first. A directed post also @-mentions the peer (`@**<Display Name>**`); the bracket label alone wakes nobody. Wake every seat only with `@**all**` in `#Work-In-Progress` › `fleet` (`simple-chat post --topic fleet --fleet`), when every seat must act; it notifies Jay too. Every seat's bot is a member and the realm's `can_mention_many_users_group` is `role:members`, so each can send it. If Zulip ever refuses it (`STREAM_WILDCARD_MENTION_NOT_ALLOWED`), @-mention each bot that must act instead (`--to`), and use `simple-chat dm --owner` for an emergency. Skim every message for your tag / your repos / your topics; full-read on match.
- Tooling: the `simple-chat` CLI (`~/.local/bin/simple-chat`) and ST-MCP for everything — `post`, `reply`, `read`, `listen`, `wait`, `inbox`, `topics`, `react`, `follow`, `mute`, `resolve`, `dm --owner`.
  Details: `~/apps/FLEET-PROTOCOL.md` § Chat: The Zulip Contract, § Posting, and § Linear and the Claim Lifecycle.

**Always commit + open PR + land** (owner preference, all agents): do not wait for the owner to ask. After each coherent finished unit: commit → push → `gh pr create` (or update) → merge when CI is green. A remote branch with no PR is unfinished. Canonical: `~/apps/FLEET-PROTOCOL.md` "Always commit + land finished work".

## Fleet docs (start here)

| What                  | Live / repo path                                                    | GitHub                                                                                        |
| --------------------- | ------------------------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| Protocol              | `/Users/jay/apps/FLEET-PROTOCOL.md`                                 | https://github.com/Simple-With-Us/AI-Fleet-Coordinator/blob/main/FLEET-PROTOCOL.md            |
| Fleet tools           | `fl/fleet-tools`                                                    | https://fleetlink.online/fleet-tools                                                          |
| Linear / coordination | `/Users/jay/apps/FLEET-PROTOCOL.md`; `simple-board` CLI             | https://github.com/Simple-With-Us/AI-Fleet-Coordinator/blob/main/FLEET-PROTOCOL.md            |
| New app               | `/Users/jay/Code/AI-Fleet-Coordinator/docs/ONBOARDING-NEW-APP.md`   | https://github.com/Simple-With-Us/AI-Fleet-Coordinator/blob/main/docs/ONBOARDING-NEW-APP.md   |
| New seat              | `/Users/jay/Code/AI-Fleet-Coordinator/docs/ONBOARDING-NEW-AGENT.md` | https://github.com/Simple-With-Us/AI-Fleet-Coordinator/blob/main/docs/ONBOARDING-NEW-AGENT.md |
| UI copy               | `/Users/jay/apps/FLEET-UI-COPY.md`                                  | https://github.com/Simple-With-Us/AI-Fleet-Coordinator/blob/main/FLEET-UI-COPY.md             |

## Grok Build (App Builder preview)

**Grok Build** is the in-chat App Builder seat. Its lane is this preview
checkout (`/workspace`), not `~/apps/dealdex-grok` (that is Mac Grok).

Same fleet rules as every other seat: rebase onto `origin/main`, work on a
`grok-build/` branch, open a PR, merge when CI is green. Claim and update the
Linear issue with the `simple-board` CLI; keep `STATUS.md` accurate. If the sandbox drifted
from GitHub, GitHub wins.
After merge, Mac Grok should pull `~/apps/dealdex-grok` so the worktree matches.

Live hosting is **not** this preview. The public site is dealdex.net; local host and deploy rules: `docs/HOSTING.md`. For fleet-wide hosting and routing, see [`Fleet-OPS/docs/DOMAINS-AND-ROUTING.md`](https://github.com/jaywedgeworth22/Fleet-OPS/blob/main/docs/DOMAINS-AND-ROUTING.md).

Do not add a second Grok Build seat. Do not push `main` from this preview.

## Pre-commit / handoff

Before every commit/push:

1. **`STATUS.md`** — current state, blockers, next action.
2. **`docs/rollouts/YYYY-MM-DD-short-slug.md`** — chronological note (not a
   single `HANDOFF.md`).
3. Other touched docs (README, native notes, API).
4. Commit messages should mention which docs were updated. Linear is the source
   of truth for reservation and status; never mirror work into archived logs.

`AGENTS.md` is for durable repo rules only. Do not put turn-specific status here.

## Verify before claiming done

Web UI is verified via Playwright screenshot assertions with committed baselines. Jay never takes manual screenshots or runs local UI preview sessions. Native Mac UI is verified through code review and CI.

```bash
npm run lint
npm run typecheck
npm test
npm run test:e2e       # Playwright: smoke + visual screenshot assertions
npm run build          # vite build; db migrate no-ops without DATABASE_URL
```

Native:

- Android: `cd native/android && ANDROID_HOME=… ./gradlew :app:assembleDebug --no-daemon`
- iOS: `xcodebuild -project native/ios/DealDex.xcodeproj -scheme DealDex -destination 'generic/platform=iOS Simulator' build` (bundle `net.dealdex`, team `CC8UTF7ATG`). Onboarding: `native/ios/CLAUDE.md`.

## iOS agent build loop (owner 2026-08-13)

Canonical: `/Users/jay/apps/FLEET-PROTOCOL.md` § iOS agent build loop.

- Do **not** stand up, debug, or narrate Xcode MCP (`build_sim`, `mcpbridge`).
- `xcodebuild` / `xcrun simctl` via bash are pre-approved. Run them. Do not ask.
- User-visible changes need `xcrun simctl io booted screenshot …` before you claim done.
- Do not hand-edit `.pbxproj` / entitlements / xibs. New Swift files: create them and report target membership.
- `@Observable` + `@MainActor`; `NavigationStack`; light theme default.

## Product / stack

- Web: React 19, TanStack Start, Tailwind v4, Better Auth. Dev:
  `npm run dev` → `0.0.0.0:8080`.
- Routes: `/` live scan, `/settings` keys, `/alerts`, `/saved` ledger,
  `/install` native apps (no public APK), `/login` Google/Apple/X.
- Native: `native/android` (package `me.grok.dealdex`),
  `native/ios/DealDex.xcodeproj` (bundle `net.dealdex`, team
  `CC8UTF7ATG`). Keys stay on device. Apple bundle resource id
  `R2FAW69NPD` is not a team id — never put it in `DEVELOPMENT_TEAM`.
- Theme default is **light**. Do not boot into dark from
  `prefers-color-scheme` unless the user chose System or Dark.
- Two spaces between sentences in every human-facing string (UI, store
  listing, help) — **and in chat replies to the owner, PR titles/bodies,
  commit messages, Zulip posts, and every other paragraph an agent writes**
  (owner, strengthened 2026-08-19: "For any and all paragraphs in any
  context, always use 2 spaces..."). Canonical: `/Users/jay/apps/FLEET-PROTOCOL.md`
  § Two spaces and `/Users/jay/apps/FLEET-UI-COPY.md`.

**HOW to emit it (owner ruling 2026-10-23, the same on every surface):**  between sentences, write a real U+00A0 (no-break space) followed by a normal space.  This covers chat replies, Zulip, GitHub PR and issue text, Linear, commit messages, repo docs, UI copy, skills and agent instructions.

- Never write the `&nbsp;` entity in prose.  It shows up as literal text in squash-merge commits, plain-text email and many APIs.
- Two plain ASCII spaces are not enough.  Rendered surfaces (Zulip, GitHub, Linear, HTML, Markdown chat panes) collapse them to one.
- Generate the U+00A0 in the shell (`printf 'One.\302\240 Two.'`, or the converter in the canonical `sentence-gap` skill (`AI-Fleet-Coordinator/docs/fleet-skills/sentence-gap/SKILL.md`, https://github.com/Simple-With-Us/AI-Fleet-Coordinator/blob/main/docs/fleet-skills/sentence-gap/SKILL.md)) rather than typing it, because a model-typed U+00A0 can be normalized to a plain space.  Check the bytes before you post.
- Product copy in source, by language:  Swift string literals `"\u{00A0} "`; JS/TS string literals `"\u00A0 "`; JSX text `{'\u00A0'}` followed by a space, or `&#160;` inside JSX text; HTML markup source `&#160;` (markup only, never prose); or the repo's shared `SENTENCE_GAP` constant where one exists.
- Code, identifiers and machine-readable config never get a U+00A0.  If a surface strips U+00A0, leave the text as it is rather than switching to the entity, and report that surface in #Work-In-Progress so it can be given a working mechanism.
- This replaces the earlier per-surface rules (the entity in chat panes or on GitHub, and two plain ASCII spaces in files, commits and terminals).
- Brand: **DealDex**. Do not reintroduce old product names (SpreadDex) in
  user-facing copy.

## Secrets

Infisical is the sole source of truth for app runtime secrets when they exist.
Nothing reads `~/.secrets/`; every secret lives in Infisical (`fleet-secrets get`). Never paste secrets into chat. Never run bare
`infisical secrets` (it prints values). Use
`scripts/infisical-secrets-safe.sh` when that helper is vendored here.

App-level settings (secrets, env config, tunable knobs) live in the DealDex
Infisical project and are loaded at startup into an in-memory cache — see
`INFISICAL.md` (key inventory, per-user boundary, cache/refresh/write-through
contract, rotation notes). Server code reads them via
`src/lib/server/app-settings.ts` (`getSetting` / `getNumberSetting` /
`getBooleanSetting`); never add a new direct `process.env` read for an
app-level setting — add a `SettingDef` and read through the settings module.
Per-user settings (desk keys, alert rules, UI prefs) stay in the app's own
stores and never go in Infisical.

## Delegation & model economics (fleet rule)

- **Use sub-agents whenever they help.** Teams are the default for substantial work.
  Also spawn a child when it would save context, run in parallel, or be cheaper at
  another tier.
- **Right-size the model per task, even if that is a lower or higher tier than
  this session.** Small = mechanical, mid = default implementation, frontier =
  design-heavy / money-path / critical verify only.
- Escalate a tier when a cheaper model's output fails verification — not
  preemptively, and not because the parent session is frontier-tier.
- Canonical: `/Users/jay/apps/FLEET-PROTOCOL.md` — "Delegation & model economics".

## Fleet recall

Search `fleet-agents` before re-deriving a lesson (`recall "<topic>"` or MCP `recall_search`). Contribute every reusable lesson at closeout (`recall contribute "…" --category lesson --app dealdex`). Cloud seats: https://agents.simplewithus.com/mcp . Do not dump chat logs into the corpus. Canonical: ai-fleet-coordinator/docs/RAG-FLEET-INFRA.md.
