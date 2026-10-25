// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { ToastProvider } from "@/components/ui/toast";
import { blankFilters } from "@/lib/filters";
import type { Category, Transaction } from "@/types";
import { FiltersSheet } from "./filters-sheet";
import { Highlighted, SpendRow } from "./spend-row";

vi.mock("@/hooks/useOnline", () => ({ useOnline: () => true }));

afterEach(cleanup);

const TODAY = "2026-10-21";

const categories: Category[] = [
  { id: "food", name: "Food & Drink", emoji: "🍽️", color: "apricot", order: 0 },
  { id: "transport", name: "Transport", emoji: "🚗", color: "sky", order: 1 },
];

const spend = (patch: Partial<Transaction> = {}): Transaction => ({
  id: "s1",
  amount: 28_000,
  store: "KOPI JANJI JIWA",
  description: "Latte with Dina",
  categoryId: "food",
  date: "2026-10-20",
  source: "ocr",
  status: "confirmed",
  createdAt: "2026-10-20T08:00:00.000Z",
  ...patch,
});

function row(s: Transaction, words: string[] = [], onOpen = vi.fn()) {
  render(
    <ul>
      <SpendRow spend={s} categories={categories} today={TODAY} words={words} onOpen={onOpen} />
    </ul>
  );
  return onOpen;
}

describe("a spend row", () => {
  it("shows the emoji, store, category and note, amount, date and where it came from", () => {
    row(spend());
    const button = screen.getByRole("button");
    expect(button.textContent).toContain("KOPI JANJI JIWA");
    expect(button.textContent).toContain("Food & Drink · Latte with Dina");
    expect(button.textContent).toContain("Rp 28.000");
    expect(button.textContent).toContain("Tue 20 Oct");
    expect(within(button).getByText("From a screenshot.")).toBeTruthy();
  });

  it("says typed in for a spend written by hand, and shows the year only when it isn't this year", () => {
    row(spend({ source: "manual", date: "2025-12-31", description: "" }));
    const button = screen.getByRole("button");
    expect(within(button).getByText("Typed in.")).toBeTruthy();
    expect(button.textContent).toContain("Wed 31 Dec 2025");
    expect(button.textContent).not.toContain("·");
  });

  it("marks a spend whose category was removed with No category", () => {
    row(spend({ categoryId: "gone" }));
    expect(screen.getByRole("button").textContent).toContain("No category · Latte with Dina");
    expect(screen.getByRole("button").textContent).toContain("❔");
  });

  it("opens the spend when it is pressed", () => {
    const s = spend();
    const onOpen = row(s);
    fireEvent.click(screen.getByRole("button"));
    expect(onOpen).toHaveBeenCalledWith(s);
  });

  it("highlights the search words in the store and the note, capitals ignored", () => {
    row(spend(), ["kopi", "dina"]);
    const marks = [...document.querySelectorAll("mark")].map((m) => m.textContent);
    expect(marks).toEqual(["KOPI", "Dina"]);
  });

  it("writes the text as it is when nothing matches", () => {
    const { container } = render(<Highlighted text="Gojek" words={["zzz"]} />);
    expect(container.innerHTML).toBe("Gojek");
  });
});

type SheetProps = Parameters<typeof FiltersSheet>[0];

function sheet(patch: Partial<Omit<SheetProps, "onChange" | "onClear" | "onClose">> = {}) {
  const mocks = { onChange: vi.fn(), onClear: vi.fn(), onClose: vi.fn() };
  const props: SheetProps = {
    filters: blankFilters(TODAY),
    categories,
    spends: [{ categoryId: "food" }],
    today: TODAY,
    matches: 12,
    categoryName: (id: string) => categories.find((c) => c.id === id)?.name ?? "No category",
    ...mocks,
    ...patch,
  };
  render(
    <ToastProvider>
      <FiltersSheet {...props} />
    </ToastProvider>
  );
  return mocks;
}

describe("the filters sheet", () => {
  it("has dates, categories, amount and source, and a button that says what you will see", () => {
    sheet();
    const dialog = screen.getByRole("dialog", { name: "Filters" });
    for (const legend of ["Dates", "Categories", "Amount", "Source"]) {
      expect(within(dialog).getByRole("group", { name: legend })).toBeTruthy();
    }
    expect(within(dialog).getByRole("button", { name: "Show 12 spends" })).toBeTruthy();
    expect(within(dialog).getByRole("button", { name: "Clear all" }).getAttribute("aria-disabled")).toBe("true");
  });

  it("applies a category as it is pressed, and several can be on", () => {
    const props = sheet({ filters: { ...blankFilters(TODAY), categoryIds: ["food"] } });
    fireEvent.click(screen.getByRole("button", { name: /Transport/ }));
    expect(props.onChange.mock.calls[0][0].categoryIds).toEqual(["food", "transport"]);
    fireEvent.click(screen.getByRole("button", { name: /Food & Drink/ }));
    expect(props.onChange.mock.calls[1][0].categoryIds).toEqual([]);
  });

  it("offers No category only when a spend has lost its category", () => {
    sheet({ spends: [{ categoryId: "gone" }] });
    expect(screen.getByRole("button", { name: /No category/ })).toBeTruthy();
  });

  it("steps a week earlier or later, and later is off in the current week", () => {
    const filters = { ...blankFilters(TODAY), date: { kind: "week" as const, anchor: TODAY, from: "", to: "", label: "" } };
    const props = sheet({ filters });
    expect(screen.getByText("19 to 25 Oct 2026")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Later week" }).getAttribute("aria-disabled")).toBe("true");
    fireEvent.click(screen.getByRole("button", { name: "Earlier week" }));
    expect(props.onChange.mock.calls[0][0].date.anchor).toBe("2026-10-14");
  });

  it("shows From and To for a custom span and says when the end is before the start", () => {
    const filters = {
      ...blankFilters(TODAY),
      date: { kind: "custom" as const, anchor: TODAY, from: "2026-10-05", to: "2026-10-01", label: "" },
    };
    sheet({ filters });
    expect(screen.getByText("From")).toBeTruthy();
    expect(screen.getByText("The end is before the start.")).toBeTruthy();
  });

  it("types amounts with dots and says when the most is below the least", () => {
    const filters = { ...blankFilters(TODAY), min: 500_000, max: 100_000 };
    const props = sheet({ filters });
    const least = screen.getByLabelText("At least") as HTMLInputElement;
    expect(least.value).toBe("500.000");
    expect(screen.getByText("The most is below the least.")).toBeTruthy();
    fireEvent.change(least, { target: { value: "75.000" } });
    expect(props.onChange.mock.calls[0][0].min).toBe(75_000);
    fireEvent.change(screen.getByLabelText("At most"), { target: { value: "" } });
    expect(props.onChange.mock.calls[1][0].max).toBeNull();
  });

  it("says No spends match, with the button off, when nothing is left", () => {
    sheet({ matches: 0 });
    const button = screen.getByRole("button", { name: "No spends match" });
    expect(button.getAttribute("aria-disabled")).toBe("true");
  });

  it("clears all when something is on", () => {
    const props = sheet({ filters: { ...blankFilters(TODAY), source: "manual" } });
    fireEvent.click(screen.getByRole("button", { name: "Clear all" }));
    expect(props.onClear).toHaveBeenCalled();
  });
});
