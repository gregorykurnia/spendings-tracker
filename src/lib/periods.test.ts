import { describe, expect, it } from "vitest";
import {
  barHeight,
  biggestSpends,
  canStepLater,
  compare,
  daySeries,
  heroLabel,
  lastPickableDay,
  makePeriod,
  navLabel,
  NO_CATEGORY_ID,
  previousPeriod,
  shareLabel,
  shownDayIndex,
  spanLabel,
  splitByCategory,
  spendsInPeriod,
  stepAnchor,
  summarise,
  sumRange,
  switchMode,
  type Spend,
} from "./periods";

const TODAY = "2026-10-25"; // a Sunday

function spend(id: string, date: string, amount: number | null, categoryId = "food"): Spend {
  return { id, date, amount, categoryId };
}

describe("makePeriod", () => {
  it("runs a week from Monday to Sunday", () => {
    const p = makePeriod("week", "2026-10-22", "2026-10-22");
    expect([p.from, p.to]).toEqual(["2026-10-19", "2026-10-25"]);
    expect(p).toMatchObject({ end: "2026-10-22", running: true, current: true });
  });
  it("isn't running on its last day, so the whole period is counted", () => {
    const p = makePeriod("week", TODAY, TODAY);
    expect(p).toMatchObject({ end: "2026-10-25", running: false, current: true });
    const m = makePeriod("month", "2026-10-31", "2026-10-31");
    expect(m).toMatchObject({ end: "2026-10-31", running: false, current: true });
  });
  it("runs a month from the 1st", () => {
    const p = makePeriod("month", TODAY, TODAY);
    expect([p.from, p.to, p.end]).toEqual(["2026-10-01", "2026-10-31", "2026-10-25"]);
    expect(p.running).toBe(true);
  });
  it("counts a past period whole and a first day as running", () => {
    expect(makePeriod("month", "2026-09-15", TODAY)).toMatchObject({ from: "2026-09-01", end: "2026-09-30", running: false, current: false });
    expect(makePeriod("month", "2026-10-01", "2026-10-01")).toMatchObject({ end: "2026-10-01", running: true });
  });
  it("handles February in a leap year and new year", () => {
    expect(makePeriod("month", "2028-02-10", TODAY).to).toBe("2028-02-29");
    const w = makePeriod("week", "2026-01-01", TODAY);
    expect([w.from, w.to]).toEqual(["2025-12-29", "2026-01-04"]);
  });
});

describe("previousPeriod", () => {
  it("compares a running month with the same number of days of the last one", () => {
    const prev = previousPeriod(makePeriod("month", TODAY, TODAY));
    expect([prev.from, prev.to, prev.end]).toEqual(["2026-09-01", "2026-09-30", "2026-09-25"]);
  });
  it("compares a running week with the same weekdays of the last one", () => {
    const prev = previousPeriod(makePeriod("week", "2026-10-21", "2026-10-21")); // Wednesday
    expect([prev.from, prev.to, prev.end]).toEqual(["2026-10-12", "2026-10-18", "2026-10-14"]);
  });
  it("stops at the end of a shorter month", () => {
    const prev = previousPeriod(makePeriod("month", "2026-03-30", "2026-03-30"));
    expect([prev.from, prev.to, prev.end]).toEqual(["2026-02-01", "2026-02-28", "2026-02-28"]);
  });
  it("takes the whole period before a finished one", () => {
    const prev = previousPeriod(makePeriod("month", "2026-09-15", TODAY));
    expect([prev.from, prev.end]).toEqual(["2026-08-01", "2026-08-31"]);
    const prevWeek = previousPeriod(makePeriod("week", TODAY, TODAY));
    expect([prevWeek.from, prevWeek.end]).toEqual(["2026-10-12", "2026-10-18"]);
  });
  it("crosses new year", () => {
    const prev = previousPeriod(makePeriod("month", "2026-01-10", "2026-01-10"));
    expect([prev.from, prev.end]).toEqual(["2025-12-01", "2025-12-10"]);
  });
});

describe("stepping and switching", () => {
  it("steps a month earlier and later", () => {
    expect(stepAnchor("month", "2026-10-25", -1, TODAY)).toBe("2026-09-25");
    expect(stepAnchor("month", "2026-08-15", 1, TODAY)).toBe("2026-09-15");
  });
  it("lands on today when stepping into the current period", () => {
    expect(stepAnchor("month", "2026-09-15", 1, TODAY)).toBe(TODAY);
    expect(stepAnchor("week", "2026-10-14", 1, TODAY)).toBe(TODAY);
  });
  it("does nothing for later in the current period", () => {
    expect(stepAnchor("month", TODAY, 1, TODAY)).toBe(TODAY);
    expect(canStepLater(makePeriod("month", TODAY, TODAY), TODAY)).toBe(false);
    expect(canStepLater(makePeriod("month", "2026-09-15", TODAY), TODAY)).toBe(true);
  });
  it("steps a week by seven days, with a month end in between", () => {
    expect(stepAnchor("week", "2026-10-05", -1, TODAY)).toBe("2026-09-28");
  });
  it("keeps the date when switching, or goes to today if the new period holds it", () => {
    expect(switchMode("week", "2026-10-25", TODAY)).toBe(TODAY);
    expect(switchMode("month", "2026-09-15", TODAY)).toBe("2026-09-15");
    expect(switchMode("week", "2026-09-30", TODAY)).toBe("2026-09-30");
  });
});

describe("labels", () => {
  const week = makePeriod("week", TODAY, "2026-10-21"); // running (today is Wednesday)
  const month = makePeriod("month", TODAY, TODAY);
  it("names a running period so far, and a finished one by its name", () => {
    expect(heroLabel(week, "2026-10-21")).toBe("This week so far");
    expect(heroLabel(makePeriod("week", TODAY, TODAY), TODAY)).toBe("This week");
    expect(heroLabel(month, TODAY)).toBe("October so far");
    expect(heroLabel(makePeriod("month", "2026-09-15", TODAY), TODAY)).toBe("September");
    expect(heroLabel(makePeriod("week", "2026-09-02", TODAY), TODAY)).toBe("31 Aug to 6 Sep");
  });
  it("adds the year to a month in another year", () => {
    expect(heroLabel(makePeriod("month", "2025-12-05", TODAY), TODAY)).toBe("December 2025");
  });
  it("names the period between the step buttons with its year", () => {
    expect(navLabel(makePeriod("week", TODAY, TODAY), TODAY)).toBe("19 to 25 Oct 2026");
    expect(navLabel(month, TODAY)).toBe("October 2026");
  });
  it("names a span inside a sentence", () => {
    expect(spanLabel(previousPeriod(month), TODAY)).toBe("1 to 25 September");
    expect(spanLabel(makePeriod("month", "2026-09-15", TODAY), TODAY)).toBe("September");
    expect(spanLabel(previousPeriod(week), "2026-10-21")).toBe("12 to 14 Oct");
    expect(spanLabel(makePeriod("month", "2025-09-15", TODAY), TODAY)).toBe("September 2025");
  });
});

describe("compare", () => {
  const prev = previousPeriod(makePeriod("month", TODAY, TODAY));
  it("says how much lower", () => {
    expect(compare(6_842_350, 7_318_000, prev, TODAY)).toEqual({
      kind: "lower",
      line: "Rp 475.650 lower",
      sub: "1 to 25 September was Rp 7.318.000",
      short: "Rp 475.650 lower than 1 to 25 September",
    });
  });
  it("says how much higher, with no sign", () => {
    expect(compare(100, 40, prev, TODAY)).toMatchObject({ kind: "higher", line: "Rp 60 higher" });
  });
  it("says the same", () => {
    expect(compare(500, 500, prev, TODAY)).toMatchObject({ kind: "same", line: "Same as before", short: "Same as 1 to 25 September" });
  });
  it("says there is nothing to compare with, even when this period is empty too", () => {
    expect(compare(900, 0, prev, TODAY)).toEqual({
      kind: "none",
      line: "Nothing to compare with",
      sub: "No spending in 1 to 25 September",
      short: "Nothing in 1 to 25 September to compare with",
    });
    expect(compare(0, 0, prev, TODAY).kind).toBe("none");
  });
  it("handles a ten-digit difference", () => {
    expect(compare(2_000_000_000, 1_000_000_000, prev, TODAY).line).toBe("Rp 1.000.000.000 higher");
  });
});

describe("summarise", () => {
  const spends = [
    spend("a", "2026-10-03", 100_000),
    spend("b", "2026-10-25", 28_000),
    spend("c", "2026-10-26", 999), // after today: never counted in a running month
    spend("d", "2026-09-10", 80_000),
    spend("e", "2026-09-25", 20_000),
    spend("f", "2026-09-26", 500_000), // after the comparable cut-off
  ];
  it("compares a running month like for like", () => {
    const s = summarise(spends, "month", TODAY, TODAY);
    expect(s.total).toBe(128_000);
    expect(s.previousTotal).toBe(100_000);
    expect(s.comparison.line).toBe("Rp 28.000 higher");
  });
  it("sums a finished month whole", () => {
    expect(summarise(spends, "month", "2026-09-15", TODAY).total).toBe(600_000);
  });
  it("counts a null amount as nothing", () => {
    expect(sumRange([spend("x", "2026-10-01", null), spend("y", "2026-10-02", 5)], "2026-10-01", "2026-10-31")).toBe(5);
  });
});

describe("daySeries", () => {
  it("has every day of the whole period, zeros included, and marks days still to come", () => {
    const p = makePeriod("week", "2026-10-21", "2026-10-21");
    const days = daySeries([spend("a", "2026-10-19", 10), spend("b", "2026-10-19", 5), spend("c", "2026-10-21", 7)], p, "2026-10-21");
    expect(days.map((d) => d.amount)).toEqual([15, 0, 7, 0, 0, 0, 0]);
    expect(days.map((d) => d.future)).toEqual([false, false, false, true, true, true, true]);
    expect(days[0].date).toBe("2026-10-19");
  });
  it("covers a month of 31 days", () => {
    expect(daySeries([], makePeriod("month", TODAY, TODAY), TODAY)).toHaveLength(31);
    expect(daySeries([], makePeriod("month", "2026-02-10", TODAY), TODAY)).toHaveLength(28);
  });
});

describe("the day readout", () => {
  const p = makePeriod("week", "2026-10-21", "2026-10-21");
  const days = daySeries([spend("a", "2026-10-19", 5), spend("b", "2026-10-20", 50), spend("c", "2026-10-21", 50)], p, "2026-10-21");
  it("starts on the first biggest day", () => {
    expect(shownDayIndex(days, null)).toBe(1);
  });
  it("shows the picked day, but not one still to come", () => {
    expect(shownDayIndex(days, "2026-10-21")).toBe(2);
    expect(shownDayIndex(days, "2026-10-24")).toBe(1);
  });
  it("starts on the first day when nothing was spent", () => {
    expect(shownDayIndex(daySeries([], p, "2026-10-21"), null)).toBe(0);
  });
  it("finds the last pickable day and has none in a period still to come", () => {
    expect(lastPickableDay(days)).toBe(2);
    const future = daySeries([], makePeriod("week", "2026-11-04", TODAY), TODAY);
    expect(shownDayIndex(future, null)).toBe(-1);
    expect(lastPickableDay(future)).toBe(-1);
  });
  it("sizes bars against the biggest day, never under 4%", () => {
    expect(barHeight(50, 50)).toBe(100);
    expect(barHeight(25, 50)).toBe(50);
    expect(barHeight(1, 48_250_000)).toBe(4);
    expect(barHeight(0, 50)).toBe(0);
    expect(barHeight(0, 0)).toBe(0);
  });
});

describe("splitByCategory", () => {
  const ids = new Set(["food", "groceries", "transport", "fun", "health", "shopping", "edu"]);
  it("lists categories biggest first with their share", () => {
    const split = splitByCategory([spend("a", "2026-10-01", 300, "food"), spend("b", "2026-10-02", 100, "groceries"), spend("c", "2026-10-03", 100, "food")], ids);
    expect(split.total).toBe(500);
    expect(split.rows).toEqual([
      { id: "food", amount: 400, share: 0.8 },
      { id: "groceries", amount: 100, share: 0.2 },
    ]);
    expect(split.rest).toEqual([]);
  });
  it("counts a deleted category as No category, so the total still adds up", () => {
    const split = splitByCategory([spend("a", "2026-10-01", 300, "gone"), spend("b", "2026-10-02", 100, "")], ids);
    expect(split.rows).toEqual([{ id: NO_CATEGORY_ID, amount: 400, share: 1 }]);
  });
  it("shows the top five and keeps the rest behind", () => {
    const list = [...ids].map((id, i) => spend(id, "2026-10-01", (i + 1) * 100, id));
    const split = splitByCategory(list, ids);
    expect(split.top.map((r) => r.id)).toEqual(["edu", "shopping", "health", "fun", "transport"]);
    expect(split.rest.map((r) => r.id)).toEqual(["groceries", "food"]);
    expect(splitByCategory(list, ids, 3).rest).toHaveLength(4);
  });
  it("breaks equal amounts by id so the order never flips", () => {
    const a = splitByCategory([spend("1", "2026-10-01", 5, "groceries"), spend("2", "2026-10-01", 5, "food")], ids);
    const b = splitByCategory([spend("2", "2026-10-01", 5, "food"), spend("1", "2026-10-01", 5, "groceries")], ids);
    expect(a.rows.map((r) => r.id)).toEqual(b.rows.map((r) => r.id));
  });
  it("copes with no spending and with a ten-digit total", () => {
    expect(splitByCategory([], ids)).toEqual({ total: 0, rows: [], top: [], rest: [] });
    expect(splitByCategory([spend("a", "2026-10-01", 1_234_567_890, "food")], ids).total).toBe(1_234_567_890);
  });
  it("words the share, with <1% for a sliver", () => {
    expect(shareLabel(0.8)).toBe("80%");
    expect(shareLabel(0.004)).toBe("<1%");
    expect(shareLabel(0.01)).toBe("1%");
    expect(shareLabel(0.126)).toBe("13%");
  });
});

describe("biggestSpends", () => {
  it("takes the five biggest, the later day first on equal amounts", () => {
    const list = [
      spend("a", "2026-10-01", 10),
      spend("b", "2026-10-05", 90),
      spend("c", "2026-10-03", 90),
      spend("d", "2026-10-02", 30),
      spend("e", "2026-10-04", 20),
      spend("f", "2026-10-06", 5),
    ];
    expect(biggestSpends(list).map((s) => s.id)).toEqual(["b", "c", "d", "e", "a"]);
    expect(biggestSpends(list, 2)).toHaveLength(2);
  });
  it("leaves the input alone", () => {
    const list = [spend("a", "2026-10-01", 1), spend("b", "2026-10-01", 2)];
    biggestSpends(list);
    expect(list.map((s) => s.id)).toEqual(["a", "b"]);
  });
});

describe("spendsInPeriod", () => {
  it("keeps spends up to the day counted so far", () => {
    const p = makePeriod("month", TODAY, TODAY);
    const list = [spend("a", "2026-10-25", 1), spend("b", "2026-10-26", 1), spend("c", "2026-09-30", 1)];
    expect(spendsInPeriod(list, p).map((s) => s.id)).toEqual(["a"]);
  });
});
