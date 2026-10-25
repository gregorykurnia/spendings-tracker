# Changelog

One to three lines per entry; details are in the commit body.

## 2026-10-25
- Redesign 1.1: safe test setup. Vitest (`npm test`), emulator tests (`npm run test:db`), Playwright on a `.next-test` build against the Firestore emulator (`npm run test:e2e`), `npm run seed:emulator` (normal and stress sets), smoke spec. `firebase.ts` refuses the emulator unless the project is a `demo-` one.
