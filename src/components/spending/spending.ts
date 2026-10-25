// What the Spending screen shows, worked out from the spends and the choices made on the screen.
// Pure, so the rules are tested without a browser; the logic itself is in `src/lib/periods.ts`.

import { formatDay } from "@/lib/dates";
import {
  barHeight,
  biggestSpends,
  daySeries,
  heroLabel,
  lastPickableDay,
  navLabel,
  NO_CATEGORY_ID,
  shownDayIndex,
  spendsInPeriod,
  splitByCategory,
  summarise,
  type CategoryShare,
  type DayTotal,
  type Period,
  type PeriodMode,
  type PeriodSummary,
  type Spend,
} from "@/lib/periods";
import { formatRupiah } from "@/lib/money";
import type { Category } from "@/types";

/** How many categories show before "Show N more". */
export const TOP_CATEGORIES = 5;

/** How many spends "Biggest spends" lists. */
export const BIGGEST_COUNT = 5;

/** What a spend whose category was removed is called, and drawn as. */
export const MISSING_CATEGORY = { name: "No category", emoji: "❔", color: "slate" } as const;

export type CategoryLook = { id: string; name: string; emoji: string; color: string };

/** The category with this id, or the "No category" look for one that was removed. */
export function categoryLook(id: string, categories: readonly Category[]): CategoryLook {
  const found = categories.find((c) => c.id === id);
  return found
    ? { id: found.id, name: found.name, emoji: found.emoji, color: found.color }
    : { id: NO_CATEGORY_ID, ...MISSING_CATEGORY };
}

export type DayView = DayTotal & {
  /** The bar's height, a share of the biggest day. */
  height: number;
  /** Nothing was spent and the day isn't still to come: drawn as a flat mark. */
  quiet: boolean;
  /** `Mon`, or the day of the month under every seventh bar of a month; empty for the rest. */
  axis: string;
  /** Where the label sits, as a percentage across the chart. */
  axisAt: number;
};

export type SpendingView<T extends Spend = Spend> = {
  period: Period;
  summary: PeriodSummary;
  /** `October so far`, above the total. */
  label: string;
  /** `October 2026`, between the earlier and later buttons. */
  navLabel: string;
  /** Spends counted in the period so far. */
  count: number;
  days: DayView[];
  /** The day the readout shows (`-1` only if every day were still to come). */
  shown: number;
  /** The last day that can be picked. */
  last: number;
  /** The biggest day's spending, among days that can be picked. */
  biggestDay: number;
  /** What a screen reader hears for the chart. */
  chartSummary: string;
  categories: { shown: CategoryShare[]; more: number };
  biggest: T[];
};

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

/**
 * Everything the screen draws for one period. `anchor` is any date inside it, `picked` the day chosen
 * on the chart (the biggest day when none, or when it isn't in this period).
 */
export function spendingView<T extends Spend>(
  spends: readonly T[],
  categories: readonly Category[],
  choice: { mode: PeriodMode; anchor: string; picked: string | null; showAll: boolean },
  today: string
): SpendingView<T> {
  const summary = summarise(spends, choice.mode, choice.anchor, today);
  const period = summary.period;
  const inPeriod = spendsInPeriod(spends, period);
  const series = daySeries(spends, period, today);
  const shown = shownDayIndex(series, choice.picked);
  const last = lastPickableDay(series);
  const biggestDay = series.reduce((m, d) => (d.future ? m : Math.max(m, d.amount)), 0);

  const days = series.map((d, i): DayView => {
    const axis = period.mode === "week" ? WEEKDAYS[i] : i % 7 === 0 ? String(+d.date.slice(8)) : "";
    return {
      ...d,
      height: d.future ? 0 : barHeight(d.amount, biggestDay),
      quiet: !d.future && d.amount === 0,
      axis,
      axisAt: ((i + 0.5) / series.length) * 100,
    };
  });

  const split = splitByCategory(inPeriod, new Set(categories.map((c) => c.id)), TOP_CATEGORIES);
  const bigIndex = series.findIndex((d) => !d.future && d.amount === biggestDay);
  const chartSummary =
    biggestDay > 0 && bigIndex >= 0
      ? `Spending by day. Biggest day ${formatDay(series[bigIndex].date, today)}, ${formatRupiah(biggestDay)}.`
      : "Spending by day. Nothing spent yet.";

  return {
    period,
    summary,
    label: heroLabel(period, today),
    navLabel: navLabel(period, today),
    count: inPeriod.length,
    days,
    shown,
    last,
    biggestDay,
    chartSummary,
    categories: {
      shown: choice.showAll ? split.rows : split.top,
      more: split.rest.length,
    },
    biggest: biggestSpends(inPeriod, BIGGEST_COUNT),
  };
}

/** The words for the day under the chart: its date, and what was spent. */
export function readoutFor(day: DayView, biggestDay: number, today: string) {
  return {
    date: formatDay(day.date, today),
    amount: day.amount > 0 ? formatRupiah(day.amount) : "Nothing spent",
    none: day.amount === 0,
    biggest: day.amount > 0 && day.amount === biggestDay,
  };
}

/**
 * Where a category row goes: All transactions with that category and the part of the period counted
 * so far already on (U7). `label` names the span on its chip, such as `October so far`. The page that
 * receives it reads `cat`, `from`, `to`, `label` and `back`.
 */
export function categoryHref(categoryId: string, period: Period, label: string) {
  const query = new URLSearchParams({
    cat: categoryId,
    from: period.from,
    to: period.end,
    label,
    back: "spending",
  });
  return `/transactions?${query}`;
}

/** The empty period: what happened, and whether waiting lines will change it. */
export function emptyWords(view: Pick<SpendingView, "period" | "navLabel">, waiting: number) {
  const { period } = view;
  return {
    what: period.current
      ? `Nothing spent yet this ${period.mode}.`
      : `Nothing spent in ${view.navLabel}.`,
    waiting:
      waiting > 0
        ? `${waiting === 1 ? "1 line is" : `${waiting} lines are`} still waiting to be checked. They count once you accept them.`
        : "",
    go: waiting === 1 ? "Go and check it" : "Go and check them",
  };
}
