// Calendar days are `YYYY-MM-DD` strings. All arithmetic runs on UTC dates, so it never depends on
// the machine's time zone or on daylight-saving changes. Weeks run Monday to Sunday.

const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTH_SHORT = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const MONTH_LONG = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

const ISO = /^(\d{4})-(\d{2})-(\d{2})$/;

function pad(n: number) {
  return n < 10 ? `0${n}` : String(n);
}

function parse(iso: string) {
  const m = ISO.exec(iso);
  if (!m) throw new Error(`Not a YYYY-MM-DD date: ${iso}`);
  return new Date(Date.UTC(+m[1], +m[2] - 1, +m[3]));
}

function format(d: Date) {
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
}

/** True for a real calendar day written as `YYYY-MM-DD` (`2026-02-30` is not). */
export function isISODate(value: unknown): value is string {
  if (typeof value !== "string" || !ISO.test(value)) return false;
  return format(parse(value)) === value;
}

/** Today on the device's calendar. `now` is only for tests. */
export function todayISO(now: Date = new Date()) {
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

export function addDays(iso: string, n: number) {
  const d = parse(iso);
  d.setUTCDate(d.getUTCDate() + n);
  return format(d);
}

/** Whole days from `a` to `b` (negative when `b` is earlier). */
export function daysBetween(a: string, b: string) {
  return Math.round((parse(b).getTime() - parse(a).getTime()) / 864e5);
}

export function mondayOf(iso: string) {
  return addDays(iso, -((parse(iso).getUTCDay() + 6) % 7));
}

export function monthStart(iso: string) {
  return `${iso.slice(0, 8)}01`;
}

export function monthEnd(iso: string) {
  const d = parse(iso);
  return format(new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)));
}

/** Moves by whole months and keeps the day of the month, or the month's last day when it is shorter. */
export function addMonths(iso: string, n: number) {
  const d = parse(iso);
  const first = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + n, 1));
  const last = new Date(Date.UTC(first.getUTCFullYear(), first.getUTCMonth() + 1, 0)).getUTCDate();
  first.setUTCDate(Math.min(d.getUTCDate(), last));
  return format(first);
}

/** `January`, from any day in that month. */
export function monthName(iso: string) {
  return MONTH_LONG[parse(iso).getUTCMonth()];
}

/** `25 Oct`. */
function dayMonth(iso: string) {
  const d = parse(iso);
  return `${d.getUTCDate()} ${MONTH_SHORT[d.getUTCMonth()]}`;
}

/** `Sun 25 Oct`, with the year (`Sun 25 Oct 2025`) only when it isn't this year. */
export function formatDay(iso: string, today: string) {
  const d = parse(iso);
  const text = `${DAY_NAMES[d.getUTCDay()]} ${dayMonth(iso)}`;
  return iso.slice(0, 4) === today.slice(0, 4) ? text : `${text} ${iso.slice(0, 4)}`;
}

/** `Sun 25 Oct 2026`: always with the year. */
export function formatDayLong(iso: string) {
  const d = parse(iso);
  return `${DAY_NAMES[d.getUTCDay()]} ${dayMonth(iso)} ${iso.slice(0, 4)}`;
}

/** `25 Oct 2026`: no weekday, always with the year. */
export function formatDayYear(iso: string) {
  return `${dayMonth(iso)} ${iso.slice(0, 4)}`;
}

/**
 * A span of days: `25 Oct`, `1 to 25 Oct`, `28 Sep to 4 Oct`. The year is added when either end isn't
 * this year or when `withYear` is set (`19 to 25 Oct 2026`, `28 Dec 2025 to 3 Jan 2026`).
 */
export function formatSpan(from: string, to: string, today: string, withYear = false) {
  let out: string;
  if (from === to) out = dayMonth(to);
  else if (from.slice(0, 7) === to.slice(0, 7)) out = `${+from.slice(8)} to ${dayMonth(to)}`;
  else out = `${dayMonth(from)} to ${dayMonth(to)}`;
  const thisYear = today.slice(0, 4);
  if (withYear || from.slice(0, 4) !== thisYear || to.slice(0, 4) !== thisYear) {
    if (from.slice(0, 4) !== to.slice(0, 4)) {
      out = `${dayMonth(from)} ${from.slice(0, 4)} to ${dayMonth(to)} ${to.slice(0, 4)}`;
    } else {
      out += ` ${to.slice(0, 4)}`;
    }
  }
  return out;
}
