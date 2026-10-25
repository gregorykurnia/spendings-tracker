// The inbox's rules, apart from its markup: how the waiting lines are grouped, what the title and the
// accept bar say and accept, what is announced, and where focus goes when a line leaves.

import { formatDay } from "@/lib/dates";
import { countLabel, formatRupiah } from "@/lib/money";
import { arrivalOrder, groupWaiting, type ReviewReason } from "@/lib/review";
import type { Transaction } from "@/types";

/** A waiting line and why it needs a look (none, in "Look right"). The first reason is the one shown. */
export type InboxItem = { line: Transaction; reasons: ReviewReason[] };

export type GroupName = "lookRight" | "needLook";

/**
 * A line on its way out: being accepted (with a spinner) or leaving (collapsing). The data drops it
 * the moment it is written, so the inbox keeps the row as it was, in the group it was in, until it has
 * gone. Its reasons are kept too: a line just accepted would otherwise look like a repeat of itself.
 */
export type Departing = InboxItem & { group: GroupName; phase: "accepting" | "leaving" };

export type InboxGroups = Record<GroupName, InboxItem[]>;

/**
 * The two groups, each in the order the lines arrived. A departing line that the data has already
 * dropped stays in the group it was in.
 */
export function inboxGroups(
  waiting: readonly Transaction[],
  spends: readonly Transaction[],
  categoryIds: ReadonlySet<string>,
  departing: ReadonlyMap<string, Departing> = new Map()
): InboxGroups {
  const live = groupWaiting(waiting, spends, categoryIds);
  const groups: InboxGroups = {
    lookRight: live.lookRight.map((line) => ({ line, reasons: [] })),
    needLook: live.needLook,
  };
  const present = new Set(waiting.map((line) => line.id));
  for (const d of departing.values()) {
    if (!present.has(d.line.id)) groups[d.group].push({ line: d.line, reasons: d.reasons });
  }
  const byArrival = (a: InboxItem, b: InboxItem) => arrivalOrder(a.line, b.line);
  groups.lookRight.sort(byArrival);
  groups.needLook.sort(byArrival);
  return groups;
}

/** Where home stands besides the waiting lines: a tray is showing, or nothing has ever been added. */
export type HomeContext = {
  tray?: boolean;
  firstUse?: boolean;
  /** Every waiting line came in this visit, from this many screenshots. */
  freshShots?: number;
};

/** The line under the title on a first open. */
export const FIRST_USE_SUB = "Screenshots from your banking app are read for you.";

/** The page title: how many are waiting, or what is going on instead. */
export function inboxTitle(count: number, { tray, firstUse }: HomeContext = {}) {
  if (count) return `${count} to check`;
  if (tray) return "Nothing to check yet";
  return firstUse ? "Add your first spending" : "All checked";
}

/**
 * The line under the title: how old the oldest waiting line is. `today` decides whether the year shows.
 * With nothing waiting it is quiet while a tray is showing (the tray has the news).
 */
export function inboxSub(
  lines: readonly Pick<Transaction, "date">[],
  today: string,
  { tray, firstUse, freshShots }: HomeContext = {}
) {
  if (firstUse) return FIRST_USE_SUB;
  if (!lines.length) return tray ? "" : "Nothing is waiting.";
  if (freshShots) return `From ${countLabel(freshShots, "screenshot")}, added just now`;
  const dated = lines.map((line) => line.date).filter(Boolean);
  if (!dated.length) return "";
  return `Oldest is from ${formatDay(dated.reduce((a, b) => (b < a ? b : a)), today)}`;
}

/** The jump link in "Look right": `2 need a look`, `1 needs a look`. */
export function jumpLabel(count: number) {
  return `${count} ${count === 1 ? "needs" : "need"} a look`;
}

/** What a tick says to a screen reader. */
export function tickLabel(line: Pick<Transaction, "store" | "amount">) {
  return `Accept ${line.store}, ${formatRupiah(line.amount)}`;
}

/** The accept bar needs at least two lines that look right; one line has its own tick. */
export function showAcceptBar(ready: number) {
  return ready >= 2;
}

/**
 * The accept bar's words. `ready` counts the lines in "Look right" and nothing else: lines that need a
 * look are never in it. While it works, `accepting` is how many it took.
 */
export function acceptBarLabel({
  ready,
  needLook,
  accepting,
}: {
  ready: number;
  needLook: number;
  accepting: number | null;
}) {
  if (accepting !== null) return `Accepting ${accepting}…`;
  return needLook > 0 ? `Accept the ${ready} that look right` : `Accept all ${ready}`;
}

/**
 * "From 2 screenshots, added just now": how many screenshots the waiting lines came from, while every
 * one of them came in this visit (`stamps`, one per screenshot read), and 0 otherwise.
 */
export function freshShotCount(waiting: readonly Pick<Transaction, "createdAt">[], stamps: ReadonlySet<string>) {
  if (!waiting.length || !waiting.every((line) => stamps.has(line.createdAt))) return 0;
  return new Set(waiting.map((line) => line.createdAt)).size;
}

/** The toast after accepting many. */
export function acceptedManyMessage(lines: readonly Pick<Transaction, "amount">[]) {
  const total = lines.reduce((sum, line) => sum + (line.amount ?? 0), 0);
  return `Accepted ${lines.length}. ${formatRupiah(total)} added.`;
}

/** Announced after accepting many (the toast says the amount). */
export function acceptedManyAnnouncement(accepted: number, left: number) {
  return `Accepted ${accepted}. ${leftToCheck(left)}`;
}

function leftToCheck(left: number) {
  return left ? `${countLabel(left, "line")} left to check.` : "Nothing left to check.";
}

/** Announced after one tick (there is no toast for one). */
export function acceptedOneMessage(line: Pick<Transaction, "store" | "amount">, left: number) {
  return `Accepted ${line.store}, ${formatRupiah(line.amount)}. ${leftToCheck(left)}`;
}

export function thrownAwayMessage(line: Pick<Transaction, "store">, left: number) {
  return `Thrown away ${line.store.trim() || "a line with no store name"}. ${leftToCheck(left)}`;
}

/** After "Keep it" or "It's a spend": it either moved to "Look right" or still needs something. */
export function keptMessage(stillNeedsSomething: boolean) {
  return stillNeedsSomething
    ? "Kept. One more thing is needed before it can be accepted."
    : "Kept. It moved to Look right.";
}

/**
 * Where focus goes when lines leave: the next line down, else the one above, from `order` (every row
 * in the order they are shown). Null when nothing else is left.
 */
export function nextFocusId(order: readonly string[], removed: ReadonlySet<string>): string | null {
  const first = order.findIndex((id) => removed.has(id));
  if (first < 0) return null;
  for (let i = first + 1; i < order.length; i++) if (!removed.has(order[i])) return order[i];
  for (let i = first - 1; i >= 0; i--) if (!removed.has(order[i])) return order[i];
  return null;
}
