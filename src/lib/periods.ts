import type { Transaction } from "@/types";
import {
  addDays,
  addMonths,
  daysBetween,
  formatSpan,
  mondayOf,
  monthEnd,
  monthName,
  monthStart,
} from "./dates";
import { formatRupiah } from "./money";

/** The part of a confirmed spend the Spending screen needs. */
export type Spend = Pick<Transaction, "id" | "date" | "amount" | "categoryId">;

export type PeriodMode = "week" | "month";

export type Period = {
  mode: PeriodMode;
  /** First and last day of the whole period. */
  from: string;
  to: string;
  /** The last day counted so far: today while the period runs, otherwise `to`. */
  end: string;
  /** Started and not yet on its last day: totals are compared with the same days of the one before. */
  running: boolean;
  /** Today falls inside it. */
  current: boolean;
};

/** The period containing `anchor`. Weeks run Monday to Sunday. */
export function makePeriod(mode: PeriodMode, anchor: string, today: string): Period {
  const from = mode === "week" ? mondayOf(anchor) : monthStart(anchor);
  const to = mode === "week" ? addDays(from, 6) : monthEnd(anchor);
  const running = today >= from && today < to;
  return { mode, from, to, end: running ? today : to, running, current: today >= from && today <= to };
}

/** The period before: whole, or only as many days as this one has had when this one is still running. */
export function previousPeriod(p: Period): Period {
  let from: string;
  let to: string;
  if (p.mode === "week") {
    from = addDays(p.from, -7);
    to = addDays(from, 6);
  } else {
    from = addMonths(monthStart(p.from), -1);
    to = monthEnd(from);
  }
  let end = to;
  if (p.running) {
    end = addDays(from, daysBetween(p.from, p.end));
    if (end > to) end = to;
  }
  return { mode: p.mode, from, to, end, running: false, current: false };
}

/**
 * The date to look at after stepping one period earlier (`-1`) or later (`+1`). Stepping into the
 * current period lands on today. "Later" does nothing in the current period.
 */
export function stepAnchor(mode: PeriodMode, anchor: string, dir: -1 | 1, today: string) {
  if (dir === 1 && !canStepLater(makePeriod(mode, anchor, today), today)) return anchor;
  const next = mode === "week" ? addDays(anchor, 7 * dir) : addMonths(anchor, dir);
  return makePeriod(mode, next, today).current ? today : next;
}

/** Whether "Later" is available: it isn't in the current period. */
export function canStepLater(p: Period, today: string) {
  return p.to < today;
}

/** The date to keep looking at after switching between week and month. */
export function switchMode(mode: PeriodMode, anchor: string, today: string) {
  return makePeriod(mode, anchor, today).current ? today : anchor;
}

function yearSuffix(iso: string, today: string) {
  return iso.slice(0, 4) !== today.slice(0, 4) ? ` ${iso.slice(0, 4)}` : "";
}

/** How a span is named inside a sentence: `1 to 25 September`, `September`, `12 to 18 Oct`. */
export function spanLabel(p: Period, today: string) {
  if (p.mode === "week") return formatSpan(p.from, p.end, today, false);
  const name = monthName(p.from) + yearSuffix(p.from, today);
  return p.end === p.to ? name : `1 to ${+p.end.slice(8)} ${name}`;
}

/** The label between the earlier and later buttons: `19 to 25 Oct 2026`, `October 2026`. */
export function navLabel(p: Period, today: string) {
  return p.mode === "week"
    ? formatSpan(p.from, p.to, today, true)
    : `${monthName(p.from)} ${p.from.slice(0, 4)}`;
}

/** The label above the big total: `This week so far`, `October so far`, `September`, `2 to 8 Sep`. */
export function heroLabel(p: Period, today: string) {
  if (p.mode === "week") {
    if (p.current) return p.running ? "This week so far" : "This week";
    return formatSpan(p.from, p.to, today, false);
  }
  const name = monthName(p.from) + yearSuffix(p.from, today);
  return p.running ? `${name} so far` : name;
}

export type Comparison = {
  kind: "none" | "same" | "lower" | "higher";
  /** `Rp 475.650 lower`. */
  line: string;
  /** `1 to 25 September was Rp 7.318.000`. */
  sub: string;
  /** One line for the glance card: `Rp 475.650 lower than 1 to 25 September`. */
  short: string;
};

/** This period's total against the one before. No green or red: spending more isn't an error. */
export function compare(total: number, prevTotal: number, prev: Period, today: string): Comparison {
  const span = spanLabel(prev, today);
  if (prevTotal === 0) {
    return {
      kind: "none",
      line: "Nothing to compare with",
      sub: `No spending in ${span}`,
      short: `Nothing in ${span} to compare with`,
    };
  }
  const diff = total - prevTotal;
  const sub = `${span} was ${formatRupiah(prevTotal)}`;
  if (diff === 0) return { kind: "same", line: "Same as before", sub, short: `Same as ${span}` };
  const word = diff < 0 ? "lower" : "higher";
  const line = `${formatRupiah(Math.abs(diff))} ${word}`;
  return { kind: word, line, sub, short: `${line} than ${span}` };
}

function amountOf(s: Pick<Spend, "amount">) {
  return s.amount ?? 0;
}

/** The sum of spends dated from `from` to `to`, both included. */
export function sumRange(spends: readonly Spend[], from: string, to: string) {
  let total = 0;
  for (const s of spends) if (s.date >= from && s.date <= to) total += amountOf(s);
  return total;
}

export type PeriodSummary = {
  period: Period;
  previous: Period;
  total: number;
  previousTotal: number;
  comparison: Comparison;
};

/** The total for a period, set against the same days of the one before while it runs. */
export function summarise(
  spends: readonly Spend[],
  mode: PeriodMode,
  anchor: string,
  today: string
): PeriodSummary {
  const period = makePeriod(mode, anchor, today);
  const previous = previousPeriod(period);
  const total = sumRange(spends, period.from, period.end);
  const previousTotal = sumRange(spends, previous.from, previous.end);
  return { period, previous, total, previousTotal, comparison: compare(total, previousTotal, previous, today) };
}

export type DayTotal = { date: string; amount: number; /** After today: shown faint and can't be picked. */ future: boolean };

/** One entry for every day of the whole period, with `0` for a day with no spending. */
export function daySeries(spends: readonly Spend[], p: Period, today: string): DayTotal[] {
  const perDay = new Map<string, number>();
  for (const s of spends) {
    if (s.date >= p.from && s.date <= p.to) perDay.set(s.date, (perDay.get(s.date) ?? 0) + amountOf(s));
  }
  const days: DayTotal[] = [];
  for (let d = p.from; d <= p.to; d = addDays(d, 1)) {
    days.push({ date: d, amount: perDay.get(d) ?? 0, future: d > today });
  }
  return days;
}

/** The index of the day shown in the readout: the picked one, otherwise the first biggest day. `-1` when every day is still to come. */
export function shownDayIndex(days: readonly DayTotal[], picked: string | null) {
  if (picked) {
    const i = days.findIndex((d) => d.date === picked && !d.future);
    if (i >= 0) return i;
  }
  let best = -1;
  days.forEach((d, i) => {
    if (!d.future && (best < 0 || d.amount > days[best].amount)) best = i;
  });
  return best;
}

/** The last day that can be picked, or `-1`. */
export function lastPickableDay(days: readonly DayTotal[]) {
  let last = -1;
  days.forEach((d, i) => {
    if (!d.future) last = i;
  });
  return last;
}

/** A bar's height as a percentage of the biggest day. A day with spending is never thinner than 4%. */
export function barHeight(amount: number, max: number) {
  if (amount <= 0 || max <= 0) return 0;
  return Math.max(4, Math.round((amount / max) * 100));
}

/** The id the split gives to spends whose category no longer exists. */
export const NO_CATEGORY_ID = "__none__";

export type CategoryShare = { id: string; amount: number; share: number };

export type CategorySplit = {
  total: number;
  /** Every category with spending, biggest first. */
  rows: CategoryShare[];
  /** The first `top` rows. */
  top: CategoryShare[];
  /** The rows after those, folded behind "Show N more". */
  rest: CategoryShare[];
};

/**
 * Spending in the period by category, biggest first. A spend whose category isn't in `categoryIds`
 * counts under `NO_CATEGORY_ID`, so the totals still add up.
 */
export function splitByCategory(
  spends: readonly Spend[],
  categoryIds: ReadonlySet<string>,
  top = 5
): CategorySplit {
  const by = new Map<string, number>();
  let total = 0;
  for (const s of spends) {
    const id = categoryIds.has(s.categoryId) ? s.categoryId : NO_CATEGORY_ID;
    by.set(id, (by.get(id) ?? 0) + amountOf(s));
    total += amountOf(s);
  }
  const rows = [...by]
    .map(([id, amount]) => ({ id, amount, share: total > 0 ? amount / total : 0 }))
    .sort((a, b) => b.amount - a.amount || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  return { total, rows, top: rows.slice(0, top), rest: rows.slice(top) };
}

/** `<1%` below one percent, otherwise the rounded percentage. */
export function shareLabel(share: number) {
  return share < 0.01 ? "<1%" : `${Math.round(share * 100)}%`;
}

/** The biggest spends first; equal amounts show the latest day first. */
export function biggestSpends<T extends Spend>(spends: readonly T[], n = 5): T[] {
  return [...spends]
    .sort(
      (a, b) =>
        amountOf(b) - amountOf(a) ||
        (a.date < b.date ? 1 : a.date > b.date ? -1 : 0) ||
        (a.id < b.id ? -1 : a.id > b.id ? 1 : 0)
    )
    .slice(0, n);
}

/** The spends inside the part of the period counted so far. */
export function spendsInPeriod<T extends Spend>(spends: readonly T[], p: Period): T[] {
  return spends.filter((s) => s.date >= p.from && s.date <= p.end);
}
