// @vitest-environment jsdom
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { ToastProvider } from "@/components/ui/toast";
import type { Category, Transaction } from "@/types";
import { forgetSpendingChoice, SpendingScreen } from "./spending-screen";

const data = vi.hoisted(() => ({
  spends: [] as Transaction[],
  waiting: [] as Transaction[],
  loading: false,
  categories: [] as Category[],
}));

vi.mock("@/hooks/useOnline", () => ({ useOnline: () => true }));
vi.mock("@/hooks/useTransactions", () => ({
  useTransactions: () => ({ spends: data.spends, waiting: data.waiting, loading: data.loading }),
}));
vi.mock("@/hooks/useCategories", () => ({
  useCategories: () => ({ categories: data.categories, loading: false }),
}));
vi.mock("next/link", () => ({
  default: ({ href, children, ...rest }: { href: string; children: ReactNode }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));
vi.mock("@/components/app/app-bar", () => ({
  SubBar: ({ onTypeInSpend }: { onTypeInSpend?: () => void }) => (
    <button type="button" onClick={onTypeInSpend}>
      Type in a spend
    </button>
  ),
}));
vi.mock("@/components/app/screen-skeletons", () => ({ ScreenSkeleton: () => <p>Loading</p> }));
vi.mock("@/components/spend-form/spend-form", () => ({
  SpendForm: ({ mode, onClose }: { mode: { kind: string; spend?: Transaction }; onClose: () => void }) => (
    <div role="dialog" aria-label={mode.kind === "change" ? `Change ${mode.spend?.store}` : "Type in"}>
      <button type="button" onClick={onClose}>
        Close form
      </button>
    </div>
  ),
}));

const categories: Category[] = [
  { id: "food", name: "Food & Drink", emoji: "🍽️", color: "apricot", order: 0 },
  { id: "transport", name: "Transport", emoji: "🚗", color: "sky", order: 1 },
];

let n = 0;
const spend = (date: string, amount: number, store: string, categoryId = "food"): Transaction => ({
  id: `s${++n}`,
  date,
  amount,
  store,
  categoryId,
  description: "",
  source: "manual",
  status: "confirmed",
  createdAt: "2026-10-01T00:00:00.000Z",
});

const waitingLine = (id: string): Transaction => ({ ...spend("2026-10-20", 5, "Line"), id, status: "pending_review" });

function show() {
  return render(
    <ToastProvider>
      <SpendingScreen />
    </ToastProvider>
  );
}

const title = () => screen.getByRole("heading", { level: 1 }).textContent;
const heroTotal = () => screen.getByRole("region", { name: /so far|This week|October|September|Oct|Sep/ }).textContent;
const earlier = (unit: string) => screen.getByRole("button", { name: `Earlier ${unit}` });
const later = (unit: string) => screen.getByRole("button", { name: `Later ${unit}` });

beforeEach(() => {
  forgetSpendingChoice();
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date(2026, 9, 21, 10, 0, 0)); // Wednesday 21 October 2026
  data.spends = [
    spend("2026-10-02", 100_000, "Superindo", "food"),
    spend("2026-10-10", 650_000, "Pertamina", "transport"),
    spend("2026-10-21", 25_000, "Kopi Kenangan", "food"),
    spend("2026-09-05", 300_000, "Superindo", "food"),
    spend("2026-09-21", 200_000, "Gojek", "transport"),
    spend("2026-09-25", 40_000, "Gojek", "transport"),
  ];
  data.waiting = [];
  data.loading = false;
  data.categories = categories;
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe("Spending", () => {
  it("opens on this month so far, compared with the same days of last month", () => {
    show();
    expect(title()).toBe("Spending");
    expect(screen.getByText("October 2026")).toBeTruthy();
    expect(screen.getByText("October so far")).toBeTruthy();
    expect(heroTotal()).toContain("775.000");
    expect(screen.getByText("Rp 275.000 higher")).toBeTruthy();
    expect(screen.getByText("1 to 21 September was Rp 500.000")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Month" }).getAttribute("aria-pressed")).toBe("true");
    expect(screen.getByRole("button", { name: "Week" }).getAttribute("aria-pressed")).toBe("false");
  });

  it("comes back to the period it was showing (back from a category's spends)", () => {
    show();
    fireEvent.click(earlier("month"));
    expect(screen.getByText("September 2026")).toBeTruthy();
    cleanup();
    show();
    expect(screen.getByText("September 2026")).toBeTruthy();
  });

  it("keeps Later off in the current period and offers no way back", () => {
    show();
    expect(later("month").getAttribute("aria-disabled")).toBe("true");
    expect(screen.queryByRole("button", { name: /^Back to this/ })).toBeNull();
  });

  it("steps to the earlier month, whole this time, and back", () => {
    show();
    fireEvent.click(earlier("month"));
    expect(screen.getByText("September 2026")).toBeTruthy();
    expect(screen.getByText("September", { selector: "p" })).toBeTruthy();
    expect(heroTotal()).toContain("540.000");
    expect(screen.getByText("Nothing to compare with")).toBeTruthy();
    expect(later("month").getAttribute("aria-disabled")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Back to this month" }));
    expect(screen.getByText("October so far")).toBeTruthy();
    expect(screen.queryByRole("button", { name: /^Back to this/ })).toBeNull();
    // Stepping later into the current month lands on it too.
    fireEvent.click(earlier("month"));
    fireEvent.click(later("month"));
    expect(screen.getByText("October so far")).toBeTruthy();
  });

  it("switches to the week (Monday to Sunday) and keeps looking at the same date", () => {
    show();
    fireEvent.click(screen.getByRole("button", { name: "Week" }));
    expect(screen.getByText("19 to 25 Oct 2026")).toBeTruthy();
    expect(screen.getByText("This week so far")).toBeTruthy();
    expect(heroTotal()).toContain("25.000");
    fireEvent.click(earlier("week"));
    expect(screen.getByText("12 to 18 Oct 2026")).toBeTruthy();
    expect(screen.getByText("Nothing spent in 12 to 18 Oct 2026.")).toBeTruthy();
    fireEvent.click(earlier("week"));
    expect(screen.getByText("5 to 11 Oct 2026")).toBeTruthy();
    expect(screen.getByText("Pertamina", { selector: "span" })).toBeTruthy();
    // Back to the month while looking at an earlier week of it: the month that week is in.
    fireEvent.click(screen.getByRole("button", { name: "Month" }));
    expect(screen.getByText("October so far")).toBeTruthy();
  });

  it("keeps an earlier date when switching from a past week to the month", () => {
    show();
    fireEvent.click(screen.getByRole("button", { name: "Week" }));
    for (let i = 0; i < 6; i++) fireEvent.click(earlier("week"));
    expect(screen.getByText("7 to 13 Sep 2026")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Month" }));
    expect(screen.getByText("September 2026")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Back to this month" })).toBeTruthy();
  });

  it("opens a category's spends in All transactions with the period already on", () => {
    show();
    const food = screen.getByRole("link", { name: /Food & Drink/ });
    const url = new URL(food.getAttribute("href") as string, "http://x");
    expect(url.pathname).toBe("/transactions");
    expect(Object.fromEntries(url.searchParams)).toEqual({
      cat: "food",
      from: "2026-10-01",
      to: "2026-10-21",
      label: "October so far",
      back: "spending",
    });
  });

  it("opens a biggest spend in the Change spend form, and closes it again", () => {
    show();
    const list = screen.getByRole("heading", { name: "Biggest spends" }).closest("section") as HTMLElement;
    const rows = within(list).getAllByRole("button");
    expect(rows.map((r) => r.textContent?.match(/Pertamina|Superindo|Kopi Kenangan/)?.[0])).toEqual([
      "Pertamina",
      "Superindo",
      "Kopi Kenangan",
    ]);
    fireEvent.click(rows[0]);
    expect(screen.getByRole("dialog", { name: "Change Pertamina" })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Close form" }));
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("opens the form from the menu to type in a spend", () => {
    show();
    fireEvent.click(screen.getByRole("button", { name: "Type in a spend" }));
    expect(screen.getByRole("dialog", { name: "Type in" })).toBeTruthy();
  });

  it("shows a no-spending period with nothing to compare, without a chart", () => {
    show();
    for (let i = 0; i < 3; i++) fireEvent.click(earlier("month")); // July
    expect(screen.getByText("Nothing spent in July 2026.")).toBeTruthy();
    expect(screen.getByText("Nothing to compare with")).toBeTruthy();
    expect(screen.queryByRole("heading", { name: "Day by day" })).toBeNull();
    expect(screen.queryByRole("heading", { name: "Where it went" })).toBeNull();
    expect(screen.queryByRole("link", { name: /Go and check/ })).toBeNull();
  });

  it("points at waiting lines when the period has no spending", () => {
    data.waiting = [waitingLine("w1"), waitingLine("w2")];
    show();
    for (let i = 0; i < 3; i++) fireEvent.click(earlier("month"));
    expect(screen.getByText("2 lines are still waiting to be checked. They count once you accept them.")).toBeTruthy();
    expect(screen.getByRole("link", { name: "Go and check them" }).getAttribute("href")).toBe("/");
  });

  it("says nothing spent yet in a current period with no spending", () => {
    data.spends = [];
    data.waiting = [waitingLine("w1")];
    show();
    expect(screen.getByText("Nothing spent yet this month.")).toBeTruthy();
    expect(screen.getByRole("link", { name: "Go and check it" })).toBeTruthy();
  });

  it("shows first use, with no period controls, when there is nothing at all", () => {
    data.spends = [];
    data.waiting = [];
    show();
    expect(title()).toBe("Spending");
    expect(screen.getByText("Nothing to show yet.")).toBeTruthy();
    expect(screen.getByRole("link", { name: "Add your first screenshots" }).getAttribute("href")).toBe("/");
    expect(screen.queryByRole("button", { name: "Week" })).toBeNull();
    expect(screen.queryByRole("button", { name: /^Earlier/ })).toBeNull();
  });

  it("shows the grey layout while its own data is still arriving", () => {
    data.loading = true;
    show();
    expect(screen.getByText("Loading")).toBeTruthy();
    expect(screen.queryByRole("heading", { level: 1 })).toBeNull();
  });
});
