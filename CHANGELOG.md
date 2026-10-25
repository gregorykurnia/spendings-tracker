# Changelog

One to three lines per entry; details are in the commit body.

## 2026-10-25
- Redesign 1.1: safe test setup. Vitest (`npm test`), emulator tests (`npm run test:db`), Playwright on a `.next-test` build against the Firestore emulator (`npm run test:e2e`), `npm run seed:emulator` (normal and stress sets), smoke spec. `firebase.ts` refuses the emulator unless the project is a `demo-` one.
- Redesign 1.2: data layer. Waiting lines gain direction, bank line, order, kept, suggestion and own-transfer fields; hooks for screenshot lines, kept-as-typed edits, accept one or many, throw away, keep; unique category names, swatch colours, chunked move-and-delete, seeding progress. `/api/ocr` reads BCA, GoPay and Krom through `src/lib/ocr.ts` (Anthropic SDK); `npm run ocr:try <folder>` for real screenshots.
- Redesign 1.3: pure logic in `src/lib` (`money`, `dates`, `periods`, `review`, `filters`, `swatches`) with unit tests: rupiah and bank forms, Monday-to-Sunday periods and like-for-like comparison, day series, category split, needs-a-look reasons (own transfer first), search, filters, four orders, `swatchFor()`. The old `dateRanges.ts` and `format.ts` stay until nothing imports them.
- Redesign 1.4: design tokens (`src/styles/tokens.css`) and Hanken Grotesk, new layout (safe areas, skip link, live region, toast), shared parts in `components/ui` (button, fields, chip, pill, sheet and dialog, back link, skeletons), bars, menu and offline notice in `components/app`, and `AppGate`, which puts setting up, loading, couldn't load or no connection in place of a screen. The old `Nav` is gone; old screens keep their old look until phase 2.
- Redesign 1.5: `e2e/app.spec.ts` covers the whole-app states against the test build: first open (Setting up, progress), loading, couldn't load and Try again, no connection at open and back online, losing the connection after load.
- Redesign R1: Phase 1 review (`redesign/reviews/R1-phase-1.md`). Fixed lost typing on a failed save (now `saveError`, not a load failure), review-reason order and required category ids, retry and nested-sheet focus, OCR size limit and dotted decimals, token-only colours; routed the rest to tasks 2.1–2.6.
