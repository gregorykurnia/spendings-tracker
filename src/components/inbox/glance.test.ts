import { describe, expect, it } from "vitest";
import { glanceFor } from "./glance";

const spend = (id: string, date: string, amount: number) => ({ id, date, amount, categoryId: "food" });

describe("the glance card", () => {
  const today = "2026-10-25";

  it("totals the month so far and sets it against the same days of the month before", () => {
    const g = glanceFor(
      [
        spend("a", "2026-10-03", 100_000),
        spend("b", "2026-10-25", 28_000),
        spend("c", "2026-10-28", 999_000), // after today: not counted
        spend("d", "2026-09-10", 200_000),
        spend("e", "2026-09-28", 500_000), // after the 25th: not part of the like-for-like span
      ],
      today
    );
    expect(g.label).toBe("October so far");
    expect(g.digits).toBe("128.000");
    expect(g.comparison).toBe("Rp 72.000 lower than 1 to 25 September");
    expect(g.long).toBe(false);
  });

  it("says there is nothing to compare with when the month before had no spending", () => {
    const g = glanceFor([spend("a", "2026-10-03", 50_000)], today);
    expect(g.comparison).toBe("Nothing in 1 to 25 September to compare with");
  });

  it("shows nought for a month with no spending, and shrinks a ten-digit total", () => {
    expect(glanceFor([], today).digits).toBe("0");
    expect(glanceFor([spend("a", "2026-10-03", 1_250_000_000)], today).long).toBe(true);
  });
});
