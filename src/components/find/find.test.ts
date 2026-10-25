import { describe, expect, it } from "vitest";
import { applyFilters, blankFilters } from "@/lib/filters";
import { categoryHref } from "@/components/spending/spending";
import { makePeriod, NO_CATEGORY_ID } from "@/lib/periods";
import type { Category } from "@/types";
import {
  categoryChoices,
  filtersFromParams,
  firstUseGo,
  paramsKey,
  parseAmountFilter,
  rangeProblem,
  readParams,
  showLabel,
  switchDateKind,
} from "./find";

const TODAY = "2026-10-21";

const categories: Category[] = [
  { id: "food", name: "Food & Drink", emoji: "🍽️", color: "apricot", order: 0 },
  { id: "transport", name: "Transport", emoji: "🚗", color: "sky", order: 1 },
];

describe("arriving from Spending", () => {
  it("reads what categoryHref sends into a category, a named span and nothing else", () => {
    const href = categoryHref("transport", makePeriod("month", TODAY, TODAY), "October so far");
    const query = new URL(href, "http://x").searchParams;
    const f = filtersFromParams(readParams((n) => query.get(n)), TODAY);
    expect(f.categoryIds).toEqual(["transport"]);
    expect(f.date).toEqual({ kind: "custom", anchor: TODAY, from: "2026-10-01", to: TODAY, label: "October so far" });
    expect(f.query).toBe("");
    expect(f.source).toBe("any");
    expect(f.sort).toBe("date-desc");
  });

  it("starts clean with no parameters, and for a spend with no category keeps the none id", () => {
    expect(filtersFromParams(readParams(() => null), TODAY)).toEqual(blankFilters(TODAY));
    const f = filtersFromParams(readParams((n) => (n === "cat" ? NO_CATEGORY_ID : null)), TODAY);
    expect(f.categoryIds).toEqual([NO_CATEGORY_ID]);
  });

  it("ignores a date that isn't one, and keeps a one-sided span", () => {
    const bad = filtersFromParams({ cat: "", from: "soon", to: "2026-10-05", label: "", q: "" }, TODAY);
    expect(bad.date).toMatchObject({ kind: "custom", from: "", to: "2026-10-05" });
    const none = filtersFromParams({ cat: "", from: "x", to: "y", label: "", q: "" }, TODAY);
    expect(none.date.kind).toBe("all");
  });

  it("gives a different key to a different arrival", () => {
    const a = paramsKey(readParams(() => null));
    const b = paramsKey({ cat: "food", from: "", to: "", label: "", q: "" });
    expect(a).not.toBe(b);
    expect(paramsKey({ cat: "food", from: "", to: "", label: "", q: "" })).toBe(b);
  });

  it("finds the spends of that category inside the span, and only those", () => {
    const f = filtersFromParams({ cat: "transport", from: "2026-10-01", to: "2026-10-21", label: "", q: "" }, TODAY);
    const spend = (id: string, date: string, categoryId: string) => ({
      id,
      date,
      amount: 1000,
      store: id,
      description: "",
      categoryId,
      source: "manual" as const,
      createdAt: "",
    });
    const list = [
      spend("in", "2026-10-10", "transport"),
      spend("early", "2026-09-30", "transport"),
      spend("late", "2026-10-22", "transport"),
      spend("other", "2026-10-10", "food"),
    ];
    expect(applyFilters(list, f, new Set(["food", "transport"])).map((s) => s.id)).toEqual(["in"]);
  });
});

describe("category choices", () => {
  it("lists the owner's order and adds No category only when it applies", () => {
    expect(categoryChoices(categories, [{ categoryId: "food" }], []).map((c) => c.name)).toEqual(["Food & Drink", "Transport"]);
    const withMissing = categoryChoices(categories, [{ categoryId: "gone" }], []);
    expect(withMissing.map((c) => c.id)).toEqual(["food", "transport", NO_CATEGORY_ID]);
    expect(withMissing[2]).toMatchObject({ name: "No category", emoji: "❔" });
  });

  it("keeps No category while it is chosen, even after the last such spend is fixed", () => {
    expect(categoryChoices(categories, [], [NO_CATEGORY_ID]).map((c) => c.id)).toContain(NO_CATEGORY_ID);
  });
});

describe("the filters sheet", () => {
  it("says what you'll see on the main button", () => {
    expect(showLabel(23)).toBe("Show 23 spends");
    expect(showLabel(1)).toBe("Show 1 spend");
    expect(showLabel(0)).toBe("No spends match");
  });

  it("starts a custom span from the days the old kind covered, and drops them for all time", () => {
    const week = { kind: "week" as const, anchor: TODAY, from: "", to: "", label: "" };
    expect(switchDateKind(week, "custom", { from: "2026-10-19", to: "2026-10-25" })).toMatchObject({
      kind: "custom",
      from: "2026-10-19",
      to: "2026-10-25",
    });
    const custom = { kind: "custom" as const, anchor: TODAY, from: "2026-10-01", to: TODAY, label: "October so far" };
    expect(switchDateKind(custom, "all", null)).toMatchObject({ kind: "all", from: "", to: "", label: "" });
    expect(switchDateKind(custom, "custom", null)).toBe(custom);
    expect(switchDateKind(custom, "month", null)).toMatchObject({ kind: "month", anchor: TODAY });
  });

  it("reads typed amounts as whole rupiah, dots and zeros ignored, at most twelve digits", () => {
    expect(parseAmountFilter("1.250.000")).toBe(1_250_000);
    expect(parseAmountFilter("0050")).toBe(50);
    expect(parseAmountFilter("")).toBeNull();
    expect(parseAmountFilter("abc")).toBeNull();
    expect(parseAmountFilter("1234567890123456")).toBe(123_456_789_012);
  });

  it("names a span that ends before it starts and an amount range that is upside down", () => {
    const f = blankFilters(TODAY);
    expect(rangeProblem(f)).toEqual({ dates: "", amount: "" });
    const bad = { ...f, date: { ...f.date, kind: "custom" as const, from: "2026-10-05", to: "2026-10-01" }, min: 500, max: 100 };
    expect(rangeProblem(bad)).toEqual({ dates: "The end is before the start.", amount: "The most is below the least." });
    const open = { ...f, date: { ...f.date, kind: "custom" as const, from: "2026-10-05", to: "" }, min: 100, max: null };
    expect(rangeProblem(open)).toEqual({ dates: "", amount: "" });
  });
});

describe("first use", () => {
  it("points at the waiting lines first when there are some", () => {
    expect(firstUseGo(2)).toBe("Go and check them");
    expect(firstUseGo(0)).toBe("Add screenshots");
  });
});
