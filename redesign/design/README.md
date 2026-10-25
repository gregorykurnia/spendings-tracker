# Design progress

Inputs: `redesign/handoff/` (priorities and brief both FILLED). Decisions: `decisions.md`.

## Stage 1: three directions (done, 2026-10-25)
- A `a-kas`, B `b-daybook`, C `c-tick`. Owner chose B with C's screenshot crop: **`directions/d-daybook-crop` approved**. P1 to P4 adopted.
- After the shot, one desktop fix (crop column widened so the store name doesn't wrap), checked by measurement only.

## Stage 2: prototype (next, new session via `./start`)
Build in `redesign/design/prototype/`, expanded only from `directions/d-daybook-crop`. One group per session, in this order:
1. Capture and review: C1 to C4, R1 to R11. States: import in progress, failed, found nothing, amount couldn't be read, not ready to save, saving.
2. Understand: U1 to U8. States: no spending, nothing to compare with, a day with no spending.
3. Find and fix: F1 to F7. States: no results, deleting, missing category.
4. Organise: O1 to O6. States: starter categories being set up, checking a category before deleting.
5. App-wide states (first use, loading, failed to load, no connection) and the `?stress` data set.
Carry over from D: no tab bar (home is the inbox, Spending, All transactions and Categories open from it); a tick per row plus one accept-all bar; the "needs a look" group in lemon; the "From the screenshot" crop in the open row; store names verbatim; sentence case; text never under 14px; touch targets 44px; light mode only. Palette and type are in `directions/d-daybook-crop/index.html` (Hanken Grotesk, lemon-white, petrol blue).
Defaults so nothing blocks: phone label "Add", desktop "Add screenshots"; the compare line says "lower than 1 to 25 September" while a period runs.
