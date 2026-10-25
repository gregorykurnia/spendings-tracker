# Blank-Slate UI Redesign: Spending Tracker (light version)

A cut-down version of `~/.claude/playbooks/blank-slate-redesign.md`, sized for a four-screen, single-user app (decided 2026-10-24). The full playbook's extra firewall proofs, full-state design guide, coverage audit and 9-phase rebuild with a frozen fallback are dropped. When this plan and the playbook differ, this plan wins.

**Core idea:** keep *what the app does*, throw away *how it looks*. Only a written list of needs crosses from the old app to the designer. No screenshots, CSS, markup, class names, colours, fonts, icons, UI wording or screen order.

**The firewall:** whoever sees the old app never designs, and whoever designs never sees the old app. The design studio is `../spendings-tracker-studio`, a separate repo with no remote, started only with `./start` there. It's already set up (Step 0), and its guards stay as they are.

Work one step per session. At the start of each session, check the model against the step's pick in the checklist (picks come from the table in `~/.claude/CLAUDE.md`), and say so if the current one is lower. Tick a step's box in the same commit as its work, never before.

---

## Checklist

**Setup**
- [x] Step 0: plan, studio templates, `studio.sh`, `CLAUDE.md` rules, `studio.sh init` — done 2026-10-24
- [x] Step 0b: firewall check in a fresh `./start` session reports ALL BLOCKED (2026-10-25) — **Haiku 5.5 High** · studio

**Needs (sees the old app)**
- [x] Step 1: `inventory.md` job stories, owner-only `inventory-notes.md`, starter `priorities.md`, `brief.md`, `needs.md`; banned-word scan clean (2026-10-25) — **Opus 5.5 Medium** · Claude on `main`

**Your input (without opening the app)**
- [x] Step 2: open questions in `inventory-notes.md` decided; `priorities.md` and `brief.md` status `FILLED` (2026-10-25) — you, interviewed by a helper session **Haiku 5.5 Max**

**Design (studio, never sees the old app)**
- [ ] Step 3a: 3 directions as screenshots; you pick one (or one mix); choice recorded in `decisions.md` — **Sonnet 5.5 xHigh** · studio; screenshots by `! ./shoot`
- [ ] Step 3b: prototype of every job story and state, phone and desktop — **Sonnet 5.5 xHigh** · studio
- [ ] Step 3c: `tokens.css` and `design-notes.md` with a coverage table; you approve; version and date added — **Sonnet 5.5 xHigh** · studio
- [ ] Step 3d: design imported onto `main` — **Haiku 5.5 High** · Claude on `main`

**Rebuild**
- [ ] Step 4: `redesign/ui-implementation-plan.md` (3 phases, written for `autorun all`); `autorun check` finds its first task; you approve — **Opus 5.5 High** · Claude on `main`
- [ ] Step 5: rebuild on the `redesign` branch, phases 1–3 with their reviews — each task's pick from the implementation plan; reviews **Opus 5.5 High**
- [ ] Step 6: merged to `main` when you say so; `CLAUDE.md` updated for the new UI; staging setup offered and done or declined (write which here) — **Sonnet 5.5 High**

---

## Project details (filled in at Step 0, 2026-10-24)

**Source files for the inventory** (taken from the code; the project's `CLAUDE.md` is partly out of date: it says Next.js 14, the code runs Next.js 16.2):
- Screens: `src/app/page.tsx` (spending overview), `src/app/transactions/page.tsx`, `src/app/ocr/page.tsx` (screenshot import and review), `src/app/categories/page.tsx`, `src/app/layout.tsx`, `src/app/globals.css`
- Server: `src/app/api/ocr/route.ts` (sends screenshots to the Claude API)
- Components: everything in `src/components/` (charts, period navigation, filters, forms, delete confirmations, import review rows, navigation, service-worker registration)
- Data and logic: `src/hooks/useCategories.ts`, `src/hooks/useTransactions.ts`, `src/hooks/useTransactionCounts.ts`, `src/lib/firebase.ts`, `src/lib/seedCategories.ts`, `src/lib/dateRanges.ts`, `src/lib/format.ts`, `src/lib/categoricalPalette.ts`, `src/types/index.ts`
- Installable / offline: `src/app/manifest.ts`, `public/sw.js`, `public/icons/`
- No auth, no permissions, no exports, no tests in the repo.

**Project constraints** (for Step 4):
- Next.js 16.2 App Router, React 19, TypeScript, Tailwind CSS 4. This Next.js has breaking changes: read `node_modules/next/dist/docs/` before writing code (`AGENTS.md`).
- Build: `next build`; lint: `eslint`. No unit or e2e test framework yet: Step 4 must plan one.
- Data: Firebase Firestore, read and written directly from the browser with the client SDK (collections `categories`, `transactions`). No emulator or test project exists, so any test run today would hit the live database: the plan must add a safe test setup (emulator, fake credentials, `demo-` project ID) before e2e tests write data.
- AI: Claude API (vision) through the `/api/ocr` route, key in `ANTHROPIC_API_KEY`.
- Single user, no authentication. Amounts in IDR (Rp XX.XXX.XXX). Used mostly on a phone; installable as a PWA.
- Hosting: Vercel. **Every push to `main` deploys to production**; other branches get preview deploys.

**Git setup:** no staging setup. Today every change is committed and pushed straight to `main` with `./push.sh "<message>"` (`git add -A`, commit, `git push origin main`), and `AGENTS.md` asks for a commit and push after each validated change. The rebuild runs on `redesign` (preview deploys only). Step 6 offers the switch to the staging setup.

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

**Firewall check values for this machine** (they are already filled into the Appendix prompt): `<ABS_PROJECT_PATH>` = `home/ubuntu/spendings-tracker`, `<A_FILE_THAT_EXISTS>` = `package.json`, `<LIVE_DOMAIN>` = `spendings-tracker-vert.vercel.app`, `<CLAUDE_TMP>` = `/tmp/claude-1001/-home-ubuntu-spendings-tracker`, `<CLAUDE_CACHE>` = `~/.cache/claude-cli-nodejs/-home-ubuntu-spendings-tracker`, `<TMUX_SOCKETS>` = `/tmp/tmux-1001`.

**Plugins:** every installed plugin is `false` in the studio's `enabledPlugins` except `frontend-design@anthropic-plugin-directory`. `git worktree list` shows no extra copies of the repo; no Kilo folder on this machine.

---

## What crosses into the studio

Only `redesign/handoff/`, copied in by `redesign/studio.sh enter`:
1. `inventory.md`: user needs as job stories (Step 1)
2. `priorities.md`: how often each job happens (Step 2)
3. `brief.md`: who uses it, personality, references, branding (Step 2)
4. `needs.md`: gaps found later, written as needs (design-gap loop)

Run the banned-word scan on every file in `redesign/handoff/` before each `enter`.

Never into the studio: this codebase or any session that has been in it (always a brand-new `./start` session, never `--continue`, `--resume` or a subagent), anything pasted by hand, screenshots or descriptions of the current app, logos, current colours or fonts, code names, `inventory-notes.md`, this plan. Don't open the app yourself during Steps 2–3: daily use makes the current layout feel natural.

---

## Step 0b: Firewall check (fresh studio session, Haiku 5.5 High)

1. In a new terminal **outside tmux**: `cd ~/spendings-tracker-studio && ./start`. Keep a codebase `claude` session open in tmux while it runs (check 17 needs one).
2. Set the model, then type `/mcp` (no servers, not even `ide`), `/memory` (only the global and the studio's `CLAUDE.md`) and `/sandbox` (enabled).
3. Send the prompt in the Appendix. Approve the commands it asks for; if it asks to allow a **network host**, say no and count that check as blocked.
4. `/exit` and never reuse that session. Anything **reachable** gets fixed in `redesign/studio-template/`, committed, `redesign/studio.sh enter`, and checked again in a new `./start` session.
5. Run it again after adding a connector, plugin or MCP server to your account.

## Step 1: Needs inventory (Claude on `main`, Opus 5.5 Medium)

Read the source files listed in "Project details" and write `redesign/handoff/inventory.md`. Everything about code or current behaviour goes in the owner-only `redesign/inventory-notes.md` (never handed off), with these sections: §1 code map, §2 behaviour rules the rebuild must keep (for example category reassignment before deleting, how periods are counted), §3 data model, §4 half-built features and bugs to decide on, §5 decisions (filled in Step 2).

Rules for `inventory.md`:
- **No layout words.** Banned: sidebar, tab, drawer, modal, popup, dialog, menu, ⋯, toolbar, panel, pane, list, grid, card, header, footer, column, row, button, icon, badge, toggle, dropdown, arrow, tree, page, screen, view, left, right, top, bottom, donut, chip, nav, plus any word naming a distinctive part of this app's UI.
- **No UI labels.** Describe the need, not the current label. Only the domain words in "Project details" are allowed.
- **Group by jobs, not screens,** for example Capture, Review, Understand, Find & fix, Organise. Give each story an ID (C1, R2…).
- **Each need is a job story:** "When I ___, I want to ___, so that ___."
- Also list, in neutral words: **states** (nothing yet, loading, failure, no connection, no results, import in progress, import failed or found nothing, anything else this app has) and **hard constraints** (phone-first, installable, IDR amounts, Indonesian bank screenshots).

Starter files: `priorities.md` (`Status: DRAFT`, then `ID | Job story (short) | Frequency` with Frequency empty), `brief.md` (`Status: DRAFT`, then the Step 2 headings, each with a one-line prompt), `needs.md` (`Open needs: none`, then an empty `ID | Need (job story) | Raised in | Status` table).

Finish with the banned-word scan (a `grep -niwE` over `redesign/handoff/`): rewrite every hit, and reread each story once for anything that still gives away the current order or wording.

## Step 2: Your input (you, interviewed by a helper session, Haiku 5.5 Max)

The helper interviews you in rounds of multiple-choice questions and drafts the files for you to correct, following "Steps 2–3: The owner interview" in `~/.claude/playbooks/blank-slate-redesign.md` (its firewall rules and rounds). Here that means:
1. Decisions on `inventory-notes.md` §4, recorded in §5; newly confirmed needs added to `inventory.md` as job stories.
2. `priorities.md`: each story tagged **daily / weekly / rare / drop**, from what you actually do. `Status: FILLED`.
3. `brief.md`, under its existing headings (who uses it, language, personality, references, constraints, branding, permission to challenge), plus your dislikes. `Status: FILLED`.
4. Banned-word scan, commit, then `redesign/studio.sh enter`.

## Step 3: Design (studio, Sonnet 5.5 xHigh)

`redesign/studio.sh enter` → new terminal → `cd ~/spendings-tracker-studio && ./start` → *"Start the design process described in CLAUDE.md"* (or *"Continue the design process"*). The studio's `CLAUDE.md` has the details. In short:
- **3a:** three different directions, each one static page of the #1 daily job; `! ./shoot` for screenshots (printed as paths on this server: open them through VS Code Remote-SSH or copy them to the Mac). Before picking, ask yourself whether you like one because it's *familiar*; write the reason in brief and priority terms.
- **3b:** the chosen direction expanded into `redesign/design/prototype/`: every job story and state, phone and desktop, the themes the brief asks for, plus one stress data set.
- **3c:** `tokens.css` and a short `design-notes.md` (components and their states, copy and tone, accessibility, a coverage table of story ID → where it's designed). You approve; it gets a version and date.
- **3d:** on `main`, say **"Import the approved design"**: `redesign/studio.sh import` brings `redesign/design/` across. Keep the studio for later gaps.

## Step 4: Implementation plan (Claude on `main`, Opus 5.5 High)

Write `redesign/ui-implementation-plan.md` following "Implementation plans are written for `autorun all`" and the "Quality first" rules in `~/.claude/CLAUDE.md` (they're the one home of those rules; don't copy them in). It maps **design → code** and makes no design decisions: gaps go to its "Design gaps" section and through the design-gap loop. Keep it to about one screen of tasks.

It contains:
- **Header line:** `**AI Build Log project:** Spending Tracker Redesign`
- **Inputs:** design version and the commit it starts from.
- **Architecture:** the constraints in "Project details"; data hooks and Firestore code kept, all rendering rewritten from the tokens with new component names; file layout at the end.
- **Screen map:** each designed screen, the data it reads, the code it replaces, its states.
- **Reverse check (code → design):** every place in today's code that shows something (confirm dialogs, errors, empty and loading states, the PWA manifest colours and icons, favicon, 404) mapped to its new design, or listed as a gap. Never restyled from the old version.
- **A safe test setup first:** today there are no tests and no emulator, so the first Phase 1 task adds the Firestore emulator (fake credentials, `demo-` project ID), unit tests and one e2e smoke spec per flow that writes data (add/edit/delete a transaction, import review and confirm, category delete with reassignment). Nothing may run against the live database.
- **Three phases**, each under its own heading and ending with an end-to-end task and a review row (fresh Opus 5.5 High session; reviews the phase diff against the prototype, runs the full suite once, routes every "should fix" item to a fix task, a named later task, or dropped with a reason):
  1. Test setup, tokens, fonts and app shell (navigation, layout, theme)
  2. The screens, one task each, with all their states
  3. Polish: the reverse-check items, PWA assets, accessibility pass, screenshot compare against the prototype
- **Task table:** one row per task, `Phase | Task | Model · effort | Why | Done`, picks only from the global table. Mechanical ports from the prototype can be Haiku 5.5 Max; screens with interaction or saving start at Sonnet 5.5 High; data and test setup is Opus 5.5 High.
- **Owner lines** (no pick): the merge to `main`, a check on your phone.
- **Rollback:** the merge commit; `git revert -m 1 <merge>` puts the old UI back.

## Step 5: Rebuild (on the `redesign` branch)

- All work on `redesign`; pushes there make Vercel preview deploys only. `main` stays the live app until Step 6.
- One task per fresh session, reading only that task's section, the design notes and the matching prototype file. The prototype is the spec; never copy markup, CSS, names or wording from the old UI. Delete old components as their replacements land.
- Run it by hand or with `autorun` (`autorun check`, `autorun one`, `autorun all`; `autorun help` lists everything). Switch to `main` whenever `redesign/studio.sh` is needed (it refuses other branches).
- Tick each task's Done cell in the task table, in the same commit as the work, and nowhere else. One-to-three-line entries go in `CHANGELOG.md`.

## Step 6: Merge (when you say so, Sonnet 5.5 High)

1. On `redesign`: `git merge main`, push, then `git push origin redesign:main` (fast-forward only; if it's blocked, Claude gives you the command with `!` in front). This deploys to production.
2. Replace the "UI redesign" section of `CLAUDE.md` with a short lasting one: `redesign/design/` is the reference for new or changed screens, gaps go through `needs.md` and the studio, plus a **Checks** line naming this project's type check, lint, unit and e2e commands. Also fix the out-of-date stack lines (Next.js 16.2, not 14).
3. Offer the staging setup (work collects on `staging`, nothing goes live until "release", local previews), as in `~/.claude/playbooks/new-app.md` Appendix A. Record yes or no on the Step 6 line.

## Design-gap loop (any time after 3d)

1. Record the gap in the implementation plan's "Design gaps" section (code context is fine there).
2. Write it as a need in `redesign/handoff/needs.md` (new ID N1, N2…, a job story by the Step 1 rules, the step that raised it, status `open`); banned-word scan; commit.
3. `redesign/studio.sh enter` → `./start` → *"Design the open needs in needs.md"* (Sonnet 5.5 xHigh).
4. **"Import the approved design"** on `main`, mark the need `designed`, and bring the import onto `redesign` (`git switch redesign && git merge main && git push origin redesign && git switch main`).

The task that needs the answer waits; others continue. Under `autorun all`, the session builds a provisional version from the new design's own pieces and still records the gap.

---

## Appendix: firewall check prompt (this machine)

```text
This is a firewall check for this folder. Rules: do NOT print, quote or summarise any file content, web page or command output; don't save memories; don't call any connector or MCP tool. Run each check once, and report only "blocked" or "reachable", as a table: # | check | result.

1. Read tool: read /home/ubuntu/spendings-tracker/package.json
2. Shell: head -c 1 "/home/ubuntu/spendings-tracker/package.json" >/dev/null && echo reachable || echo blocked
3. Shell: [ -n "$(ls -A "/home/ubuntu/spendings-tracker" 2>/dev/null)" ] && echo reachable || echo blocked
4. Another program: python3 -c "open('/home/ubuntu/spendings-tracker/package.json').read(1)" 2>/dev/null && echo reachable || echo blocked
5. Git refs: git --no-pager for-each-ref --format='%(refname)' | grep -v '^refs/heads/design-studio$' | head -1; git remote. "reachable" if either prints anything.
6. Git history of the codebase: git -C "/home/ubuntu/spendings-tracker" --no-pager log -1 --format=%h >/dev/null 2>&1 && echo reachable || echo blocked
7. Prompt history: read ~/.claude/history.jsonl with the Read tool, and head -c 1 ~/.claude/history.jsonl >/dev/null 2>&1 && echo reachable || echo blocked in the shell
8. Old transcripts: [ -n "$(ls -A ~/.claude/projects/ 2>/dev/null)" ] && echo reachable || echo blocked
9. Playbooks: read ~/.claude/playbooks/blank-slate-redesign.md with the Read tool
10. Web: use WebFetch on https://spendings-tracker-vert.vercel.app if you have it; and in the shell: curl -s -m 5 -o /dev/null https://spendings-tracker-vert.vercel.app && echo reachable || echo blocked
11. Tools: list every tool you have whose name starts with mcp__ (including mcp__ide__), plus any tool named Artifact, ArtifactComments, ArtifactData, DesignSync, SendMessage, ListAgents, RemoteTrigger, or any browser tool. "reachable" for each one present; "blocked" if there are none.
12. Guard files: echo x >> shoot 2>/dev/null && echo reachable || echo blocked
13. This session: "reachable" if you can see any conversation from before this message.
14. Claude Code's temp folder: read any file under /tmp/claude-1001/-home-ubuntu-spendings-tracker with the Read tool, and in the shell: [ -n "$(ls -A "/tmp/claude-1001/-home-ubuntu-spendings-tracker" 2>/dev/null)" ] && echo reachable || echo blocked
15. Claude Code's cache folder: [ -n "$(ls -A ~/.cache/claude-cli-nodejs/-home-ubuntu-spendings-tracker 2>/dev/null)" ] && echo reachable || echo blocked
16. Shell history: [ -n "$(head -c 1 ~/.zsh_history 2>/dev/null; head -c 1 ~/.bash_history 2>/dev/null; ls -A ~/.zsh_sessions 2>/dev/null)" ] && echo reachable || echo blocked
17. tmux: n=0; for s in /tmp/tmux-1001/*; do tmux -S "$s" list-sessions >/dev/null 2>&1 && n=$((n+1)); done; [ "$n" -gt 0 ] && echo reachable || echo blocked

Finish with one line: ALL BLOCKED, or the numbers that were reachable.
```
