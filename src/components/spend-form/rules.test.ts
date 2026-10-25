import { describe, expect, it } from "vitest";
import type { Category } from "@/types";
import {
  amountInputText,
  formWords,
  missingFields,
  needsDecision,
  notSavedMessage,
  parseAmountInput,
  problems,
  quickCategories,
  stillNeeded,
  summaryLine,
  type Draft,
} from "./rules";

const ids = new Set(["food", "transport"]);
const ready: Draft = { store: "KOPI", amount: 28000, date: "2026-10-25", categoryId: "food", note: "" };

describe("what makes a spend not ready", () => {
  it("accepts a complete spend, with or without a note", () => {
    expect(problems(ready, ids)).toEqual({});
    expect(problems({ ...ready, note: "latte" }, ids)).toEqual({});
  });

  it("names each missing piece in plain words", () => {
    const empty: Draft = { store: "  ", amount: null, date: "", categoryId: "", note: "" };
    expect(problems(empty, ids)).toEqual({
      store: "Add the store name.",
      amount: "Enter an amount above Rp 0.",
      category: "Choose a category.",
      date: "Choose a date.",
    });
  });

  it("refuses an amount of zero or below", () => {
    expect(problems({ ...ready, amount: 0 }, ids).amount).toBe("Enter an amount above Rp 0.");
    expect(problems({ ...ready, amount: -5 }, ids).amount).toBe("Enter an amount above Rp 0.");
  });

  it("points a line with no readable amount at the screenshot", () => {
    expect(problems({ ...ready, amount: null }, ids, true).amount).toBe(
      "Couldn't read this amount. Check the screenshot and type it in."
    );
    // Once something is typed and then cleared to zero, it is the ordinary message.
    expect(problems({ ...ready, amount: 0 }, ids, true).amount).toBe("Enter an amount above Rp 0.");
  });

  it("says a removed category was removed, and asks for another", () => {
    expect(problems({ ...ready, categoryId: "gone" }, ids).category).toBe(
      "That category was removed. Choose another."
    );
  });
});

describe("the line that says what is still needed", () => {
  it("lists the fields in the order they are asked for", () => {
    expect(stillNeeded(["store"])).toBe("store");
    expect(stillNeeded(["store", "amount"])).toBe("store and amount");
    expect(stillNeeded(["store", "amount", "date"])).toBe("store, amount and date");
    expect(summaryLine(["amount", "category"])).toBe("Still needed: amount and category.");
    expect(notSavedMessage(["store"])).toBe("Not saved. Still needed: store.");
  });

  it("is empty when nothing is missing", () => {
    expect(summaryLine([])).toBe("");
  });

  it("orders the missing fields store, amount, category, date", () => {
    const found = problems({ store: "", amount: null, date: "", categoryId: "", note: "" }, ids);
    expect(missingFields(found)).toEqual(["store", "amount", "category", "date"]);
  });
});

describe("typing an amount", () => {
  it("keeps the digits only, without leading zeros or more than twelve", () => {
    expect(parseAmountInput("Rp 1.234.567")).toBe(1234567);
    expect(parseAmountInput("0045")).toBe(45);
    expect(parseAmountInput("000")).toBeNull();
    expect(parseAmountInput("abc")).toBeNull();
    expect(parseAmountInput("1234567890123456")).toBe(123456789012);
  });

  it("shows the amount with dots, or nothing", () => {
    expect(amountInputText(1234567)).toBe("1.234.567");
    expect(amountInputText(null)).toBe("");
    expect(amountInputText(0)).toBe("");
  });
});

describe("the words on the buttons", () => {
  it("differ for the three jobs", () => {
    expect(formWords("add")).toMatchObject({ title: "Type in a spend", secondary: "Cancel", primary: "Add spend" });
    expect(formWords("change")).toMatchObject({ title: "Change spend", secondary: "Cancel", primary: "Save changes" });
    expect(formWords("correct")).toMatchObject({ title: "Edit details", secondary: "Done", primary: "Accept" });
  });

  it("say the verb in progress", () => {
    expect(formWords("add").busy).toBe("Saving…");
    expect(formWords("change").busy).toBe("Saving…");
    expect(formWords("correct").busy).toBe("Accepting…");
  });
});

describe("the quick categories", () => {
  const cat = (id: string): Category => ({ id, name: id, emoji: "•", color: "mint", order: 0 });
  const all = ["a", "b", "c", "d", "e", "f"].map(cat);

  it("are the first four in the owner's order", () => {
    expect(quickCategories(all, "").map((c) => c.id)).toEqual(["a", "b", "c", "d"]);
    expect(quickCategories(all, "b").map((c) => c.id)).toEqual(["a", "b", "c", "d"]);
  });

  it("always show the chosen one, in the fourth place", () => {
    expect(quickCategories(all, "f").map((c) => c.id)).toEqual(["a", "b", "c", "f"]);
  });

  it("ignores a category that no longer exists", () => {
    expect(quickCategories(all, "gone").map((c) => c.id)).toEqual(["a", "b", "c", "d"]);
  });

  it("copes with fewer than four categories", () => {
    expect(quickCategories(all.slice(0, 2), "b").map((c) => c.id)).toEqual(["a", "b"]);
  });
});

describe("a line that must be decided about first", () => {
  const line = { status: "pending_review" as const };
  it("is an own transfer or incoming money that isn't kept", () => {
    expect(needsDecision({ ...line, ownTransfer: true })).toBe(true);
    expect(needsDecision({ ...line, direction: "in" })).toBe(true);
  });
  it("is not once kept, or for an ordinary line or a saved spend", () => {
    expect(needsDecision({ ...line, ownTransfer: true, kept: true })).toBe(false);
    expect(needsDecision({ ...line, direction: "out" })).toBe(false);
    expect(needsDecision({ status: "confirmed", direction: "in" })).toBe(false);
  });
});
