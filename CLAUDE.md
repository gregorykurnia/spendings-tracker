# Spending Tracker ("Daybook")

Personal spending tracker. Single user, no auth. Primary input: screenshots from BCA, GoPay and Krom, read by the Claude API; secondary: typed in by hand. All amounts in IDR, shown as `Rp 1.234.567`. Used mostly on an iPhone, installed as a web app.

## Stack
- Next.js 16.2 App Router, React 19, TypeScript, Tailwind CSS 4. This Next.js has breaking changes: read `node_modules/next/dist/docs/` before writing code (`AGENTS.md`).
- Firebase Firestore through the client SDK (collections `categories`, `transactions`, `meta`).
- Claude API (`claude-sonnet-4-6`, vision) for reading screenshots: `src/lib/ocr.ts`, used by `/api/ocr` (the app) and `/api/import` (the iPhone share Shortcut, needs `IMPORT_TOKEN`; guide in `docs/iphone-shortcut.md`).
- Vercel: every push to `main` deploys to production.

## Deploy workflow
Commit and push to `main` with `./push.sh "message"` after each validated change; Vercel deploys it.

## Checks
- Light, per change: `npm run typecheck`, `npx eslint <changed files>`, `npm test` (unit, no database).
- Data layer: `npm run test:db` (Firestore emulator, project `demo-spendings`).
- E2e: `npm run test:e2e` (production build in `.next-test` against the emulator; one spec: `npm run test:e2e -- e2e/<name>.spec.ts`). Tests never touch the live database or call the Claude API.
- Before delivering: `npm run build`.

## Key files
- `src/types/index.ts` — Transaction and Category (waiting lines are transactions with `status: "pending_review"`; see the comments for the optional fields).
- `src/hooks/` — all Firestore reads and writes. `src/lib/` — pure logic (`periods`, `money`, `dates`, `review`, `filters`, `swatches`, `ocr`).
- `src/components/{ui,app,inbox,spend-form,spending,find,organise}/`.
- `src/lib/seedCategories.ts` — the 16 starter categories, seeded on first open.

## Screens
`/` home (the inbox: import, review, glance), `/spending`, `/transactions` (All transactions), `/categories`. `/ocr` redirects to `/`.

## Design
- `redesign/design/` is the reference for any new or changed screen: `design-notes.md` (tokens, components, copy and tone, accessibility, behaviour), `tokens.css` (copied to `src/styles/tokens.css`; no colours or sizes outside it), and the prototype in `prototype/`.
- A screen or state the design doesn't cover is a design gap: add it as a need in `redesign/handoff/needs.md` (job story, no layout words), then design it in the studio (`redesign/studio.sh enter`, then `./start` in `../spendings-tracker-studio`). Build a provisional version from the design's own pieces meanwhile. Never read from the studio folder; only `redesign/handoff/` goes into it.
- "Import the approved design": run `redesign/studio.sh import` on `main`, confirm `redesign/design/` arrived, mark the matching needs `designed`.

## Rules
- Never hardcode category IDs; always read them from Firestore.
- Categories and transactions are editable and hard-deleted with one confirmation. Deleting a used category moves its transactions (waiting lines too) to one the owner picks.
- Offline the app is read-only.

## Env variables
In `.env.local` (not committed) and in Vercel: `NEXT_PUBLIC_FIREBASE_{API_KEY,AUTH_DOMAIN,PROJECT_ID,STORAGE_BUCKET,MESSAGING_SENDER_ID,APP_ID}`, `ANTHROPIC_API_KEY`, `IMPORT_TOKEN`.
