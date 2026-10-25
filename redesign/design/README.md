# Design progress

Inputs: `redesign/handoff/` (priorities and brief both FILLED). Decisions: `decisions.md`.

## Stage 1: three directions (done, 2026-10-25)
- A `a-kas`, B `b-daybook`, C `c-tick`. Owner chose B with C's screenshot crop: **`directions/d-daybook-crop` approved**. P1 to P4 adopted.
- After the shot, one desktop fix (crop column widened so the store name doesn't wrap), checked by measurement only.

## Stage 2: prototype (in progress, started 2026-10-25)
Built in `prototype/`, expanded only from `directions/d-daybook-crop`. One group per session, in this order:
1. **Capture and review: C1 to C4, R1 to R11 (done and approved 2026-10-25).** States: import in progress, failed, found nothing, amount couldn't be read, not ready to save, saving, and nothing waiting.
2. **Understand: U1 to U8 (done and approved 2026-10-25).** States: no spending, nothing to compare with, a day with no spending.
3. **Find and fix: F1 to F7 (done and approved 2026-10-25).** States: no results, deleting, missing category. All transactions lives in `js/find.js`; the Change spend form (`D.openForm('edit-saved')`) now has delete.
4. **Organise: O1 to O6 (done 2026-10-25, waiting for the owner's look).** States: starter categories being set up, checking a category before deleting. Whole-app states use `state.boot` (see `D.screens['boot-setup']` in `js/org.js` and the hook in `D.render`); group 5 adds `boot-first`, `boot-loading`, `boot-failed`, `boot-offline` the same way.
5. **App-wide states, `?stress` on every screen, installable (done 2026-10-25, waiting for the owner's look).** First use, loading, failed to load, no connection (opening, and using it read-only), manifest and icons.

Carried over from D: no tab bar (home is the inbox; Spending, All transactions and Categories open from it); a tick per row plus one accept bar; the "needs a look" group in lemon; the "From the screenshot" crop in the open row; store names verbatim; sentence case; text never under 14px; touch targets 44px; light mode only. Defaults: phone label "Add", desktop "Add screenshots"; the compare line says "lower than 1 to 25 September" while a period runs.

## Stage 3: design notes (done 2026-10-25, waiting for the owner's approval)
`tokens.css` (all tokens, one file) and `design-notes.md` (tokens, type and layout, components with variants and states, copy and tone, accessibility, behaviour that isn't visible, and the coverage tables: every story, every inventory state and every hard constraint, each pointing at state ids). `node prototype/check.js` keeps them honest: it fails if a story or state is missing from the tables, if a state id in the notes doesn't exist or a state isn't in the notes, if the swatches differ between `tokens.css` and `data.js`, if text is under 14px or a control under 44px, and if a contrast ratio quoted in the notes isn't true.

## Stage 4: freeze (next, on the owner's approval)
Put a version and date at the top of `design-notes.md` (for example `v1.0 (2026-xx-xx)`). Later changes bump the version.

### How to look at it
- **Interactive (the way to look at it):** in a second terminal on the server run `cd ~/spendings-tracker-studio/redesign/design && python3 -m http.server 8080 --bind "$(tailscale ip -4)"`, then open `http://100.118.18.29:8080/prototype/` with Tailscale on (Ctrl-C when done). Plain files, no build; fonts from Google Fonts.
- **Screenshots:** `./shoot redesign/design/prototype` saves `desktop.png` and `phone.png` of the home screen, but on this server it only prints their paths; copy them to the Mac with `scp` (see the global instructions) to see them.
- **Every state:** the menu button (top right) has a yellow "Prototype: jump to a state" panel. The same states open by link: `/prototype/?state=import-mixed`; add `&stress` for the stress data. State ids, group 5 (App-wide): `app-first`, `app-first-spending`, `app-first-list`, `app-loading`, `app-loading-spending`, `app-loading-list`, `app-loading-cats`, `app-failed`, `app-failed-cats`, `app-failed-retrying`, `app-failed-live`, `app-offline-boot`, `app-offline-boot-live`, `app-offline`, `app-offline-save`. Group 4 (Categories): `org-list`, `org-reorder`, `org-add`, `org-notready`, `org-edit`, `org-del-checking`, `org-del-empty`, `org-del-has`, `org-del-moving`, `org-setup`, `org-setup-live`. Group 3 (All transactions): `find-all`, `find-search`, `find-filters`, `find-sheet`, `find-sort`, `find-none`, `find-missing`, `find-missing-form`, `find-form`, `find-delete`, `find-deleting`. Group 2 (Spending): `spend-month`, `spend-week`, `spend-past`, `spend-all`, `spend-quiet`, `spend-first`, `spend-none`, `spend-category`, `spend-open`. Group 1: `review-fresh` (default), `review-problems`, `review-later`, `review-clear`, `review-saving`, `import-reading`, `import-live`, `import-mixed`, `import-failed`, `import-nothing`, `import-done`, `form-correct`, `form-amount`, `form-notready`, `form-saving`, `form-add`, `form-saved`, `picker`.
- **Try the real flow:** "Add" opens the file picker; whatever you choose is read (about 2 seconds each) and the lines arrive in the inbox. "Run it live" in the state list shows a failure and "Try again".

### File map (for the next sessions)
`prototype/index.html` loads, in this order: `js/icons.js` (icon set), `js/data.js` (dates, rupiah, categories and their colours, saved transactions), `js/ui.js` (overlays, toast), `js/capture.js` (group 1), `js/spending.js` (group 2: periods, the Spending screen, the home glance card), `js/find.js` (group 3: All transactions, filters, delete), `js/org.js` (group 4: Categories, the category form, deleting a category, the first-open set-up), `js/states.js` (group 5: loading, failed, no connection, the offline notice), then `js/app.js` (router, events, state switcher). Tokens: `redesign/design/tokens.css` (one file; the page links `../tokens.css`, so serve `redesign/design/`, not `prototype/`). CSS: `css/base.css` (shared parts), `css/capture.css`, `css/spending.css`, `css/find.css`, `css/org.css`, `css/states.css`. The manifest is `manifest.webmanifest`, the icons are in `icons/`. A group registers its screen with `D.screens.<name>`, its clicks with `D.acts.<name>`, and its states with `D.addScenario({id, group, label, route, params, run(state), after(state)})` (`route` is the screen the state opens). Screens link with `#/name?key=value`; `D.params` holds the values. `node prototype/check.js` (no browser) renders every state, validates the markup, checks that every button has a handler and runs the main flows; run it before finishing a group. It can't judge looks.

### Group 1: where each story is covered
C1 Add button and tray · C2 "Type in a spend" form (links under the glance, menu, All checked panel, failed screenshot) · C3 tray "Reading…" · C4 tray "Couldn't read this one" and "Nothing found" · R1 crop in the open row · R2 open row (note, category) and "Edit details" form · R3 the tick · R4 "Throw away" · R5 count in the title, "Oldest is from…" · R6 saved as you type (P3) · R7 accept bar · R8 "Suggested from the store name" · R9 repeat in "Need a look" · R10 incoming in "Need a look" · R11 note and category in the open row.
The full table with state ids comes in `design-notes.md` (stage 3).

### Group 2: where each story is covered
U1 the big total on Spending (week or month) and on the home glance · U2 "Rp 475.650 lower" and "1 to 25 September was Rp 7.318.000" (like for like while running) · U3 "Where it went": emoji on colour, amount, share, biggest first, top five then "Show N more" · U4 "Day by day": slide or step for the exact amount, biggest day tagged · U5 "Biggest spends" · U6 Week/Month switch, earlier/later arrows, "Back to this month", date kept when switching · U7 category row, then its spends in that period · U8 biggest spend, then the Change spend form (P7).
States: no spending in the period `spend-none` · nothing to compare with `spend-first` · a day with no spending `spend-quiet`.

### Group 3: where each story is covered
F1 search box on All transactions (store and note, highlighted) · F2 the Filters sheet: dates (all time, a day, a week, a month, custom), categories, amount, source · F3 number on the Filters button, one chip per filter, "Clear all" · F4 the Order menu · F5 the row: emoji on colour, store, category and note, amount, date, source icon · F6 the Change spend form · F7 "Delete this spend" in that form, then one confirmation.
States: no results `find-none` · deleting `find-deleting` (and `find-delete` for the question) · missing category `find-missing` and `find-missing-form`.
Group 4 can reuse `D.overlay`, `D.catById`, `D.openCatPicker` and the chips, fields and buttons in `base.css`; the alert colour is for deleting (O6 should use `.btn.danger` and the same confirmation shape as `confirmHtml` in `find.js`).

### Group 4: where each story is covered
O1 first open: `org-setup` (the set-up screen) and the sixteen starters in `org-list` · O2 "Add category" on Categories: name, emoji, colour · O3 tap a category, change it, and every screen shows the change · O4 "Change order" with arrows, the first four marked as quick choices · O5 the spend count on each row · O6 "Delete this category" in the change form: the check, then "no spends" or "choose where they go".
States: starter categories being set up `org-setup` / `org-setup-live` · checking a category before deleting `org-del-checking`, then `org-del-empty` or `org-del-has` (and `org-del-moving`).

### Group 5: where each state is covered
First use (no transactions at all): `app-first`, `app-first-spending`, `app-first-list` · loading transactions or categories: `app-loading` (home), `app-loading-spending`, `app-loading-list`, `app-loading-cats` · failed to load: `app-failed` (transactions), `app-failed-cats`, `app-failed-retrying`, and `app-failed-live` to run it · no connection: opening the app `app-offline-boot` / `app-offline-boot-live`, and using it `app-offline` and `app-offline-save`.
Installable: `manifest.webmanifest`, `icons/`, the `<meta>` tags in `index.html`. Stress: add `&stress` to any state link.
Next is stage 3: `redesign/design/tokens.css` and `design-notes.md` (tokens, components with variants and states, copy and tone, accessibility, and the coverage table that maps every story ID and state to its state id above).

