# Inventory notes (owner only, never handed off)

Written at Step 1 (2026-10-25) from the code on `main` at `f338d7b`. The job stories in `handoff/inventory.md` refer to the IDs used here.

## §1 Code map

| Area | Files | Stories |
|---|---|---|
| Shell, install, offline | `src/app/layout.tsx`, `src/components/Nav.tsx`, `src/app/manifest.ts`, `public/sw.js`, `src/components/ServiceWorkerRegister.tsx`, `public/icons/` | constraints |
| Spending summary (`/`) | `src/app/page.tsx`, `src/components/PeriodNav.tsx`, `CategoryDonutChart.tsx`, `TrendBarChart.tsx` | U1–U6 |
| Transactions (`/transactions`) | `src/app/transactions/page.tsx`, `TransactionFilters.tsx`, `TransactionFormModal.tsx`, `DeleteTransactionModal.tsx`, `PeriodNav.tsx`, `Modal.tsx` | C2, F1–F7 |
| Screenshot import (`/ocr`) | `src/app/ocr/page.tsx`, `OcrReviewRow.tsx`, `src/app/api/ocr/route.ts` | C1, C3, C4, R1–R6 |
| Categories (`/categories`) | `src/app/categories/page.tsx`, `CategoryFormModal.tsx`, `DeleteCategoryModal.tsx` | O1–O6 |
| Data hooks | `src/hooks/useTransactions.ts`, `useCategories.ts` (also seeding and migration), `useTransactionCounts.ts` | all |
| Logic | `src/lib/dateRanges.ts`, `format.ts`, `seedCategories.ts`, `categoricalPalette.ts`, `firebase.ts` | U1–U6, F2, O1 |

All pages are client components reading Firestore live (`onSnapshot`). The only server code is `/api/ocr`.

## §2 Behaviour rules the rebuild must keep

**Money and dates**
- Amounts are stored as plain numbers (rupiah) and shown as `Rp ` + `id-ID` grouping of the rounded value (`formatIDR`).
- Dates are `YYYY-MM-DD` strings compared as strings; all period math is in local time (`dateRanges.ts`, after two timezone fixes: `f283f83`, `c6438d4`).
- Weeks run Monday–Sunday. Periods are inclusive of both ends.
- Period labels: day = Today / Yesterday / Tomorrow / "Sun, Jul 21, 2026"; week = This Week / Last Week / "Jul 21 – 27" (or across months); month = This Month / Last Month / "July 2026". Moving into future periods is allowed.

**Status and totals**
- Only `status: "confirmed"` transactions count anywhere (summary, transactions, totals). `pending_review` ones exist only in the import review (fix `98b4af1`).
- Transaction counts per category (categories screen and delete check) include pending ones.

**Summary**
- Granularity is week or month (default month, anchored on today). Switching granularity keeps the anchor date.
- Total = sum of confirmed amounts in the period.
- Comparison = the whole previous period of the same granularity (see §4 Q4). Change % = (total − previous) / previous; shown with ▲/▼ and the previous total; up is "bad", down is "good". When the previous period is 0, it says there's nothing to compare.
- Category split: summed by category, sorted by amount descending, amount only (percentages were removed on purpose in `fb1a3a7`, see §4 Q2).
- Trend: always one bucket per day for the whole period, including days with 0; tap or hover a day for its amount and full date.
- Biggest spends: top 5 by amount in the period.

**Transactions**
- Default filters: period mode, month, today; everything else empty; sort date newest first.
- Date modes: period (day / week / month, moved through, switching granularity resets to today), custom (needs both dates, otherwise no date filter), all time.
- Category filter is multi-select (any of). Source: all / manual / ocr. Min and max are inclusive. Keyword: case-insensitive substring of store or description.
- Active filter count = categories selected + source + min + max + keyword (the date mode isn't counted). Reset restores the defaults.
- Sorts: date desc (default), date asc, amount desc, amount asc.
- Add: always `source: "manual"`, `status: "confirmed"`, `createdAt` = now. Edit changes amount, store, description, category, date (not source).
- Validation for add, edit and review accept: amount > 0, store not blank, category set, date set. Description optional. Store and description are trimmed.
- Delete: hard delete after one confirmation.

**Import**
- Files: `image/*`, several at once. Each is sent one at a time as base64 to `/api/ocr`, which calls Claude (`claude-sonnet-4-6`, max 4096 tokens) with the exact prompt in `route.ts` and parses the first JSON array in the reply.
- Each extracted item is saved straight away as `source: "ocr"`, `status: "pending_review"`, category = the first category by order, date = extracted or today, amount = `Number(...) || 0`.
- Review shows pending items newest import first, with their count. Field edits are saved on blur (amount and store only if valid). Accept = save all fields, then set `status: "confirmed"`. Discard = hard delete, no confirmation.
- Pending items live in Firestore, so they survive closing the app and show on any device.

**Categories**
- Seeding: on first load, a transaction-guarded sentinel (`meta/categoriesSeeded`) seeds the 16 starter categories once, only if the collection is empty (fixes `f39b5b0`, `bab1cbe`, `29b9840`). A second one-off migration adds Telecommunications (`meta/telecommunicationsCategorySeeded`, fixed doc id `telecommunications`). Keep both guards or replace them with something equally race-safe.
- Order: integer `order`; new categories go last; moving swaps `order` with the neighbour. Order decides the order everywhere a category is picked, and (today) the colours in the summary.
- Form: name required (trimmed), emoji free text capped at 4 characters (graphemes), colour from 16 presets. Duplicate names are allowed.
- Delete: count the category's transactions first. 0 → confirm and delete. More → choose another category; one batch moves every transaction (pending included) and deletes the category.
- Never hardcode category ids (except the migration's fixed id).

**Install and offline**
- Manifest: standalone, start `/`. Service worker caches the four routes, manifest and icons; navigations are network-first with cache fallback; other same-origin GETs cache-first; `/api/*` and Firestore are never cached.

## §3 Data model

Firestore, read and written straight from the browser (client SDK, no auth).

- `categories/{id}`: `name`, `emoji`, `color` (hex), `order` (number).
- `transactions/{id}`: `amount` (number), `store`, `description`, `categoryId`, `date` (`YYYY-MM-DD`), `source` (`manual` | `ocr`), `status` (`confirmed` | `pending_review`), `createdAt` (ISO timestamp).
- `meta/categoriesSeeded`, `meta/telecommunicationsCategorySeeded`: `seededAt`. Seeding sentinels only.
- Types in `src/types/index.ts`. Transactions are read whole and ordered by `date desc`; all filtering and totals happen in the browser.

## §4 Half-built features and bugs to decide on

Each has a suggested default; Step 2 decides.

1. **Category colours ignored in the summary.** The category split uses a fixed 8-colour palette by position, not the colour the user picked (transactions and categories do use it). With 16 categories, colours repeat. *Suggest: use the category's own colour everywhere (U3 is written that way).*
2. **Share of total.** `CLAUDE.md` asks for amount and % in the category split; `fb1a3a7` removed the %. *Suggest: amount first, share as secondary. Add to U3 if yes.*
3. **Summary totals hide the amount in the middle.** The split's centre says "Total / N categories" rather than an amount. Design question only, no story change.
4. **Unfair comparison mid-period.** This month (so far) is compared with all of last month, so early in a month it always looks like a big drop. Dead code `resolveComparisonRange` did like-for-like (same day-of-month cutoff). *Suggest: like-for-like for the current period, full period for past ones.*
5. **Wrong default category on import.** Every extracted item starts as the first category (Food & Drink), so an unnoticed item gets confirmed as food. *Suggest: no category until chosen (accept blocked until set), or let the extraction suggest one.*
6. **Incoming money counted as spending.** The extraction prompt doesn't separate debits from credits; incoming transfers become "spends" unless discarded (R4). Income was removed on purpose (`70e73e7`). *Suggest: ask the extraction to skip or flag credits.*
7. **No duplicate check.** Importing an overlapping screenshot creates duplicates. *Suggest: flag likely duplicates (same date, amount, store) in review.*
8. **One bad screenshot stops the batch.** An error stops the rest; items from earlier screenshots stay. A screenshot with nothing found shows no message at all. Errors are generic. *Suggest: carry on with the rest and report per screenshot (C4).*
9. **No "accept all".** Each item is accepted one by one. *Suggest: add only if R3 is tagged daily.*
10. **"Today" uses UTC in two places.** The add form's default date and the import's fallback date use `toISOString()`, so between 00:00 and 07:00 in Jakarta they give yesterday. Bug: fix in the rebuild.
11. **Zero amounts on import.** An unreadable amount becomes 0 and can't be accepted until fixed. Fine as is; the rebuild should make it obvious.
12. **No "no connection" state.** Firestore's offline cache isn't turned on, so offline the app most likely shows empty data or zero totals instead of saying it's offline (not tested). The summary also has no failed-to-load state. *Suggest: a real offline message; offline cache optional.*
13. **Large screenshots.** Images go to Claude unresized; the API refuses images over about 5 MB. *Suggest: shrink images in the browser before sending.*
14. **Source isn't editable.** `CLAUDE.md` says source can be edited; the edit form doesn't offer it. *Suggest: drop that rule (F6 leaves it out).*
15. **Biggest spends and category split don't lead anywhere.** You can't open a spend or jump to a category's transactions from the summary. *Suggest: owner decides; would be new stories in U3/U5.*
16. **No total for filtered transactions.** Finding all "Transport in March" doesn't show their sum. *Suggest: owner decides; new story in F2 if yes.*
17. **Filters aren't remembered** after leaving or reloading. *Suggest: owner decides.*
18. **Delete only from the transactions screen,** not while editing. Design question only.
19. **Pinch zoom disabled** (`maximumScale: 1`). Accessibility issue; drop it in the rebuild unless the owner objects.
20. **Missing category label differs:** "Unknown" in the summary, "Uncategorized" elsewhere. Pick one.
21. **Out of scope for the redesign:** Firestore security rules (no auth, open browser access), the stale `CLAUDE.md` (Next.js 14, colour picker, "% of total").

## §5 Decisions (filled in at Step 2)

| # | Decision | Story change |
|---|---|---|
| 1 | Use each category's own colour everywhere | none (U3 already says so) |
| 2 | No share % in the category split | none |
| 3 | Design question only | none |
| 4 | Like-for-like comparison while a period is running; full period for past ones | U2 reworded |
| 5 | Extraction suggests a category from the store; you confirm or change it | R8 added |
| 6 | Extraction skips or flags incoming money | R10 added |
| 7 | Flag likely duplicates (same date, amount, store) in review | R9 added |
| 8 | A bad or empty screenshot doesn't stop the batch; report per screenshot | C4 reworded |
| 9 | Add "accept all" | R7 added |
| 10 | Bug: "today" uses Jakarta time, not UTC (fix in rebuild) | none |
| 11 | Unreadable (zero) amount made obvious; still blocks accepting | state added |
| 12 | A real "no connection" message and a failed-to-load state; offline cache optional | none (states already listed) |
| 13 | Shrink images in the browser before sending | none |
| 14 | Source isn't editable; drop that rule from `CLAUDE.md` at Step 6 | none |
| 15 | Summary leads on: a category opens its transactions, a big spend opens that transaction | U7, U8 added |
| 16 | No total for filtered results | none |
| 17 | Filters not remembered | none |
| 18 | Design question only | none |
| 19 | Allow pinch zoom | none |
| 20 | One consistent label for a missing category (designer picks it) | none |
| 21 | Out of scope | none |
| — | Manual entry kept but rare (C2); while reviewing an import, add what was bought as a note and set the category on the spot | R11 added |
