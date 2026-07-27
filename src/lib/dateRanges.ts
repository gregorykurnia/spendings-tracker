export type DateRangeOption =
  | "today"
  | "this_week"
  | "this_month"
  | "last_month"
  | "last_3_months"
  | "this_year"
  | "custom"
  | "all";

function toISO(d: Date) {
  return d.toISOString().slice(0, 10);
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
