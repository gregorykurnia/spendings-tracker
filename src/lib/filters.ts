import type { Transaction } from "@/types";
import {
  addDays,
  addMonths,
  formatDayLong,
  formatDayYear,
  formatSpan,
  mondayOf,
  monthEnd,
  monthName,
  monthStart,
} from "./dates";
import { formatRupiah } from "./money";
import { NO_CATEGORY_ID } from "./periods";

/** The part of a saved spend that search and filters read. */
export type FindSpend = Pick<
  Transaction,
  "id" | "date" | "amount" | "store" | "description" | "categoryId" | "source" | "createdAt"
>;

export type DateFilterKind = "all" | "day" | "week" | "month" | "custom";

export type DateFilter = {
  kind: DateFilterKind;
  /** For a day, week or month: any date inside it. */
  anchor: string;
  /** For custom: either end can be left empty. */
  from: string;
  to: string;
  /** A name for a custom span that came from another screen, such as `October so far`. */
  label: string;
};

export type SourceFilter = "any" | "ocr" | "manual";
export type SortOrder = "date-desc" | "date-asc" | "amount-desc" | "amount-asc";

export const SORT_ORDERS: { value: SortOrder; label: string }[] = [
  { value: "date-desc", label: "Newest first" },
  { value: "date-asc", label: "Oldest first" },
  { value: "amount-desc", label: "Highest amount" },
  { value: "amount-asc", label: "Lowest amount" },
];

export type FindFilters = {
  /** Search words: not counted as a filter. */
  query: string;
  date: DateFilter;
  /** Category ids; `NO_CATEGORY_ID` stands for spends whose category was removed. */
  categoryIds: string[];
  min: number | null;
  max: number | null;
  source: SourceFilter;
  sort: SortOrder;
};

export function blankFilters(today: string): FindFilters {
  return {
    query: "",
    date: { kind: "all", anchor: today, from: "", to: "", label: "" },
    categoryIds: [],
    min: null,
    max: null,
    source: "any",
    sort: "date-desc",
  };
}

/** The words of a search: split on spaces, capitals ignored. */
export function searchWords(query: string) {
  return query.trim().toLowerCase().split(/\s+/).filter(Boolean);
}

/**
 * The parts of `text` to highlight, as `[start, end)` pairs in order, overlaps merged. Capitals are
 * ignored. The text is lowered one character at a time so the positions still fit the original.
 */
export function matchRanges(text: string, words: readonly string[]): [number, number][] {
  const hay = lowerKeepingLength(text);
  const ranges: [number, number][] = [];
  for (const raw of words) {
    const word = raw.toLowerCase();
    if (!word) continue;
    for (let i = hay.indexOf(word); i >= 0; i = hay.indexOf(word, i + 1)) ranges.push([i, i + word.length]);
  }
  ranges.sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  const merged: [number, number][] = [];
  for (const r of ranges) {
    const last = merged[merged.length - 1];
    if (last && r[0] <= last[1]) last[1] = Math.max(last[1], r[1]);
    else merged.push([r[0], r[1]]);
  }
  return merged;
}

function lowerKeepingLength(text: string) {
  let out = "";
  for (const ch of text) {
    const lower = ch.toLowerCase();
    // A few characters grow when lowered (`İ`); keep the original so positions stay aligned.
    out += lower.length === ch.length ? lower : ch;
  }
  return out;
}

/** The days a date filter covers, or `null` for all time. Either end of a custom span may be empty. */
export function dateFilterRange(d: DateFilter): { from: string; to: string } | null {
  switch (d.kind) {
    case "day":
      return { from: d.anchor, to: d.anchor };
    case "week": {
      const from = mondayOf(d.anchor);
      return { from, to: addDays(from, 6) };
    }
    case "month":
      return { from: monthStart(d.anchor), to: monthEnd(d.anchor) };
    case "custom":
      return { from: d.from, to: d.to };
    default:
      return null;
  }
}

/** The date after stepping a day, week or month filter earlier (`-1`) or later (`+1`). */
export function stepDateFilter(d: DateFilter, dir: -1 | 1): string {
  if (d.kind === "day") return addDays(d.anchor, dir);
  if (d.kind === "week") return addDays(d.anchor, 7 * dir);
  return addMonths(d.anchor, dir);
}

function matchesSearch(t: FindSpend, words: readonly string[]) {
  if (!words.length) return true;
  const hay = `${t.store} ${t.description}`.toLowerCase();
  return words.every((w) => hay.includes(w));
}

/** The saved spends that pass the search and every filter, in the chosen order. */
export function applyFilters<T extends FindSpend>(
  spends: readonly T[],
  filters: FindFilters,
  categoryIds: ReadonlySet<string>
): T[] {
  const words = searchWords(filters.query);
  const range = dateFilterRange(filters.date);
  const wanted = new Set(filters.categoryIds);
  const list = spends.filter((t) => {
    if (!matchesSearch(t, words)) return false;
    if (range) {
      if (range.from && t.date < range.from) return false;
      if (range.to && t.date > range.to) return false;
    }
    if (wanted.size) {
      const id = categoryIds.has(t.categoryId) ? t.categoryId : NO_CATEGORY_ID;
      if (!wanted.has(id)) return false;
    }
    const amount = t.amount ?? 0;
    if (filters.min != null && amount < filters.min) return false;
    if (filters.max != null && amount > filters.max) return false;
    if (filters.source !== "any" && t.source !== filters.source) return false;
    return true;
  });
  return sortSpends(list, filters.sort);
}

function newestFirst(a: FindSpend, b: FindSpend) {
  if (a.date !== b.date) return a.date < b.date ? 1 : -1;
  if (a.createdAt !== b.createdAt) return a.createdAt < b.createdAt ? 1 : -1;
  return a.id < b.id ? 1 : a.id > b.id ? -1 : 0;
}

/** The four orders. Equal amounts fall back to newest first; oldest first is newest first reversed. */
export function sortSpends<T extends FindSpend>(spends: readonly T[], order: SortOrder): T[] {
  const list = [...spends];
  switch (order) {
    case "date-asc":
      return list.sort((a, b) => newestFirst(b, a));
    case "amount-desc":
      return list.sort((a, b) => (b.amount ?? 0) - (a.amount ?? 0) || newestFirst(a, b));
    case "amount-asc":
      return list.sort((a, b) => (a.amount ?? 0) - (b.amount ?? 0) || newestFirst(a, b));
    default:
      return list.sort(newestFirst);
  }
}

export type ActiveFilter = { key: "date" | "category" | "amount" | "source"; label: string };

function dateFilterLabel(d: DateFilter, today: string) {
  const r = dateFilterRange(d);
  if (!r) return "";
  if (d.kind === "day") return formatDayLong(d.anchor);
  if (d.kind === "week") return formatSpan(r.from, r.to, today, true);
  if (d.kind === "month") return `${monthName(r.from)} ${r.from.slice(0, 4)}`;
  if (d.label) return d.label;
  if (r.from && r.to) return formatSpan(r.from, r.to, today, true);
  if (r.from) return `From ${formatDayYear(r.from)}`;
  if (r.to) return `Until ${formatDayYear(r.to)}`;
  return "";
}

/**
 * The filters that are on, one chip each, in a fixed order. The search box is not a filter.
 * `categoryName` gives the name for an id (`No category` for `NO_CATEGORY_ID`).
 */
export function activeFilters(
  f: FindFilters,
  today: string,
  categoryName: (id: string) => string
): ActiveFilter[] {
  const out: ActiveFilter[] = [];
  const date = f.date.kind === "all" ? "" : dateFilterLabel(f.date, today);
  if (date) out.push({ key: "date", label: date });
  if (f.categoryIds.length) {
    const names = f.categoryIds.map(categoryName);
    out.push({ key: "category", label: names.length < 3 ? names.join(", ") : `${names.length} categories` });
  }
  if (f.min != null || f.max != null) {
    const label =
      f.min != null && f.max != null
        ? `${formatRupiah(f.min)} to ${formatRupiah(f.max)}`
        : f.min != null
          ? `${formatRupiah(f.min)} or more`
          : `Up to ${formatRupiah(f.max as number)}`;
    out.push({ key: "amount", label });
  }
  if (f.source !== "any") out.push({ key: "source", label: f.source === "ocr" ? "Screenshot" : "Typed in" });
  return out;
}

/** Removes one filter (the search words stay). */
export function removeFilter(f: FindFilters, key: ActiveFilter["key"]): FindFilters {
  switch (key) {
    case "date":
      return { ...f, date: { ...f.date, kind: "all", from: "", to: "", label: "" } };
    case "category":
      return { ...f, categoryIds: [] };
    case "amount":
      return { ...f, min: null, max: null };
    default:
      return { ...f, source: "any" };
  }
}

/** Removes every filter and clears the search; the order stays. */
export function clearSearchAndFilters(f: FindFilters, today: string): FindFilters {
  return { ...blankFilters(today), sort: f.sort };
}

/** The line under "No spends match.": what was asked, or `null` when nothing was. */
export function noResultsLine(f: FindFilters, filterCount: number) {
  const parts: string[] = [];
  if (searchWords(f.query).length) parts.push(`“${f.query.trim()}”`);
  if (filterCount) parts.push(`${filterCount} ${filterCount === 1 ? "filter" : "filters"} on`);
  return parts.length ? `Nothing for ${parts.join(" with ")}.` : null;
}
