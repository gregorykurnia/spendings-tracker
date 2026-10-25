# Design notes: Daybook (working name)

**Status:** draft for approval, 2026-10-25. Not frozen. When the owner approves, a version and date go on this line (for example `v1.0 (2026-xx-xx)`); later changes bump it.

Inputs: `redesign/handoff/` only. Direction: `directions/d-daybook-crop`. Decisions and the reasons behind them: `decisions.md` (P1 to P7 and the choices per group). The working prototype is `prototype/`; every state below opens by link, for example `/prototype/?state=import-mixed`. Add `&stress` for the stress data set.

## 1. What this is

A calm, bright place to check spending that arrives as banking screenshots. One home, the inbox: a tick per line, one bar to accept all that look right. Spending, All transactions and Categories open from it; there is no tab bar. Phone first, desktop works. Light mode only. Name, logo and colours were left open; "Daybook", the bookmark mark and the palette are proposals.

## 2. Tokens

Source: `tokens.css` (one file; the prototype links it and defines nothing of its own). `check.js` keeps the swatches equal to `data.js`, fails on text under 14px or a control under 44px, and fails on a token nobody uses.

| Group | Tokens | Use |
|---|---|---|
| Surfaces and ink | `--ground` warm white, `--paper` white, `--ink`, `--ink-2`, `--ink-3` | page, cards and fields, text, secondary text, placeholders |
| Action | `--petrol` (+ `--on-petrol`) | every button, tick, link and selected state |
| Lemon: "look at this" | `--lemon`, `--lemon-soft`, `--lemon-line`, `--lemon-edge` | needs a look, the screenshot crop, filters that are on, the biggest day, offline notice |
| Alert: "wrong or can't be undone" | `--alert`, `--alert-soft`, `--alert-line` | no amount, field errors, deleting. Never for spending more or less |
| Lines | `--line`, `--line-2`, `--field-line` | dividers and tracks, card and resting-chip borders, control borders |
| Chart | `--bar`, `--day-on` | day bars, the column behind the chosen day |
| Category swatches | `--sw-<name>-tint` and `--sw-<name>` for 13 names | tint on pills and tiles, solid on bars and rings. The owner picks one per category |
| Type | `--font` Hanken Grotesk 400 to 800; `--fs-s` 14, `-m` 15, `-b` 16, `-amt` 17, `-l` 18, `-xl` 22, `-2xl` 28, `-big` 32, `-h1` 36, `-hero` 40, plus wide and emoji sizes | see section 3 |
| Shape | `--r-s` 10, `-m` 14, `-l` 20, `-xl` 24; `--touch` 44 | inputs and small cards, cards, sheets and groups; the smallest thing you press |
| Layout | `--page-max` 1120, `--page-narrow` 760, `--sheet-max` 560, `--boot-max` 460 | home and Spending, All transactions and Categories, sheets and dialogs, full-screen states |
| Elevation and layers | `--shadow-sheet`, `--shadow-dialog`, `--shadow-cta`; `--z-bar` 5, `-overlay` 20, `-toast` 30, `-skip` 50 | |
| Motion | `--dur-step`, `-fast`, `-leave`, `-sheet`, `-spin`, `-slide`, `-pulse` | all stop or go still under "reduce motion" |

Breakpoints (comments in `tokens.css`, as media queries can't read tokens): 960 wide layout, 700 sheets become dialogs, 600 form fields pair up, 519 and below the fourth quick category hides.

## 3. Type and layout

- **One family, weight does the work:** 800 for titles, amounts and group headings; 700 for names and buttons; 600 for secondary lines; 500 and 400 for quiet text. Letter-spacing tightens as size grows (-0.035em on titles). Figures are tabular so amounts line up.
- **Scale:** page title 36 (52 wide) · the big total 40 (56 wide) on Spending, 32 (46) on the home card · section heading 18 · store names 16 · amounts in rows 17 · secondary 15 · captions 14. Nothing is smaller than 14.
- **Page rhythm:** gutter 20 (40 wide); rows 13 to 15 tall padding; groups 14 apart; sections 28 to 36 apart. A page is one column on a phone; wide, home is a main column plus a 360 side column, Spending a main column plus a 380 category column.
- **Density:** key numbers big, details one line below. At most one chart per screen, one accent colour per meaning.
- **Fixed bars:** the accept bar is fixed to the bottom on a phone (page padding makes room) and sticky wide.
- **Installed:** safe-area padding at the top and bottom, status bar default, no pull-to-refresh; every screen under home has its own back link, because there is no browser back button.

## 4. Components

States that apply to every control: rest, focus (3px petrol ring, 3px offset), disabled (`aria-disabled`, grey, still readable), busy (spinner and the verb in progress: "Saving…", "Accepting…", "Deleting…"), and offline (dimmed, says why when pressed).

| Component | Variants | States | See |
|---|---|---|---|
| Button `.btn` | outline (default), solid, quiet, danger, danger outline; 44 high, 52 `big` | rest, disabled, busy, offline | `form-notready`, `form-saving` |
| Add `.add` | "Add" on a phone, "Add screenshots" wide | rest, disabled while reading | `import-reading` |
| Tick `.tick` | 44 round, petrol ring | ready, busy (spinner), offline | `review-saving`, `app-offline` |
| Step button `.step`, back `.back`, segmented `.seg` | earlier/later, day/period, back to home or Spending, Week or Month | rest, disabled (first, last, current period) | `spend-month`, `find-sheet` |
| Category pill `.pill`, disc `.cat-em` | emoji on its tint; disc 44, big 56 | wraps for long names | `review-fresh`, `org-list` |
| Chip `.chip` | resting, on (petrol), "More" (dashed), wrapping; used for quick categories, filters, sources, move-to | rest, on, disabled | `review-fresh`, `find-sheet`, `org-del-has` |
| Filter chip `.fx-chip` | lemon, name and a cross | rest | `find-filters` |
| Swatch `.swatch`, emoji tile `.emo` | 13 colours, 28 suggested emoji | rest, chosen (ring) | `org-add` |
| Text field `.input` | text, search (pill, clear button), amount (Rp prefix), date (native picker under a formatted label), select (order) | rest, focus, invalid (alert fill and border, message below), read-only (busy or offline) | `form-notready`, `find-all` |
| Message under a field `.f-err`, summary `.f-sum`, hint `.hint` | field error, offline error (`.net`, announced as an alert), "Still needed: store and amount." | shown after leaving the field or after a try | `form-notready`, `app-offline-save` |
| Review row `.row` | closed, open (card with crop, note, chips, links), busy, leaving (collapses) | | `review-fresh`, `review-saving` |
| Need-a-look row `.row.nl` | reasons: incoming, repeat, amount, store, date, category; each has one line of why and two buttons (fix first, then throw away) | | `review-problems`, `review-incomplete` |
| Spend row `.tx-line` | biggest (date and category under the store), list (category, note, amount, date, source icon), missing category (grey ❔, "No category" in alert), search highlight (`mark`) | rest | `spend-month`, `find-all`, `find-missing` |
| Category line `.cat-line`, Categories row `.org-line` | share bar in the solid colour; count under the name; reorder mode (arrows, quick-choices line) | | `spend-all`, `org-reorder` |
| Import row `.shot` | thumbnail, name, state; "Waiting", "Reading…" (bar), "Found 4 transactions", "Couldn't read this one" (try again, type in a spend, dismiss), "Nothing found" | | `import-mixed` |
| Group heading and jump `.grp`, `.jump` | "Look right 5" with "2 need a look" jump; the lemon group | | `review-fresh` |
| Cards | home card, Spending total (`.hero`), empty panel (`.empty`, with mark, text, buttons, and numbered steps for first use), crop (`.crop`), delete card, preview | | `app-first`, `spend-none` |
| Accept bar `.actionbar` | "Accept the 5 that look right", "Accept all 5" when none need a look; hidden under two lines | rest, busy, offline | `review-fresh`, `review-saving` |
| Day chart `.chart` | week (7 wide bars), month (31 thin bars), readout with step buttons | bar, chosen, no spending (flat mark), still to come (faint) | `spend-month`, `spend-quiet` |
| Sheet and dialog `.ov`, `.panel` | form, picker, menu, filters, confirm (alert dialog); sheet below 700, dialog above | opening, saving (cannot be dismissed) | `form-correct`, `find-delete`, `org-del-has` |
| Toast `.toast` | one line, past tense, 4 seconds, no buttons | | after accept all, add, delete |
| Offline notice `.offline` | lemon, under the bar, every screen | | `app-offline` |
| Loading `.sk` | the layout of home, Spending, All transactions, Categories in grey | pulsing (still when motion is reduced) | `app-loading` |
| Full-screen states | setting up, no connection, couldn't load | retrying | `org-setup`, `app-offline-boot`, `app-failed` |

## 5. Copy and tone

Calm, plain, brief. English, sentence case, no exclamation marks, no emoji except the owner's category emoji. Store names stay exactly as the bank writes them.

| Pattern | Rule | Example |
|---|---|---|
| One word per action | the same word from button to message | Accept, "Accepted 5. Rp 1.765.450 added." · Add, "Added KOPI…, Rp 28.000." · Delete, "Deleted …" |
| Our words | spend = saved or typed in; line = something read from a screenshot and not checked yet; "transactions" only in the page name | "7 to check", "69 spends use it. 1 waiting line does too." |
| Verbs on buttons | say what happens | Accept · Throw away · Keep it · It's a spend · Type in a spend · Add amount · Choose category · Move 70 and delete |
| Errors | what happened and what to do; no apology, no promises | "Couldn't read the amount. Check it against the screenshot." · "Something went wrong while loading. Try again in a moment." |
| Empty | what this is, then one next step | "Add screenshots from your banking app and the spending in them shows up here to check." |
| Confirming | name what goes, say it is for good, safe button first | "Delete this spend?", the spend, "It is removed for good and stops counting in your totals.", Cancel · Delete |
| Waiting | the verb in progress, then the result | "Reading…" then "Found 4 transactions" |
| Numbers | whole rupiah with dots `Rp 1.234.567`; the amount in the bank's own form on the crop `87.450,00 DB`; counts "1 spend", "2 spends" | |
| Dates | `Sun 25 Oct`, the year only when it is not this year; spans "1 to 25 September", "19 to 25 Oct 2026"; weeks Monday to Sunday | |
| Comparisons | "Rp 475.650 lower" then "1 to 25 September was Rp 7.318.000"; no green or red | |

## 6. Accessibility

- **Contrast (checked by `check.js`):** ink on the ground 11:1; secondary ink 5.9:1; placeholders 5.2:1; petrol on the ground 7.7:1 and white on petrol 7.9:1; alert on its fill 5.8:1; ink on every category tint 8.1:1 or more; the weakest text pair, secondary ink on a disabled button, 4.8:1. Control borders 3.2:1, day bars 3.4:1, solid category colours 3.3:1 or more against white.
- **Not by colour alone:** each category has its emoji and name; the chosen day is also named in text; a filter that is on has a chip with its words; "No amount" and "No category" are words with an icon, not just red.
- **Size:** text never under 14px, inputs 16px (no zoom on iPhone), controls 44px, the stretched row is the whole line.
- **Keyboard and screen reader:** every control is a real button or link; the row's name is its open button (`aria-expanded`), the tick says "Accept STORE, Rp amount"; dialogs trap focus, close on Escape and return focus to what opened them; results, progress, accepted and deleted are announced in a polite live region; errors are tied to their field and announced when a save is tried.
- **The day chart** has a text alternative (the biggest day) and its own readout with step buttons; sliding along it is an extra.
- **Motion:** only on a touch (a sheet rising, a row leaving, a progress bar) or to show waiting; none of it plays under "reduce motion".
- **To test on a device (can't be shown by the prototype):** VoiceOver and TalkBack through the inbox and a form; 200% text size; the installed app's top and bottom edges on a notched phone; the date picker on iPhone and Android.

## 7. Behaviour that isn't visible

- Edits to a waiting line are kept as they are typed (R6). Closing the form never loses them.
- Waiting lines stay in the order they arrived (the bank's order); new ones are added below, never above what is being ticked.
- "Accept the N that look right" accepts exactly the lines in "Look right". Lines that need a look are never in it.
- A waiting line that is thrown away can be had again by adding that screenshot again; deleting a saved spend needs one confirmation and cannot be undone.
- The first four categories in the owner's order are the quick choices when checking a spend. A new category goes at the end. Deleting a category needs a check first; spends and waiting lines in it move to a category chosen by the owner.
- With no connection nothing is written: the app is read-only, and says so.
- A category that cannot be found shows as "No category" everywhere and blocks saving that spend until one is chosen.

## 8. Coverage

Every story and every state in `handoff/inventory.md`, and where the prototype shows it. State ids open by link (`/prototype/?state=<id>`).

### Stories

| ID | Story | Where | State ids |
|---|---|---|---|
| C1 | Bring in screenshots | Home, "Add" opens the picker (several at once); the tray follows them | `import-reading`, `import-live`, `import-done` |
| C2 | Record a spend by hand | "Type in a spend": links under the home card, menu, empty panels, a failed screenshot; the one form, today's date | `form-add`, `form-notready` |
| C3 | Know an import is still working | Tray "Reading…", Add greyed, "Keep this open until it's done." | `import-reading` |
| C4 | Told which screenshot failed | Tray: "Couldn't read this one", "Nothing found", the rest still read | `import-mixed`, `import-failed`, `import-nothing` |
| R1 | Check before it counts | Lines wait in "Look right"; the open row shows "From the screenshot" beside the fields | `review-fresh` |
| R2 | Correct a line | Open row (note, category) and "Edit details" | `form-correct` |
| R3 | Accept in one action | The tick | `review-fresh`, `review-saving` |
| R4 | Throw away | "Throw away" in the open row and in need-a-look rows | `review-problems` |
| R5 | Waiting for later, with a count | Title "N to check", "Oldest is from…" | `review-later` |
| R6 | Corrections kept if interrupted | Edits saved as typed ("Changes are kept as you go") | `form-correct` |
| R7 | Accept a whole clean batch | "Accept the N that look right" | `review-fresh`, `review-saving` |
| R8 | Suggested category | The pill, "Suggested from the store name" | `review-fresh` |
| R9 | Likely duplicate | Need a look: "You already have this one…" | `review-fresh` |
| R10 | Incoming money | Need a look: "Money coming in…", "It's a spend" | `review-fresh`, `review-later` |
| R11 | Note and category while checking | Open row: note, quick chips, "More" | `review-fresh`, `picker` |
| U1 | Total this month or week | Spending total; the home card | `spend-month`, `spend-week` |
| U2 | Compare with the period before | "Rp 475.650 lower", "1 to 25 September was Rp 7.318.000"; same number of days while running | `spend-month`, `spend-past` |
| U3 | Split by category | "Where it went": emoji, colour, amount, share, biggest first | `spend-month`, `spend-all` |
| U4 | Day by day | Chart with an exact amount for the chosen day; biggest day tagged | `spend-month`, `spend-week`, `spend-quiet` |
| U5 | Biggest spends | "Biggest spends": date, store, category | `spend-month` |
| U6 | Earlier and later, week and month | Week/Month switch, arrows, "Back to this month"; the date is kept when switching | `spend-week`, `spend-past` |
| U7 | Category to its transactions | A category row opens All transactions with that category and period on | `spend-category` |
| U8 | Biggest spend to its transaction | A biggest spend opens the Change spend form | `spend-open` |
| F1 | Search store or note | Search box, highlighted matches | `find-search` |
| F2 | Narrow by date, category, amount, source | Filters sheet | `find-sheet`, `find-filters` |
| F3 | See and clear filters | Number on Filters, one chip each, "Clear all" | `find-filters` |
| F4 | Order by date or amount | Order menu | `find-sort` |
| F5 | Recognise at a glance | Row: emoji on colour, store, category and note, amount, date, source icon | `find-all` |
| F6 | Change a saved transaction | The shared form | `find-form`, `form-saved` |
| F7 | Delete, confirming once | "Delete this spend", then one question | `find-delete`, `find-deleting` |
| O1 | Starter categories | Sixteen ready-made on first open | `org-setup`, `org-list` |
| O2 | Add a category | Name, emoji, colour; preview | `org-add`, `org-notready` |
| O3 | Change a category | Same form; shows everywhere | `org-edit` |
| O4 | Set the order | "Change order" with arrows; the first four marked as quick choices | `org-reorder` |
| O5 | How many each has | Count on each row | `org-list` |
| O6 | Delete, moving transactions first | Check, then "no spends" or "choose where they go" | `org-del-empty`, `org-del-has`, `org-del-moving` |

### States

| State (inventory wording) | Where | State ids |
|---|---|---|
| Nothing yet: first use | Home, Spending, All transactions | `app-first`, `app-first-spending`, `app-first-list` |
| Nothing yet: a period with no spending | Spending, "Nothing spent in July 2026." | `spend-none` |
| Nothing yet: nothing waiting for review | Home, "All checked" | `review-clear` |
| Starter categories being set up | Full screen "Setting up", 9 of 16 | `org-setup`, `org-setup-live` |
| Loading | Grey layout of each screen | `app-loading`, `app-loading-spending`, `app-loading-list`, `app-loading-cats` |
| Failed to load | Transactions, categories, trying again | `app-failed`, `app-failed-cats`, `app-failed-retrying`, `app-failed-live` |
| No connection | Opening the app; using it read-only; a save that can't happen | `app-offline-boot`, `app-offline-boot-live`, `app-offline`, `app-offline-save` |
| No results | "No spends match." | `find-none` |
| No earlier spending to compare with | "Nothing to compare with" | `spend-first` |
| Import in progress | Tray, several at once | `import-reading`, `import-live` |
| Import failed / found nothing | Tray rows | `import-mixed`, `import-failed`, `import-nothing` |
| Waiting for review, with a count | "7 to check", "12 to check" | `review-fresh`, `review-later` |
| Amount couldn't be read | "No amount", no tick, "Add amount" | `review-problems`, `form-amount` |
| Not ready to save | A spend missing store, amount, category or date; a line with no store or date; a category with no name | `form-notready`, `review-incomplete`, `org-notready` |
| Saving or deleting in progress | Tick, accept bar, form, delete question, category delete | `review-saving`, `form-saving`, `find-deleting`, `org-del-moving` |
| Checking a category before deleting | "Checking if it is used…", then the two answers | `org-del-checking`, `org-del-empty`, `org-del-has` |
| Missing category | "No category" in the list, form asks for a new one | `find-missing`, `find-missing-form` |
| A day with no spending | Flat mark, "Nothing spent" | `spend-quiet` |

### Hard constraints

| Constraint | Where |
|---|---|
| Phone first, desktop works | Every screen is built from 390 wide; 960 and up adds columns, a sticky accept bar and dialogs |
| Installable | `prototype/manifest.webmanifest`, `prototype/icons/`, the tags in `index.html`; standalone, safe areas, own back links |
| IDR amounts | `Rp 1.234.567` everywhere; stress data goes to `Rp 48.250.000` a spend |
| Indonesian bank screenshots | Several at a time (BCA). The crop shows the bank's own line (`87.450,00 DB`); the tray takes many; `?stress` has twelve |
| One user | No sign-in, sharing or other people anywhere |
| Calendar | Local days; weeks Monday to Sunday (`spend-week`) |
| Categories carry an emoji and a colour, both chosen by the user | Form, 13 colours, any emoji (`org-add`) |

### Gaps the table showed, and what was done
- Lines with no store name or no date had a design but no state to show it: added `review-incomplete`.
- A "Need a look" button was 40px high: now 44px.
- Page titles were 52px wide on two screens and 44px on two: all 52.
- Anything else the table asked for was already covered.
