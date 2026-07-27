export type DateRangeOption =
  | "today"
  | "this_week"
  | "this_month"
  | "last_month"
  | "last_3_months"
  | "this_year"
  | "custom"
  | "all";

export type Granularity = "day" | "week" | "month";

function toISO(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function fromISO(iso: string) {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d);
}

function mondayOf(d: Date) {
  const day = d.getDay();
  const monday = new Date(d);
  monday.setDate(d.getDate() - ((day + 6) % 7));
  return monday;
}

export function todayISO() {
  const now = new Date();
  return toISO(new Date(now.getFullYear(), now.getMonth(), now.getDate()));
}

/** Bounds (inclusive, YYYY-MM-DD) of the period containing `anchorISO` at the given granularity. */
export function getPeriodRange(
  granularity: Granularity,
  anchorISO: string
): { start: string; end: string } {
  const anchor = fromISO(anchorISO);
  switch (granularity) {
    case "day":
      return { start: anchorISO, end: anchorISO };
    case "week": {
      const monday = mondayOf(anchor);
      const sunday = new Date(monday);
      sunday.setDate(monday.getDate() + 6);
      return { start: toISO(monday), end: toISO(sunday) };
    }
    case "month": {
      const start = new Date(anchor.getFullYear(), anchor.getMonth(), 1);
      const end = new Date(anchor.getFullYear(), anchor.getMonth() + 1, 0);
      return { start: toISO(start), end: toISO(end) };
    }
  }
}

/** Shift the anchor date by one unit of granularity (dir = -1 previous, +1 next). */
export function shiftAnchor(granularity: Granularity, anchorISO: string, dir: -1 | 1): string {
  const anchor = fromISO(anchorISO);
  switch (granularity) {
    case "day": {
      const d = new Date(anchor);
      d.setDate(anchor.getDate() + dir);
      return toISO(d);
    }
    case "week": {
      const d = new Date(anchor);
      d.setDate(anchor.getDate() + dir * 7);
      return toISO(d);
    }
    case "month": {
      const d = new Date(anchor.getFullYear(), anchor.getMonth() + dir, 1);
      return toISO(d);
    }
  }
}

const WEEKDAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTH_LABELS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];

/** Human label for the period containing `anchorISO`, e.g. "Today", "Jul 21 – 27", "July 2026". */
export function formatPeriodLabel(granularity: Granularity, anchorISO: string): string {
  const todayIso = todayISO();
  const anchor = fromISO(anchorISO);

  if (granularity === "day") {
    if (anchorISO === todayIso) return "Today";
    const yesterday = shiftAnchor("day", todayIso, -1);
    if (anchorISO === yesterday) return "Yesterday";
    const tomorrow = shiftAnchor("day", todayIso, 1);
    if (anchorISO === tomorrow) return "Tomorrow";
    return `${WEEKDAY_LABELS[anchor.getDay()]}, ${MONTH_LABELS[anchor.getMonth()]} ${anchor.getDate()}, ${anchor.getFullYear()}`;
  }

  if (granularity === "week") {
    const { start, end } = getPeriodRange("week", anchorISO);
    const s = fromISO(start);
    const e = fromISO(end);
    const thisWeekStart = getPeriodRange("week", todayIso).start;
    const lastWeekStart = shiftAnchor("week", thisWeekStart, -1);
    if (start === thisWeekStart) return "This Week";
    if (start === lastWeekStart) return "Last Week";
    const sameMonth = s.getMonth() === e.getMonth();
    return sameMonth
      ? `${MONTH_LABELS[s.getMonth()]} ${s.getDate()} – ${e.getDate()}`
      : `${MONTH_LABELS[s.getMonth()]} ${s.getDate()} – ${MONTH_LABELS[e.getMonth()]} ${e.getDate()}`;
  }

  // month
  const thisMonthStart = getPeriodRange("month", todayIso).start;
  const lastMonthStart = shiftAnchor("month", thisMonthStart, -1);
  const { start } = getPeriodRange("month", anchorISO);
  if (start === thisMonthStart) return "This Month";
  if (start === lastMonthStart) return "Last Month";
  return `${MONTH_LABELS[anchor.getMonth()]} ${anchor.getFullYear()}`;
}

/**
 * Range for the period immediately preceding the given option, matched like-for-like
 * (same day-of-month cutoff for partial months, same weekday cutoff for partial weeks, etc.)
 * so the comparison is fair even when the current period isn't finished yet.
 */
export function resolveComparisonRange(
  option: DateRangeOption
): { start: string; end: string; label: string } | null {
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  switch (option) {
    case "today": {
      const yesterday = new Date(startOfToday);
      yesterday.setDate(yesterday.getDate() - 1);
      return { start: toISO(yesterday), end: toISO(yesterday), label: "yesterday" };
    }
    case "this_week": {
      const day = startOfToday.getDay();
      const monday = new Date(startOfToday);
      monday.setDate(startOfToday.getDate() - ((day + 6) % 7));
      const prevMonday = new Date(monday);
      prevMonday.setDate(monday.getDate() - 7);
      const prevSameDay = new Date(startOfToday);
      prevSameDay.setDate(startOfToday.getDate() - 7);
      return { start: toISO(prevMonday), end: toISO(prevSameDay), label: "last week" };
    }
    case "this_month": {
      const prevMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const daysInPrevMonth = new Date(now.getFullYear(), now.getMonth(), 0).getDate();
      const cutoffDay = Math.min(now.getDate(), daysInPrevMonth);
      const prevMonthEnd = new Date(now.getFullYear(), now.getMonth() - 1, cutoffDay);
      return { start: toISO(prevMonthStart), end: toISO(prevMonthEnd), label: "last month" };
    }
    case "last_month": {
      const start = new Date(now.getFullYear(), now.getMonth() - 2, 1);
      const end = new Date(now.getFullYear(), now.getMonth() - 1, 0);
      return { start: toISO(start), end: toISO(end), label: "the month before" };
    }
    case "last_3_months": {
      const start = new Date(now.getFullYear(), now.getMonth() - 5, 1);
      const end = new Date(now.getFullYear(), now.getMonth() - 2, startOfToday.getDate());
      return { start: toISO(start), end: toISO(end), label: "the previous 3 months" };
    }
    case "this_year": {
      const start = new Date(now.getFullYear() - 1, 0, 1);
      const end = new Date(now.getFullYear() - 1, now.getMonth(), startOfToday.getDate());
      return { start: toISO(start), end: toISO(end), label: "last year" };
    }
    case "custom":
    case "all":
    default:
      return null;
  }
}

export function resolveDateRange(
  option: DateRangeOption,
  custom?: { start: string; end: string }
): { start: string; end: string } | null {
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  switch (option) {
    case "today":
      return { start: toISO(startOfToday), end: toISO(startOfToday) };
    case "this_week": {
      const day = startOfToday.getDay();
      const monday = new Date(startOfToday);
      monday.setDate(startOfToday.getDate() - ((day + 6) % 7));
      return { start: toISO(monday), end: toISO(startOfToday) };
    }
    case "this_month": {
      const start = new Date(now.getFullYear(), now.getMonth(), 1);
      return { start: toISO(start), end: toISO(startOfToday) };
    }
    case "last_month": {
      const start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const end = new Date(now.getFullYear(), now.getMonth(), 0);
      return { start: toISO(start), end: toISO(end) };
    }
    case "last_3_months": {
      const start = new Date(now.getFullYear(), now.getMonth() - 2, 1);
      return { start: toISO(start), end: toISO(startOfToday) };
    }
    case "this_year": {
      const start = new Date(now.getFullYear(), 0, 1);
      return { start: toISO(start), end: toISO(startOfToday) };
    }
    case "custom":
      if (custom?.start && custom?.end) return custom;
      return null;
    case "all":
    default:
      return null;
  }
}
