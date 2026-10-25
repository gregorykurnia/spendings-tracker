// @vitest-environment jsdom
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { ToastProvider } from "@/components/ui/toast";
import { makePeriod, NO_CATEGORY_ID, type Spend } from "@/lib/periods";
import type { Category, Transaction } from "@/types";
import { BiggestSpends } from "./biggest-spends";
import { CategoryLines } from "./category-lines";
import { DayChart } from "./day-chart";
import { Hero } from "./hero";
import { spendingView } from "./spending";

vi.mock("@/hooks/useOnline", () => ({ useOnline: () => true }));
vi.mock("next/link", () => ({
  default: ({ href, children, ...rest }: { href: string; children: ReactNode }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

afterEach(cleanup);

const TODAY = "2026-10-21"; // a Wednesday

const categories: Category[] = [
  { id: "food", name: "Food & Drink", emoji: "🍽️", color: "apricot", order: 0 },
  { id: "transport", name: "Transport", emoji: "🚗", color: "sky", order: 1 },
];

const spends: Spend[] = [
  { id: "a", date: "2026-10-19", amount: 40_000, categoryId: "food" },
  { id: "b", date: "2026-10-21", amount: 90_000, categoryId: "transport" },
];

const weekView = () =>
  spendingView(spends, categories, { mode: "week", anchor: TODAY, picked: null, showAll: false }, TODAY);

function chart(onPick = vi.fn(), picked: string | null = null) {
  const view = spendingView(spends, categories, { mode: "week", anchor: TODAY, picked, showAll: false }, TODAY);
  render(
    <ToastProvider>
      <DayChart
        days={view.days}
        mode="week"
        shown={view.shown}
        last={view.last}
        biggestDay={view.biggestDay}
        today={TODAY}
        summary={view.chartSummary}
        onPick={onPick}
      />
    </ToastProvider>
  );
  return { onPick, view };
}

const readout = () => screen.getByTestId("day-readout").textContent;

describe("the day chart", () => {
  it("starts on the biggest day, tagged, with a text alternative naming it", () => {
    chart();
    expect(readout()).toBe("Wed 21 OctRp 90.000Biggest day");
    expect(screen.getByRole("img", { name: "Spending by day. Biggest day Wed 21 Oct, Rp 90.000." })).toBeTruthy();
  });

  it("says Nothing spent for a day with none, and no tag", () => {
    chart(vi.fn(), "2026-10-20");
    expect(readout()).toBe("Tue 20 OctNothing spent");
  });

  it("steps to the previous and the next day with its buttons", () => {
    const { onPick } = chart(vi.fn(), "2026-10-20");
    fireEvent.click(screen.getByRole("button", { name: "Previous day" }));
    expect(onPick).toHaveBeenLastCalledWith("2026-10-19");
    fireEvent.click(screen.getByRole("button", { name: "Next day" }));
    expect(onPick).toHaveBeenLastCalledWith("2026-10-21");
  });

  it("can't step before the first day or past the last day that can be picked", () => {
    const first = chart(vi.fn(), "2026-10-19");
    const previous = screen.getByRole("button", { name: "Previous day" });
    expect(previous.getAttribute("aria-disabled")).toBe("true");
    fireEvent.click(previous);
    expect(first.onPick).not.toHaveBeenCalled();
    cleanup();

    // Today is the last day that can be picked: Thursday to Sunday are still to come.
    const last = chart();
    const next = screen.getByRole("button", { name: "Next day" });
    expect(next.getAttribute("aria-disabled")).toBe("true");
    fireEvent.click(next);
    expect(last.onPick).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "Previous day" }).getAttribute("aria-disabled")).toBeNull();
  });

  it("keeps the step buttons in the tab order even when they can't be used", () => {
    chart(vi.fn(), "2026-10-19");
    const previous = screen.getByRole("button", { name: "Previous day" }) as HTMLButtonElement;
    expect(previous.disabled).toBe(false);
    previous.focus();
    expect(document.activeElement).toBe(previous);
  });

  it("picks the day under a finger, and never one still to come", () => {
    const { onPick } = chart();
    const plot = screen.getByRole("img");
    plot.getBoundingClientRect = () => ({ left: 0, width: 700, top: 0, height: 150, right: 700, bottom: 150, x: 0, y: 0, toJSON() {} });
    fireEvent.pointerDown(plot, { clientX: 150, pointerId: 1 }); // 700 / 7 = 100 each: the second day
    expect(onPick).toHaveBeenLastCalledWith("2026-10-20");
    fireEvent.pointerMove(plot, { clientX: 650, pointerId: 1 }); // Sunday is still to come: lands on today
    expect(onPick).toHaveBeenLastCalledWith("2026-10-21");
    fireEvent.pointerUp(plot, { pointerId: 1 });
    fireEvent.pointerMove(plot, { clientX: 50, pointerId: 1, pointerType: "touch" }); // no finger down: nothing
    expect(onPick).toHaveBeenCalledTimes(2);
  });

  it("draws every day of the week, with the weekday under it", () => {
    chart();
    for (const day of ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]) {
      expect(screen.getByText(day)).toBeTruthy();
    }
  });
});

describe("the total", () => {
  it("shows the total in digits beside a small Rp, and the comparison in words", () => {
    const view = weekView();
    const { container } = render(<Hero label={view.label} summary={view.summary} />);
    expect(screen.getByText("This week so far")).toBeTruthy();
    expect(container.querySelector("small")?.textContent).toBe("Rp");
    expect(container.textContent).toContain("130.000");
    expect(screen.getByText("Nothing to compare with")).toBeTruthy();
    expect(screen.getByText("No spending in 12 to 14 Oct")).toBeTruthy();
  });

  it("says lower or higher with the amount", () => {
    const earlier: Spend[] = [...spends, { id: "c", date: "2026-10-13", amount: 200_000, categoryId: "food" }];
    const view = spendingView(earlier, categories, { mode: "week", anchor: TODAY, picked: null, showAll: false }, TODAY);
    render(<Hero label={view.label} summary={view.summary} />);
    expect(screen.getByText("Rp 70.000 lower")).toBeTruthy();
    expect(screen.getByText("12 to 14 Oct was Rp 200.000")).toBeTruthy();
  });
});

describe("where it went", () => {
  const period = makePeriod("month", TODAY, TODAY);
  const shares = [
    { id: "food", amount: 150_000, share: 0.6 },
    { id: NO_CATEGORY_ID, amount: 99_000, share: 0.396 },
    { id: "transport", amount: 1_000, share: 0.004 },
  ];

  function lines(more: number, showAll = false, onToggleAll = vi.fn()) {
    render(
      <CategoryLines
        shares={shares}
        categories={categories}
        period={period}
        label="October so far"
        more={more}
        showAll={showAll}
        onToggleAll={onToggleAll}
      />
    );
    return onToggleAll;
  }

  it("lists each category with its amount and share, linking to its spends", () => {
    lines(0);
    const food = screen.getByRole("link", { name: /Food & Drink/ });
    expect(food.textContent).toContain("Rp 150.000");
    expect(food.textContent).toContain("60%");
    const url = new URL(food.getAttribute("href") as string, "http://x");
    expect(url.pathname).toBe("/transactions");
    expect(url.searchParams.get("cat")).toBe("food");
    expect(url.searchParams.get("from")).toBe("2026-10-01");
    expect(url.searchParams.get("to")).toBe(TODAY);
    expect(url.searchParams.get("label")).toBe("October so far");
    expect(url.searchParams.get("back")).toBe("spending");
  });

  it("shows a removed category as No category and a tiny share as under one percent", () => {
    lines(0);
    const none = screen.getByRole("link", { name: /No category/ });
    expect(none.textContent).toContain("❔");
    expect(none.getAttribute("href")).toContain(`cat=${NO_CATEGORY_ID}`);
    expect(screen.getByRole("link", { name: /Transport/ }).textContent).toContain("<1%");
  });

  it("has no toggle when everything is shown, and a Show N more when some are folded", () => {
    lines(0);
    expect(screen.queryByRole("button")).toBeNull();
    cleanup();
    const toggle = lines(2);
    const more = screen.getByRole("button", { name: "Show 2 more" });
    expect(more.getAttribute("aria-expanded")).toBe("false");
    fireEvent.click(more);
    expect(toggle).toHaveBeenCalledTimes(1);
  });

  it("says Show fewer once they are all shown", () => {
    lines(2, true);
    expect(screen.getByRole("button", { name: "Show fewer" }).getAttribute("aria-expanded")).toBe("true");
  });
});

describe("the biggest spends", () => {
  const big = (id: string, store: string, categoryId: string, amount: number, date: string): Transaction => ({
    id,
    store,
    categoryId,
    amount,
    date,
    description: "",
    source: "manual",
    status: "confirmed",
    createdAt: "2026-10-01T00:00:00.000Z",
  });
  const rows = [big("x", "Superindo", "food", 650_000, "2026-10-12"), big("y", "Old shop", "gone", 120_000, "2025-12-30")];

  it("gives each its store, date and category, and opens the pressed one", () => {
    const onOpen = vi.fn();
    render(<BiggestSpends spends={rows} categories={categories} today={TODAY} onOpen={onOpen} />);
    const list = screen.getByRole("list");
    const superindo = within(list).getByRole("button", { name: /Superindo/ });
    expect(superindo.textContent).toContain("Mon 12 Oct · Food & Drink");
    expect(superindo.textContent).toContain("Rp 650.000");
    expect(within(list).getByRole("button", { name: /Old shop/ }).textContent).toContain("Tue 30 Dec 2025 · No category");
    fireEvent.click(superindo);
    expect(onOpen).toHaveBeenCalledWith(rows[0]);
  });
});
