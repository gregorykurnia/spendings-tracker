# R3 Phase 3 review (2026-10-25)

Diff `abb8e92..08552f6` read against the plan's Architecture, "Reverse check", "Design gaps", tasks 3.1–3.8 (and their R2 lines), design notes §3, §6 and §8, and `redesign/compare/report.md`. A second, independent read covered the share route, the service worker, the share notice, the error and not-found pages and the Spending reorder.

## Live-data safety

New since R2: `scripts/test-servers.ts` (shared by e2e, `a11y` and `compare`), `src/app/api/import/route.test.db.ts` and `e2e/installable.spec.ts`. They all use the demo-project test build (checked by `checkBuild`), the emulator on 8181 and the fake `ANTHROPIC_API_KEY`. The share route's tests point the Claude client at a local fake through `ANTHROPIC_BASE_URL`. No test path can reach the live database or Claude.

## Reverse check and design gaps

Up to date. Every reverse-check row is done: the title, home-screen name and theme come from the prototype; the icons and `icon.svg` replace `favicon.ico`; the service worker keeps the new shell; the starter SVGs and `dateRanges.ts` are gone; nothing is left in the flat `src/components/` folder. G1 and G2 are built as their rows describe (3.1). G3–G6 are built as described and stay open until the studio answers N1–N6 (`redesign/handoff/needs.md`). No new gaps.

## Full suite (once, on a shared machine)

Another project's autorun session was building at the same time (two cores, load about 3), so this was not a free machine. The owner can't be waited for overnight, and the suite was run anyway.
- `npm test`: 480 passed.
- `npm run test:db`: 44 passed, 1 failed. Failure list: `src/hooks/useTransactions.test.db.ts` "accepting waiting lines > accepts none of them if one isn't ready" (saw 1 waiting line, not 2, within a second). Traced to a real fault in the test before it (below). After the fix the file passed 5 of 5 (24 tests).
- `npm run test:e2e` (after the fixes, with the edited journey spec): 64 passed, no failures.
- `npm run build` is clean.

## Fixed in this review

- **Typing on a line thrown away elsewhere (should fix):** a waiting line deleted while it still had typed edits was accepted with "not found" before its edits were cleared. The edits were then written to a missing line (after the pause, on flush or on leaving), which failed and showed a save error beside a line that no longer exists. `find` now drops a gone line's edits, and a write that finds its line gone isn't a failed save. The late failing write also held up the next emulator test's first read, which is what failed in the full run. New emulator test: "drops the typing on a line that is thrown away elsewhere, with no save error" (it fails without the fix). The earlier test now also checks that there is no save error.
- **Service worker cache trim (should fix):** the static cache trimmed the oldest files first once it held more than 200. Files that don't change between deploys (framework, font, CSS) are the oldest, so after a number of deploys a screen not opened for a while could reload offline with its scripts gone, a blank page instead of No connection. The trim now never removes a file a kept page still names.
- **Journey spec:** the two Toko Journey amounts were sorted as text (which happened to work); they now sort as numbers.
- **Test isolation:** the hook's emulator tests wait for the SDK's pending writes before clearing the emulator. A hook that unmounts writes what is left without waiting.

## Routed to later tasks

None. Every should-fix item was fixed here.

## Dropped, with reasons

- **The share route's 5.25 MB limit and Vercel's request size:** Vercel Functions take bodies up to 100 MB now, so the route's own "too big" answer is the one the Shortcut shows. An image just over Claude's 5 MB limit is answered "Couldn't read this one", the same words as the in-app import. Banking screenshots are far smaller.
- **A captive Wi-Fi portal cached as the home page:** the app is served only over HTTPS, so a portal can't answer 200 for its address. The fetch fails and the cached shell is used.
- **No `maxDuration` on `/api/import`:** the default function time limit is now 300 seconds, well over one screenshot read.
- **`/api/ocr` has no token:** this was already so before this phase, and it fits the project's no-auth rule. The import token protects only the route that a phone outside the app calls.
- **The share notice is marked as seen even when the in-app tray is showing instead:** this only happens when the owner shares from the phone and imports in the app at the same moment. The lines still wait in the inbox.
- **The share notice is gone after going to Spending and back in the same visit:** it is marked as seen the first time it shows, which is the "once per device" G3 asks for. The lines themselves stay in the inbox.
