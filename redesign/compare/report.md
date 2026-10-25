# Screenshot compare: app vs prototype

Run 2026-10-25 with `npm run compare` (`scripts/compare.ts`): 25 states at 390 and 1280 wide, 50 pairs, in
`redesign/compare/side/<state>-<width>.png` (prototype left, app right; images are not committed, rerun to get them).
Rerun one state with `npm run compare -- --skip-build --only <state>`; the prototype shots are kept between runs
(`--refresh-proto` shoots them again). Two states were rerun after the first run (see "Tool notes").
Task 3.6 reran everything once with unhinted text and fresh prototype shots (see "Tool notes"): the items for
Spending, All transactions and Categories below were written from the first run's shots, so look at the new
`side/` images when fixing each one in 3.7; a width-only difference there is probably the same text-rounding artefact.

States: home, home-stress, home-clear, home-import, form-add, form-notready, menu, spend, spend-stress, spend-open,
spend-none, find, find-stress, find-filters, find-sheet, find-none, find-form, find-delete, org, org-stress, org-add,
org-del-has, app-first, app-offline-boot, app-offline.

How to read it: the app's data is the test seed, not the prototype's, so stores, amounts, counts, the order of the
category chips and wording that depends on them ("Oldest is from…" against "From 2 screenshots…", the "Suggested from
the store name" line, "Accept all 3" against "Accept the 5 that look right") always differ and are **not** listed.
Only layout, sizes, colours, spacing and wording that doesn't depend on data are.

## To fix (by area; 3.6 took home and form and whole app, 3.7 the rest: all done or explained)

### Home and form
- **H1. Extra space before the links on a phone, when lines are waiting.** *Fixed in 3.6.* The room for the accept
  bar (`96px` plus the safe area) was padding on the inbox section, so it sat between the last line and the links.
  It is now padding at the end of the page (`.home:has(.withBar)` in `inbox.module.css`, as the prototype's
  `body.has-bar`): about 30px before the links, and the bar still clears the last link.
- **H2. Import tray buttons a little wider than the prototype's.** *Explained, not an app difference.* Both sides use
  the same button rules (44 high, 18 side padding, 15px, 700), and the prototype loads the same Hanken Grotesk. The
  widths differed only because headless Chrome on Linux rounds each letter's width to whole pixels, and it rounds the
  app's variable font and the prototype's static files differently ("Type in a spend": 150 against 144). With text
  unhinted, as on a phone, every string measures the same on both sides to 1/64 px and "Try again" and "Type in a
  spend" share a row with "Dismiss" under them, as in the prototype. The tool now shoots unhinted.

### Spending
- None found. (The chart difference is the prototype's bug: see "Explained".) Task 3.7 looked again at every Spending
  pair from the unhinted run (`spend`, `spend-stress`, `spend-open`, `spend-none`, both widths): still none. The
  smaller total in `spend-stress` is the design's own rule (10 digits or more get the `long` size, as in the
  prototype's `spending.js`; the prototype's stress total has 9).

### All transactions
- **F1. Where focus lands in the delete question.** *Explained, not an app difference.* Focus does land on Cancel
  when the question opens (`data-autofocus` on it; `e2e/transactions.spec.ts` and `e2e/categories.spec.ts` assert
  `toBeFocused`). The ring is missing only in the shot: the prototype's state loads with no click, so the browser
  counts it as keyboard use, while the app's shot comes after a mouse click on "Delete this spend", and a ring
  shows only for keyboard use. The app has the same `:focus-visible` rule as the prototype.
- **F2. The filters sheet's "Clear all" with no filter on** (`find-sheet`). *Explained, not an app difference.* The
  prototype's own rule `.btn[aria-disabled="true"]` (beige fill) applies to its quiet "Clear all" when no filter is
  on (`find.js` sets `aria-disabled`); its shot just has filters on. The app's beige look is that rule. A design
  question for the studio only if the owner thinks the beige block looks heavy.

### Categories
- **C1. "Or type or paste your own" label** (`org-add`, both widths). *Fixed in 3.7.* It is now the hint style
  (small, regular weight, muted: `.ownLabel` in `organise.module.css`), as the prototype's `.hint` span in the label.
- **C2. Spacing in the add form.** *Fixed in 3.7.* Not a follow-on of C1: measured on the shots, the app's emoji tiles
  sat 2px lower (group gap 8px against the prototype's `.field` gap of 6px) and its "Or type…" label 6px higher (the
  prototype's `.own` adds 8px above it). `.group` is now 6px (also the "Move to" and "Colour" groups) and `.own` has
  `margin-top: 8px`. Every text row of `org-add-390` now sits on the same pixel row as the prototype's.

### Whole app
- **A1. No-connection screen at opening** (`app-offline-boot-390`). *Explained, not an app difference.* The app's
  `.boot` rules are the prototype's own, rule for rule (`--boot-max` 460, `padding: 12vh 24px 48px`, 18vh from 960
  wide), and so are `.failed` and the setting-up tiles. The prototype's narrower block starting 20px lower is its
  `.offline` notice rule boxing the page through `<body class="offline">` (72px less width, 8px margin and 12px
  padding above): see "Explained". With that class removed on the prototype side (`protoSetup`), both sides are
  identical at 390 and 1280, including "again." on its own line, which is the design's own wrapping.

## Explained (nothing to fix)

- **Prototype bug: the header is tinted and its tools wrap under the logo** in every prototype shot (a pale petrol
  band). The prototype's `.bar` rule (header) clashes with the day chart's `.bar` rule in `spending.css`, so the header
  gets the chart bars' colour and `display: block`. The app's cream header with logo left and tools right is the
  intended design (design notes §3). Don't copy it.
- **Prototype bug: the day chart overflows** its column (`spend-390`, `spend-1280`: bars cut at the right edge, ragged
  heights on a month). Same `.bar` clash. The app's chart fits its column with all days. Don't copy it.
- **Prototype bug: the whole page sits in a pale yellow rounded panel** in `app-offline-boot` and `app-offline`
  (`.offline` notice rule applied to the page wrapper through `body.offline`). The app has the notice only. Don't copy
  it. `app-offline-boot` now removes the class on the prototype side; `app-offline` keeps it, since that state needs
  the read-only look.
- **The accept bar sits mid-page in tall shots** of both sides: it is fixed to the bottom of the first screen and
  shows over the lines under it. Same on both.
- **The import tray's screenshot thumbnails are solid coral squares in the app:** the test fixture is a one-pixel PNG
  stretched to the thumbnail. Not an app difference.
- **Prototype shortcuts:** the prototype opens "Delete a category" without the "Change category" sheet behind it
  (`org-del-has`); the app stacks the question over the sheet, as the Spend's delete does in both. The prototype's menu
  lists review-only states.
- **Spend form `form-add`, `form-notready`, `spend-open`, `find-form`, `menu`, `find-none`, `org`, `org-stress`,
  `spend`, `spend-none`, `app-first`, `find`, `find-stress`, `home-clear`:** match apart from data and the prototype
  bugs above (sheet title, fields, error text, buttons, scrim, row layout, emoji tiles, empty-state cards).

## Not covered by this run
Week mode on Spending, the form's category picker, import in progress/finished, saving and deleting in progress, the
setup and loading states, and the failed state (they need timing or a held reply; the e2e specs cover their behaviour).
Add them to `STATES` in `scripts/compare.ts` if 3.6 or 3.7 wants a picture.

## Tool notes
- The offline states need `page.addInitScript` given as a string: `tsx` adds a helper to functions that the page
  doesn't have, which silently broke the script and left the app online. Fixed in `scripts/compare.ts` and
  `scripts/a11y.ts` (its "no connection" scan had been scanning the failed-to-load screen; rerun, still clean).
- `menu` needed a click on the prototype side (`protoSetup`); reshot with `--refresh-proto`.
- The browser clock is fixed to 2026-10-25 so both sides show the same weeks.
- Chromium is launched with `--font-render-hinting=none` (task 3.6), so text widths are as on a phone. Without it a
  headless Linux browser rounds every letter's width to whole pixels and the two sides' fonts disagree by a few
  pixels per line, which showed up as differences that aren't there. All prototype shots were reshot with it.
