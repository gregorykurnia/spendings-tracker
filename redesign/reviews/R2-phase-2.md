# R2 Phase 2 review (2026-10-25)

Diff `bb7f477..29b95b3` read against the plan's Architecture, tasks 2.1–2.7 (and their R1 lines), design notes §3–§8, `decisions.md` and the prototype, in three parts: home and the spend form; Spending and All transactions; Categories, the hooks and leftovers.

## Live-data safety

The test setup is unchanged since R1 (`scripts/test-env.ts`, the `demo-` guard in `firebase.ts`, the build check in `scripts/e2e.ts`). The new specs reach Firestore only through the emulator helpers and the test build, and every `/api/ocr` call is answered by `e2e/fixtures/ocr.ts`. No test path can reach the live database or Claude.

## Screens against the prototype (390 and 1280 wide)

Home (`review-fresh`), first use (`app-first`), Spending (`spend-week`, `spend-month`), All transactions (`find-all`), Change spend (`find-form`), Categories (`org-list`) and Change category (`org-edit`) were shot side by side from the seeded test build and the prototype. Layout, order, wording and the wide two-column arrangements match. The only differences come from the seed data, which isn't the prototype's. A pixel-level compare is task 3.5.

## Old components

None left from the old UI. Every old modal, chart, filter, period nav, `dateRanges.ts`, `format.ts` and `categoricalPalette.ts` is gone and nothing imports them. `src/components/ServiceWorkerRegister.tsx` is the one flat file left; task 3.2 replaces it (routed below).

## Full suite (once, free machine)

After the fixes:
- `npm test`: 463 passed.
- `npm run test:db`: 38 passed and 1 flaky (fixed below; that test then passed 5 of 5, and the whole file 39 of 39).
- `npm run test:e2e`: 60 passed and 2 failed, both from this review's own `aria-disabled` change (Playwright won't press an `aria-disabled` control without `force`). The 2 were fixed and rerun with `--last-failed`: 2 passed.
- Failure list: `e2e/home.spec.ts:322` "with no connection, Add does nothing and says why", `e2e/journey.spec.ts:217` "on home, offline: ticks and Accept all say why …".
- `npm run build` is clean.

## Fixed in this review

- **Writes with no connection (must fix):** the open row's "Throw away" and a category chosen in a picker that was opened before the connection dropped both wrote offline. Both now refuse and say why; the picker stays open, as in the prototype.
- **Offline controls:** the tick, "Accept all" and "Add screenshots" now carry `aria-disabled` when offline, as in the prototype, so a screen reader hears they are dimmed.
- **Accepting from the form:** the form no longer shows the old values (and "Still needed: amount") while it accepts. It reads the line as the spend it just became.
- **Done in "Edit details":** it no longer waits for the server before closing. The write goes on behind it, and a failed one is tried again.
- **A failed edit is retried** after 5 seconds, so typing whose write failed isn't left waiting for the next keystroke.
- **Accepting trims** the store and note, one line or many.
- **The unchecked `addTransaction` and `updateTransaction` are deleted** (R1 item for 2.1).
- **"From N screenshots":** it counts only the screenshots whose lines are still waiting, so adding one more after accepting two says 1, not 3.
- **The accept-all announcement** now reads "Accepted 3. 2 lines left to check.", the prototype's wording.
- **Spending keeps its period** (week or month, the date and the picked day) when you come back from a category's spends. It is kept for the visit; a reload opens on this month.
- **Old spends with a bad date:** a date with a time keeps its day, and anything else reads as no date. `formatDay` says "No date" instead of throwing, which would have taken All transactions down.
- **"Clear all" in the chip row** puts focus on Filters, as the prototype does.
- **The Categories delete question** shows the list's spend count while it checks, not "No spends", and has no close button while it moves and deletes. The same goes for deleting a spend (prototype `find-deleting`).
- **A counts failure on Categories** waits for an open form to close before showing the couldn't-load state, so typing isn't lost.
- **Flaky tests:** the emulator test "never adds starters" (a race with the Telecommunications migration), and the emulator reads in `home.spec.ts` and the reorder test in `categories.spec.ts` (now `expect.poll`). `home.spec.ts` and `journey.spec.ts` now take today from the local calendar, not UTC.
- **New tests:** offline throw and offline picker; the tick and accept bar marked as dimmed; trimming on accept; reading old dates; "No date"; the fresh-screenshot count; the accept-all announcement; Spending coming back to its period; the delete question's count, its close button and its offline refusal; the reorder arrow offline; focus after Clear all (e2e).

## Routed to later tasks

- **3.2:** `ServiceWorkerRegister.tsx` moves to `src/components/app/` with the new service worker. That task's files already name `src/components/app/service-worker*`.
- **3.4:** on a phone, Spending shows its sections in a different order (CSS `order`: total, categories, days, biggest) from the reading and tab order (total, chart, biggest, categories). This copies the prototype, but WCAG 1.3.2/2.4.3 want them to agree. Decide in the accessibility pass: change the DOM order, or record a design gap.

## Dropped, with reasons

- **Memoising the Spending view and the filter results:** the stress set (507 spends) recomputes in a few milliseconds per keystroke or pointer move.
- **All transactions showing first use when only waiting lines exist:** kept. It says "Go and check them", the wording Spending uses for the same case, and is easy to change if the studio says otherwise.
- **A `?cat=` id for a since-deleted category:** links are built from live ids on Spending in the same visit. Mapping it would need the categories before the address is read.
- **Empty period by count, not total:** they differ only for spends of Rp 0 or no amount, which can't be saved.
- **A duplicate name caught only by the database check:** this needs a second device adding the same name at the same moment. The message still says nothing was saved.
- **A sheet waiting on "Saving…" when the connection drops mid-write:** Firestore holds the write until it is back, so no data is lost. Every form shares this, the design has no state for it, and the owner's device checks will show whether it matters.
- **The delete message counting what was checked, not what was moved:** this differs only if something is added to the category between the check and the move. The rerun-on-in-use path already handles additions it sees.
- **"Couldn't read this one" when the connection drops between reading and saving:** rare, the offline notice shows at the same time, and Try again works once back online.
