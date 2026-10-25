import { describe, expect, it } from "vitest";
import type { Transaction } from "@/types";
import { suggestCategoryId } from "./suggest";

function t(store: string, categoryId: string, date: string, extra: Partial<Transaction> = {}): Transaction {
  return {
    id: `${store}-${date}`,
    amount: 10_000,
    store,
    description: "",
    categoryId,
    date,
    source: "ocr",
    status: "confirmed",
    createdAt: `${date}T08:00:00.000Z`,
    ...extra,
  };
}

const ids = new Set(["food", "groceries", "transport"]);

describe("suggestCategoryId", () => {
  it("takes the latest confirmed spend at the same store, capitals and spaces ignored", () => {
    const list = [t("Indomaret", "food", "2026-10-01"), t("INDOMARET ", "groceries", "2026-10-20"), t("indomaret", "food", "2026-10-05")];
    expect(suggestCategoryId("  indomaret", list, ids)).toBe("groceries");
  });

  it("breaks a same-day tie by the time it was added", () => {
    const list = [
      t("Grab", "food", "2026-10-20", { createdAt: "2026-10-20T09:00:00.000Z" }),
      t("Grab", "transport", "2026-10-20", { createdAt: "2026-10-20T10:00:00.000Z" }),
    ];
    expect(suggestCategoryId("Grab", list, ids)).toBe("transport");
  });

  it("ignores waiting lines", () => {
    const list = [t("Grab", "transport", "2026-10-01"), t("Grab", "food", "2026-10-20", { status: "pending_review" })];
    expect(suggestCategoryId("Grab", list, ids)).toBe("transport");
  });

  it("suggests nothing when the latest spend's category is gone", () => {
    const list = [t("Grab", "transport", "2026-10-01"), t("Grab", "deleted", "2026-10-20")];
    expect(suggestCategoryId("Grab", list, ids)).toBeNull();
  });

  it("suggests nothing for a new store or an empty one", () => {
    expect(suggestCategoryId("Alfamart", [t("Indomaret", "groceries", "2026-10-01")], ids)).toBeNull();
    expect(suggestCategoryId("  ", [t("", "groceries", "2026-10-01")], ids)).toBeNull();
  });
});
