import { describe, expect, it } from "vitest";
import { NO_CATEGORY_ID, makePeriod, type Spend } from "@/lib/periods";
import type { Category } from "@/types";
import { categoryHref, categoryLook, emptyWords, readoutFor, spendingView } from "./spending";

const TODAY = "2026-10-21"; // a Wednesday

const categories: Category[] = [
  { id: "food", name: "Food & Drink", emoji: "🍽️", color: "apricot", order: 0 },
  { id: "transport", name: "Transport", emoji: "🚗", color: "sky", order: 1 },
  { id: "shop", name: "Shopping", emoji: "👗", color: "rose", order: 2 },
  { id: "home", name: "Home", emoji: "🏠", color: "lilac", order: 3 },
  { id: "health", name: "Health", emoji: "💊", color: "coral", order: 4 },
  { id: "travel", name: "Travel", emoji: "✈️", color: "cyan", order: 5 },
  { id: "other", name: "Other", emoji: "❓", color: "slate", order: 6 },
];

let n = 0;
const spend = (date: string, amount: number, categoryId = "food"): Spend => ({ id: `s${++n}`, date, amount, categoryId });

const choice = (mode: "week" | "month", anchor = TODAY, extra = {}) => ({
  mode,
  anchor,
  picked: null,
  showAll: false,
  ...extra,
});

describe("spendingView: a running month", () => {
  const spends = [
    spend("2026-10-02", 100_000),
    spend("2026-10-10", 250_000, "transport"),
    spend("2026-10-20", 50_000),
    spend("2026-10-21", 25_000, "shop"),
    spend("2026-10-28", 999_000), // after today: not counted yet
    spend("2026-09-05", 300_000),
    spend("2026-09-21", 200_000),
    spend("2026-09-25", 900_000), // after the 21st: not part of the like-for-like span
  ];
  const view = spendingView(spends, categories, choice("month"), TODAY);

  it("totals the days so far and compares with the same days of the month before", () => {
    expect(view.summary.total).toBe(425_000);
    expect(view.summary.previousTotal).toBe(500_000);
    expect(view.summary.comparison.line).toBe("Rp 75.000 lower");
    expect(view.summary.comparison.sub).toBe("1 to 21 September was Rp 500.000");
    expect(view.label).toBe("October so far");
    expect(view.navLabel).toBe("October 2026");
    expect(view.count).toBe(4);
  });

  it("has a bar for every day, the days to come faint and unpickable", () => {
    expect(view.days).toHaveLength(31);
    expect(view.days.filter((d) => d.future)).toHaveLength(10);
    expect(view.last).toBe(20); // the 21st
    expect(view.days[27].future).toBe(true);
    expect(view.days[27].height).toBe(0);
  });

  it("starts the readout on the biggest day and names it", () => {
    expect(view.shown).toBe(9); // the 10th
    expect(view.biggestDay).toBe(250_000);
    expect(view.chartSummary).toBe("Spending by day. Biggest day Sat 10 Oct, Rp 250.000.");
    expect(view.days[9].height).toBe(100);
    expect(view.days[1].height).toBe(40);
  });

  it("marks a day with no spending as a flat mark", () => {
    expect(view.days[2].quiet).toBe(true);
    expect(view.days[2].height).toBe(0);
    expect(view.days[27].quiet).toBe(false);
  });

  it("puts a day number under every seventh bar", () => {
    expect(view.days.filter((d) => d.axis).map((d) => d.axis)).toEqual(["1", "8", "15", "22", "29"]);
    expect(view.days[0].axisAt).toBeCloseTo(100 / 62, 5);
  });

  it("splits by category, biggest first, with a share each", () => {
    expect(view.categories.shown.map((c) => [c.id, c.amount])).toEqual([
      ["transport", 250_000],
      ["food", 150_000],
      ["shop", 25_000],
    ]);
    expect(view.categories.more).toBe(0);
  });

  it("lists the biggest spends of the days so far", () => {
    expect(view.biggest.map((s) => s.amount)).toEqual([250_000, 100_000, 50_000, 25_000]);
  });

  it("follows the picked day, and falls back to the biggest when it isn't in the period or can't be picked", () => {
    expect(spendingView(spends, categories, choice("month", TODAY, { picked: "2026-10-20" }), TODAY).shown).toBe(19);
    expect(spendingView(spends, categories, choice("month", TODAY, { picked: "2026-10-28" }), TODAY).shown).toBe(9);
    expect(spendingView(spends, categories, choice("month", TODAY, { picked: "2026-09-05" }), TODAY).shown).toBe(9);
  });
});

describe("spendingView: a running week", () => {
  const spends = [spend("2026-10-19", 40_000), spend("2026-10-21", 90_000), spend("2026-10-12", 70_000)];

  it("runs Monday to Sunday with the weekday under each bar", () => {
    const view = spendingView(spends, categories, choice("week"), TODAY);
    expect(view.period).toMatchObject({ from: "2026-10-19", to: "2026-10-25", end: TODAY });
    expect(view.days.map((d) => d.axis)).toEqual(["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]);
    expect(view.days.map((d) => d.future)).toEqual([false, false, false, true, true, true, true]);
    expect(view.label).toBe("This week so far");
    expect(view.navLabel).toBe("19 to 25 Oct 2026");
  });

  it("compares the three days so far with the same three days of the week before", () => {
    const view = spendingView(spends, categories, choice("week"), TODAY);
    expect(view.summary.total).toBe(130_000);
    expect(view.summary.previousTotal).toBe(70_000);
    expect(view.summary.comparison.line).toBe("Rp 60.000 higher");
    expect(view.summary.comparison.sub).toBe("12 to 14 Oct was Rp 70.000");
  });

  it("shows the week before whole, every day pickable", () => {
    const view = spendingView(spends, categories, choice("week", "2026-10-14"), TODAY);
    expect(view.period).toMatchObject({ from: "2026-10-12", end: "2026-10-18", current: false });
    expect(view.last).toBe(6);
    expect(view.summary.total).toBe(70_000);
    expect(view.shown).toBe(0);
  });
});

describe("spendingView: categories", () => {
  const many = [
    spend("2026-10-01", 700, "food"),
    spend("2026-10-02", 600, "transport"),
    spend("2026-10-03", 500, "shop"),
    spend("2026-10-04", 400, "home"),
    spend("2026-10-05", 300, "health"),
    spend("2026-10-06", 200, "travel"),
    spend("2026-10-07", 100, "other"),
  ];

  it("shows the top five and says how many more", () => {
    const view = spendingView(many, categories, choice("month"), TODAY);
    expect(view.categories.shown).toHaveLength(5);
    expect(view.categories.more).toBe(2);
  });

  it("shows all of them when asked", () => {
    const view = spendingView(many, categories, choice("month", TODAY, { showAll: true }), TODAY);
    expect(view.categories.shown).toHaveLength(7);
    expect(view.categories.more).toBe(2);
  });

  it("counts spends whose category was removed under No category, so the total still adds up", () => {
    const view = spendingView([spend("2026-10-01", 900, "gone"), spend("2026-10-02", 100)], categories, choice("month"), TODAY);
    expect(view.categories.shown.map((c) => [c.id, c.amount])).toEqual([
      [NO_CATEGORY_ID, 900],
      ["food", 100],
    ]);
    expect(view.summary.total).toBe(1_000);
  });
});

describe("spendingView: totals and empty periods", () => {
  it("handles a ten-digit total and bars of very different size", () => {
    const view = spendingView(
      [spend("2026-10-02", 1_250_000_000), spend("2026-10-03", 85_000)],
      categories,
      choice("month"),
      TODAY
    );
    expect(view.summary.total).toBe(1_250_085_000);
    expect(view.days[1].height).toBe(100);
    expect(view.days[2].height).toBe(4); // never thinner than 4%
  });

  it("is empty with no spending, and still has a readout on today", () => {
    const view = spendingView([], categories, choice("month"), TODAY);
    expect(view.count).toBe(0);
    expect(view.summary.comparison.kind).toBe("none");
    expect(view.shown).toBe(0);
    expect(view.chartSummary).toBe("Spending by day. Nothing spent yet.");
  });

  it("leaves a whole past period empty with nothing to compare", () => {
    const view = spendingView([spend("2026-10-02", 5)], categories, choice("month", "2026-08-15"), TODAY);
    expect(view.count).toBe(0);
    expect(view.summary.comparison).toMatchObject({ kind: "none", line: "Nothing to compare with" });
  });

  it("ignores the biggest spend after today when naming the biggest day", () => {
    const view = spendingView(
      [spend("2026-10-02", 10_000), spend("2026-10-30", 500_000)],
      categories,
      choice("month"),
      TODAY
    );
    expect(view.biggestDay).toBe(10_000);
    expect(view.count).toBe(1);
  });
});

describe("readoutFor", () => {
  const view = spendingView([spend("2026-10-02", 10_000), spend("2026-10-03", 4_000)], categories, choice("month"), TODAY);
  it("names the date and the amount, tagging the biggest day", () => {
    expect(readoutFor(view.days[1], view.biggestDay, TODAY)).toEqual({
      date: "Fri 2 Oct",
      amount: "Rp 10.000",
      none: false,
      biggest: true,
    });
    expect(readoutFor(view.days[2], view.biggestDay, TODAY).biggest).toBe(false);
  });
  it("says Nothing spent for a day with no spending, never the biggest", () => {
    expect(readoutFor(view.days[5], view.biggestDay, TODAY)).toMatchObject({ amount: "Nothing spent", none: true, biggest: false });
  });
  it("adds the year when the day isn't this year", () => {
    const old = spendingView([spend("2025-12-02", 1)], categories, choice("month", "2025-12-15"), TODAY);
    expect(readoutFor(old.days[1], old.biggestDay, TODAY).date).toBe("Tue 2 Dec 2025");
  });
});

describe("categoryLook and categoryHref", () => {
  it("falls back to No category in the alert of a grey ❔", () => {
    expect(categoryLook("food", categories)).toMatchObject({ id: "food", name: "Food & Drink" });
    expect(categoryLook("gone", categories)).toEqual({ id: NO_CATEGORY_ID, name: "No category", emoji: "❔", color: "slate" });
  });

  it("opens All transactions with the category and the days counted so far", () => {
    const period = makePeriod("month", TODAY, TODAY);
    const href = categoryHref("food", period, "October so far");
    const url = new URL(href, "http://x");
    expect(url.pathname).toBe("/transactions");
    expect(Object.fromEntries(url.searchParams)).toEqual({
      cat: "food",
      from: "2026-10-01",
      to: "2026-10-21",
      label: "October so far",
      back: "spending",
    });
  });

  it("sends spends with a removed category as No category, and a finished period to its last day", () => {
    const period = makePeriod("week", "2026-10-14", TODAY);
    const url = new URL(categoryHref(NO_CATEGORY_ID, period, "12 to 18 Oct"), "http://x");
    expect(url.searchParams.get("cat")).toBe(NO_CATEGORY_ID);
    expect([url.searchParams.get("from"), url.searchParams.get("to")]).toEqual(["2026-10-12", "2026-10-18"]);
  });
});

describe("emptyWords", () => {
  const current = { period: makePeriod("month", TODAY, TODAY), navLabel: "October 2026" };
  const past = { period: makePeriod("month", "2026-07-15", TODAY), navLabel: "July 2026" };

  it("says nothing spent yet in the current period and names a past one", () => {
    expect(emptyWords(current, 0).what).toBe("Nothing spent yet this month.");
    expect(emptyWords({ ...current, period: makePeriod("week", TODAY, TODAY) }, 0).what).toBe("Nothing spent yet this week.");
    expect(emptyWords(past, 0).what).toBe("Nothing spent in July 2026.");
  });

  it("points at waiting lines, which count once accepted", () => {
    expect(emptyWords(past, 0).waiting).toBe("");
    expect(emptyWords(past, 1)).toMatchObject({
      waiting: "1 line is still waiting to be checked. They count once you accept them.",
      go: "Go and check it",
    });
    expect(emptyWords(past, 3)).toMatchObject({
      waiting: "3 lines are still waiting to be checked. They count once you accept them.",
      go: "Go and check them",
    });
  });
});
