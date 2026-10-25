# Changelog

One to three lines per entry; details are in the commit body.

## 2026-10-25
- Redesign 1.1: safe test setup. Vitest (`npm test`), emulator tests (`npm run test:db`), Playwright on a `.next-test` build against the Firestore emulator (`npm run test:e2e`), `npm run seed:emulator` (normal and stress sets), smoke spec. `firebase.ts` refuses the emulator unless the project is a `demo-` one.
- Redesign 1.2: data layer. Waiting lines gain direction, bank line, order, kept, suggestion and own-transfer fields; hooks for screenshot lines, kept-as-typed edits, accept one or many, throw away, keep; unique category names, swatch colours, chunked move-and-delete, seeding progress. `/api/ocr` reads BCA, GoPay and Krom through `src/lib/ocr.ts` (Anthropic SDK); `npm run ocr:try <folder>` for real screenshots.
- Redesign 1.3: pure logic in `src/lib` (`money`, `dates`, `periods`, `review`, `filters`, `swatches`) with unit tests: rupiah and bank forms, Monday-to-Sunday periods and like-for-like comparison, day series, category split, needs-a-look reasons (own transfer first), search, filters, four orders, `swatchFor()`. The old `dateRanges.ts` and `format.ts` stay until nothing imports them.
