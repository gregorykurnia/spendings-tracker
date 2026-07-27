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
  description: string,
  categoryId: string,
  date: string,
  type: "expense" | "income",
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
- Summary bar: total spent, total income, net balance for the period
- Category breakdown: donut chart + list with amount and % of total
- Daily/weekly trend: bar chart of spending over time
- Top 5 transactions: biggest spends in the period

## Transactions List (/transactions)
Filters:
- Date range: Today / This Week / This Month / Last Month / Last 3 Months / Custom range
- Category: multi-select dropdown
- Type: Expense / Income / All
- Amount range: min / max
- Source: Manual / OCR / All
- Keyword search: matches description field

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
   "Extract all transactions from this BCA banking screenshot. For each transaction return: date (YYYY-MM-DD), description (merchant or transfer name), amount (number only, no formatting), type (expense or income). Return as JSON array only, no other text."
3. Extracted transactions appear in a review queue with status: pending_review
4. User reviews each: can edit date, description, amount, type, and assign category
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
- All transactions are editable after saving (amount, description, category, date, type, source)
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
  description: string;
  categoryId: string;
  date: string;
  type: "expense" | "income";
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
