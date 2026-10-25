import { describe, expect, it } from "vitest";
import {
  addDays,
  addMonths,
  daysBetween,
  formatDay,
  formatDayLong,
  formatDayYear,
  formatSpan,
  isISODate,
  mondayOf,
  monthEnd,
  monthName,
  monthStart,
  todayISO,
} from "./dates";

const TODAY = "2026-10-25"; // a Sunday

describe("formatDay", () => {
  it("writes the weekday, day and month, without the year this year", () => {
    expect(formatDay("2026-10-25", TODAY)).toBe("Sun 25 Oct");
    expect(formatDay("2026-01-01", TODAY)).toBe("Thu 1 Jan");
  });
  it("adds the year when it isn't this year", () => {
    expect(formatDay("2025-12-31", TODAY)).toBe("Wed 31 Dec 2025");
  });
  it("always has the year in the long forms", () => {
    expect(formatDayLong("2026-10-25")).toBe("Sun 25 Oct 2026");
    expect(formatDayYear("2026-10-25")).toBe("25 Oct 2026");
  });
});

describe("formatSpan", () => {
  it("names a span inside one month with the month once", () => {
    expect(formatSpan("2026-10-12", "2026-10-18", TODAY)).toBe("12 to 18 Oct");
    expect(formatSpan("2026-10-19", "2026-10-25", TODAY, true)).toBe("19 to 25 Oct 2026");
  });
  it("names both months when the span crosses a month end", () => {
    expect(formatSpan("2026-09-28", "2026-10-04", TODAY)).toBe("28 Sep to 4 Oct");
  });
  it("names one day alone", () => {
    expect(formatSpan("2026-10-25", "2026-10-25", TODAY)).toBe("25 Oct");
  });
  it("adds the year when a span is in another year, and both when it crosses new year", () => {
    expect(formatSpan("2025-03-03", "2025-03-09", TODAY)).toBe("3 to 9 Mar 2025");
    expect(formatSpan("2025-12-29", "2026-01-04", TODAY)).toBe("29 Dec 2025 to 4 Jan 2026");
  });
});

describe("calendar arithmetic", () => {
  it("adds days across month, year and leap-day ends", () => {
    expect(addDays("2026-10-31", 1)).toBe("2026-11-01");
    expect(addDays("2026-01-01", -1)).toBe("2025-12-31");
    expect(addDays("2028-02-28", 1)).toBe("2028-02-29");
    expect(addDays("2026-02-28", 1)).toBe("2026-03-01");
  });
  it("counts days between two dates", () => {
    expect(daysBetween("2026-10-01", "2026-10-25")).toBe(24);
    expect(daysBetween("2026-10-25", "2026-10-01")).toBe(-24);
    // across a daylight-saving change in many zones
    expect(daysBetween("2026-03-01", "2026-04-01")).toBe(31);
  });
  it("finds the Monday of a week, with Sunday ending the week", () => {
    expect(mondayOf("2026-10-25")).toBe("2026-10-19");
    expect(mondayOf("2026-10-19")).toBe("2026-10-19");
    expect(mondayOf("2026-10-26")).toBe("2026-10-26");
    expect(mondayOf("2026-01-01")).toBe("2025-12-29");
  });
  it("finds month ends, leap years included", () => {
    expect(monthStart("2026-10-25")).toBe("2026-10-01");
    expect(monthEnd("2026-10-05")).toBe("2026-10-31");
    expect(monthEnd("2026-02-10")).toBe("2026-02-28");
    expect(monthEnd("2028-02-10")).toBe("2028-02-29");
    expect(monthEnd("2026-12-01")).toBe("2026-12-31");
  });
  it("moves by months and keeps the day, or the last day of a shorter month", () => {
    expect(addMonths("2026-10-25", -1)).toBe("2026-09-25");
    expect(addMonths("2026-03-31", -1)).toBe("2026-02-28");
    expect(addMonths("2026-01-31", 1)).toBe("2026-02-28");
    expect(addMonths("2026-01-15", -1)).toBe("2025-12-15");
    expect(addMonths("2026-12-15", 1)).toBe("2027-01-15");
  });
  it("names the month", () => {
    expect(monthName("2026-09-15")).toBe("September");
  });
});

describe("isISODate", () => {
  it("accepts real days only", () => {
    expect(isISODate("2026-02-28")).toBe(true);
    expect(isISODate("2026-02-30")).toBe(false);
    expect(isISODate("2026-2-3")).toBe(false);
    expect(isISODate("")).toBe(false);
    expect(isISODate(null)).toBe(false);
  });
});

describe("todayISO", () => {
  it("uses the local calendar day", () => {
    expect(todayISO(new Date(2026, 9, 25, 23, 59))).toBe("2026-10-25");
    expect(todayISO(new Date(2026, 0, 1, 0, 0))).toBe("2026-01-01");
  });
});
