import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { act, renderHook, waitFor } from "@testing-library/react";
import { terminate } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { clearEmulator, listDocs, writeDocs } from "../../scripts/test-env";
import { useCategories } from "./useCategories";

const seeded = [
  { id: "categoriesSeeded", data: { seededAt: "2026-10-20T08:00:00.000Z" } },
  { id: "telecommunicationsCategorySeeded", data: { seededAt: "2026-10-20T08:00:00.000Z" } },
];

function category(id: string, name: string, order: number) {
  return { id, data: { name, emoji: "🛒", color: "#84cc16", order } };
}

function transaction(id: string, categoryId: string) {
  return {
    id,
    data: {
      amount: 10_000,
      store: "Superindo",
      description: "",
      categoryId,
      date: "2026-10-20",
      source: "manual",
      status: "confirmed",
      createdAt: "2026-10-20T08:00:00.000Z",
    },
  };
}

beforeEach(clearEmulator);
afterAll(() => terminate(db));

describe("useCategories writes", () => {
  it("seeds the sixteen starter categories on first open", async () => {
    const { result, unmount } = renderHook(() => useCategories());
    await waitFor(() => expect(result.current.categories).toHaveLength(16), { timeout: 10_000 });

    // The hook shows its own writes before the emulator has them.
    await expect.poll(async () => (await listDocs("categories")).length).toBe(16);
    unmount();
  });

  it("moves every spend to another category, then deletes the old one", async () => {
    await writeDocs("meta", seeded);
    await writeDocs("categories", [category("a", "Groceries", 0), category("b", "Other", 1)]);
    await writeDocs("transactions", [transaction("t1", "a"), transaction("t2", "a"), transaction("t3", "b")]);
    const { result, unmount } = renderHook(() => useCategories());
    await waitFor(() => expect(result.current.categories).toHaveLength(2));

    expect(await act(() => result.current.transactionCountForCategory("a"))).toBe(2);
    await act(() => result.current.reassignAndDelete("a", "b"));

    expect((await listDocs("categories")).map((c) => c.id)).toEqual(["b"]);
    const transactions = await listDocs("transactions");
    expect(transactions.map((t) => t.data.categoryId)).toEqual(["b", "b", "b"]);
    unmount();
  });

  it("deletes a category with no spends", async () => {
    await writeDocs("meta", seeded);
    await writeDocs("categories", [category("a", "Groceries", 0), category("b", "Other", 1)]);
    const { result, unmount } = renderHook(() => useCategories());
    await waitFor(() => expect(result.current.categories).toHaveLength(2));

    await act(() => result.current.deleteCategory("a"));

    expect((await listDocs("categories")).map((c) => c.id)).toEqual(["b"]);
    unmount();
  });
});
