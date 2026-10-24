# Blank-Slate UI Redesign Playbook

A reusable process for redesigning any project's UI from scratch, as if it were a brand-new product nobody has seen, while still covering everything the current app can do.

**Core principle:** keep *what the app does*, throw away *how it looks*. The only thing that crosses from the old app to the new design is a written, layout-free list of user needs. No screenshots, CSS, markup, class names, colours, fonts, icons, UI wording or screen order cross over.

**The firewall:** whoever sees the old app never designs, and whoever designs never sees the old app.

---

## How to run this in a project

1. In the project, start a session and say: **"Start the blank-slate redesign from `~/.claude/playbooks/blank-slate-redesign.md`."**
2. Claude does **Step 0** (setup). It copies this playbook into the project as `redesign/redesign-plan.md` and fills in the project-specific blanks. That copy is the living plan for this project, with its own checklist. This file stays a generic template.
3. After that, work **one step per session**. At the start of each session, Claude checks the model (see below) and reads only what that step needs. When the step is done, Claude ticks it in the checklist (near the top of the project's copy) in the same commit.

Throughout, `<base>` from the generic playbook is `main` here (this project has no staging branch; see "Project details"), and the project folder is `spendings-tracker`.

## Project details (filled in at Step 0, 2026-10-24)

**Source files for the inventory** (taken from the code; the project's `CLAUDE.md` is partly out of date: it says Next.js 14, the code runs Next.js 16.2):
- Screens: `src/app/page.tsx` (spending overview), `src/app/transactions/page.tsx`, `src/app/ocr/page.tsx` (screenshot import and review), `src/app/categories/page.tsx`, `src/app/layout.tsx`, `src/app/globals.css`
- Server: `src/app/api/ocr/route.ts` (sends screenshots to the Claude API)
- Components: everything in `src/components/` (charts, period navigation, filters, forms, delete confirmations, import review rows, navigation, service-worker registration)
- Data and logic: `src/hooks/useCategories.ts`, `src/hooks/useTransactions.ts`, `src/hooks/useTransactionCounts.ts`, `src/lib/firebase.ts`, `src/lib/seedCategories.ts`, `src/lib/dateRanges.ts`, `src/lib/format.ts`, `src/lib/categoricalPalette.ts`, `src/types/index.ts`
- Installable / offline: `src/app/manifest.ts`, `public/sw.js`, `public/icons/`
- No auth, no permissions, no exports, no tests in the repo.

**Project constraints** (for Step 6):
- Next.js 16.2 App Router, React 19, TypeScript, Tailwind CSS 4. This Next.js has breaking changes: read `node_modules/next/dist/docs/` before writing code (`AGENTS.md`).
- Build: `next build`; lint: `eslint`. No unit or e2e test framework yet: Step 6 must plan one.
- Data: Firebase Firestore, read and written directly from the browser with the client SDK (collections `categories`, `transactions`). No emulator or test project exists, so any test run today would hit the live database: the plan must add a safe test setup (emulator, fake credentials, `demo-` project ID) before e2e tests write data.
- AI: Claude API (vision) through the `/api/ocr` route, key in `ANTHROPIC_API_KEY`.
- Single user, no authentication. Amounts in IDR (Rp XX.XXX.XXX). Used mostly on a phone; installable as a PWA.
- Hosting: Vercel. **Every push to `main` deploys to production**; other branches get preview deploys.

**Git setup:** no staging setup. Today every change is committed and pushed straight to `main` with `./push.sh "<message>"` (`git add -A`, commit, `git push origin main`), and `AGENTS.md` asks for a commit and push after each validated change. The rebuild runs on `redesign` (preview deploys only). The merge step offers the switch to the staging setup.

**Domain words allowed in the inventory:** spending, expense, transaction, purchase, transfer, amount, total, rupiah / IDR, store, merchant, description, note, category, category colour, emoji, date, day, week, month, year, period, trend, biggest spends, share of total, BCA, bank, banking app, screenshot, import, extract, review, confirm, reassign, source (typed in by hand vs. imported from a screenshot).

**Live URL, preview domains, repo:**
- Production: `https://spendings-tracker-vert.vercel.app`
- Previews: `https://spendings-tracker-*-gregorykurnia-8729s-projects.vercel.app`
- Repo: `https://github.com/gregorykurnia/spendings-tracker` (Vercel project linked to it)

**Machines you'll design on:**
| Machine | OS | Codebase path | `id -u` | Login shell |
|---|---|---|---|---|
| Oracle server `investment-office` (over SSH / Termius) | Ubuntu 24.04, arm64 | `/home/ubuntu/spendings-tracker` | 1001 | bash |

Studio: `/home/ubuntu/spendings-tracker-studio`. Prerequisites present at Step 0: `bwrap` (with its AppArmor profile), `socat`, `tmux`, Playwright headless shell (for `./shoot`). Screenshots are printed as paths: view them through VS Code Remote-SSH or copy them to the Mac.

**Extra folders denied in the studio** (may hold screenshots or browser history of the old app): `~/uploads`, `~/inbox`, `~/IMG_*.PNG` in the home folder, `~/.cache/chrome-devtools-mcp`, `~/.cache/ms-playwright-mcp`.

**Firewall check values for this machine** (Appendix E): `<ABS_PROJECT_PATH>` = `home/ubuntu/spendings-tracker`, `<A_FILE_THAT_EXISTS>` = `package.json`, `<LIVE_DOMAIN>` = `spendings-tracker-vert.vercel.app`, `<CLAUDE_TMP>` = `/tmp/claude-1001/-home-ubuntu-spendings-tracker`, `<CLAUDE_CACHE>` = `~/.cache/claude-cli-nodejs/-home-ubuntu-spendings-tracker`, `<TMUX_SOCKETS>` = `/tmp/tmux-1001`.

**Plugins:** every installed plugin is `false` in the studio's `enabledPlugins` except `frontend-design@anthropic-plugin-directory`. `git worktree list` shows no extra copies of the repo; no Kilo folder on this machine.

---

## Checklist

When a step finishes, Claude ticks its box here in the same commit, never before. Studio steps (4a–5) happen in the studio, so they're ticked from the codebase when you report them done, or at the import at the latest. Each line ends with its pick: the model and effort, then who runs it.

**Setup**
- [x] Step 0: plan copied and blanks filled; studio templates, `studio.sh`, codebase `CLAUDE.md` rules; `studio.sh init` run — **Haiku 5.5 Max** · Claude on `main`
- [ ] Step 0b: firewall check on every machine you'll design on: every channel *blocked* — **Haiku 5.5 High** · fresh studio session

**Discovery (sees the old app)**
- [ ] Step 1: `inventory.md` as job stories grouped by jobs; owner-only `inventory-notes.md`; starter `priorities.md`, `brief.md`, `needs.md` — **Opus 5.5 Medium** (High if the codebase is large or its docs are out of date) · Agent A on `main`
- [ ] Step 1: second leak review; removed details logged in §7 — **Sonnet 5.5 High** · fresh session on `main`
- [ ] Step 1b: banned-word scan clean — **Haiku 5.5 High** · Claude on `main`
- [ ] Step 1b: guess-the-layout test passed (§8) — **Opus 5.5 High** · fresh studio session (the test is only as strict as its reader)

**Brief (you, without opening the app)**
- [ ] Step 2: §4–§5 decided; `priorities.md` status `FILLED` — you · helper session **Haiku 5.5 Max**
- [ ] Step 3: `brief.md` status `FILLED`, including the branding decision — you · helper session **Haiku 5.5 Max**

**Design (studio, never sees the old app)**
- [ ] Step 4a: 3 directions as screenshots; familiarity check done; choice recorded in `decisions.md` — **Sonnet 5.5 xHigh** · studio; screenshots by `! ./shoot`, no model
- [ ] Step 4b: all job stories and states prototyped, including stress data — **Sonnet 5.5 xHigh** · studio
- [ ] Step 4c: design guide complete — **Sonnet 5.5 xHigh** · studio
- [ ] Step 5: coverage audit passed — **Sonnet 5.5 High** · fresh studio session
- [ ] Step 5b: design guide approved, versioned and imported — you approve, then **Haiku 5.5 High** · Claude on `main`

**Implementation plan (sees repo and approved design)**
- [ ] Step 6: `ui-implementation-plan.md` with component map, screen map and coverage matrix — **Opus 5.5 High** · Agent C
- [ ] Reverse coverage complete; gaps sent through the design-gap loop — **Opus 5.5 High** · Agent C
- [ ] §7.0 model per task, chosen from the global table; calibration trial planned — **Opus 5.5 High** · Agent C
- [ ] Plan approved; `autorun check` finds its first §7.0 row — you

**Rebuild**
- [ ] `redesign` branch created — **Haiku 5.5 Max**
- [ ] Phase 1: data separated from rendering, no visual change, tests green — each task's pick from §7.0; review **Opus 5.5 High**
- [ ] Phase 2: tokens, base styles and app shell — each task's pick from §7.0; review **Opus 5.5 High**
- [ ] Phases 3–6: components, screens, states and edge surfaces, every task on `redesign` — each task's pick from §7.0; reviews **Opus 5.5 High**
- [ ] Phase 7: new UI is the default; frozen fallback and one-commit rollback in place and tested; old-names check passes (fallback excluded) — each task's pick from §7.0; review **Opus 5.5 High**
- [ ] Phase 8: tests rewritten and passing; screenshots match; accessibility passes — each task's pick from §7.0; review **Opus 5.5 High**
- [ ] Merged to `main` (Step 7, "Merge and settle the project's rules"); `CLAUDE.md` updated to the new UI with a lasting checks rule — **Sonnet 5.5 High**
- [ ] Staging setup offered, if the project doesn't have it, and done or declined (recorded in the plan) — *owner* decides, then **Sonnet 5.5 High**
- [ ] Phase 9: after-launch check done; fallback and every old file deleted; old-names check passes with no exclusions; every `needs.md` row designed and built — each task's pick from §7.0

---

## Choosing the model for each step

**Principle: the cheapest model that does the step well.** Quality comes first: a step's output has to pass the check that follows it (a leak review, scan, test, audit or review). Among the models that would pass, use the cheapest. The picks below are the current best guess at that point.

**The model table lives in `~/.claude/CLAUDE.md`, under "Model choice for coding implementation".** This playbook doesn't copy it, so updating that table updates every project. Each step below says what *kind* of work it is and gives the current pick. If the table has changed since this was written, choose again by the kind of work. The table wins over the picks written here.

| Kind of work | What to optimise | Current pick |
|---|---|---|
| **Visual design** (directions, prototype, design guide) | Best Presentation Elo rank | Sonnet 5.5 xHigh |
| **Risky or complex code** (data layer, sync, editors, auth, anything that can lose data or break production) | Best Terminal Bench rank | Opus 5.5 High |
| **Careful reading and judgment** (inventory, plan reviews, well-specified hard tasks) | Strong Terminal Bench rank at lower cost | Opus 5.5 Medium |
| **Many rules, low damage** (screens with real data, mapping, coverage checks) | Middle tier | Sonnet 5.5 High |
| **Mechanical, exact reference** (port from prototype, templates, scripts, scans) | Cheapest that is reliable | Haiku 5.5 Max → xHigh → High |

Never pick **Opus 5.5 Low** or **Sonnet 5.5 Medium**: Haiku 5.5 Max beats both on both ranks at under half the cost (see the global table notes).

**Where Haiku stops:** Haiku 5.5 rows are for exact copies with no state or interaction logic (tokens, icons, a component gallery, scripts). A screen with interaction, failure states or changes to shared components starts at Sonnet 5.5 High: in a calibration trial, Haiku 5.5 Max bent a shared component, could save a record twice on retry and skipped the failure states.

**Model check:** at the start of every session, compare the current model and effort with the step's pick. If the current one is lower, say so before starting and suggest switching (`/model`, plus the effort setting). If it's much higher for a mechanical step, suggest the cheaper one.

**Move up after a failed check (every step):** when a step's output fails the check that follows it, redo the fix one row stronger in the global table and update that step's pick in the project's copy. For example, a leak review lets through wording that the scan or the guess-the-layout test catches, or an end-of-phase review rejects the work. Don't run one-off steps twice just to compare models; that costs more than it saves. Calibration trials belong in the rebuild (§7.0), where many similar tasks repeat.

### Picks per step

Each step's pick (model, effort and who runs it) is on its line in the **Checklist** near the top. That's the only copy: when a pick moves (see below), change it there.

---

## The firewall: what crosses and what doesn't

Design happens in a **separate folder**, `../spendings-tracker-studio`. It's its **own git repo** on branch `design-studio`, with fresh history and **no remote**. The codebase's commits aren't in its `.git`, so not even a git command that slips past the block rules can show the old app. Work moves only through `redesign/studio.sh`, which runs from the codebase:
- **In** (`enter`): copies the committed `redesign/handoff/` into the studio.
- **Out** (`enter` and `import`): copies the studio's branch into the codebase repo as `design-studio` (and backs it up to `origin`). `import` then brings `redesign/design/` onto `main`.

Studio sessions are started only with `./start` in the studio folder. It refuses `--continue` and `--resume` and launches Claude Code with **no MCP servers and no claude.ai connectors**.

| | `main` (the codebase) | the studio |
|---|---|---|
| Old app code, tests, brand assets | ✅ | ❌ not on disk |
| Git history | Old commits | Studio commits only; the old commits aren't in its `.git` at all |
| Git remote | `origin` | none |
| `CLAUDE.md` | Describes the old app | Studio-only: designer role, firewall, process, deliverables |
| `.claude/settings.json` | as before | Sandbox on (shell commands can't read the codebase or Claude Code's history files, have no network, and can't change the guard files); deny rules for the same paths in Claude's file tools; web tools, every MCP tool, and messaging other Claude sessions all off |
| Connectors, MCP servers, plugins | as configured | Off (`./start` and `enabledPlugins`), except design-guidance plugins set to `true` (default: `frontend-design`), with `mcp__*` denied as a backup |
| Claude Code memory | Codebase folder's memory | Separate (memory is per folder) and turned off |
| `redesign/handoff/` | Where the handoff package is written | Synced copy (read-only input) |
| `redesign/design/` | Imported after approval (Step 5b) | Where the designer works |

### Allowed into the studio (the handoff package, `redesign/handoff/`)
1. `inventory.md`: user needs, written as job stories (Step 1)
2. `priorities.md`: how often each job happens (Step 2)
3. `brief.md`: who uses it, personality, outside references, branding (Step 3)
4. `needs.md`: design gaps found later, written as needs (the design-gap loop)

Everything in `redesign/handoff/` goes through the same banned-word scan before each `enter`.

### Never allowed into the studio
- The codebase folder, or any session that has been in it. Always start a **brand-new** session in the studio with `./start`, never `--continue` or `--resume`, and never as a subagent spawned from a codebase session.
- Anything you paste in by hand: screenshots, copied text, files dragged into the terminal. If you need to tell the designer something, write it as a need in `needs.md`.
- The codebase's `CLAUDE.md` or `AGENTS.md`, source code, styles, tests, this plan, `redesign/inventory-notes.md`
- Screenshots, screen recordings or descriptions of the current app
- Logos, favicons, current colours or fonts (unless deliberately kept, see Step 3)
- Class names, element IDs, test IDs, database field names
- Phrases like "like the current one but…" or "improve the existing…"

The global `~/.claude/CLAUDE.md` loads in the studio too. That's fine, because it holds the model table, but it must never describe any project's UI. Its pointer to this playbook is for codebase sessions only, and the studio's `CLAUDE.md` tells the designer to ignore it.

---

## Step 0: Setup (Claude on `main`, Haiku 5.5 Max)

1. **Copy this playbook** to `redesign/redesign-plan.md` and fill in these blanks:
   - **Source files for the inventory:** every file that produces UI or behaviour, including auth, permissions, offline/PWA, editors, exports, and tests. Take these from the **code**, not the docs: a project's `CLAUDE.md` is often out of date.
   - **Project constraints** for Step 6: framework or no framework, build step, data backend, hosting, deploy behaviour (for example, "every push to `main` deploys to production").
   - **Git setup:** whether the project already has the staging setup (a `staging` branch its host doesn't deploy, releases with `git push origin staging:main`, local previews). If not, write down how it deploys and commits today; the merge step offers the switch.
   - **Domain words** the user would say out loud and that are allowed in the inventory (for example "invoice", "patient", "minutes of meeting").
   - **Live URL(s), preview domains and repo URL** for the deny rules.
   - **Every machine you'll design on** (your laptop, a VM, a second computer): its OS, the codebase's absolute path there, `id -u`, and its login shell. The studio's rules name paths, so each machine gets its own set (Appendix B) and its own Step 0b run.
   - **Every installed plugin** (`claude plugin list`), to set in the studio's `enabledPlugins`: `false` for each one, except design-guidance plugins that hold no information about the app. Those are `true`. The default `true` plugin is `frontend-design@anthropic-plugin-directory`. Check any plugin you want to turn on against the plugin check in Appendix B first. MCP servers and connectors need no list: `./start` and the `mcp__*` rule cover all of them.
2. **Write the studio templates** to `redesign/studio-template/`: `CLAUDE.md` and `settings.json` from the Appendix, with the placeholders filled in. They contain no trace of the old UI, so they're safe on `main`.
3. **Write `redesign/studio.sh`** from the Appendix and run `chmod +x redesign/studio.sh`.
4. **Add the codebase rules** from the Appendix to the project's `CLAUDE.md`.
5. Commit, then run `redesign/studio.sh init`. This creates the studio as its own repo with the templates and the `./start` launcher in place.

## Step 0b: Firewall check (fresh studio session, Haiku 5.5 High)

Before anything is handed off, prove the studio can't reach the old app. The handoff folder is still empty at this point, so nothing leaks even if a check fails.

1. In a **new terminal**: `cd ../spendings-tracker-studio && ./start`.
2. Type `/mcp`, `/memory` and `/sandbox` yourself, then send the firewall-check prompt from Appendix E. It tries each channel and reports only *blocked* or *reachable*, never content.
3. Run `/exit`. Never reuse this session.
4. Any channel that comes back **reachable** gets fixed in `redesign/studio-template/`. Commit, run `redesign/studio.sh enter` (it refreshes the studio's guard files), and repeat in a new `./start` session until the result is ALL BLOCKED.
5. Run the check again whenever you add a new connector, plugin or MCP server to your account.
6. **List every tool that makes copies of the repo** (AI editor extensions with worktree pools, such as Kilo in `~/.local/share/kilo`; other agents' workspaces) with `git worktree list` and a look at the editor's extensions. Remove them, or add their folders to the studio's deny rules. Such a copy of the old code was found late in one project.
7. **Every machine you design on passes its own check** before its first `enter`. A new machine's paths must already be in the template (Appendix B); rules that name another machine's paths protect nothing there. On Linux, install `bubblewrap` and `socat` first (on Ubuntu 24.04, also an AppArmor profile that lets `/usr/bin/bwrap` use user namespaces), or `./start` refuses to run. To move design work to another machine, run `enter` on the old one first so `origin` has the latest `design-studio`; the first `enter` on the new machine rebuilds the studio from it. Design on one machine at a time.

---

## Step 1: Capability inventory (Agent A, sees the old app)

**Pick:** Opus 5.5 Medium (High for large or poorly documented codebases).

Agent A reads the source files listed in Step 0 and writes `redesign/handoff/inventory.md`. Anything that refers to code or current behaviour goes into the owner-only `redesign/inventory-notes.md`, which never leaves `main`. It has these sections:
- §1 Code map (for Agent C)
- §2 Current behaviour details
- §3 Data model
- §4 Placeholders and half-built features to decide on
- §5 Bugs and unclear intent to decide on
- §6 Constraints
- §7 Details removed during leak reviews
- §8 Guess-the-layout test results
- §9 Decisions made in Step 2

**Rule 1: no layout words.** Banned words: sidebar, tab, drawer, modal, popup, dialog, menu, ⋯, toolbar, panel, pane, list, grid, card, header, footer, column, row, button, icon, badge, toggle, dropdown, arrow, tree, page, screen, view, left, right, top, bottom. Add any word that names a distinctive part of *this* app's UI.

**Rule 2: no UI terms.** Describe the need, not the current label. "Starred" becomes "mark items as important". "Lock" becomes "restrict access with a password". Keep only the domain words listed in Step 0.

**Rule 3: group by user jobs, not current screens.** Grouping that follows the current screens recreates them. Use job groups that fit the product, for example:
- Capture
- Find
- Organise
- Share & control access
- Work anywhere

Give each story an ID (for example C1, F3).

**Rule 4: write each need as a job story.**
> When I ___, I want to ___, so that ___.

| ❌ Leaks the old design | ✅ Job story |
|---|---|
| "Sidebar tree with collapse arrows" | "When I have many nested projects, I want to move between any of them quickly and always know where I am, so that I don't lose context." |
| "⋯ context menu on items" | "When something changes, I want to rename, relocate, restrict or share it, so that the structure stays accurate." |
| "Starred tab" | "When something matters a lot, I want to flag it and find all flagged things together, so that I can get back to them fast." |

The inventory must also list, in neutral language:
- **States:** nothing yet, loading, failure, no connection, restricted, read-only, visiting via a shared link, live-synced, plus anything this app has
- **Roles and permissions:** what each kind of user can see and do
- **Hard constraints:** devices, installable, file limits, rich text, exports

**Starter files for you.** Agent A also creates:
- `redesign/handoff/priorities.md`: status line `Status: DRAFT`, then a table `ID | Job story (short) | Frequency` with one row per story and the Frequency column empty
- `redesign/handoff/brief.md`: status line `Status: DRAFT`, then the headings from Step 3, each followed by a one-line prompt and no answers
- `redesign/handoff/needs.md`: status line `Open needs: none`, then an empty table `ID | Need (job story) | Raised in | Status`

**Second leak review** (fresh session, Sonnet 5.5 High): read only `inventory.md` and rewrite every story that still implies the current layout, order or wording. Log the removed details in `inventory-notes.md` §7, where Agent C can use them later.

## Step 1b: Sanitisation (you, plus a fresh agent)

1. **Banned-word scan** (Haiku 5.5 High): search every file in `redesign/handoff/` for every banned word and rewrite any hit. Repeat this scan before every `enter` from now on.
2. **Guess-the-layout test** (Opus 5.5 High):
   - Run `redesign/studio.sh enter`.
   - In a **new terminal**, run `cd ../spendings-tracker-studio && ./start` and send:
     > Read only `redesign/handoff/inventory.md`. Don't design anything. Describe, as specifically as you can, what you imagine the *current* version of this app's layout looks like.
   - Then run `/exit`. Never reuse that session for design.
   - Compare its guess with the real app. If it describes the real layout, something leaked: rewrite that story on `main`, log it in §8, and run the test again.

## Step 2: Priorities (you)

1. Decide the open questions in `inventory-notes.md` §4–§5. Add newly confirmed needs to `inventory.md` as job stories, written by the same rules, and log the decisions in §9.
2. Fill in `redesign/handoff/priorities.md`: one row per story ID, tagged **daily / weekly / rare / drop**. Do this from memory of *what you do*, not by opening the app.
3. Set its status line to `FILLED`.

These rankings decide the visual hierarchy, and they should drive the design more than anything else.

## Step 3: Design brief (you)

Fill in `redesign/handoff/brief.md` and set its status line to `FILLED`. It covers:
- **Who uses it:** people, roles, devices, context
- **Language:** which language(s) the interface uses
- **Personality:** calm or editorial? dense and tool-like? playful? warm or clinical?
- **References:** 2–3 apps you admire that are *not* this one
- **Constraints:** phone and desktop, installable, light and dark mode, signed-in vs. visiting via a link, role-based visibility
- **Branding:** by default the name, logo and colours are all open. If you keep something, write only that (for example the name). Never pass logo files or the palette.
- **Permission to challenge the model:** the designer may propose merging, splitting or removing concepts. Proposals are flagged for your decision, never silently adopted.

---

## Step 4: Design from zero (Agent B, in the studio)

**Starting a studio session:**
1. On `main`, with everything committed, run `redesign/studio.sh enter`. This syncs `redesign/handoff/` into the studio.
2. Open a **new terminal** (outside tmux): `cd ../spendings-tracker-studio && ./start`. With tmux installed, it opens its own session on the studio's tmux server. Never use plain `claude`, `--continue` or `--resume` there.
3. Send: *"Start the design process described in CLAUDE.md."* (or *"Continue the design process"*)

The studio's `CLAUDE.md` (Appendix) gives Agent B the full process. In short:

### 4a: Three directions, returned as screenshots (Sonnet 5.5 xHigh)

Most of the cost is in *building* directions, not in showing them. So each direction is kept small, and you judge it from images:
- **Three deliberately different directions**, varying the way people move around, density, type, colour and personality.
- Each direction is **one static HTML file** in `redesign/design/directions/<letter>-<name>/index.html`:
  - It shows only the **#1 daily job** from `priorities.md`, plus one secondary moment if it's needed to show how people move around.
  - Mock data and CSS are inline. There is no routing, no interactivity, no states and no dark mode.
  - It responds to width, so the same file gives the phone screenshot.
- A **`README.md` of at most 10 lines** per direction: the idea, how people move around, density, type and colour.
- **Screenshots by script, not by model:** when the three are ready, the designer asks you to type **`! ./shoot`** in the studio session. It saves `desktop.png` (1440×900) and `phone.png` (390×844) for each direction and opens them for you. It runs as you, because Chrome can't run inside Claude's sandbox, and it's locked down so the pages can't reach anything but Google Fonts (Appendix B).
- Agent B may look at **one** screenshot to check that it rendered. It doesn't read all six back, and it doesn't describe them to you. You look at the images.
- **Familiarity check (you, privately, before replying):** ask yourself which option looks most like the current app. If that's the one you're drawn to, treat it as a warning sign: say why you like it in terms of the brief and the priorities, not because it "feels right". Never tell the designer what the current app looks like, or which option resembles it.
- You reply with a pick, or a mix ("A's layout with C's type"). A mix gets **one** extra screenshot round, then it's settled. Write the choice and the reason (in brief and priority terms) in `redesign/design/decisions.md`.

### 4b: Expand the chosen direction (Sonnet 5.5 xHigh)

The chosen direction becomes the full prototype in `redesign/design/prototype/`. It covers every job story and every state (nothing yet, loading, failure, no connection, restricted, read-only role, shared-link visitor, bulk selection, no search results), on phone and desktop, in light and dark. Work through it in several sessions, one group of jobs per session. The losing directions stay as files and are never expanded.

**Stress data:** besides tidy mock data, every screen gets a stress version (a `?stress` switch or a second data set):
- very long names and titles, with no spaces and in other scripts
- huge counts (thousands of items, deep nesting)
- empty optional fields
- the longest realistic body text
- many people or roles at once
- tiny and huge images

This way the rebuild never meets a layout the prototype didn't design for.

### 4c: Design guide (Sonnet 5.5 xHigh)

Write `redesign/design/design-guide.md` and `redesign/design/tokens.css`:
- **Tokens:** colour (light and dark), type scale, spacing, radius, elevation, motion, breakpoints
- **Components:** every reusable piece, with all variants and states (default, hover, focus, active, disabled, loading, error, selected, empty)
- **Screens:** every screen in every state, on phone and desktop, in light and dark
- **Patterns:** feedback, destructive actions, empty states, loading, motion rules
- **Copy and tone:** voice, labels, message wording
- **Accessibility:** contrast, focus visibility, keyboard behaviour, touch targets

**Mid-design rule:** if you catch yourself saying "the current app does it like X", stop. Translate it into a need ("I need to get to X in one step from anywhere") and give the designer the need, not X.

## Step 5: Coverage audit (fresh studio session, Sonnet 5.5 High)

Write `redesign/design/coverage.md`, mapping every story ID and state to where the prototype covers it. You check it by walking through the prototype yourself. Anything missing is a gap to send back to Agent B as a *need*. It's never solved by borrowing from the old UI.

## Step 5b: Approve, freeze and import (you, then Claude on `main` with Haiku 5.5 High)

1. Approve the design guide and freeze it with a version and date (for example `design-guide v1.0 (2026-xx-xx)`). Later changes go through Agent B and bump the version.
2. In the codebase folder, say **"Import the approved design"**. Claude runs `redesign/studio.sh import`, which copies `redesign/design/` from `design-studio` onto `main` and commits it. The firewall only blocks old → new, so this direction is safe.
3. Keep the studio. Gaps found later go through the design-gap loop below.

## Design-gap loop (any time after Step 5b)

Step 6 and Step 7 will find things the design doesn't answer. They get **designed in the studio**, never filled in from the old app:
1. **Record it** in the implementation plan §9.1, with whatever code context Agent C or the implementer needs. This stays on `main`.
2. **Translate it** into a need in `redesign/handoff/needs.md`: a new ID (N1, N2, …), a job story by the Step 1 rules, the step that raised it, and status `open`. Leave out code, old behaviour and old wording.
3. **Banned-word scan** on `needs.md` (Haiku 5.5 High), then commit.
4. `redesign/studio.sh enter` → `./start` → *"Design the open needs in needs.md"* (Sonnet 5.5 xHigh). The designer updates the prototype and guide, bumps the guide version, and logs each answer in `decisions.md`.
5. **"Import the approved design"** on `main`. Mark the need `designed` in `needs.md` and close its row in §9.1. During the rebuild, also bring the import onto `redesign` (`git switch redesign && git pull --ff-only origin redesign && git merge main && git push origin redesign && git switch main`).

The rebuild task that needs the answer waits until the need is designed. Other tasks continue.

---

## Step 6: Technical implementation plan (Agent C, Opus 5.5 High)

Agent C sees the repo and the approved design. Before any code changes, it writes **`redesign/ui-implementation-plan.md`**. **Keep it lean:** every task session reads its task section and the §7.0 table, so each task section fits on about one screen (what to build, the guide and prototype references, Done when), and table cells stay short. A task that runs a slow tool (the full suite, screenshots of every prototype state, anything over about 15 minutes) and then fixes what it finds is split: one task builds the tool, runs it once and lists the differences or failures; then fix tasks by app area, each rerunning only its area. (Two such tasks, each written as one, took about 4 hours apiece, nearly all of it waiting on reruns.) Design detail stays in the design guide; history goes in git and `CHANGELOG.md`, never back into the plan. Agent C maps **design → code**; it doesn't make design decisions, and every gap it finds goes to §9.1 and then through the design-gap loop.

Required sections:

**Header line:** `**AI Build Log project:** <App name> Redesign` (where `autorun` sends each session's costs; a project of that name is made on the first send).

**1. Inputs & freeze:** the design-guide version, the inventory version, and the commit it starts from.

**2. Technical architecture**
- The project constraints from Step 0
- **How the rebuild runs next to the old app** (a parallel entry point, route or flag), so production keeps working until the switch-over
- File layout at the end
- A new naming convention that shares nothing with the old names
- Theming through tokens
- How fonts and icons load
- How data logic is separated from rendering
- How special surfaces are styled (editors, exports, guest views)

**3. Component map:** for each design-guide component: its CSS selector(s), the JS or component that builds it, and its file. Also every variant and state and how code triggers it (class, attribute, `aria-*`), plus responsive and accessibility requirements.

**4. Screen map:** for each screen: the components it uses, the data it reads, the code it replaces, and every state it can be in.

**5. Coverage matrix (design → code):** every **screen × state × device × theme** with a checkbox, and every job story traced to its screen, component and code.

**6. Reverse coverage (code → design):** search the code for **every place that produces visible UI** and map each one to its new counterpart. Easy to miss:
- Auth flows (sign-in, reset, invite)
- Role-gated UI
- Native `alert()`, `confirm()` and `prompt()`
- Toasts and inline errors
- Lightboxes and previews
- Editor content styles
- PDF, print and email output
- Guest or shared-link views
- 404 and error pages
- PWA install prompt, manifest theme colour, favicon, app icons
- Sync and offline indicators
- Upload progress and failures

Anything without a design counterpart goes to §9.1. It is **never** restyled from the old version.

**7. Phases:** each phase ships to a preview, keeps tests green, and lists its tasks, files and done criteria:
1. Separate data from rendering, with **no visual change**. If the project has no tests, first add a small behaviour smoke test.
2. Tokens, base styles and the app shell
3. Components (all variants and states)
4. Screens, one at a time
5. Every state on every screen
6. Edge surfaces
7. **Switch-over with a way back:**
   - The new UI becomes the default.
   - The old UI stays reachable at a fallback entry point (for example `/old` or a flag) for a set **launch window** (default 2 weeks). It's frozen, with no changes.
   - The plan writes down a **one-commit rollback** (which commit or flag puts the old UI back as the default) and tests it once on a preview.
   - Old rendering code that isn't needed by the fallback is deleted now.
   - The old-names check runs with only the frozen fallback files excluded.
8. QA and polish
9. **After launch:**
   - About a week in, check errors and logs, collect what people stumbled on, and send anything new through the design-gap loop.
   - At the end of the launch window, delete the fallback entry point and every remaining old file.
   - Run the old-names check with **no exclusions**.

**§7.0 Who builds it: model and effort per task (required).** Agent C reads the **model table in `~/.claude/CLAUDE.md`** and uses only the rows listed there:
- **A tier list** that maps each kind of work in this project to a row of the global table, using the "Choosing the model" rules above. Risky or data-losing work → best Terminal Bench rank. Visual work with no exact reference → best Presentation rank. Mechanical porting from the prototype → the cheapest reliable Haiku row. Never Opus Low or Sonnet Medium.
- **A table with one row per task:** `Phase | Task | Model · effort | Why | Done`. The "why" names the risk or the reference that justifies the tier.
- **One place to tick:** the §7.0 table ends with a `Done` checkbox column (date and commit, in the same commit as the work). Nothing else is ticked per task: no Done boxes under the task headings, and the coverage rows (§5, §6, §10) are ticked by the phase review after it checks them. Each extra place to tick costs time in every task. Done cells stay short: date and commit, plus a phrase only when something changed from the plan (a gap raised, a pick moved). Don't log costs.
- **Light checks per task, full checks per phase:** follow "Light checks per task or feature" and "Every slow check reruns only what a fix touched" in `~/.claude/CLAUDE.md` (the one home of these rules; don't restate them in the plan). What the rebuild adds: once before delivering, the project's scan scripts and the old-names check once it exists, and data-layer tests only when the task changed data code. Screenshot and compare reruns keep the prototype's shots, which don't change. The full end-to-end suite runs at each phase review, not per task.
- **A calibration trial, before the tasks it decides:** build one middle-tier task twice, with the picked model and the next cheaper row, and check both against the prototype. Keep the cheaper row if its result is just as good. Decide on quality alone; don't log costs. Run it at the start of the phase, and hold every task whose pick depends on it until it's done (building those early on the cheaper model meant redoing them).
- **An escalation rule:** move a task up one row the first time a cheaper model gets it wrong twice.
- **Written for `autorun all`:** the table follows "Implementation plans are written for `autorun all`" in `~/.claude/CLAUDE.md`, so one unattended run can go from Phase 1 to Phase 8. Each phase gets its own heading, and its review is a row of its own (`R<n>` or "Phase N review").
- **End-of-phase review, never skipped:** a fresh Opus 5.5 High session reviews the phase's diff against the plan and the prototype, and runs the full end-to-end suite, before the phase counts as done. In one rebuild every phase review rejected real work (an undo that could lose payments, lost typing), so this is the safety net that lets per-task checks stay light. Fix what the reviewers find first, then run the full suite once on a machine as free as it can be (no other build or test running, nothing else editing or testing in that folder, heavy browser tabs closed). Right after it ends, copy `test-results/.last-run.json` and rerun the failures with `--last-failed --last-failed-file <copy>`, since any other end-to-end run overwrites it. (One review's suite took 1 h 40 min with a fixer working alongside it, and most of its failures were page-load timeouts from a swapping machine.) Before the review commits, it routes every open "should fix" item (its own and any still open from earlier reviews) to exactly one place in `redesign/reviews/triage.md`: a fix task `N.F1`, `N.F2`… added to §7.0 and done before the next phase, a named later task whose section points to it, or dropped with a reason. Anything that loses or corrupts data, or shows a failed write as saved, gets a fix task. (In one rebuild four reviews left 59 items only in their review files; six were fixed by chance and one got worse.)
- **One task per session**, reading only that task's plan section, the matching design-guide section, and the matching prototype file. This keeps a cheaper model from reading the old code and copying old patterns.
- If the global table changes mid-rebuild, update §7.0 to match before the next task.

**8. Testing & QA:**
- Rewrite the tests to fit the new design while keeping every behaviour.
- Compare screenshots of the prototype and the build for each screen × state × device × theme.
- Accessibility check.
- Real-device check.

**9. Risks & open questions:** §9.1 needs for the designer (each linked to its `needs.md` ID); §9.2 questions for the owner; §9.3 the rollback: the launch window, the fallback entry point, and the one-commit way back.

**10. Definition of done:**
- Every coverage and reverse-coverage row is ticked, and every `needs.md` row is `designed` and built.
- An **old-names check** (a script that fails if any old class name, id or old wording remains) passes with no exclusions, after Phase 9.
- Tests pass, screenshots match the prototype (including stress data), and the accessibility check passes.

You approve the plan before Step 7.

## Step 7: Rebuild (on a `redesign` branch)

- **Branch:** all work collects on `redesign`, never `main`, and especially not if pushes to `main` deploy to production. Review on `npm run preview` where the project has local previews, otherwise on its preview deploys. On Vercel with the staging setup, add `"redesign": false` next to `"staging": false` in `vercel.json`'s `deploymentEnabled`, so the rebuild doesn't build on Vercel either. Merge only after Phase 8, when you say so (see "Merge and settle the project's rules" below). Phase 9 happens on `main` after launch.
- **Switching branches:** the folder switches back to `main` whenever `redesign/studio.sh` is needed (it refuses to run on any other branch), then back to `redesign`.
- **Model per task:** follow §7.0, with a model check at the start of each session. Start every task in a fresh session (`/clear`), so the one-task-per-session rule holds.
- **Unattended runs (`~/.claude/scripts/autorun.sh`):** the owner can leave the rebuild running, from Phase 1 to Phase 8. The runner takes the first §7.0 row with an empty Done cell, starts a fresh `claude -p` session on that row's model and effort, checks that the row got ticked and committed, and moves on. It stops after a phase review row or at the end of a phase, when a task fails twice (the retry runs on Opus 5.5 High; apply the escalation rule), when the folder has uncommitted changes, or at a cap the owner set (`TASK_BUDGET`, `TOTAL_BUDGET`, `MAX_TASKS`; none by default). A session still going after `TASK_MINUTES` (240 by default) is cut off and counts as a failed try, as does one that ends in an error other than an outage or a usage limit. When a session needs the owner (a design gap, a scope question, a production action), it asks its questions and the runner waits: the owner hears through a phone notification, a line in every new terminal, or any `autorun` command, answers with `autorun answer`, and that same session carries on. `autorun all` never waits: sessions make every decision themselves (design gaps get a provisional version from the new design's own pieces, still recorded as a gap) and log each one with its task and commit (`autorun decisions`); only what can't be undone or needs the owner in person (production data or settings, accounts, secrets, merging to the main branch, real-device checks) is left for the owner, after its safe parts are done, and the run moves on. It waits out Claude being unavailable (outages and usage limits only), and stops only at the end, after three tasks in a row fail, or when a phase review or its fixes can't be finished, so the next phase never starts on top of an unfinished review. The owner cross-checks the decisions, the recap and the review notes afterwards, and handles what was left for them before the next run. Each finished session also goes to AI Build Log (repo `projects-steps-documentation`) as a step with its models, tokens, cost and time, into the project on the plan's `AI Build Log project:` line, which is created on the first send; this needs `autorun buildlog-setup` once per machine. The owner starts it in their own terminal, inside the project folder, never from a Claude session (it finds the plan itself; `autorun help` lists everything):
  ```
  autorun help    # every command, with a line on each
  autorun check   # the next task and its model; spends nothing
  autorun one     # first time: just the next task, then check the result
  autorun         # the rest of the phase, in the background
  autorun all     # overnight: to the end, deciding for you, no cost caps, then a recap
  autorun status  # one screen: current task, whether it looks stuck, done so far, spend, what needs you
  autorun decisions   # every decision it made on its own, with task and commit
  autorun recap   # the morning recap: done, parked, decisions to check, costs and usage
  autorun watch   # see it live; Ctrl-b then d leaves it running
  autorun stop    # stop after the current task
  autorun answer "..."   # answer a waiting question; the same session carries on
  autorun skip    # drop the question and do that task yourself in claude
  autorun costs   # per session and model: input, output, cache, cost
  autorun notify-setup   # once per machine: phone notifications via the ntfy app
  autorun buildlog-setup   # once per machine: every session goes to AI Build Log as a step
  ```
  Its cost log is automatic and only shows spend; picks are still decided on quality (the calibration trial).
- **Source of truth:** the frozen design guide is the spec, and the prototype is the reference rendering. Compare against the prototype, never the old app.
- **Delete, don't modify:** write new markup and styles from the tokens, and use new names. Keep only the plumbing (data, auth, storage, sync).
- **Tests follow the design:** tests are a checklist of *behaviours*. Rewrite their steps and selectors, and never bend the design to fit an old test.
- **Design gaps:** stop, add them to §9.1, and run the design-gap loop. Never fill a gap from the old app.
- **Before each commit:** the light per-task checks from §7.0 (which point to the global rule) and the old-names check once it exists. The full suite waits for the phase review. Commits that only change plans or docs skip the checks.
- **Keep always-loaded files small:** `CLAUDE.md` and `AGENTS.md` load into every session and subagent. The project's change log lives in `CHANGELOG.md`, which nothing loads automatically, with one to three lines per entry; details go in the commit body. (A 129 KB change log in `AGENTS.md` added about 32,000 tokens to every session.)
- **Keep the machine free while a build runs:** one browser, no other AI agents or editor extensions working on the same repo, no dev servers or emulators left running after a check (the end-to-end script stops what it started).
- **Test by risk:** end-to-end tests cover user flows and anything that writes data; markup and visual variants get fast unit tests or the Phase 8 screenshots. End-to-end tests run against a production build, as "Fast test setup" in `~/.claude/CLAUDE.md` says.
- **One home per rule:** each rule lives in one file (the plan, or the project's `CLAUDE.md`) and the others point to it. Copies drift: changing one rule in one project took edits in six files, and an old copy contradicted the new one.
- **Track progress after every task:** tick the task's **Done** box in the §7.0 table (date and commit), in the same commit as the work, and nowhere else. The phase review ticks §5, §6 and §10 after checking them, and then the phase in the checklist below.
- **After merge:** see "Merge and settle the project's rules" below.

### Merge and settle the project's rules (after Phase 8, when you say so; Sonnet 5.5 High)

Merging is owner-only work: `autorun all` leaves it as an *owner* line and never merges by itself.

1. **Merge.** On `redesign`, run `git merge main` so it holds every commit `main` has (design imports, fixes), and push it. Run the full checks only if something they cover changed since the Phase 8 review. Then fast-forward `main` with `git push origin redesign:main`. When `main` is `main`, that is exactly `git push origin redesign:main`, the release form the owner's settings allow; if it's blocked, give the owner the command with `!` in front. It refuses anything but a fast-forward: if it does, stop and tell the owner. Never force. Switch the folder to `main` and `git pull --ff-only`.
2. **Rewrite the project's `CLAUDE.md` for the new UI.** Replace the "UI redesign (in progress)" section with a short lasting one: the design guide, tokens and prototype in `redesign/design/` are the reference for new or changed screens; never bring back the old UI's markup, names or wording; design gaps go through `needs.md` and the studio; the studio rules, while the studio is kept. Keep the rebuild's checks rule too: a **Checks** line that points to the global "Light checks" rule and names this project's own commands (type check, lint, unit tests, data-layer tests, the e2e command and its page specs). Without it the project's file loses the checks rule once the redesign section is gone.
3. **Offer the staging setup** if Step 0 recorded the project doesn't have it. Ask the owner once, in plain words: today the project <how it deploys and commits, from Step 0>; with the setup, work collects on `staging`, nothing goes live until "release", and previews run locally. If the owner says yes:
   - Create `staging` from `main` and push it; the folder keeps `staging` checked out from now on.
   - Stop the host deploying `staging` (and `redesign`): on Vercel, `vercel.json`'s `"git": { "deploymentEnabled": { "staging": false, "redesign": false } }` (or the same in `vercel.ts`); on another host, the matching setting, or an *owner* line if only its dashboard can change it.
   - Add the `preview` and `preview:share` scripts if they're missing (the forms in new-app Step 8, adjusted to the stack).
   - Replace the project's own branch, commit, release and preview rules with the four sections of new-app Appendix A ("Branches", "Commit and push after every change", "Releasing to production", "Previews"). Adjust the checks, scripts, database and paths to this project and this machine, and fold the Checks line from step 2 into them so the rule has one home.
   - Search the project's other files (`AGENTS.md`, the plans, `README`) for rules that still say to push to `main`, and point them to the new sections.
   - Phase 9 then runs on `staging`, and its fixes go live with the next release.
   If the owner says no, record that in the plan's checklist line and keep the project's rules.

---

## Where old design can still leak in

| Leak | Why | Guard |
|---|---|---|
| AI reading the code | Markup, class names, screen order | Agent A writes needs only; Agent B works in a folder where the old code isn't on disk |
| Shell reaching outside the studio | `cat`, `python`, `cp`, hard links or symlinks reading the codebase folder | Sandbox on, with the codebase folder denied at the OS level and no way to run unsandboxed; Step 0b proves it |
| Other Claude sessions | `SendMessage` / `ListAgents` can reach a codebase session on the same machine | Both denied |
| The screenshot browser | Runs as you, outside the sandbox | Pages served over local HTTP from `redesign/design/` only, with no symlinks; all traffic except Google Fonts goes to a dead proxy; the designer can't edit `shoot` |
| Guard files | A designer could weaken `start`, `shoot` or the settings | The sandbox and Edit rules block writes; `enter` rewrites them every time |
| `CLAUDE.md` auto-loading | The codebase's `CLAUDE.md` describes the old UI | The studio has its own `CLAUDE.md`; the global one stays free of any UI description, and its playbook pointer is ignored in the studio |
| Git history | Commit messages and old branches | The studio is its own repo: the old commits aren't in its `.git` and it has no remote. Git deny rules are a backup |
| Old conversations | `--resume`, or reading transcripts | `./start` refuses resume; the codebase's transcripts and `~/.claude` history files are denied |
| Prompt history | `~/.claude/history.jsonl` holds your prompts from every project | Denied in the studio |
| Claude Code's temp and cache folders | Codebase sessions leave scratch files, tool output and logs in per-folder temp and cache folders outside `~/.claude` | Both denied for every machine; Step 0b checks them |
| Shell history | Commands typed in the codebase, with its paths and names | `~/.zsh_history`, `~/.zsh_sessions` and `~/.bash_history` denied |
| Code editor link | A connected editor (VS Code and others) can push the open file or selection into the session | `./start` turns off editor auto-connect; Step 0b checks no `ide` server appears |
| A second machine | The rules name paths; on a VM or second computer they point at nothing, so its copy of the codebase is open | One set of path rules per machine; Step 0b passes on each before its first `enter` |
| Memory | Memories describing the old UI | Memory is per folder and turned off in the studio; codebase sessions still don't save memories about the old UI |
| Connectors, MCP, plugins | A browser tool can open the live site; Drive, Figma, Docs, deploy tools and artifacts can show the old app | `./start` loads no MCP servers or connectors; plugins off; `mcp__*`, `Artifact` and `DesignSync` denied; Step 0b proves it |
| Online copies | The repo and live site show the old app | No remote; web tools off; the sandbox blocks all network access from the shell |
| Things you paste in | Screenshots or text from the old app | Never paste into the studio; gaps go in as needs through `needs.md` |
| Inventory wording | "Tab", "menu", "Starred" | Banned words, leak review and the guess-the-layout test |
| Inventory structure | Grouping by screens recreates them | Group by jobs |
| Your memory | Daily use makes the current layout feel natural | Don't open the app during Steps 2–5; translate habits into needs |
| Your choice of direction | You'll tend to pick the familiar one | Familiarity check before picking; the reason is written in brief and priority terms |
| Gaps found later | Implementers fill gaps with what they know | Design-gap loop: gaps become needs and are designed in the studio |
| Branding | Logo and palette constrain the design | Open by default |
| The data model | Existing concepts shape the design | The designer may challenge them; you decide |
| Implementation plan | Agent C sees old code and fills gaps with it | Design → code only; gaps go to §9.1 |
| Forgotten surfaces | Dialogs, exports and auth keep their old look | Reverse coverage list |
| The rebuild | The implementer sees old code | Prototype is the spec; new names; old-names check; one task per session |
| Tests | Old tests encode old flows | Tests preserve behaviour only |

**What this can't remove:** the feature set (on purpose, since the new design has to cover it) and your own taste. Everything else is blocked by at least two layers: the old material isn't there at all (separate repo, no remote, no connectors), *and* a deny rule or sandbox blocks it, *and* Step 0b checks the result. If a model already knows a public app from its training, the brief can avoid naming it, but nothing can make the model forget it.

---

# Appendix: files Step 0 writes

## A. `redesign/studio.sh`

It also writes the studio's guard files on every `init` and `enter`: the `./start` launcher, the `./shoot` screenshot script, and copies of the two templates. That way template fixes arrive in the studio and any tampering is undone.

Tested end to end (2026-10-13, Claude Code 2.1.296, macOS): init, enter, import, re-sync after deletions, rebuilding a deleted studio folder, with and without a remote, none of the codebase's commits reaching the studio's `.git`, and a design session committing work through `./start`. Linux additions tested 2026-10-20 (Ubuntu 24.04, arm64, over SSH): rebuilding the studio from `origin`, `./shoot` with both screenshots saved and a page's website and raw-IP requests blocked, and Step 0b ALL BLOCKED with no editor connection. The tmux relaunch in `./start` (own `studio` server, refusing a shared one) was tested there too (2026-10-20).

```bash
#!/usr/bin/env bash
# The design studio is a separate git repo in its own folder (../spendings-tracker-studio, branch design-studio).
# It never holds the codebase's history and has no remote: work moves only through this script.
#
#   redesign/studio.sh init     create the studio from redesign/studio-template/ (fresh history)
#   redesign/studio.sh enter    save studio work, refresh the studio's guard files, sync redesign/handoff/ into it
#   redesign/studio.sh import   bring the approved redesign/design/ from the studio onto the base branch
set -euo pipefail

cd "$(git rev-parse --show-toplevel)"
ROOT="$PWD"
SBRANCH="design-studio"
STUDIO="$(dirname "$ROOT")/$(basename "$ROOT")-studio"
BASE="${BASE_BRANCH:-$(git symbolic-ref -q --short refs/remotes/origin/HEAD 2>/dev/null | sed 's#^origin/##' || true)}"
BASE="${BASE:-main}"
branch="$(git branch --show-current)"

require_base_clean() {
  [ "$branch" = "$BASE" ] || { echo "✋ Run this from $BASE (currently on '$branch')." >&2; exit 1; }
  if [ -n "$(git status --porcelain)" ]; then
    echo "✋ Uncommitted changes on $BASE. Commit them first." >&2
    exit 1
  fi
}

have_remote() { [ -n "$(git remote)" ]; }
have_branch() { git show-ref --verify --quiet "refs/heads/$SBRANCH"; }

save_studio_work() {
  [ -d "$STUDIO/.git" ] || return 0
  if [ -n "$(git -C "$STUDIO" status --porcelain)" ]; then
    git -C "$STUDIO" add -A
    git -C "$STUDIO" commit -q -m "Save unsaved studio work"
  fi
}

# Copy the studio's branch into this repo (one-way: studio -> codebase), and back it up to origin.
collect_studio_branch() {
  [ -d "$STUDIO/.git" ] || return 0
  git fetch -q --no-tags "$STUDIO" "$SBRANCH:$SBRANCH"
  if have_remote; then git push -q origin "$SBRANCH"; fi
}

ensure_studio() {
  [ -d "$STUDIO" ] && return 0
  if ! have_branch && have_remote; then git fetch -q --no-tags origin "$SBRANCH:$SBRANCH" 2>/dev/null || true; fi
  have_branch || { echo "✋ There's no studio yet. Run 'init' first." >&2; exit 1; }
  # --no-local + --single-branch copy only design-studio's objects, never the codebase's history.
  git clone -q --no-local --single-branch --no-tags --branch "$SBRANCH" "$ROOT" "$STUDIO"
  git -C "$STUDIO" remote remove origin
  echo "Recreated the studio folder: $STUDIO"
}

write_guard_files() {  # rewritten on every init/enter, so template fixes arrive and tampering is undone
  cp "$ROOT/redesign/studio-template/CLAUDE.md" "$STUDIO/CLAUDE.md"
  cp "$ROOT/redesign/studio-template/settings.json" "$STUDIO/.claude/settings.json"
  rm -f "$STUDIO/.claude/settings.local.json"  # drop any "always allow" clicked in a studio session
  printf '.DS_Store\nnode_modules/\n.tmp/\n.claude/settings.local.json\n' > "$STUDIO/.gitignore"
  cat > "$STUDIO/start" <<'START'
#!/usr/bin/env bash
# Starts a brand-new, isolated design session: no MCP servers, no claude.ai connectors,
# no auto memory, no artifacts. Never continue or resume an old session.
cd "$(dirname "$0")"
for a in "$@"; do
  case "$a" in -c|--continue|-r|--resume|--resume=*|--fork-session)
    echo "✋ Always start a brand-new session." >&2; exit 1;;
  esac
done
# tmux: the studio runs on its own tmux server (-L studio), never one shared with codebase sessions,
# whose panes could otherwise be read or typed into from here.
# Outside tmux, relaunch inside a new session on that server (skip with STUDIO_NO_TMUX=1).
if [ -z "${TMUX:-}${STUDIO_NO_TMUX:-}" ] && [ -t 0 ] && [ -t 1 ] && command -v tmux >/dev/null; then
  name=claude; n=1
  while tmux -L studio has-session -t "=$name" 2>/dev/null; do n=$((n+1)); name="claude-$n"; done
  exec tmux -L studio new-session -s "$name" -c "$PWD" -- "$PWD/start" "$@"
fi
if [ -n "${TMUX:-}" ] && [ "$(basename "${TMUX%%,*}")" != studio ]; then
  echo "✋ This tmux server is shared with other sessions. From a new terminal window outside tmux, run:" >&2
  echo "   cd \"$PWD\" && ./start     (it opens the studio's own tmux server)" >&2
  exit 1
fi
unset TMUX TMUX_PANE
# A terminal opened in the codebase's editor window carries its editor hooks; drop them.
unset CLAUDE_CODE_SSE_PORT $(compgen -v VSCODE_)
export ENABLE_CLAUDEAI_MCP_SERVERS=false CLAUDE_CODE_DISABLE_AUTO_MEMORY=1 CLAUDE_CODE_DISABLE_ARTIFACT=1
# No editor link: an IDE connection can push the open file or selection (possibly the codebase) into the session.
export CLAUDE_CODE_AUTO_CONNECT_IDE=false CLAUDE_CODE_IDE_SKIP_AUTO_INSTALL=1
# Your arguments go first: --mcp-config takes several values and would swallow anything after it.
exec claude "$@" --strict-mcp-config --mcp-config '{"mcpServers":{}}'
START
  cat > "$STUDIO/shoot" <<'SHOOT'
#!/usr/bin/env bash
# Screenshots design directions at desktop and phone width, then opens them (macOS) or prints their paths (Linux).
# The OWNER runs this from inside the studio session as `! ./shoot` (or from a terminal):
#   ./shoot                 every folder in redesign/design/directions/
#   ./shoot <folder>...     only these folders (each holds an index.html, inside redesign/design/)
# Pages are served from redesign/design/ over a local web server, so they can't load local files
# from anywhere else. Chrome reaches Google Fonts only; all other traffic goes to a dead proxy.
set -euo pipefail
cd "$(dirname "$0")"
STUDIO="$PWD"
DESIGN="$STUDIO/redesign/design"
CHROME="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
NOSANDBOX=""
if [ "$(uname)" = Linux ]; then
  # Playwright's headless shell (full Chromium hung on the test server), same lockdown flags.
  # Chrome's own sandbox can't start under Ubuntu's user-namespace restriction; the dead proxy
  # and the local-only server still confine the page.
  CHROME="$(ls -d "$HOME"/.cache/ms-playwright/chromium_headless_shell-*/chrome-linux*/headless_shell 2>/dev/null | tail -1)"
  NOSANDBOX="--no-sandbox"
fi
FONTS="fonts.googleapis.com;fonts.gstatic.com"

if [ -n "$(find "$DESIGN" -type l -print -quit)" ]; then
  echo "✋ redesign/design/ contains symlinks. Remove them first:" >&2
  find "$DESIGN" -type l >&2
  exit 1
fi

mkdir -p .tmp && export TMPDIR="$STUDIO/.tmp"
PORT="$(python3 -c 'import socket; s=socket.socket(); s.bind(("127.0.0.1",0)); print(s.getsockname()[1])')"
python3 -m http.server "$PORT" --bind 127.0.0.1 --directory "$DESIGN" >/dev/null 2>&1 &
SERVER=$!
trap 'kill $SERVER 2>/dev/null' EXIT
for _ in $(seq 50); do curl -s -o /dev/null "http://127.0.0.1:$PORT/" && break; sleep 0.1; done

shot() {  # $1 = url, $2 = width,height, $3 = output png
  if [ -x "$CHROME" ]; then
    "$CHROME" --headless=new $NOSANDBOX --hide-scrollbars --user-data-dir="$STUDIO/.tmp/chrome" \
      --proxy-server="127.0.0.1:9" --proxy-bypass-list="$FONTS" \
      --host-resolver-rules="MAP * ~NOTFOUND, EXCLUDE fonts.googleapis.com, EXCLUDE fonts.gstatic.com, EXCLUDE 127.0.0.1" \
      --virtual-time-budget=5000 --window-size="$2" --screenshot="$3" "$1" >/dev/null 2>&1
  else
    npx -y playwright screenshot --proxy-server="127.0.0.1:9" --proxy-bypass="$FONTS" \
      --viewport-size="$2" "$1" "$3" >/dev/null
  fi
}

if [ "$#" -gt 0 ]; then dirs=("$@"); else dirs=("$DESIGN"/directions/*/); fi
pngs=()
for d in "${dirs[@]}"; do
  [ -d "$d" ] || continue
  d="$(cd "$d" && pwd -P)"
  case "$d" in "$DESIGN"/*) ;; *) echo "✋ Skipping $d: not inside redesign/design/." >&2; continue;; esac
  [ -f "$d/index.html" ] || continue
  url="http://127.0.0.1:$PORT/${d#"$DESIGN"/}/index.html"
  shot "$url" 1440,900 "$d/desktop.png"
  shot "$url" 390,844 "$d/phone.png"
  pngs+=("$d/desktop.png" "$d/phone.png")
  echo "📸 ${d#"$DESIGN"/}"
done
if [ "${#pngs[@]}" -gt 0 ] && [ -z "${SHOOT_NO_OPEN:-}" ]; then
  if [ "$(uname)" = Darwin ]; then open "${pngs[@]}"; else printf '🖼  %s\n' "${pngs[@]}"; fi
fi
SHOOT
  chmod +x "$STUDIO/start" "$STUDIO/shoot"
}

case "${1:-}" in
  init)
    require_base_clean
    if have_branch || [ -e "$STUDIO" ]; then
      echo "✋ The studio already exists. Use 'enter'." >&2; exit 1
    fi
    for f in CLAUDE.md settings.json; do
      [ -f "redesign/studio-template/$f" ] || { echo "✋ Missing redesign/studio-template/$f" >&2; exit 1; }
    done
    mkdir -p "$STUDIO/.claude" "$STUDIO/redesign/handoff" "$STUDIO/redesign/design"
    git -C "$STUDIO" init -q -b "$SBRANCH"
    write_guard_files
    touch "$STUDIO/redesign/handoff/.gitkeep" "$STUDIO/redesign/design/.gitkeep"
    git -C "$STUDIO" add -A
    git -C "$STUDIO" commit -q -m "Start the design studio"
    collect_studio_branch
    echo "✅ Studio created at $STUDIO (its own repo, no shared history, no remote)."
    echo "Next: run the firewall check (Step 0b)."
    ;;
  enter)
    require_base_clean
    ensure_studio
    save_studio_work
    for f in CLAUDE.md settings.json; do
      [ -f "redesign/studio-template/$f" ] || { echo "✋ Missing redesign/studio-template/$f" >&2; exit 1; }
    done
    write_guard_files
    git -C "$STUDIO" add -A
    if ! git -C "$STUDIO" diff --cached --quiet; then git -C "$STUDIO" commit -q -m "Refresh studio guard files"; fi
    if git cat-file -e "$BASE:redesign/handoff" 2>/dev/null; then
      find "$STUDIO/redesign/handoff" -mindepth 1 ! -name .gitkeep -exec rm -rf {} +
      git archive "$BASE" redesign/handoff | tar -x -C "$STUDIO"
      git -C "$STUDIO" add -A redesign/handoff
      if ! git -C "$STUDIO" diff --cached --quiet; then
        git -C "$STUDIO" commit -q -m "Update handoff inputs"
        echo "Synced handoff inputs into the studio."
      fi
    fi
    collect_studio_branch
    cat <<MSG

✅ The studio is ready.

Open a NEW terminal window and run:
  cd "$STUDIO" && ./start
With tmux installed, ./start opens its own session on the studio's tmux server (it refuses a shared one):
  (detach: Ctrl-b d · list: tmux -L studio ls · come back: tmux -L studio attach -t claude)

(Always ./start: a brand-new session with no connectors. To take screenshots,
 type  ! ./shoot  inside that session.)
This window stays your codebase on $BASE.
MSG
    ;;
  import)
    require_base_clean
    save_studio_work
    collect_studio_branch
    if ! have_branch && have_remote; then git fetch -q --no-tags origin "$SBRANCH:$SBRANCH" 2>/dev/null || true; fi
    have_branch || { echo "✋ There's no studio branch to import from." >&2; exit 1; }
    git checkout "$SBRANCH" -- redesign/design
    if git diff --cached --quiet; then
      echo "Nothing new to import."
      exit 0
    fi
    git commit -q -m "Import approved design guide from $SBRANCH"
    if have_remote; then git push -q; fi
    echo "✅ Imported redesign/design/ into $BASE."
    ;;
  *)
    sed -n '2,8p' "$0"
    exit 1
    ;;
esac
```

## B. `redesign/studio-template/settings.json`

Fill in the placeholders:
- `<ABS_PROJECT_PATH>`: the codebase folder's absolute path, for example `/Users/me/projects/app`. In the `Read(/…)` and `Edit(/…)` rules this becomes `//Users/…`, which Claude Code reads as an absolute path. In the sandbox list it stays a plain absolute path.
- `<CLAUDE_TMP>`: Claude Code's temp folder for codebase sessions, `<tmp>/claude-<uid>/<encoded path>`. The encoded path is `<ABS_PROJECT_PATH>` with every `/` turned into `-` (`/Users/me/projects/app` → `-Users-me-projects-app`). `<tmp>` is `/private/tmp` on macOS and `/tmp` on Linux; `<uid>` is `id -u`.
- `<TMUX_SOCKETS>`: tmux's socket folder, `<tmp>/tmux-<uid>` (`/private/tmp/tmux-<uid>` on macOS, `/tmp/tmux-<uid>` on Linux; `$TMUX_TMPDIR` instead of `<tmp>` if you set it). Hiding it stops studio commands from reading or typing into codebase terminals on the shared tmux server; `./start` runs the studio on its own server (`tmux -L studio`), whose socket is in the same folder but which `./start` reaches before the sandbox starts.
- `<CLAUDE_CACHE>`: Claude Code's cache folder for the codebase, `~/Library/Caches/claude-cli-nodejs/<encoded path>` on macOS, `~/.cache/claude-cli-nodejs/<encoded path>` on Linux.
- **One set per machine:** repeat the `<ABS_PROJECT_PATH>`, `<CLAUDE_TMP>`, `<CLAUDE_CACHE>` and `<TMUX_SOCKETS>` lines, in both the deny rules and `denyRead`, for every machine from Step 0. The template is shared, so the studio on each machine blocks every machine's paths. That's harmless where a path doesn't exist.
- `enabledPlugins`: one line for **every** plugin `claude plugin list` shows. Each is `false`, except design-guidance plugins that hold no information about the app, which are `true` (the default is `frontend-design@anthropic-plugin-directory`). A project setting overrides a user-level one, so these lines win inside the studio.
- Add any other folder that might hold screenshots or notes about the old app to both `Read(…/**)` and `denyRead`, unless the studio itself lives inside it.

```json
{
  "autoMemoryEnabled": false,
  "disableClaudeAiConnectors": true,
  "enableArtifact": false,
  "deniedMcpServers": [{ "serverName": "claude.ai Claude Docs" }],
  "enabledPlugins": {
    "<PLUGIN>@<MARKETPLACE>": false,
    "frontend-design@anthropic-plugin-directory": true
  },
  "permissions": {
    "deny": [
      "mcp__*",
      "WebFetch",
      "WebSearch",
      "Artifact",
      "DesignSync",
      "SendMessage",
      "ListAgents",
      "RemoteTrigger",
      "ShareOnboardingGuide",
      "Read(/<ABS_PROJECT_PATH>/**)",
      "Edit(/<ABS_PROJECT_PATH>/**)",
      "Read(/<CLAUDE_TMP>/**)",
      "Read(<CLAUDE_CACHE>/**)",
      "Read(~/.zsh_history)",
      "Read(~/.zsh_sessions/**)",
      "Read(~/.bash_history)",
      "Read(~/.claude/history.jsonl)",
      "Read(~/.claude/projects/**)",
      "Read(~/.claude/file-history/**)",
      "Read(~/.claude/plans/**)",
      "Read(~/.claude/todos/**)",
      "Read(~/.claude/playbooks/**)",
      "Read(~/Desktop/**)",
      "Read(~/Downloads/**)",
      "Read(~/Pictures/**)",
      "Edit(/start)",
      "Edit(/shoot)",
      "Edit(/CLAUDE.md)",
      "Edit(/.claude/**)"
    ]
  },
  "sandbox": {
    "enabled": true,
    "allowUnsandboxedCommands": false,
    "failIfUnavailable": true,
    "filesystem": {
      "denyRead": [
        "<ABS_PROJECT_PATH>",
        "<CLAUDE_TMP>",
        "<CLAUDE_CACHE>",
        "<TMUX_SOCKETS>",
        "~/.zsh_history",
        "~/.zsh_sessions",
        "~/.bash_history",
        "~/.claude/history.jsonl",
        "~/.claude/projects",
        "~/.claude/file-history",
        "~/.claude/plans",
        "~/.claude/todos",
        "~/.claude/playbooks",
        "~/Desktop",
        "~/Downloads",
        "~/Pictures"
      ],
      "denyWrite": ["./start", "./shoot", "./CLAUDE.md", "./.claude"]
    }
  }
}
```

What each layer does (all verified in the end-to-end test):
- **`./start`** launches with no MCP servers (`--strict-mcp-config`), no claude.ai connectors, no auto memory and no artifacts.
- **`mcp__*`** hides every MCP tool from any source, as a backup to `./start`. `WebFetch` and `WebSearch` remove web access. `SendMessage` and `ListAgents` stop the studio from talking to other Claude sessions on your machine, *including codebase sessions*. `DesignSync`, `RemoteTrigger`, `Artifact` and `ShareOnboardingGuide` close the remaining account-level channels.
- **The sandbox** stops every shell command and program (`cat`, `python`, `ls`, `cp`, hard links, symlink reads) from reading the codebase or Claude Code's history. It blocks all network access, so if the session ever asks to allow a network host, say **no**. It also stops writes to the guard files. `allowUnsandboxedCommands: false` removes the escape hatch, and `failIfUnavailable: true` refuses to start without the sandbox.
- **tmux** (when installed): `./start` puts every studio session in its own session on a separate tmux server and refuses to run inside a shared one, and the sandbox hides tmux's socket folder, so studio commands can't read or type into codebase terminals.
- **`Read(...)` / `Edit(...)` rules** do the same for Claude's built-in file tools, which the sandbox doesn't cover.
- **Design-guidance plugins** (`true` in `enabledPlugins`) must be text guidance only. Before turning one on, check its folder under `~/.claude/plugins/cache/` has no `.mcp.json`, no `hooks/` that run commands or reach out, and no browser, web or messaging tools. `frontend-design` passes: it has a manifest, one skill file and licence text, with no hooks or servers. Anything that drives a browser (for example Playwright), reads the codebase or reaches the web stays `false`.
- **Not used:** `blockReadsOutsideWorkingDirectories`. It also blocks `/dev/null`, which breaks ordinary commands, and the explicit lists above cover what matters.
- Git block rules aren't needed: the studio's `.git` simply doesn't contain the old history, and Bash prefix rules can be sidestepped anyway (`git -C …`, `git --no-pager …`).

**Screenshots run as you, not as Claude.** Chrome can't run inside Claude Code's macOS sandbox, so the designer asks you to type `! ./shoot`. `!` commands run as you, outside the sandbox. To keep that safe, `shoot`:
- serves only `redesign/design/` from a local web server, so pages can't load local files
- refuses to run if `redesign/design/` contains any symlink
- sends all Chrome traffic except Google Fonts to a dead proxy, so domains and raw IP addresses fail

All three were tested with a page that tried to embed a codebase file, a website and a raw IP.

**On Linux**, `shoot` uses Playwright's headless shell: install it once with `npx -y playwright@1.62.1 install --with-deps chromium`. It runs with `--no-sandbox`, because Chrome's own sandbox can't start under Ubuntu's user-namespace restriction; the dead proxy and the local-only server still confine the page. Instead of opening the screenshots it prints their paths. Over SSH, view them through your editor's remote window (for example VS Code Remote-SSH) or copy them to your own machine.

## C. `redesign/studio-template/CLAUDE.md`

```markdown
# Design Studio

You are **Agent B, the designer**. You are designing a product's interface from zero. There is no previous design for you to see, and you must not look for one.

## Firewall
- Your only inputs are the files in `redesign/handoff/`: `inventory.md`, `priorities.md`, `brief.md` and `needs.md`. Start only when `priorities.md` and `brief.md` both say `FILLED`.
- Never read outside this folder. Never look for git history, other branches or remotes. Never fetch, search for or open the product's repo or live site.
- Your global instructions point to playbooks (for example a blank-slate redesign or a new-app playbook). Those are for codebase sessions, not for you. Ignore them, and don't open them.
- Never reach other terminals or sessions (tmux, screen, their sockets).
- Never create symlinks, never ask to allow network access, and never edit `start`, `shoot`, `CLAUDE.md` or `.claude/`. The owner's script resets them anyway.
- Don't save memories. If you find any memory, note or file that describes an existing version of this app, don't use it. Tell the owner.
- If the owner describes, pastes or shows how an existing app looks or works, don't use it. Ask for the underlying need, and suggest they add it to `needs.md` on their side.
- You may propose merging, splitting or removing concepts from the inventory. Write proposals in `redesign/design/decisions.md` and ask; never adopt them silently.
- Sessions start only through `./start`. If this session was resumed, or you can see conversation from before this session, stop and tell the owner.

## Firewall check (the only exception)
When the owner's message starts with "This is a firewall check", do exactly the listed attempts once each, even the ones that reach outside this folder or touch guard files: the point is to prove they fail. Report only blocked/reachable, never content. Don't do anything else in that session.

## Model check
Use the model table in the global instructions. Design work wants the best Presentation Elo rank (currently Sonnet 5.5 xHigh). The coverage audit wants Sonnet 5.5 High. If the current model is lower, say so before starting and suggest switching.

## Plugins
`frontend-design` is enabled. Use it through the Skill tool for aesthetic direction, typography and avoiding templated defaults. Don't open its files from disk. No other plugins or connectors are available in this folder.

## Process (one stage per session; record progress in `redesign/design/README.md`)

### 1. Three directions, as screenshots
- Make 3 deliberately different directions: different ways of moving around, density, type, colour and personality.
- Each is ONE static file: `redesign/design/directions/<letter>-<name>/index.html`. It shows only the #1 daily job from `priorities.md` (plus one secondary moment if it's needed to show how people move around). Mock data and CSS are inline. No routing, interactivity, states or dark mode. It responds to width.
- Each gets a `README.md` of at most 10 lines: the idea, how people move around, density, type, colour.
- Web fonts may come from Google Fonts. Everything else (images, icons, scripts) is inline or a file inside the direction's folder.
- When all three are ready, ask the owner to type `! ./shoot`. It saves `desktop.png` (1440×900) and `phone.png` (390×844) in each direction's folder and opens them for the owner. You can't take screenshots yourself: the sandbox blocks the browser.
- Look at one screenshot at most, only to check that it rendered. Don't describe the images to the owner; they look at them.
- The owner picks one or asks for a mix. A mix gets one more screenshot round (`! ./shoot redesign/design/directions/<mix-folder>`), no more. Record the choice and the owner's reason in `decisions.md`.

### 2. Full prototype
- Expand only the chosen direction into `redesign/design/prototype/`.
- Cover every job story and every state from the inventory (nothing yet, loading, failure, no connection, restricted, read-only, shared-link visitor, bulk selection, no results), on phone and desktop, in light and dark.
- Work in several sessions, one group of jobs at a time.
- Every screen also gets a **stress data** version (a `?stress` switch or second data set): very long names with no spaces and in other scripts, thousands of items and deep nesting, empty optional fields, the longest realistic text, many people or roles at once, tiny and huge images.

### 3. Design guide
Write `redesign/design/design-guide.md` and `redesign/design/tokens.css`. Cover tokens, components (all variants and states), screens (every state × device × theme), patterns, copy and tone, and accessibility.

### 4. Coverage
In a fresh session, write `redesign/design/coverage.md`, mapping every story ID and state to where the prototype covers it. Fix the gaps.

### 5. Freeze
When the owner approves, put a version and date at the top of the design guide (for example `v1.0 (2026-xx-xx)`). Later changes bump the version.

### Open needs (any time later)
When asked to design the open needs, read `redesign/handoff/needs.md`. For each `open` row:
- design it in the prototype and the guide
- bump the guide version
- log the answer under the need's ID in `decisions.md`

You never edit `needs.md`; the owner closes rows on their side.

## Saving work
After each finished piece of work: `git add -A && git commit -m "<what changed>"`. This repo has no remote. The owner's `studio.sh` collects and backs up your commits.
```

## D. Rules to add to the project's `CLAUDE.md`

```markdown
## UI redesign (blank-slate, in progress)
- The plan is `redesign/redesign-plan.md` (from `~/.claude/playbooks/blank-slate-redesign.md`). Design happens in `../spendings-tracker-studio`, a separate repo that never sees this codebase. Studio sessions start only with `./start` there.
- Never read from the studio folder, and never send anything from this codebase into it, except `redesign/handoff/` through `redesign/studio.sh enter`.
- Before every `enter`, run the banned-word scan on every file in `redesign/handoff/`.
- On tmux, the studio runs on its own server (`tmux -L studio`). Never capture, read or send keys to its panes.
- Don't save memories that describe the current UI.
- When a redesign step finishes, tick its box in the checklist at the top of `redesign/redesign-plan.md` in the same commit, never before. Studio steps (4a–5) are ticked here when the owner reports them done, or at the import at the latest.
- At the start of each redesign session, check the model against the step's line in the plan's checklist (or §7.0 in the implementation plan during the rebuild), using the table in `~/.claude/CLAUDE.md`. If the current model is lower, say so and suggest switching.
- When the owner says **"Import the approved design"**: run `redesign/studio.sh import`, confirm `redesign/design/` arrived, tick the step it belongs to (5b, or the matching rows in `needs.md` and §9.1), and offer the next step.
- Rebuild (Step 7): work only on the `redesign` branch, one task per session, reading only that task's plan section, design-guide section and prototype file. Never copy markup, CSS, names or wording from the old UI.
- After every rebuild task: tick its **Done** box in the implementation plan's §7.0 table (date and commit), in the same commit as the work, and nowhere else. The phase review ticks §5, §6 and §10 and the phase in `redesign/redesign-plan.md`'s checklist. Add a one-to-three-line entry to `CHANGELOG.md`, never to `CLAUDE.md` or `AGENTS.md`.
- Checks per task are the light ones in §7.0; the full end-to-end suite runs at phase reviews.
- Design gaps: add them to §9.1 of the implementation plan, then write them as needs in `redesign/handoff/needs.md` (the design-gap loop). Never fill a gap from the old app.
```

## E. Firewall check (Step 0b)

**First, in the fresh `./start` session, type these yourself:**
- `/mcp`: no servers listed, not even `ide` (an editor link)
- `/memory`: only your global `~/.claude/CLAUDE.md` and the studio's `CLAUDE.md`. If a `CLAUDE.md` from a parent folder shows up, it loads into every studio session: move the studio, or make sure that file says nothing about the app.
- `/sandbox`: enabled

**Then send this prompt** (fill in the placeholders with **this machine's** values from Appendix B). The studio's `CLAUDE.md` has an exception that lets the designer run exactly these attempts. The folder checks count entries instead of trusting `ls`: on Linux the sandbox may mount an empty folder over a denied one, so `ls` succeeds but shows nothing.

```text
This is a firewall check for this folder. Rules: do NOT print, quote or summarise any file content, web page or command output; don't save memories; don't call any connector or MCP tool. Run each check once, and report only "blocked" or "reachable", as a table: # | check | result.

1. Read tool: read /<ABS_PROJECT_PATH>/<A_FILE_THAT_EXISTS>
2. Shell: head -c 1 "/<ABS_PROJECT_PATH>/<A_FILE_THAT_EXISTS>" >/dev/null && echo reachable || echo blocked
3. Shell: [ -n "$(ls -A "/<ABS_PROJECT_PATH>" 2>/dev/null)" ] && echo reachable || echo blocked
4. Another program: python3 -c "open('/<ABS_PROJECT_PATH>/<A_FILE_THAT_EXISTS>').read(1)" 2>/dev/null && echo reachable || echo blocked
5. Git refs: git --no-pager for-each-ref --format='%(refname)' | grep -v '^refs/heads/design-studio$' | head -1; git remote. "reachable" if either prints anything.
6. Git history of the codebase: git -C "/<ABS_PROJECT_PATH>" --no-pager log -1 --format=%h >/dev/null 2>&1 && echo reachable || echo blocked
7. Prompt history: read ~/.claude/history.jsonl with the Read tool, and head -c 1 ~/.claude/history.jsonl >/dev/null 2>&1 && echo reachable || echo blocked in the shell
8. Old transcripts: [ -n "$(ls -A ~/.claude/projects/ 2>/dev/null)" ] && echo reachable || echo blocked
9. Playbooks: read ~/.claude/playbooks/blank-slate-redesign.md with the Read tool
10. Web: use WebFetch on https://<LIVE_DOMAIN> if you have it; and in the shell: curl -s -m 5 -o /dev/null https://<LIVE_DOMAIN> && echo reachable || echo blocked
11. Tools: list every tool you have whose name starts with mcp__ (including mcp__ide__), plus any tool named Artifact, ArtifactComments, ArtifactData, DesignSync, SendMessage, ListAgents, RemoteTrigger, or any browser tool. "reachable" for each one present; "blocked" if there are none.
12. Guard files: echo x >> shoot 2>/dev/null && echo reachable || echo blocked
13. This session: "reachable" if you can see any conversation from before this message.
14. Claude Code's temp folder: read any file under /<CLAUDE_TMP> with the Read tool, and in the shell: [ -n "$(ls -A "<CLAUDE_TMP>" 2>/dev/null)" ] && echo reachable || echo blocked
15. Claude Code's cache folder: [ -n "$(ls -A <CLAUDE_CACHE> 2>/dev/null)" ] && echo reachable || echo blocked
16. Shell history: [ -n "$(head -c 1 ~/.zsh_history 2>/dev/null; head -c 1 ~/.bash_history 2>/dev/null; ls -A ~/.zsh_sessions 2>/dev/null)" ] && echo reachable || echo blocked
17. tmux: n=0; for s in <TMUX_SOCKETS>/*; do tmux -S "$s" list-sessions >/dev/null 2>&1 && n=$((n+1)); done; [ "$n" -gt 0 ] && echo reachable || echo blocked

Finish with one line: ALL BLOCKED, or the numbers that were reachable.
```

The session will ask permission for some commands. Approve them: that's the point of the test. For check 17, keep a tmux session open on the default server (for example a codebase `claude` session) while it runs, or it proves nothing; skip it on a machine without tmux. If it asks to allow a **network host**, say no, and count that check as blocked.

Expected result: **ALL BLOCKED** (checks 1–13 returned that in the macOS end-to-end test, and the Linux run passed with the entry-counting folder checks; 14–17 are new, added after the Linux run). Anything reachable → fix the template on `main`, commit, run `enter` (which refreshes the studio's guard files), and repeat in a new `./start` session.
