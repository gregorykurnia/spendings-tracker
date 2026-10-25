# R1 Phase 1 review (2026-10-25)

Diff `104ff2e..b5a2b2a` read against the plan's Architecture, tasks 1.1–1.5, design notes §2–§8, `decisions.md` and the prototype, in three parts: data layer, pure logic, UI shell.

## Live-data safety

No test path can reach the live database. `firebase.ts` refuses the emulator unless the project ID starts with `demo-`, and refuses a `demo-` project without the emulator. All test settings come from `scripts/test-env.ts`: `test:db` gets them through `vitest.config.ts`, and e2e and the seed script pass them as process env, which beats `.env*` files. `scripts/e2e.ts` refuses a build whose bundles carry any other `projectId`. The seed script only calls the emulator's REST address. Unit tests mock every hook that would touch Firestore. The fake `ANTHROPIC_API_KEY` stops a missed `/api/ocr` call from reaching Claude. The live database already has a `categoriesSeeded` sentinel with `seededAt`, so seeding skips it (now tested for a database with no sentinel too).

## Full suite (once, free machine)

`npm test` 198 passed, `npm run test:db` 36 passed, `npm run test:e2e` 8 passed (app and smoke specs, test build), after the fixes above, with no other build or test running. Failure list: none. (Unit tests rerun after the nested-sheet fix: 199 passed.)

## Fixed in this review

- Typed edits to a waiting line were lost when their write failed. They are now put back under newer typing, unless the line is gone. A failed save no longer sets the load `error`, which would have replaced the screen with "Couldn't load"; it sets a new `saveError` instead.
- `cannotSave` now checks in the same order as the needs-a-look reasons: own transfer, incoming, then amount, store, date, category.
- `reviewReasons` and `groupWaiting` now require `categoryIds`, so a line whose category was deleted can't be counted as "looks right".
- `matchRanges` lowers the search words itself.
- `/api/ocr` refuses images over 7 MB of base64 (413) before calling the API.
- `parseAmount` reads `"45000.50"` as 45,001 instead of 4,500,050.
- "Try again" keeps keyboard focus through the retry's remount. Focus goes to `#main` once the screen loads.
- Closing a sheet that sits over another (the picker over the form) puts focus back on its opener.
- `#fff` and the `2s` spinner now use tokens.
- The read-only date field looks read-only.
- The body pads for the left and right safe areas.
- The counts listener logs its failures.
- New tests: a failed write keeps typing; a failed accept keeps edits unless the line is gone; accepting 451 lines; seeding a database that has no sentinel; a focus test for retry and for nested sheets; a size limit test; dotted decimals.

## Routed to later tasks

- **2.1:** save through validated functions only (`addSpend` and a validating update that also ends `categorySuggested`). Delete `addTransaction` and the unvalidated `updateTransaction` once the old screens are gone. Guard `formatRupiah` against a waiting line's `amount: null`.
- **2.2:** show `saveError` as a message beside the line, never as a whole-app state. When `bankLine.amountText` is empty, the crop shows the line's own amount, as for old lines. Call `todayISO()` on the client only (no server render of "today").
- **2.2–2.6:** each rebuilt screen renders `<main id="main" tabIndex={-1}>`. The skip link, the sheet fallback and the retry focus all land there.
- **2.6:** a counts failure shows the design's failed state, not "no spends". `useTransactionCounts` needs to return its error. The category form always sends `swatchFor(color)`, because `updateCategory` refuses an old hex value.

## Dropped, with reasons

- **Lint errors in `CategoryFormModal`, `DeleteCategoryModal` and `TransactionFormModal`:** they come from before the redesign, and tasks 2.1 and 2.6 delete those files.
- **Toast plus live-region announcement of the same offline words:** the prototype does the same (`app.js`) so that a second press is read again. The owner's VoiceOver check covers it.
- **Spinner still turning under reduced motion:** `decisions.md` and the prototype keep a slow turn as the one exception. The plan's "stops all motion" is shorthand, and the design wins.
- **Re-checking that a category exists when accepting:** the inbox only offers accept for lines grouped with the current category ids. A spend whose category was later deleted has its own designed state (`find-missing-form`).
- **Auth on `/api/ocr`:** the app is single-user with no auth (project rule). Task 3.3 adds `IMPORT_TOKEN` for the import route.
- **`İ` highlighting, and tests for `summarise` over a running week and for Feb 29 in `formatDay`:** the highlighting is cosmetic and very rare. The tests are covered by the `previousPeriod`, `daySeries` and date tests underneath them.
