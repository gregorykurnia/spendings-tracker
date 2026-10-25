// The spend form's rules, apart from its markup: what makes a spend not ready, how the amount is
// typed, which categories are the quick choices, and the words on the buttons.

import { formatDigits } from "@/lib/money";
import type { Category, Transaction } from "@/types";

/** One form for three jobs (decisions P4): type in a spend, correct a waiting line, change a saved one. */
export type SpendFormMode =
  | { kind: "add" }
  /** `line` is the live waiting line: edits go to it as they are typed (design notes §7). */
  | { kind: "correct"; line: Transaction; focus?: "store" | "amount" | "date" }
  | { kind: "change"; spend: Transaction };

export type FieldKey = "store" | "amount" | "category" | "date";

/** The order the fields are asked for, and named in "Still needed: …". */
export const FIELD_ORDER: readonly FieldKey[] = ["store", "amount", "category", "date"];

const FIELD_NAME: Record<FieldKey, string> = {
  store: "store",
  amount: "amount",
  category: "category",
  date: "date",
};

/** What the form holds. `categoryId` is `""` while none is chosen. */
export type Draft = {
  store: string;
  amount: number | null;
  date: string;
  categoryId: string;
  note: string;
};

export type Problems = Partial<Record<FieldKey, string>>;

/**
 * What stops the spend from being saved. `unread` is a waiting line that came in with no amount:
 * its message points at the screenshot. A category that no longer exists counts as none.
 */
export function problems(draft: Draft, categoryIds: ReadonlySet<string>, unread = false): Problems {
  const out: Problems = {};
  if (!draft.store.trim()) out.store = "Add the store name.";
  if (!(draft.amount != null && draft.amount > 0)) {
    out.amount =
      unread && draft.amount == null
        ? "Couldn't read this amount. Check the screenshot and type it in."
        : "Enter an amount above Rp 0.";
  }
  if (!draft.categoryId) out.category = "Choose a category.";
  else if (!categoryIds.has(draft.categoryId)) out.category = "That category was removed. Choose another.";
  if (!draft.date) out.date = "Choose a date.";
  return out;
}

/** The fields with a problem, in the order they are asked for. */
export function missingFields(found: Problems): FieldKey[] {
  return FIELD_ORDER.filter((key) => found[key]);
}

/** `store`, `store and amount`, `store, amount and date`. */
export function stillNeeded(keys: readonly FieldKey[]): string {
  const names = keys.map((key) => FIELD_NAME[key]);
  return names.length < 2 ? names.join("") : `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`;
}

/** The line above the buttons: "Still needed: store and amount." Empty when nothing is missing. */
export function summaryLine(keys: readonly FieldKey[]): string {
  return keys.length ? `Still needed: ${stillNeeded(keys)}.` : "";
}

/** What is said, not just shown, when a save is tried and something is missing. */
export function notSavedMessage(keys: readonly FieldKey[]): string {
  return `Not saved. Still needed: ${stillNeeded(keys)}.`;
}

/** The figures typed in the amount box: digits only, no leading zeros, at most twelve. */
export function parseAmountInput(raw: string): number | null {
  const digits = raw.replace(/\D/g, "").replace(/^0+/, "").slice(0, 12);
  return digits ? parseInt(digits, 10) : null;
}

/** How the amount box shows the amount: `1.234.567`, or nothing. */
export function amountInputText(amount: number | null): string {
  return amount != null && amount > 0 ? formatDigits(amount) : "";
}

/** The title and the words on the two buttons at the bottom (`busy` is the main button while it works). */
export function formWords(mode: SpendFormMode["kind"]) {
  switch (mode) {
    case "add":
      return { title: "Type in a spend", secondary: "Cancel", primary: "Add spend", busy: "Saving…" };
    case "correct":
      return { title: "Edit details", secondary: "Done", primary: "Accept", busy: "Accepting…" };
    case "change":
      return { title: "Change spend", secondary: "Cancel", primary: "Save changes", busy: "Saving…" };
  }
}

/**
 * The category chips: the first four in the owner's order, with the chosen one always visible (it
 * takes the fourth place if it isn't among them). The rest are behind "More".
 */
export function quickCategories(categories: readonly Category[], selectedId: string): Category[] {
  const shown = categories.slice(0, 4);
  if (selectedId && shown.length === 4 && !shown.some((c) => c.id === selectedId)) {
    const chosen = categories.find((c) => c.id === selectedId);
    if (chosen) shown[3] = chosen;
  }
  return shown;
}

/**
 * A waiting line that must be thrown away or kept ("It's a spend") before it can be accepted:
 * money moving between the owner's own accounts, or money coming in. Same rule as `cannotSave`.
 */
export function needsDecision(line: Pick<Transaction, "status" | "kept" | "ownTransfer" | "direction">): boolean {
  return line.status === "pending_review" && !line.kept && Boolean(line.ownTransfer || line.direction === "in");
}
