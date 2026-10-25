import { describe, expect, it } from "vitest";
import type { Transaction } from "@/types";
import {
  activeFilters,
  applyFilters,
  blankFilters,
  clearSearchAndFilters,
  dateFilterRange,
  matchRanges,
  noResultsLine,
  removeFilter,
  searchWords,
  sortSpends,
  stepDateFilter,
  type FindFilters,
} from "./filters";
import { NO_CATEGORY_ID } from "./periods";

const TODAY = "2026-10-25";
const ids = new Set(["food", "groceries", "transport"]);
const names: Record<string, string> = { food: "Food & Drink", groceries: "Groceries", transport: "Transport", [NO_CATEGORY_ID]: "No category" };
const nameOf = (id: string) => names[id] ?? id;

function t(id: string, over: Partial<Transaction> = {}): Transaction {
  return {
    id,
    amount: 10_000,
    store: "STORE",
    description: "",
    categoryId: "food",
    date: "2026-10-10",
    source: "ocr",
    status: "confirmed",
    createdAt: "2026-10-10T08:00:00.000Z",
    ...over,
  };
}

function filters(over: Partial<FindFilters> = {}): FindFilters {
  return { ...blankFilters(TODAY), ...over };
}

const list = [
  t("1", { store: "INDOMARET 1234", description: "Water and bread", categoryId: "groceries", amount: 25_000, date: "2026-10-12" }),
  t("2", { store: "KOPI KENANGAN SCBD", description: "Coffee", amount: 28_000, date: "2026-10-25" }),
  t("3", { store: "GRAB* A-7XK2", categoryId: "transport", amount: 48_250_000, date: "2025-12-30", source: "manual" }),
  t("4", { store: "Warung dekat kantor", description: "Lunch, cash", amount: 40_000, date: "2026-09-20", source: "manual", categoryId: "removed" }),
];
const idsOf = (xs: { id: string }[]) => xs.map((x) => x.id);

describe("search", () => {
  it("matches the store or the note, capitals ignored", () => {
    expect(idsOf(applyFilters(list, filters({ query: "kopi" }), ids))).toEqual(["2"]);
    expect(idsOf(applyFilters(list, filters({ query: "WATER" }), ids))).toEqual(["1"]);
  });
  it("needs every word, in any order, across store and note", () => {
    expect(idsOf(applyFilters(list, filters({ query: "bread indomaret" }), ids))).toEqual(["1"]);
    expect(idsOf(applyFilters(list, filters({ query: "indomaret coffee" }), ids))).toEqual([]);
  });
  it("ignores extra spaces and finds nothing in categories or amounts", () => {
    expect(searchWords("  Kopi   kenangan ")).toEqual(["kopi", "kenangan"]);
    expect(idsOf(applyFilters(list, filters({ query: "groceries" }), ids))).toEqual([]);
    expect(idsOf(applyFilters(list, filters({ query: "28000" }), ids))).toEqual([]);
    expect(applyFilters(list, filters({ query: "   " }), ids)).toHaveLength(4);
  });
  it("treats special characters as plain text", () => {
    expect(idsOf(applyFilters(list, filters({ query: "grab*" }), ids))).toEqual(["3"]);
    expect(idsOf(applyFilters(list, filters({ query: "(" }), ids))).toEqual([]);
  });
});

describe("matchRanges", () => {
  it("gives the matching stretches, capitals ignored", () => {
    expect(matchRanges("Kopi Kenangan", ["kopi"])).toEqual([[0, 4]]);
    expect(matchRanges("Kopi kopi", ["kopi"])).toEqual([[0, 4], [5, 9]]);
  });
  it("merges overlapping and touching matches from different words", () => {
    expect(matchRanges("abcdef", ["abc", "cde"])).toEqual([[0, 5]]);
    expect(matchRanges("abcdef", ["ab", "cd"])).toEqual([[0, 4]]);
  });
  it("finds nothing for no words or no match", () => {
    expect(matchRanges("Kopi", [])).toEqual([]);
    expect(matchRanges("Kopi", ["tea"])).toEqual([]);
    expect(matchRanges("Kopi Kenangan", ["KOPI"])).toEqual([[0, 4]]);
  });
  it("keeps the positions right in text that changes length when lowered", () => {
    expect(matchRanges("İstanbul kopi", ["kopi"])).toEqual([[9, 13]]);
  });
});

describe("date filter", () => {
  it("covers all time, a day, a week from Monday, a month and a custom span", () => {
    const base = blankFilters(TODAY).date;
    expect(dateFilterRange(base)).toBeNull();
    expect(dateFilterRange({ ...base, kind: "day", anchor: "2026-10-12" })).toEqual({ from: "2026-10-12", to: "2026-10-12" });
    expect(dateFilterRange({ ...base, kind: "week", anchor: "2026-10-25" })).toEqual({ from: "2026-10-19", to: "2026-10-25" });
    expect(dateFilterRange({ ...base, kind: "month", anchor: "2026-02-10" })).toEqual({ from: "2026-02-01", to: "2026-02-28" });
    expect(dateFilterRange({ ...base, kind: "custom", from: "2026-09-01", to: "" })).toEqual({ from: "2026-09-01", to: "" });
  });
  it("includes both ends of the span", () => {
    const f = filters({ date: { ...blankFilters(TODAY).date, kind: "custom", from: "2026-10-12", to: "2026-10-25" } });
    expect(idsOf(applyFilters(list, f, ids))).toEqual(["2", "1"]);
  });
  it("lets either end of a custom span stay open", () => {
    const d = blankFilters(TODAY).date;
    expect(idsOf(applyFilters(list, filters({ date: { ...d, kind: "custom", from: "2026-10-01" } }), ids))).toEqual(["2", "1"]);
    expect(idsOf(applyFilters(list, filters({ date: { ...d, kind: "custom", to: "2026-09-30" } }), ids))).toEqual(["4", "3"]);
  });
  it("steps a day, week or month earlier and later, keeping the day of a month where it can", () => {
    const d = blankFilters(TODAY).date;
    expect(stepDateFilter({ ...d, kind: "day", anchor: "2026-10-01" }, -1)).toBe("2026-09-30");
    expect(stepDateFilter({ ...d, kind: "week", anchor: "2026-10-25" }, -1)).toBe("2026-10-18");
    expect(stepDateFilter({ ...d, kind: "month", anchor: "2026-03-31" }, -1)).toBe("2026-02-28");
  });
});

describe("category, amount and source filters", () => {
  it("matches several categories", () => {
    expect(idsOf(applyFilters(list, filters({ categoryIds: ["groceries", "transport"] }), ids))).toEqual(["1", "3"]);
  });
  it("finds spends whose category was removed under No category", () => {
    expect(idsOf(applyFilters(list, filters({ categoryIds: [NO_CATEGORY_ID] }), ids))).toEqual(["4"]);
    expect(idsOf(applyFilters(list, filters({ categoryIds: ["food", NO_CATEGORY_ID] }), ids))).toEqual(["2", "4"]);
  });
  it("includes the limits of an amount range, and an open end", () => {
    expect(idsOf(applyFilters(list, filters({ min: 25_000, max: 40_000 }), ids))).toEqual(["2", "1", "4"]);
    expect(idsOf(applyFilters(list, filters({ min: 40_000 }), ids))).toEqual(["4", "3"]);
    expect(idsOf(applyFilters(list, filters({ max: 25_000 }), ids))).toEqual(["1"]);
  });
  it("filters by source", () => {
    expect(idsOf(applyFilters(list, filters({ source: "manual" }), ids))).toEqual(["4", "3"]);
    expect(idsOf(applyFilters(list, filters({ source: "ocr" }), ids))).toEqual(["2", "1"]);
  });
  it("combines everything", () => {
    expect(idsOf(applyFilters(list, filters({ query: "o", source: "ocr", min: 26_000 }), ids))).toEqual(["2"]);
  });
});

describe("the four orders", () => {
  const a = t("a", { date: "2026-10-05", amount: 50, createdAt: "2026-10-05T08:00:00.000Z" });
  const b = t("b", { date: "2026-10-05", amount: 50, createdAt: "2026-10-05T09:00:00.000Z" });
  const c = t("c", { date: "2026-10-07", amount: 10 });
  const d = t("d", { date: "2026-10-01", amount: 900 });
  const all = [a, b, c, d];
  it("newest first, a later entry first on the same day", () => {
    expect(idsOf(sortSpends(all, "date-desc"))).toEqual(["c", "b", "a", "d"]);
  });
  it("oldest first is the reverse", () => {
    expect(idsOf(sortSpends(all, "date-asc"))).toEqual(["d", "a", "b", "c"]);
  });
  it("highest amount first, ties newest first", () => {
    expect(idsOf(sortSpends(all, "amount-desc"))).toEqual(["d", "b", "a", "c"]);
  });
  it("lowest amount first, ties newest first", () => {
    expect(idsOf(sortSpends(all, "amount-asc"))).toEqual(["c", "b", "a", "d"]);
  });
  it("applies the chosen order to the filtered list and leaves the input alone", () => {
    const before = idsOf(list);
    expect(idsOf(applyFilters(list, filters({ sort: "amount-desc" }), ids))).toEqual(["3", "4", "2", "1"]);
    expect(idsOf(list)).toEqual(before);
  });
});

describe("activeFilters", () => {
  it("has no chips for the search words or the order", () => {
    expect(activeFilters(filters({ query: "kopi", sort: "amount-asc" }), TODAY, nameOf)).toEqual([]);
  });
  it("makes one chip per filter, in a fixed order", () => {
    const f = filters({
      categoryIds: ["food"],
      min: 50_000,
      source: "manual",
      date: { kind: "custom", anchor: TODAY, from: "2026-10-01", to: "2026-10-25", label: "October so far" },
    });
    expect(activeFilters(f, TODAY, nameOf)).toEqual([
      { key: "date", label: "October so far" },
      { key: "category", label: "Food & Drink" },
      { key: "amount", label: "Rp 50.000 or more" },
      { key: "source", label: "Typed in" },
    ]);
  });
  it("words each kind of date", () => {
    const d = blankFilters(TODAY).date;
    const label = (date: FindFilters["date"]) => activeFilters(filters({ date }), TODAY, nameOf)[0]?.label;
    expect(label({ ...d, kind: "day", anchor: TODAY })).toBe("Sun 25 Oct 2026");
    expect(label({ ...d, kind: "week", anchor: TODAY })).toBe("19 to 25 Oct 2026");
    expect(label({ ...d, kind: "month", anchor: "2026-09-15" })).toBe("September 2026");
    expect(label({ ...d, kind: "custom", from: "2026-09-01", to: "2026-09-25" })).toBe("1 to 25 Sep 2026");
    expect(label({ ...d, kind: "custom", from: "2026-09-01" })).toBe("From 1 Sep 2026");
    expect(label({ ...d, kind: "custom", to: "2026-09-25" })).toBe("Until 25 Sep 2026");
    expect(label({ ...d, kind: "custom" })).toBeUndefined();
  });
  it("words categories and amounts", () => {
    const label = (f: Partial<FindFilters>) => activeFilters(filters(f), TODAY, nameOf)[0].label;
    expect(label({ categoryIds: ["food", NO_CATEGORY_ID] })).toBe("Food & Drink, No category");
    expect(label({ categoryIds: ["food", "groceries", "transport"] })).toBe("3 categories");
    expect(label({ max: 20_000 })).toBe("Up to Rp 20.000");
    expect(label({ min: 1_000, max: 20_000 })).toBe("Rp 1.000 to Rp 20.000");
  });
  it("removes one filter or all of them, keeping the order when clearing", () => {
    const f = filters({ query: "kopi", categoryIds: ["food"], min: 1, source: "ocr", sort: "amount-desc" });
    expect(removeFilter(f, "category").categoryIds).toEqual([]);
    expect(removeFilter(f, "amount")).toMatchObject({ min: null, max: null });
    expect(removeFilter(f, "source").source).toBe("any");
    expect(removeFilter(f, "category").query).toBe("kopi");
    expect(clearSearchAndFilters(f, TODAY)).toEqual({ ...blankFilters(TODAY), sort: "amount-desc" });
  });
});

describe("noResultsLine", () => {
  it("says what was asked", () => {
    expect(noResultsLine(filters({ query: " zzz " }), 1)).toBe("Nothing for “zzz” with 1 filter on.");
    expect(noResultsLine(filters(), 2)).toBe("Nothing for 2 filters on.");
    expect(noResultsLine(filters({ query: "zzz" }), 0)).toBe("Nothing for “zzz”.");
    expect(noResultsLine(filters(), 0)).toBeNull();
  });
});
