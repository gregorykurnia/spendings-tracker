import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import { act, renderHook, waitFor } from "@testing-library/react";
import { terminate } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { SEED_CATEGORIES, starterCategoryId } from "@/lib/seedCategories";
import { clearEmulator, listDocs, writeDocs, type EmulatorDoc } from "../../scripts/test-env";
import { CategoryInUseError, CategoryNameTakenError, useCategories } from "./useCategories";
import { useTransactionCounts } from "./useTransactionCounts";

const seeded = [
  { id: "categoriesSeeded", data: { seededAt: "2026-10-20T08:00:00.000Z" } },
  { id: "telecommunicationsCategorySeeded", data: { seededAt: "2026-10-20T08:00:00.000Z" } },
];

function category(id: string, name: string, order: number, color = "mint"): EmulatorDoc {
  return { id, data: { name, emoji: "🛒", color, order } };
}

function transaction(id: string, categoryId: string, status = "confirmed"): EmulatorDoc {
  return {
    id,
    data: {
      amount: 10_000,
      store: "Superindo",
      description: "",
      categoryId,
      date: "2026-10-20",
      source: "manual",
      status,
      createdAt: "2026-10-20T08:00:00.000Z",
    },
  };
}

async function openWith(categories: EmulatorDoc[], transactions: EmulatorDoc[] = []) {
  await writeDocs("meta", seeded);
  await writeDocs("categories", categories);
  await writeDocs("transactions", transactions);
  const hook = renderHook(() => useCategories());
  await waitFor(() => expect(hook.result.current.categories).toHaveLength(categories.length));
  return hook;
}

async function categoryDocs() {
  return (await listDocs("categories")).sort((a, b) => Number(a.data.order) - Number(b.data.order));
}

beforeEach(clearEmulator);
afterAll(() => terminate(db));

describe("first open", () => {
  it("adds the sixteen starter categories with swatch colours, reporting progress", async () => {
    const progress: unknown[] = [];
    const { result, unmount } = renderHook(() => {
      const r = useCategories();
      progress.push(r.seeding);
      return r;
    });
    await waitFor(() => expect(result.current.categories).toHaveLength(16), { timeout: 10_000 });
    await waitFor(() => expect(result.current.seeding).toBeNull());

    expect(progress).toContainEqual({ done: 16, total: 16 });
    expect(progress.some((p) => p && (p as { done: number }).done > 0 && (p as { done: number }).done < 16)).toBe(true);
    const docs = await categoryDocs();
    expect(docs.map((d) => d.id)).toEqual(SEED_CATEGORIES.map((c) => starterCategoryId(c.name)));
    expect(docs.every((d) => /^[a-z]+$/.test(String(d.data.color)))).toBe(true);
    const meta = await listDocs("meta");
    expect(meta.find((m) => m.id === "categoriesSeeded")?.data.seededAt).toBeTruthy();
    unmount();
  });

  async function freshHook() {
    // Seeding runs once per page load; a fresh module is a fresh page load.
    vi.resetModules();
    const { useCategories: fresh } = await import("./useCategories");
    return renderHook(() => fresh());
  }

  it("finishes a seeding that was cut short, without doubles", async () => {
    await writeDocs("meta", [{ id: "categoriesSeeded", data: { startedAt: "2026-10-25T08:00:00.000Z" } }]);
    await writeDocs(
      "categories",
      SEED_CATEGORIES.slice(0, 5).map((c) => ({ id: starterCategoryId(c.name), data: { ...c } }))
    );
    const { result, unmount } = await freshHook();
    await waitFor(() => expect(result.current.categories).toHaveLength(16), { timeout: 10_000 });

    await expect.poll(async () => (await listDocs("meta")).find((m) => m.id === "categoriesSeeded")?.data.seededAt).toBeTruthy();
    expect(await listDocs("categories")).toHaveLength(16);
    unmount();
  });

  it("never adds starters to the owner's own categories", async () => {
    await writeDocs("meta", [{ id: "categoriesSeeded", data: { startedAt: "2026-10-25T08:00:00.000Z" } }]);
    await writeDocs("categories", [category("mine", "Kids", 0)]);
    const { result, unmount } = await freshHook();
    await waitFor(() => expect(result.current.categories).toHaveLength(1));

    await expect.poll(async () => (await listDocs("meta")).find((m) => m.id === "categoriesSeeded")?.data.seededAt).toBeTruthy();
    // Telecommunications is the one later addition every database gets.
    await expect.poll(async () => (await listDocs("categories")).map((c) => c.id).sort()).toEqual(["mine", "telecommunications"]);
    unmount();
  });
  it("leaves a database from before the sentinel as it is, and marks it seeded", async () => {
    // The live data's shape before seeding had a sentinel: the owner's categories, no meta at all.
    await writeDocs("categories", [category("Xy12ab", "Kids", 0, "#10b981")]);
    const { result, unmount } = await freshHook();
    await waitFor(() => expect(result.current.categories.length).toBeGreaterThanOrEqual(1));

    await expect.poll(async () => (await listDocs("meta")).find((m) => m.id === "categoriesSeeded")?.data.seededAt).toBeTruthy();
    expect(result.current.seeding).toBeNull();
    await expect.poll(async () => (await listDocs("categories")).map((c) => c.id).sort()).toEqual(["Xy12ab", "telecommunications"]);
    unmount();
  });
});

describe("adding and changing", () => {
  it("adds a category at the end, trimmed", async () => {
    const { result, unmount } = await openWith([category("a", "Groceries", 0), category("b", "Other", 5)]);
    await act(async () => {
      await result.current.addCategory({ name: "  Kids  ", emoji: "🎒", color: "plum" });
    });

    const docs = await categoryDocs();
    expect(docs.at(-1)?.data).toEqual({ name: "Kids", emoji: "🎒", color: "plum", order: 6 });
    unmount();
  });

  it("refuses a name that is taken, capitals and spaces ignored", async () => {
    const { result, unmount } = await openWith([category("a", "Groceries", 0)]);
    await expect(result.current.addCategory({ name: " groceries", emoji: "🛒", color: "mint" })).rejects.toThrow(CategoryNameTakenError);
    expect(await listDocs("categories")).toHaveLength(1);
    unmount();
  });

  it("refuses an empty name and a colour that isn't a swatch name", async () => {
    const { result, unmount } = await openWith([category("a", "Groceries", 0)]);
    await expect(result.current.addCategory({ name: " ", emoji: "🛒", color: "mint" })).rejects.toThrow(/name/);
    await expect(result.current.addCategory({ name: "Kids", emoji: "🛒", color: "#a855f7" })).rejects.toThrow(/swatch/);
    expect(await listDocs("categories")).toHaveLength(1);
    unmount();
  });

  it("changes a category, keeping its own name free, and stores a swatch name over an old hex colour", async () => {
    const { result, unmount } = await openWith([category("a", "groceries", 0, "#84cc16"), category("b", "Other", 1)]);
    expect(result.current.categories[0].color).toBe("#84cc16");

    await act(() => result.current.updateCategory("a", { name: "Groceries", color: "lime" }));
    await expect(result.current.updateCategory("a", { name: "OTHER" })).rejects.toThrow(CategoryNameTakenError);

    expect((await categoryDocs())[0].data).toMatchObject({ name: "Groceries", color: "lime", emoji: "🛒" });
    unmount();
  });

  it("moves a category up and down, numbering the list again", async () => {
    // Old data can have gaps and repeats in the order.
    const { result, unmount } = await openWith([category("a", "A", 0), category("b", "B", 3), category("c", "C", 3), category("d", "D", 9)]);
    const ids = () => result.current.categories.map((c) => c.id);
    const before = ids();

    await act(() => result.current.moveCategory("d", "up"));
    await waitFor(() => expect(ids()).toEqual([before[0], before[1], "d", before[2]]));
    await act(() => result.current.moveCategory(before[0], "down"));
    await waitFor(() => expect(ids()).toEqual([before[1], before[0], "d", before[2]]));
    await act(() => result.current.moveCategory(before[1], "up"));

    expect((await categoryDocs()).map((d) => d.data.order)).toEqual([0, 1, 2, 3]);
    unmount();
  });
});

describe("deleting", () => {
  it("tells spends from waiting lines when checking usage", async () => {
    const { result, unmount } = await openWith(
      [category("a", "Groceries", 0), category("b", "Other", 1)],
      [transaction("t1", "a"), transaction("t2", "a"), transaction("w1", "a", "pending_review"), transaction("t3", "b")]
    );
    expect(await result.current.categoryUsage("a")).toEqual({ spends: 2, waiting: 1 });
    expect(await result.current.categoryUsage("nothing")).toEqual({ spends: 0, waiting: 0 });
    unmount();
  });

  it("deletes a category nothing uses", async () => {
    const { result, unmount } = await openWith([category("a", "Groceries", 0), category("b", "Other", 1)]);
    await act(() => result.current.deleteCategory("a"));

    expect((await listDocs("categories")).map((c) => c.id)).toEqual(["b"]);
    unmount();
  });

  it("won't delete a used category without somewhere to move its spends", async () => {
    const { result, unmount } = await openWith([category("a", "Groceries", 0), category("b", "Other", 1)], [transaction("w1", "a", "pending_review")]);
    await expect(result.current.deleteCategory("a")).rejects.toThrow(CategoryInUseError);
    await expect(result.current.deleteCategory("a", "a")).rejects.toThrow(/different/);
    await expect(result.current.deleteCategory("a", "gone")).rejects.toThrow(/not found/);
    expect(await listDocs("categories")).toHaveLength(2);
    unmount();
  });

  it("won't delete the last category", async () => {
    const { result, unmount } = await openWith([category("a", "Groceries", 0)]);
    await expect(result.current.deleteCategory("a")).rejects.toThrow(/last/);
    unmount();
  });

  it("moves 507 spends and the waiting lines in chunks, then deletes the category", async () => {
    const spends = Array.from({ length: 507 }, (_, i) => transaction(`t${String(i).padStart(3, "0")}`, "a"));
    // Old-shape documents: no direction, and a hex colour on the category.
    const waiting = [transaction("w1", "a", "pending_review"), { ...transaction("w2", "a", "pending_review"), data: { ...transaction("w2", "a", "pending_review").data, categorySuggested: true } }];
    const { result, unmount } = await openWith([category("a", "Groceries", 0, "#84cc16"), category("b", "Other", 1)], [...spends, ...waiting, transaction("x", "b")]);

    const steps: [number, number][] = [];
    await act(() => result.current.deleteCategory("a", "b", (moved, total) => steps.push([moved, total])));

    expect(steps).toEqual([[0, 509], [450, 509], [509, 509]]);
    const all = await listDocs("transactions");
    expect(all).toHaveLength(510);
    expect(all.every((t) => t.data.categoryId === "b")).toBe(true);
    expect(all.find((t) => t.id === "w2")?.data).not.toHaveProperty("categorySuggested");
    expect((await listDocs("categories")).map((c) => c.id)).toEqual(["b"]);
    unmount();
  }, 30_000);

  it("finishes a move that was cut short when run again", async () => {
    // As if a first run moved some, then failed before deleting the category.
    const { result, unmount } = await openWith(
      [category("a", "Groceries", 0), category("b", "Other", 1)],
      [transaction("t1", "b"), transaction("t2", "a"), transaction("w1", "a", "pending_review")]
    );
    const steps: [number, number][] = [];
    await act(() => result.current.deleteCategory("a", "b", (moved, total) => steps.push([moved, total])));

    expect(steps.at(-1)).toEqual([2, 2]);
    expect((await listDocs("transactions")).every((t) => t.data.categoryId === "b")).toBe(true);
    expect((await listDocs("categories")).map((c) => c.id)).toEqual(["b"]);
    unmount();
  });
});

describe("counts", () => {
  it("counts spends and waiting lines per category, old documents included", async () => {
    await writeDocs("transactions", [
      transaction("t1", "a"),
      transaction("t2", "a"),
      transaction("w1", "a", "pending_review"),
      transaction("t3", "b"),
      transaction("none", ""),
    ]);
    const { result, unmount } = renderHook(() => useTransactionCounts());

    await waitFor(() =>
      expect(result.current.counts).toEqual({ a: { spends: 2, waiting: 1 }, b: { spends: 1, waiting: 0 } }),
      // The client first shows its cache of earlier tests' documents.
      { timeout: 10_000 }
    );
    unmount();
  });
});
