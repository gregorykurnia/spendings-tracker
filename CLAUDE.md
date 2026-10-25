# Spending Tracker

Personal spending tracker for BCA transactions. Single user, no auth needed.
Primary input: OCR from BCA screenshots. Secondary input: manual entry.
All amounts in IDR. Display format: Rp XX.XXX.XXX

## Stack
- Framework: Next.js 14+ with App Router
- Styling: Tailwind CSS
- Database: Firebase Firestore
- AI: Claude API (claude-sonnet-4-6) for OCR vision
- Deployment: Vercel (auto-deploy on push to main)

## Deploy Workflow
1. Make changes
2. Run `./push.sh "description of change"`
3. Vercel auto-deploys from main branch

## Key Files
- `src/lib/firebase.ts` — Firestore init, import `db` from here
- `src/types/index.ts` — shared types: Transaction, Category
- `src/app/` — all pages (App Router)
- `src/components/` — reusable components
- `src/hooks/` — custom React hooks

## Pages
- `/` — Dashboard
- `/transactions` — Full list with filters
- `/ocr` — Screenshot upload + review queue
- `/categories` — Manage categories

## Firestore Collections

### `categories`
{
  id: string,
  name: string,
  emoji: string,
  color: string,
  order: number
}

### `transactions`
{
  id: string,
  amount: number,
  store: string,
  description: string,
  categoryId: string,
  date: string,
  source: "manual" | "ocr",
  status: "confirmed" | "pending_review",
  createdAt: string
}

## Seed Categories
Seed these into Firestore on first load if categories collection is empty:
🍽️ Food & Drink
🛒 Groceries
🚗 Transport
🏠 Home & Utilities
💼 Business
💊 Health
👗 Shopping
🎮 Entertainment
⛪ Church & Giving
📈 Investments
🎓 Education
✈️ Travel
💑 Relationship
🔧 Subscriptions
❓ Other

## Dashboard (/)
Timeframe toggle: This Week / This Month / Last Month / Last 3 Months / This Year

Sections:
- Summary bar: total spent for the period
- Category breakdown: donut chart + list with amount and % of total
- Daily/weekly trend: bar chart of spending over time
- Top 5 transactions: biggest spends in the period

## Transactions List (/transactions)
Filters:
- Date range: Today / This Week / This Month / Last Month / Last 3 Months / Custom range
- Category: multi-select dropdown
- Amount range: min / max
- Source: Manual / OCR / All
- Keyword search: matches store and description fields

Sort options:
- Date newest first (default)
- Date oldest first
- Amount highest first
- Amount lowest first

Each transaction row: editable via edit modal. Delete with confirmation modal.

## OCR Page (/ocr)
Flow:
1. User uploads one or more BCA screenshots
2. Each image sent to Claude API (vision) with prompt:
   "Extract all transactions from this BCA banking screenshot. For each transaction return: date (YYYY-MM-DD), store (merchant or transfer name), description (any additional note), amount (number only, no formatting). Return as JSON array only, no other text."
3. Extracted transactions appear in a review queue with status: pending_review
4. User reviews each: can edit date, store, description, amount, and assign category
5. User confirms → status becomes confirmed, saved to Firestore
6. User can delete any extracted entry before confirming

## Categories Page (/categories)
Features:
- List all categories with emoji, name, color swatch, transaction count
- Add new category (name, emoji, color picker)
- Edit existing category (name, emoji, color)
- Reorder via up/down buttons
- Delete category:
  - No transactions: delete directly with confirmation
  - Has transactions: prompt user to reassign to another category first, then delete

## Editability Rules
- All categories are editable (name, emoji, color) and deletable
- All transactions are editable after saving (amount, store, description, category, date, source)
- OCR-imported transactions are editable in the review queue before confirming
- OCR-confirmed transactions remain editable in the transactions list
- No soft delete — hard delete with confirmation modal everywhere

## TypeScript Types (src/types/index.ts)
export type Category = {
  id: string;
  name: string;
  emoji: string;
  color: string;
  order: number;
};

export type Transaction = {
  id: string;
  amount: number;
  store: string;
  description: string;
  categoryId: string;
  date: string;
  source: "manual" | "ocr";
  status: "confirmed" | "pending_review";
  createdAt: string;
};

## Env Variables
All in .env.local (not committed) and set in Vercel dashboard:
NEXT_PUBLIC_FIREBASE_API_KEY
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN
NEXT_PUBLIC_FIREBASE_PROJECT_ID
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID
NEXT_PUBLIC_FIREBASE_APP_ID
ANTHROPIC_API_KEY
IMPORT_TOKEN (turns on `/api/import` for sharing from the iPhone; see docs/iphone-shortcut.md)

## Build Order
Build in this order — each depends on the previous:
1. Firebase init + types + seed categories
2. Categories page (full CRUD)
3. Transactions list page + filters
4. Dashboard
5. OCR page

## General Rules
- No authentication — single user personal app
- Mobile-friendly UI (used on phone to review OCR imports)
- Keep components small and reusable under src/components/
- Use custom hooks in src/hooks/ for all Firestore reads/writes
- Never hardcode category IDs — always fetch from Firestore

## Deploy Workflow
1. Make changes
2. Run `./push.sh "description of change"`
3. Vercel auto-deploys from main branch

## push.sh
Create this file in project root and run `chmod +x push.sh` once:
```bash
#!/bin/bash
git add .
git commit -m "$1"
git push origin main
```

## UI redesign (blank-slate, light version, in progress)
- The plan is `redesign/redesign-plan.md` (a cut-down `~/.claude/playbooks/blank-slate-redesign.md`; the plan wins where they differ). Design happens in `../spendings-tracker-studio`, a separate repo that never sees this codebase. Studio sessions start only with `./start` there.
- Never read from the studio folder, and never send anything from this codebase into it, except `redesign/handoff/` through `redesign/studio.sh enter`. Run the banned-word scan on every file in `redesign/handoff/` before every `enter`.
- On tmux, the studio runs on its own server (`tmux -L studio`). Never capture, read or send keys to its panes.
- Don't save memories that describe the current UI.
- Tick a redesign step in the plan's checklist in the same commit as its work, never before; studio steps are ticked here when the owner reports them done. At the start of each redesign session, check the model against the step's pick (or the task table in `redesign/ui-implementation-plan.md` during the rebuild) and say so if the current one is lower.
- When the owner says **"Import the approved design"**: run `redesign/studio.sh import`, confirm `redesign/design/` arrived, tick Step 3d (or mark the matching `needs.md` rows `designed`), and offer the next step.
- Rebuild: only on the `redesign` branch, one task per session, reading only that task's section, `redesign/design/design-notes.md` and the matching prototype file. Never copy markup, CSS, names or wording from the old UI. Tick the task's Done cell in the task table in the same commit as the work, and nowhere else; change-log lines go in `CHANGELOG.md`.
- Design gaps go to the implementation plan's "Design gaps" section, then as needs into `redesign/handoff/needs.md` (the design-gap loop). Never fill a gap from the old app.
