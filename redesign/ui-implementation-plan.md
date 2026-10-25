# UI implementation plan: Daybook rebuild

**AI Build Log project:** Spending Tracker Redesign

Written 2026-10-25 for `autorun all` (Step 4 of `redesign/redesign-plan.md`). It maps the design to code and makes no design decisions: anything the design doesn't answer goes to "Design gaps".

- **Inputs:** design v1.0 (2026-10-25) in `redesign/design/`, imported in `cb3c4a9`. The rebuild starts from `main` at the commit that adds this plan.
- **Branch:** every task runs on `redesign`. Pushes there make Vercel preview deploys only; `main` stays the live app until Step 6.
- **Each session reads:** its own task section below, "Architecture", `redesign/design/design-notes.md`, and the prototype files the task names (`redesign/design/prototype/`; serve `redesign/design/` and open `/prototype/?state=<id>`, add `&stress` for the stress data). Never copy markup, CSS, names or wording from the old UI; the prototype is the spec. Checks, e2e rules and model picks follow `~/.claude/CLAUDE.md` ("Quality first"); they aren't repeated here.
- **Each task ends with:** light checks (`npm run typecheck`, lint on changed files, related unit tests), its named e2e spec only when the task says so, one `npm run build`, a one-to-three-line entry in `CHANGELOG.md`, the Done cell ticked (date and short commit) in the same commit, and a push to `origin redesign`.

## Before the run

- *owner*: approve this plan. Done 2026-10-25; `redesign` created from `main`.
- Nothing else blocks the run: Java 21 is installed (Firestore emulator), and no task needs a login, a secret or the live database. There is no `.env.local` on this server, so the app can only run against the emulator here, which is what every test uses.

## Architecture

- **Stack stays:** Next.js 16.2 App Router, React 19, TypeScript, Tailwind CSS 4, Firestore through the client SDK, the Claude API through `/api/ocr`. This Next.js has breaking changes: read the relevant guide in `node_modules/next/dist/docs/` before writing code (`AGENTS.md`).
- **Kept:** `src/lib/firebase.ts`, the hooks in `src/hooks/` (extended, not rewritten), the seeding sentinel and the Telecommunications migration in `useCategories.ts`, `src/types/index.ts` (extended). Period maths in `src/lib/dateRanges.ts` is replaced by the new `src/lib/periods.ts` (weeks Monday to Sunday, like-for-like comparison) and deleted once nothing imports it.
- **Rewritten:** all rendering, from `redesign/design/tokens.css` copied to `src/styles/tokens.css` (the only place colours, sizes, radii, shadows and durations are defined). Tailwind utilities point at the tokens through `@theme inline`; a component needing more than utilities gets a CSS module that uses only `var(--…)`. Font: Hanken Grotesk 400–800 through `next/font/google`.
- **Routes:** `/` home (the inbox: import tray, review, glance card, links), `/spending`, `/transactions` (All transactions; filters in the query string so Spending can open it filtered, U7), `/categories`. `/ocr` permanently redirects to `/` (`next.config.ts`). Whole-app states (setting up, loading, failed, no connection) render in place of a screen, as `state.boot` does in the prototype.
- **Data model** (in `src/types/index.ts`; old documents stay valid):
  - Waiting lines stay in `transactions` with `status: "pending_review"`. New optional fields: `direction: "out" | "in"` (a missing value means out), `bankLine: { store, date, amountText }` (what the screenshot said, for the "From the screenshot" crop; old lines without it show their current values), `seq` (order within one screenshot, so lines keep the order they arrived: `createdAt`, then `seq`), `kept: true` (after "Keep it" or "It's a spend"), `categorySuggested: true` (until the category is touched). `ownTransfer: true` (the reader saw money moving between the owner's own accounts, such as a GoPay top-up from BCA or a transfer to or from Krom). A waiting line's `amount` may be `null` (couldn't be read) and its `categoryId` may be `""`. Which bank or wallet a line came from is not stored or shown (N4).
  - Needs-a-look reasons are computed, not stored: own transfer (`ownTransfer`, not kept; G5), incoming (`direction: "in"`, not kept), repeat (a confirmed spend with the same date, amount and store, not kept), no amount, no category, no store, no date (P5).
  - Suggested category: the category of the latest confirmed spend with the same store (trimmed, capitals ignored), if that category still exists.
  - Category `color` holds a swatch name (`apricot`, `mint`, `sky`, `rose`, `lilac`, `aqua`, `coral`, `sand`, `lime`, `indigo`, `slate`, `plum`, `cyan`). Old hex values are read through `swatchFor()` (nearest swatch), so the live data needs no migration; every write stores a name. Starter categories get swatch names.
  - Category names are unique, capitals ignored. Counts per category are split into spends (confirmed) and waiting lines.
  - Deleting a category moves every transaction in it, waiting lines too, in chunked batches (at most 450 writes each), then deletes the category; running it again after a failure finishes the job.
- **OCR route:** one screenshot per request, read one at a time. Screenshots come from BCA, GoPay or Krom (N4); the prompt recognises which and returns, for every line, `direction` (`out` or `in`, from that app's own marks: BCA's DB/CR, a minus sign or the wording in GoPay and Krom), `amountText` as printed (the crop shows it as is), `amount: null` when it can't be read, and `ownTransfer` for top-ups and transfers between the owner's own BCA, GoPay and Krom (N5). The reading lives in `src/lib/ocr.ts`, shared by `/api/ocr` and `/api/import`. An empty array means "Nothing found"; a non-2xx or unparsable reply means "Couldn't read this one". The model stays `claude-sonnet-4-6`. (The prompt quoted in the project `CLAUDE.md` is updated at Step 6.)
- **Connection:** `useOnline()` (`navigator.onLine` and its events). Offline, nothing is written: every write control is dimmed and says why, forms keep what was typed (design notes §7). Opening offline before any data arrives shows the no-connection screen. The service worker keeps the app shell only, never data or `/api/`.
- **Tests:** Vitest for unit tests (`npm test`, no emulator); emulator tests for the data layer (`npm run test:db`, through `firebase emulators:exec --only firestore --project demo-spendings`); Playwright e2e (`npm run test:e2e`) against a production build in `.next-test` (`next build` then `next start -p 3100`) with the emulator on port 8181. The test build gets fake Firebase settings, `NEXT_PUBLIC_FIREBASE_PROJECT_ID=demo-spendings` and `NEXT_PUBLIC_FIRESTORE_EMULATOR=127.0.0.1:8181`; `firebase.ts` connects to the emulator when that is set and throws if the project ID doesn't start with `demo-`. E2e never calls the Claude API: specs answer `/api/ocr` with `page.route` fixtures. `scripts/seed-emulator.ts` loads a normal and a stress data set.
- **File layout at the end:** `src/app/{page,spending/page,transactions/page,categories/page,layout,not-found,error}.tsx`, `src/styles/tokens.css`, `src/components/ui/` (button, field, chip, pill, sheet and dialog, toast, back link, skeleton), `src/components/app/` (boot states, offline notice, menu), `src/components/inbox/`, `src/components/spend-form/`, `src/components/spending/`, `src/components/find/`, `src/components/organise/`, `src/hooks/`, `src/lib/` (`periods.ts`, `money.ts`, `dates.ts`, `review.ts`, `filters.ts`, `swatches.ts`), `e2e/`, `scripts/`. Nothing is left in the old flat `src/components/*.tsx`.

## Screen map

| Screen | Design (state ids) | Reads | Replaces | States |
|---|---|---|---|---|
| Home `/` | `review-*`, `import-*`, `form-*`, `picker`, `app-first`, `review-clear` | waiting lines, confirmed spends (glance total, repeats, suggestions), categories | `src/app/ocr/page.tsx`, `OcrReviewRow`, dashboard part of `src/app/page.tsx`, `Nav` | import reading, failed, nothing found; needs a look; saving; all checked; first use; loading; offline |
| Spend form (shared) | `form-correct`, `form-add`, `form-saved`, `form-amount`, `form-notready`, `form-saving`, `find-form`, `find-delete`, `find-deleting`, `find-missing-form` | categories | `TransactionFormModal`, `DeleteTransactionModal`, `Modal` | not ready, saving, deleting, missing category, offline |
| Spending `/spending` | `spend-*` | confirmed spends, categories | `src/app/page.tsx`, `CategoryDonutChart`, `TrendBarChart`, `PeriodNav`, `categoricalPalette.ts` | no spending, nothing to compare, quiet day, loading |
| All transactions `/transactions` | `find-*` | confirmed spends, categories | `src/app/transactions/page.tsx`, `TransactionFilters` | no results, missing category, first use, loading, failed |
| Categories `/categories` | `org-*` | categories, counts | `src/app/categories/page.tsx`, `CategoryFormModal`, `DeleteCategoryModal` | setting up, not ready, checking, moving, loading, failed |
| Whole app | `app-*`, `org-setup` | — | `layout.tsx`, `globals.css`, `ServiceWorkerRegister`, `public/sw.js`, `manifest.ts`, `public/icons/`, `favicon.ico` | loading, failed, no connection, setting up |

## Reverse check (code → design)

| In today's code | New design |
|---|---|
| Delete-transaction confirmation | `find-delete`, `find-deleting` |
| Delete-category confirmation and reassignment | `org-del-checking`, `org-del-empty`, `org-del-has`, `org-del-moving` |
| OCR upload error message | tray rows `import-failed`, `import-nothing` |
| "Failed to load …" messages (raw error text) | `app-failed`, `app-failed-cats` (no raw error text) |
| "Loading…" text | skeletons `app-loading*` |
| Empty period, nothing to compare, no results | `spend-none`, `spend-first`, `find-none`, `app-first*` |
| Bottom navigation bar | none: links from home, back links (design notes §3) |
| Timeframes "Last 3 months", "This year" on the dashboard | not in the design: Week/Month with earlier/later (U6); All transactions filters cover longer spans |
| Title "Spending Tracker", home-screen name, theme colour `#10b981`, `maximumScale: 1` | prototype `index.html` tags and `manifest.webmanifest` ("Daybook" is the design's proposal, see decisions) |
| `public/icons/*`, `favicon.ico` | `prototype/icons/` (svg favicon, 192, 512, maskable, apple-touch) |
| Service worker caching old routes | app shell for the new routes (task 3.2) |
| Unused starter files `public/{file,globe,next,vercel,window}.svg` | deleted |
| 404 for an unknown address (Next default, never designed) | **gap G1** |
| Unexpected error while using the app (no boundary today) | **gap G2** |

## Design gaps

Sent as needs to `redesign/handoff/needs.md`. Until the studio answers, the task builds a provisional version from the design's own pieces and keeps the gap listed here.

| Gap | Need | Provisional build (task 3.1) | Status |
|---|---|---|---|
| G1 unknown address | N1 | the full-screen state shape of `app-failed`, the mark, one line, one button to home | open |
| G2 unexpected error | N2 | the same shape, "Try again" (reset) and a link home | open |
| G3 share from iPhone | N3 | no new screen: shared screenshots arrive as waiting lines, and home's tray says "From your phone: read 2 screenshots" in the `import-done` shape (task 3.3) | open |
| G4 GoPay and Krom | N4 | nothing new to show: the crop shows each app's own printed amount (task 1.2) | open |
| G5 own-account transfer | N5 | one more needs-a-look reason in the P5/P6 shape: "Money moving between your own accounts, so it isn't counted yet.", "Throw away" first, then "It's a spend"; icon: two opposite arrows in the set's style (tasks 1.3, 2.2) | open |
| G6 more screenshots while some failed | N6 | the tray keeps rows that failed or found nothing and adds the new screenshots below them, numbered on; rows already read are dropped (task 2.3, `use-import-tray.ts`) | open |

## Phase 1: test setup, data, tokens and app shell

| Phase.task | Task | Model · effort | Why | Done |
|---|---|---|---|---|
| 1.1 | Safe test setup: emulator, Vitest, Playwright on a test build, seed script, one smoke spec | Opus 5.5 High | must provably never touch the live database | 2026-10-25, test setup |
| 1.2 | Data layer for the design: types, OCR route, waiting-line actions, categories, counts | Opus 5.5 High | data writes and a live-data compatibility rule | 2026-10-25, data layer |
| 1.3 | Pure logic: money, dates, periods, comparison, review reasons, filters, swatches | Sonnet 5.5 High | well specified, unit-tested maths |2026-10-25, pure logic |
| 1.4 | Tokens, font, layout and shared parts; whole-app states | Sonnet 5.5 xHigh | sets the look every screen builds on | 2026-10-25, tokens and shell |
| 1.5 | Phase 1 end-to-end: `e2e/app.spec.ts` for the whole-app states | Sonnet 5.5 High | flow test over finished parts | 2026-10-25, app spec |
| R1 | Phase 1 review | Opus 5.5 High | phase review rule | 2026-10-25, phase 1 review |

### 1.1 Safe test setup
Files: `package.json`, `src/lib/firebase.ts`, `firebase.json`, `vitest.config.ts`, `playwright.config.ts`, `next.config.ts` (`distDir` from `NEXT_DIST_DIR`), `.gitignore`, `scripts/seed-emulator.ts`, `e2e/smoke.spec.ts`, `src/hooks/*.test.db.ts`, `CHANGELOG.md` (create). Read: "Architecture" (Tests).
Do: dev-install `vitest`, `@testing-library/react`, `jsdom`, `firebase-tools`, `@playwright/test` (Chromium only), `tsx`. Scripts: `typecheck`, `test`, `test:db`, `test:e2e` (builds into `.next-test`, starts the emulator and `next start -p 3100`, stops both by PID), `seed:emulator`. The emulator guard in `firebase.ts`. Emulator tests for today's writes (add, change, delete a transaction; confirm a waiting line; reassign and delete a category). The smoke spec opens `/` against the seeded emulator and checks the sixteen categories exist in the emulator, not elsewhere.
Done when: all three test scripts pass; a grep of `.next-test` finds `demo-spendings` and no real project ID; nothing is left running.

### 1.2 Data layer for the design
Files: `src/types/index.ts`, `src/app/api/ocr/route.ts`, `src/hooks/useTransactions.ts`, `src/hooks/useCategories.ts`, `src/hooks/useTransactionCounts.ts`, `src/lib/seedCategories.ts`, new `src/hooks/useOnline.ts`, new `src/lib/ocr.ts`, `scripts/ocr-try.ts`, emulator tests beside each hook. Read: "Architecture" (Data model, OCR route, Connection), "Design gaps" G4 and G5; design notes §7; `decisions.md` P1–P7 and group 4.
Do: the fields and rules in "Data model". Actions: add lines from one screenshot (with `seq`, suggestion), edit a waiting line (debounced, kept as typed), accept one, accept many (one batch), throw away, keep, add a spend, change, delete; add, change (unique names), reorder, check usage (spends and waiting lines), move-and-delete in chunks; seeding reports progress (`n of 16`). The OCR route returns `{ transactions }` in the new shape and the two failure kinds; fixture replies for BCA, GoPay and Krom layouts, including a top-up and an own transfer. `npm run ocr:try <folder>` reads real screenshots through the real API and prints what it found (for the owner; needs `ANTHROPIC_API_KEY`, never run by tests).
Done when: emulator tests cover every action, including an old-shape document (hex colour, no `direction`) and a 507-spend move-and-delete; `npm test` covers the route's parsing with fixture replies.

### 1.3 Pure logic
Files: `src/lib/{money,dates,periods,review,filters,swatches}.ts` and their `.test.ts`. Read: design notes §5 (Numbers, Dates, Comparisons), §7; `decisions.md` groups 2 and 3; prototype `js/data.js`, `js/spending.js`, `js/find.js` for the rules (not the markup).
Do: `Rp 1.234.567`, the bank form `87.450,00 DB`, counts ("1 spend"); `Sun 25 Oct`, the year only when not this year, spans ("1 to 25 September", "19 to 25 Oct 2026"); week (Monday to Sunday) and month periods, earlier/later, keep the date when switching; like-for-like comparison while a period runs; day series with no-spending and still-to-come days; category split with "No category", top five and the rest; needs-a-look reasons (own transfer first, G5); search (all words, store and note, capitals ignored, match ranges for highlighting), filters and the four orders; `swatchFor()` and least-used colour.
Done when: unit tests cover each rule, including month ends, a running week, a ten-digit total and a deleted category.

### 1.4 Tokens, font, layout and shared parts
Files: `src/styles/tokens.css`, `src/app/globals.css`, `src/app/layout.tsx`, `src/components/ui/*`, `src/components/app/*`; delete `Nav.tsx`. Read: design notes §2–§4, §6; prototype `css/base.css`, `css/states.css`, `js/ui.js`, `js/states.js`; states `app-loading`, `app-failed`, `app-offline-boot`, `app-offline`, `org-setup`.
Do: tokens and `@theme inline`; Hanken Grotesk; layout with `viewport-fit=cover`, safe areas, no pull-to-refresh, skip link, polite live region; button, field (text, search, amount, date, select, error and summary), chip, pill and disc, sheet below 700 and dialog above (focus trap, Escape, return focus, can't be dismissed while busy), toast, back link, menu, offline notice, skeletons for the four screens, whole-app states (setting up with the tile count, loading, failed with retry, no connection with retry). Reduced motion stops all motion.
Done when: unit tests for the sheet's focus handling and the toast; each whole-app state renders in a quick check against the prototype at 390 and 1280 wide.

### 1.5 Phase 1 end-to-end
Files: `e2e/app.spec.ts`. Read: design notes §8 States (whole-app rows).
Do: first open seeds and shows "Setting up" then the empty home; loading; failed (emulator unreachable) and retry; offline at open (`context.setOffline`) and back online.
Done when: the spec passes against the test build.

### R1 Phase 1 review
Fresh session. Review the phase diff against the design notes and the prototype; check that no test path can reach the live database; run the full suite once on a free machine and save its failure list; fix, then route every remaining "should fix" item to a fix row in this table, a named later task, or drop it with a reason. Tick when done.

## Phase 2: the screens

| Phase.task | Task | Model · effort | Why | Done |
|---|---|---|---|---|
| 2.1 | The spend form and category picker (all three modes, delete) | Sonnet 5.5 High | interaction and saving, used everywhere | 2026-10-25, spend form |
| 2.2 | Home: the inbox, review rows, needs a look, accept bar | Sonnet 5.5 xHigh | the daily screen; densest design | 2026-10-25, inbox |
| 2.3 | Home: import tray, glance card, links, menu, first use, all checked; `e2e/home.spec.ts` | Sonnet 5.5 High | the import flow writes data | 2026-10-25, import tray |
| 2.4 | Spending; `e2e/spending.spec.ts` | Sonnet 5.5 xHigh | chart and number layout | 2026-10-25, spending |
| 2.5 | All transactions; `e2e/transactions.spec.ts` | Sonnet 5.5 High | filters, edit and delete | 2026-10-25, all transactions |
| 2.6 | Categories; `e2e/categories.spec.ts` | Sonnet 5.5 High | reorder, move-and-delete | 2026-10-25, categories |
| 2.7 | Phase 2 end-to-end: `e2e/journey.spec.ts` across screens and offline | Sonnet 5.5 High | the screens together |  |
| R2 | Phase 2 review | Opus 5.5 High | phase review rule |  |

### 2.1 The spend form and category picker
Files: `src/components/spend-form/*`; delete `TransactionFormModal.tsx`, `DeleteTransactionModal.tsx`, `Modal.tsx` once nothing imports them. Read: design notes §4 (Text field, Message, Sheet), §5, §7; `decisions.md` P4, P7, group 1 and 3 (Change, Delete); prototype `js/capture.js` (form), `js/find.js` (delete); states `form-correct`, `form-add`, `form-saved`, `form-amount`, `form-notready`, `form-saving`, `find-form`, `find-delete`, `find-deleting`, `find-missing-form`, `picker`, `app-offline-save`.
Done when: unit tests for not-ready rules, the mode buttons, kept-as-typed for a waiting line and the offline error.
Also (R1): save only through validated hook functions (`addSpend`, and an update that validates and ends `categorySuggested`); delete `addTransaction` and the unvalidated `updateTransaction` with the old screens; guard money formatting against a waiting line's `amount: null`.

### 2.2 Home: the inbox
Files: `src/app/page.tsx`, `src/components/inbox/*`. Read: design notes §4 (Tick, Review row, Need-a-look row, Group heading, Accept bar), §6, §7; `decisions.md` P1–P3, P5, P6, group 1; prototype `js/capture.js`, `css/capture.css`; states `review-fresh`, `review-problems`, `review-incomplete`, `review-later`, `review-saving`; "Design gaps" G5 (provisional own-transfer reason).
Done when: unit tests for grouping, the accept bar's wording and scope, and the tick's label; the screen matches the states at 390 and 1280 wide.
Also (R1): show `useTransactions().saveError` beside the line, never as a whole-app state; the crop shows the line's own amount when `bankLine.amountText` is empty; call `todayISO()` on the client only; render `<main id="main" tabIndex={-1}>`.

### 2.3 Home: import tray and the rest of home
Files: `src/components/inbox/*`, `src/components/app/menu*`, `e2e/home.spec.ts`, `e2e/fixtures/`; delete `src/app/ocr/`, `OcrReviewRow.tsx`, add the `/ocr` redirect. Read: design notes §4 (Add, Import row, Cards, Toast); `decisions.md` group 1 (tray), group 5 (first use); prototype `js/capture.js`, `js/spending.js` (glance card only); states `import-*`, `review-clear`, `app-first`.
Done when: `e2e/home.spec.ts` covers add screenshots (one read, one failed, one with nothing), try again, edit a line and reload (kept), tick one, accept the rest, throw away, "It's a spend".

### 2.4 Spending
Files: `src/app/spending/page.tsx`, `src/components/spending/*`, `e2e/spending.spec.ts`; delete `CategoryDonutChart`, `TrendBarChart`, `PeriodNav`, `categoricalPalette.ts`. Read: design notes §3, §4 (Day chart, Category line), §6 (the day chart); `decisions.md` group 2; prototype `js/spending.js`, `css/spending.css`; states `spend-*`.
Done when: `e2e/spending.spec.ts` covers week/month and earlier/later, stepping the day chart by keyboard, a category opening All transactions filtered, a biggest spend opening the form.
Also (R1): render `<main id="main" tabIndex={-1}>` (skip link and focus fallbacks land there).

### 2.5 All transactions
Files: `src/app/transactions/page.tsx`, `src/components/find/*`, `e2e/transactions.spec.ts`; delete `TransactionFilters.tsx` and `PeriodNav.tsx` (its last importer is the old page; 2.4 deleted the other old chart files). Spending opens this page with `?cat=<id or __none__>&from=&to=&label=&back=spending` (`categoryHref` in `src/components/spending/spending.ts`): read it into the filters (custom span with its label, category, back link); `StepButton` and `EmptyCard` in `src/components/ui/` are there for the date step and the empty states. Read: design notes §4 (Spend row, Filter chip, Chip); `decisions.md` group 3; prototype `js/find.js`, `css/find.css`; states `find-*`, `app-first-list`.
Done when: `e2e/transactions.spec.ts` covers type in a spend, search, a filter and clear all, change a spend, delete one.
Also (R1): render `<main id="main" tabIndex={-1}>` (skip link and focus fallbacks land there).

### 2.6 Categories
Files: `src/app/categories/page.tsx`, `src/components/organise/*`, `e2e/categories.spec.ts`; delete `CategoryFormModal.tsx`, `DeleteCategoryModal.tsx`. Read: design notes §4 (Category line, Swatch); `decisions.md` group 4; prototype `js/org.js`, `css/org.css`; states `org-*`.
Done when: `e2e/categories.spec.ts` covers add, a duplicate name refused, change (shows on a spend), reorder, delete unused, delete used with moving.
Also (R1): render `<main id="main" tabIndex={-1}>`; `useTransactionCounts` returns its error and a failure shows the failed state, not "no spends"; the form always sends `swatchFor(color)` (`updateCategory` refuses old hex values).

### 2.7 Phase 2 end-to-end
Files: `e2e/journey.spec.ts`. Do: import and accept, find it on Spending, open its category's spends, change it, delete it; rename a category and see it on every screen; go offline mid-use and check that writes are refused and typing is kept. Done when: the spec passes.

### R2 Phase 2 review
As R1, for the Phase 2 diff; also compare each screen against its prototype states at 390 and 1280 wide, and check that no old component is left.

## Phase 3: polish

| Phase.task | Task | Model · effort | Why | Done |
|---|---|---|---|---|
| 3.1 | Reverse-check leftovers: provisional G1/G2, metadata, unused files | Haiku 5.5 Max | mechanical, from design pieces |  |
| 3.2 | Installable: manifest, icons, favicon, service worker for the new shell | Sonnet 5.5 High | offline opening must work |  |
| 3.3 | Share from iPhone: `/api/import` with a token, Shortcut guide (G3) | Opus 5.5 High | a public endpoint that writes data |  |
| 3.4 | Accessibility pass: axe scan script over every screen, fixes | Sonnet 5.5 High | design notes §6 |  |
| 3.5 | Screenshot compare tool: app vs prototype, run once, list differences | Sonnet 5.5 High | builds the slow tool once |  |
| 3.6 | Fix compare differences: home, form, whole-app states | Sonnet 5.5 xHigh | visual fixes |  |
| 3.7 | Fix compare differences: Spending, All transactions, Categories | Sonnet 5.5 xHigh | visual fixes |  |
| 3.8 | Phase 3 end-to-end: full e2e suite once, build | Sonnet 5.5 High | final flow check |  |
| R3 | Phase 3 review | Opus 5.5 High | phase review rule |  |

### 3.1 Reverse-check leftovers
Files: `src/app/not-found.tsx`, `src/app/error.tsx`, `src/app/layout.tsx` (metadata), `public/`. Read: "Reverse check", "Design gaps". Do: the provisional G1 and G2 screens; title, description and home-screen name from the prototype's `index.html`; delete the unused starter SVGs and `src/lib/dateRanges.ts` if unused. Done when: every reverse-check row is done or still listed as a gap.

### 3.2 Installable
Files: `src/app/manifest.ts`, `public/icons/`, `src/app/icon.svg` (replaces `favicon.ico`), `public/sw.js`, `src/components/app/service-worker*`. Read: design notes §3 (Installed), §8 Hard constraints; prototype `manifest.webmanifest`, `icons/`. Do: copy the icons; the manifest values; a service worker that caches the app shell for the four routes, never data or `/api/`, and replaces the old cache. Done when: in the test build, going offline after one visit and reloading shows the no-connection screen, not the browser's.

### 3.3 Share from iPhone
Files: `src/app/api/import/route.ts`, `src/lib/ocr.ts`, `src/components/inbox/*` (tray message), `docs/iphone-shortcut.md`, tests. Read: "Design gaps" G3; "Architecture" (OCR route, Data model). iPhone web apps can't receive shares, so an iOS Shortcut in the share sheet posts the screenshot to `/api/import`.
Do: `POST /api/import` takes one image (the body as sent by Shortcuts' "Get Contents of URL"), refuses anything without `Authorization: Bearer $IMPORT_TOKEN` (constant-time compare; no token set means the route is off), reads it with `src/lib/ocr.ts` and writes the lines as waiting lines with the same fields as an import in the app (including `seq` and the suggestion), tagged `importedVia: "share"` with a batch time. Answers in plain words the Shortcut can show ("Read 4 transactions. They're waiting in Daybook.", "Couldn't read this one.", "Nothing found."). Home's tray shows the provisional G3 message for share batches not yet seen. `docs/iphone-shortcut.md`: step-by-step for building the Shortcut (Receive images from the share sheet, Get Contents of URL with the header, Show Result).
Done when: tests (emulator, with the Claude call pointed at a local fake through an env setting) cover a good token, a wrong or missing token, a failed read and nothing found; no test calls the Claude API.

### 3.4 Accessibility pass
Files: `scripts/a11y.ts` (axe through Playwright over every screen and the main overlays, normal and stress data; `--only <route>`), fixes. Read: design notes §6. Done when: the scan reports nothing serious or critical; keyboard checks of the inbox, the form and the day chart pass. Device checks go to the owner line below.

### 3.5 Screenshot compare tool
Files: `scripts/compare.ts`, `redesign/compare/` (gitignored images, committed `report.md`). Do: shoot about 20 key prototype states (served from `redesign/design/`) and the same states in the app (seeded emulator, stress set where the state uses it) at 390 and 1280 wide; side-by-side images; `--only <state>`; keep prototype shots between runs. Run it once and list each difference in `report.md` by area (home and form; Spending; All transactions; Categories; whole app). Fix nothing here.

### 3.6 and 3.7 Fix compare differences
Read: `redesign/compare/report.md` (your area only), the matching prototype files. Fix each difference in the area, rerunning only its states with `--only`. Done when: the area's report items are fixed or explained.

### 3.8 Phase 3 end-to-end
Run the full e2e suite once and `npm run build`; fix failures, rerunning only failed tests. Done when: one clean run.

### R3 Phase 3 review
As R1, for Phase 3; also the reverse check and design gaps are up to date, `npm run build` is clean, and `redesign/redesign-plan.md` Step 5 is ticked.

## Owner lines

- *owner*: on your phone, open the `redesign` preview deploy (needs the Firebase and `ANTHROPIC_API_KEY` variables set for Preview in Vercel) and run the device checks in design notes §6: VoiceOver or TalkBack through the inbox and a form, 200% text size, the installed app on a notched phone, the date picker. Report anything off as a fix.
- *owner*: send N1 to N5 to the studio (design-gap loop) whenever convenient; nothing waits on them, the provisional builds in "Design gaps" stand until then.
- *owner* (after 1.2): put two or three real screenshots each from BCA, GoPay and Krom (including a GoPay top-up and a transfer to Krom) in a folder that isn't committed, and run `npm run ocr:try <folder>` with `ANTHROPIC_API_KEY` set; report any line read wrong as a fix.
- *owner* (after 3.3): set `IMPORT_TOKEN` (a long random string) in Vercel for Preview and Production, then build the Shortcut on your iPhone from `docs/iphone-shortcut.md`.
- *owner*: the merge to `main` (Step 6), when you say so.

## Rollback

The Step 6 merge is one merge commit: `git revert -m 1 <merge>` on `main` brings the old UI back. No data migration is involved; after a rollback, categories changed in the new UI hold swatch names the old UI doesn't know (they show without colour until edited) and waiting lines may have no amount.
