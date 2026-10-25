# Screenshot compare: app vs prototype

Run 2026-10-25 with `npm run compare` (`scripts/compare.ts`): 25 states at 390 and 1280 wide, 50 pairs, in
`redesign/compare/side/<state>-<width>.png` (prototype left, app right; images are not committed, rerun to get them).
Rerun one state with `npm run compare -- --skip-build --only <state>`; the prototype shots are kept between runs
(`--refresh-proto` shoots them again). Two states were rerun after the first run (see "Tool notes").

States: home, home-stress, home-clear, home-import, form-add, form-notready, menu, spend, spend-stress, spend-open,
spend-none, find, find-stress, find-filters, find-sheet, find-none, find-form, find-delete, org, org-stress, org-add,
org-del-has, app-first, app-offline-boot, app-offline.

How to read it: the app's data is the test seed, not the prototype's, so stores, amounts, counts, the order of the
category chips and wording that depends on them ("Oldest is from…" against "From 2 screenshots…", the "Suggested from
the store name" line, "Accept all 3" against "Accept the 5 that look right") always differ and are **not** listed.
Only layout, sizes, colours, spacing and wording that doesn't depend on data are.

## To fix (by area; 3.6 takes home and form and whole app, 3.7 the rest)

### Home and form
- **H1. Extra space before the links on a phone, when lines are waiting.** After the last waiting line the app leaves
  about 100 to 130px (`home-390`, `home-stress-390`) before "Spending / All transactions / …". The prototype leaves
  about 30px. Nothing like it in `home-clear` (no accept bar). Probably the room kept for the accept bar is counted
  twice (page padding and the bar's own space).
- **H2. Import tray: the action buttons are a little wider than the prototype's** (`home-import-390`): "Try again" and
  "Type in a spend" don't fit on one row, so "Type in a spend" drops to a second row with "Dismiss". In the prototype
  "Try again" and "Type in a spend" share a row and "Dismiss" sits alone under them. Check the button text size and
  padding against the prototype's `.btn`; the tray width is the same.

### Spending
- None found. (The chart difference is the prototype's bug: see "Explained".)

### All transactions
- **F1. Where focus lands in the delete question.** In `find-delete` (both widths) the prototype shows the focus ring
  on Cancel; the app shows no ring. The app may have focus there already (a ring shows only for keyboard use after a
  mouse click). Check that focus lands on Cancel when the question opens, as design notes §6 asks; if it does, no change.
- **F2. The filters sheet's "Clear all" with no filter on** (`find-sheet`): the app shows a filled beige disabled
  button. The prototype's state has filters on, so it only shows the enabled look (a plain text button); the disabled
  look isn't in the prototype. Not a difference to fix unless the design says otherwise; a design question for the
  studio only if the owner thinks the beige block looks heavy.

### Categories
- **C1. "Or type or paste your own" label** (`org-add`, both widths): the prototype's is small, regular weight and
  muted (the `.hint` style); the app's is bold in the ink colour, like the "Emoji" and "Colour" labels. Make it the
  hint style.
- **C2. Spacing in the add form:** the app's "Emoji" grid and the "Or type…" row sit about 4px tighter than the
  prototype's (`org-add-390`: the field below it starts 4px higher). Follows from C1 once the label is the hint style;
  recheck after.

### Whole app
- **A1. No-connection screen at opening** (`app-offline-boot-390`): the prototype's text block is narrower (three
  lines at about 260px, the app's two lines at about 340px) and starts about 20px lower. Set the text's max width and
  the top padding from the prototype's `.boot` (`--boot-max` 460, 24px side padding, `padding-top: 12vh`, and 18vh from 960 wide).
  Same check for "Setting up" and "Couldn't load", which share the layout (not shot here).

## Explained (nothing to fix)

- **Prototype bug: the header is tinted and its tools wrap under the logo** in every prototype shot (a pale petrol
  band). The prototype's `.bar` rule (header) clashes with the day chart's `.bar` rule in `spending.css`, so the header
  gets the chart bars' colour and `display: block`. The app's cream header with logo left and tools right is the
  intended design (design notes §3). Don't copy it.
- **Prototype bug: the day chart overflows** its column (`spend-390`, `spend-1280`: bars cut at the right edge, ragged
  heights on a month). Same `.bar` clash. The app's chart fits its column with all days. Don't copy it.
- **Prototype bug: the whole page sits in a pale yellow rounded panel** in `app-offline-boot` and `app-offline`
  (`.offline` notice rule applied to the page wrapper). The app has the notice only. Don't copy it.
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
