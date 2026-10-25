import type { Transaction } from "@/types";

/** Why a waiting line can't be accepted yet. Computed from the line and the saved spends, never stored. */
export type ReviewReason =
  | "ownTransfer"
  | "incoming"
  | "repeat"
  | "amount"
  | "store"
  | "date"
  | "category";

export type ReviewAction = {
  /** What the button does: `throw` away, `keep` it (it's a spend, or keep the repeat), or `fix` a field. */
  action: "throw" | "keep" | "fix" | "pick-category";
  label: string;
  /** The fix button and the main choice come first and are drawn solid. */
  primary: boolean;
  /** For `fix`: the field the form opens on. */
  field?: "amount" | "store" | "date";
};

export type ReviewReasonInfo = {
  /** The name of the icon the row shows. */
  icon: "transfer" | "in" | "repeat" | "alert" | "tag";
  /** Drawn in the "wrong" colour rather than the "look at this" one. */
  alert: boolean;
  why: string;
  actions: ReviewAction[];
};

export const REVIEW_REASONS: Record<ReviewReason, ReviewReasonInfo> = {
  ownTransfer: {
    icon: "transfer",
    alert: false,
    why: "Money moving between your own accounts, so it isn't counted yet.",
    actions: [
      { action: "throw", label: "Throw away", primary: true },
      { action: "keep", label: "It's a spend", primary: false },
    ],
  },
  incoming: {
    icon: "in",
    alert: false,
    why: "Money coming in, so it isn't counted as spending.",
    actions: [
      { action: "throw", label: "Throw away", primary: true },
      { action: "keep", label: "It's a spend", primary: false },
    ],
  },
  repeat: {
    icon: "repeat",
    alert: false,
    why: "You already have this one: same store, day and amount.",
    actions: [
      { action: "throw", label: "Throw away", primary: true },
      { action: "keep", label: "Keep it", primary: false },
    ],
  },
  amount: {
    icon: "alert",
    alert: true,
    why: "Couldn't read the amount. Check it against the screenshot.",
    actions: [
      { action: "fix", label: "Add amount", primary: true, field: "amount" },
      { action: "throw", label: "Throw away", primary: false },
    ],
  },
  store: {
    icon: "alert",
    alert: true,
    why: "The store name is missing.",
    actions: [
      { action: "fix", label: "Add store", primary: true, field: "store" },
      { action: "throw", label: "Throw away", primary: false },
    ],
  },
  date: {
    icon: "alert",
    alert: true,
    why: "The date is missing.",
    actions: [
      { action: "fix", label: "Add date", primary: true, field: "date" },
      { action: "throw", label: "Throw away", primary: false },
    ],
  },
  category: {
    icon: "tag",
    alert: false,
    why: "No category yet. Choose one to accept it.",
    actions: [
      { action: "pick-category", label: "Choose category", primary: true },
      { action: "throw", label: "Throw away", primary: false },
    ],
  },
};

type Line = Pick<
  Transaction,
  "amount" | "store" | "date" | "categoryId" | "direction" | "ownTransfer" | "kept"
>;
type Saved = Pick<Transaction, "amount" | "store" | "date" | "status" | "direction">;

function storeKey(store: string) {
  return store.trim().toLowerCase();
}

/**
 * Everything that stops a waiting line from being accepted, most important first: own transfer,
 * incoming money, a repeat of a saved spend, then the missing pieces. "Keep it" and "It's a spend"
 * (`kept`) silence the first three only. When `categoryIds` is given, a category that no longer
 * exists counts as no category.
 */
export function reviewReasons(
  line: Line,
  saved: readonly Saved[],
  categoryIds?: ReadonlySet<string>
): ReviewReason[] {
  const reasons: ReviewReason[] = [];
  if (line.ownTransfer && !line.kept) reasons.push("ownTransfer");
  if (line.direction === "in" && !line.kept) reasons.push("incoming");
  if (!line.kept && isRepeat(line, saved)) reasons.push("repeat");
  if (!(line.amount != null && line.amount > 0)) reasons.push("amount");
  if (!line.store.trim()) reasons.push("store");
  if (!line.date) reasons.push("date");
  if (!line.categoryId || (categoryIds && !categoryIds.has(line.categoryId))) reasons.push("category");
  return reasons;
}

/** A saved spend with the same date, amount and store (trimmed, capitals ignored). */
export function isRepeat(line: Pick<Line, "amount" | "store" | "date" | "direction">, saved: readonly Saved[]) {
  if (line.direction === "in" || line.amount == null || !line.date) return false;
  const key = storeKey(line.store);
  return saved.some(
    (t) =>
      t.status === "confirmed" &&
      t.date === line.date &&
      t.amount === line.amount &&
      storeKey(t.store) === key
  );
}

/** Lines keep the order they arrived in: `createdAt`, then `seq` within one screenshot. */
export function sortWaiting<T extends Pick<Transaction, "createdAt" | "seq">>(lines: readonly T[]): T[] {
  return [...lines].sort(
    (a, b) =>
      (a.createdAt < b.createdAt ? -1 : a.createdAt > b.createdAt ? 1 : 0) || (a.seq ?? 0) - (b.seq ?? 0)
  );
}

export type WaitingGroups<T> = {
  /** Nothing to resolve: these are what "Accept the N that look right" accepts. */
  lookRight: T[];
  /** At least one reason; each is paired with its reasons, the first one being the one shown. */
  needLook: { line: T; reasons: ReviewReason[] }[];
};

/** Splits the waiting lines, in arrival order, into the ones that look right and the ones that need a look. */
export function groupWaiting<
  T extends Line & Pick<Transaction, "createdAt" | "seq">,
>(lines: readonly T[], saved: readonly Saved[], categoryIds?: ReadonlySet<string>): WaitingGroups<T> {
  const groups: WaitingGroups<T> = { lookRight: [], needLook: [] };
  for (const line of sortWaiting(lines)) {
    const reasons = reviewReasons(line, saved, categoryIds);
    if (reasons.length) groups.needLook.push({ line, reasons });
    else groups.lookRight.push(line);
  }
  return groups;
}
