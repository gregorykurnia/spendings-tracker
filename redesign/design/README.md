# Design progress

Inputs: `redesign/handoff/` (priorities and brief both FILLED). Decisions: `decisions.md`.

## Stage 1: three directions (done, 2026-10-25)
- A `a-kas`, B `b-daybook`, C `c-tick`. Owner chose B with C's screenshot crop: **`directions/d-daybook-crop` approved**. P1 to P4 adopted.
- After the shot, one desktop fix (crop column widened so the store name doesn't wrap), checked by measurement only.

## Stage 2: prototype (in progress, started 2026-10-25)
Built in `prototype/`, expanded only from `directions/d-daybook-crop`. One group per session, in this order:
1. **Capture and review: C1 to C4, R1 to R11 (done 2026-10-25, waiting for the owner's look).** States: import in progress, failed, found nothing, amount couldn't be read, not ready to save, saving, and nothing waiting.
2. Understand: U1 to U8. States: no spending, nothing to compare with, a day with no spending.
3. Find and fix: F1 to F7. States: no results, deleting, missing category. (The form for F6 already exists from group 1: `D.openForm('edit-saved', {id})`.)
4. Organise: O1 to O6. States: starter categories being set up, checking a category before deleting.
5. App-wide states (first use, loading, failed to load, no connection) and the `?stress` data set. (`?stress` already makes the inbox 48 lines with very long names and huge amounts; extend it to the other screens.)

Carried over from D: no tab bar (home is the inbox; Spending, All transactions and Categories open from it); a tick per row plus one accept bar; the "needs a look" group in lemon; the "From the screenshot" crop in the open row; store names verbatim; sentence case; text never under 14px; touch targets 44px; light mode only. Defaults: phone label "Add", desktop "Add screenshots"; the compare line says "lower than 1 to 25 September" while a period runs.

### How to look at it
- **Quick shots of the home screen:** `! ./shoot redesign/design/prototype` (desktop.png and phone.png in the prototype folder).
- **Interactive:** serve `redesign/design/` (`cd redesign/design && python3 -m http.server 8080`) and open `/prototype/`. Plain files, no build; fonts from Google Fonts.
- **Every state:** the menu button (top right) has a yellow "Prototype: jump to a state" panel. The same states open by link: `/prototype/?state=import-mixed`; add `&stress` for the stress data. State ids: `review-fresh` (default), `review-problems`, `review-later`, `review-clear`, `review-saving`, `import-reading`, `import-live`, `import-mixed`, `import-failed`, `import-nothing`, `import-done`, `form-correct`, `form-amount`, `form-notready`, `form-saving`, `form-add`, `form-saved`, `picker`.
- **Try the real flow:** "Add" opens the file picker; whatever you choose is read (about 2 seconds each) and the lines arrive in the inbox. "Run it live" in the state list shows a failure and "Try again".

### File map (for the next sessions)
`prototype/index.html` loads, in this order: `js/icons.js` (icon set), `js/data.js` (dates, rupiah, categories and their colours, saved transactions), `js/ui.js` (overlays, toast), `js/capture.js` (group 1), then one file per later group, then `js/app.js` (router, events, state switcher). CSS: `css/tokens.css`, `css/base.css` (shared parts), `css/capture.css`, then one file per group. A group registers its screen with `D.screens.<name>`, its clicks with `D.acts.<name>`, and its states with `D.addScenario({id, group, label, run(state), after(state)})`. `node prototype/check.js` (no browser) renders every state, validates the markup, checks that every button has a handler and runs the main flows; run it before finishing a group. It can't judge looks.

### Group 1: where each story is covered
C1 Add button and tray · C2 "Type in a spend" form (links under the glance, menu, All checked panel, failed screenshot) · C3 tray "Reading…" · C4 tray "Couldn't read this one" and "Nothing found" · R1 crop in the open row · R2 open row (note, category) and "Edit details" form · R3 the tick · R4 "Throw away" · R5 count in the title, "Oldest is from…" · R6 saved as you type (P3) · R7 accept bar · R8 "Suggested from the store name" · R9 repeat in "Need a look" · R10 incoming in "Need a look" · R11 note and category in the open row.
The full table with state ids comes in `design-notes.md` (stage 3).
