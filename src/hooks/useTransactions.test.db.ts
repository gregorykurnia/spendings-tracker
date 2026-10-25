import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { act, renderHook, waitFor } from "@testing-library/react";
import { terminate } from "firebase/firestore";
import { db } from "@/lib/firebase";
import type { Category, OcrLine } from "@/types";
import { clearEmulator, listDocs, writeDocs, type EmulatorDoc } from "../../scripts/test-env";
import { EDIT_DELAY_MS, useTransactions } from "./useTransactions";

const spend = {
  amount: 45_000,
  store: "Kopi Kenangan",
  description: "",
  categoryId: "food-drink",
  date: "2026-10-20",
  source: "manual" as const,
  status: "confirmed" as const,
};

const categories: Category[] = [
  { id: "food-drink", name: "Food & Drink", emoji: "🍽️", color: "apricot", order: 0 },
  { id: "groceries", name: "Groceries", emoji: "🛒", color: "mint", order: 1 },
  { id: "transport", name: "Transport", emoji: "🚗", color: "sky", order: 2 },
];

function line(store: string, extra: Partial<OcrLine> = {}): OcrLine {
  return {
    date: "2026-10-24",
    store,
    description: "",
    amount: 25_000,
    amountText: "25.000,00 DB",
    direction: "out",
    ownTransfer: false,
    ...extra,
  };
}

/** A waiting line in the new shape, written straight to the emulator. */
function waitingDoc(id: string, extra: EmulatorDoc["data"] = {}): EmulatorDoc {
  return {
    id,
    data: {
      ...spend,
      source: "ocr",
      status: "pending_review",
      createdAt: "2026-10-24T08:00:00.000Z",
      seq: 0,
      direction: "out",
      ...extra,
    },
  };
}

async function only() {
  const docs = await listDocs("transactions");
  expect(docs).toHaveLength(1);
  return docs[0];
}

async function byId(id: string) {
  return (await listDocs("transactions")).find((d) => d.id === id)?.data;
}

async function openHook() {
  const hook = renderHook(() => useTransactions());
  await waitFor(() => expect(hook.result.current.loading).toBe(false));
  return hook;
}

beforeEach(clearEmulator);
afterAll(() => terminate(db));

describe("saved spends", () => {
  it("adds a typed-in spend as manual and confirmed", async () => {
    const { result, unmount } = await openHook();
    let id = "";
    await act(async () => {
      id = await result.current.addSpend({ amount: 45_000, store: "Kopi Kenangan", description: "", categoryId: "food-drink", date: "2026-10-20" });
    });

    const saved = await only();
    expect(saved.id).toBe(id);
    expect(saved.data).toMatchObject(spend);
    expect(String(saved.data.createdAt)).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    await waitFor(() => expect(result.current.spends).toHaveLength(1));
    unmount();
  });

  it("won't add a spend with something missing", async () => {
    const { result, unmount } = await openHook();
    const base = { amount: 45_000, store: "Kopi", description: "", categoryId: "food-drink", date: "2026-10-20" };
    for (const missing of [{ amount: null }, { amount: 0 }, { categoryId: "" }, { store: "  " }, { date: "" }]) {
      await expect(result.current.addSpend({ ...base, ...missing })).rejects.toThrow(/can't be saved/);
    }
    expect(await listDocs("transactions")).toHaveLength(0);
    unmount();
  });

  it("changes a spend", async () => {
    await writeDocs("transactions", [{ id: "t1", data: { ...spend, createdAt: "2026-10-20T08:00:00.000Z" } }]);
    const { result, unmount } = await openHook();
    await act(() => result.current.updateTransaction("t1", { amount: 52_500, store: "Kopi Janji Jiwa" }));

    expect((await only()).data).toMatchObject({ amount: 52_500, store: "Kopi Janji Jiwa", categoryId: "food-drink" });
    unmount();
  });

  it("deletes a spend", async () => {
    await writeDocs("transactions", [{ id: "t1", data: { ...spend, createdAt: "2026-10-20T08:00:00.000Z" } }]);
    const { result, unmount } = await openHook();
    await act(() => result.current.deleteTransaction("t1"));

    expect(await listDocs("transactions")).toHaveLength(0);
    unmount();
  });
});

describe("adding lines from a screenshot", () => {
  it("adds waiting lines in the screenshot's order with what the screenshot said", async () => {
    const { result, unmount } = await openHook();
    await act(() =>
      result.current.addScreenshotLines(
        [
          line("GOPAY TOPUP", { amount: 200_000, amountText: "200.000,00 DB", ownTransfer: true }),
          line("TRSF CR ANDI", { direction: "in", amountText: "150.000,00 CR", amount: 150_000 }),
          line("GoRide", { amount: null, amountText: "-Rp1?.0?0", date: "" }),
        ],
        categories
      )
    );

    const docs = (await listDocs("transactions")).map((d) => d.data).sort((a, b) => Number(a.seq) - Number(b.seq));
    expect(docs.map((d) => d.store)).toEqual(["GOPAY TOPUP", "TRSF CR ANDI", "GoRide"]);
    expect(docs[0]).toMatchObject({
      source: "ocr",
      status: "pending_review",
      seq: 0,
      direction: "out",
      ownTransfer: true,
      categoryId: "",
      bankLine: { store: "GOPAY TOPUP", date: "2026-10-24", amountText: "200.000,00 DB" },
    });
    expect(docs[1]).toMatchObject({ direction: "in", seq: 1 });
    expect(docs[1]).not.toHaveProperty("ownTransfer");
    expect(docs[2]).toMatchObject({ amount: null, date: "", bankLine: { amountText: "-Rp1?.0?0", date: "" } });
    expect(new Set(docs.map((d) => d.createdAt)).size).toBe(1);

    await waitFor(() => expect(result.current.waiting.map((t) => t.store)).toEqual(["GOPAY TOPUP", "TRSF CR ANDI", "GoRide"]));
    unmount();
  });

  it("suggests the category of the latest spend at the same store, if it still exists", async () => {
    await writeDocs("transactions", [
      { id: "s1", data: { ...spend, store: "Indomaret", categoryId: "food-drink", date: "2026-10-01", createdAt: "2026-10-01T08:00:00.000Z" } },
      { id: "s2", data: { ...spend, store: "INDOMARET", categoryId: "groceries", date: "2026-10-10", createdAt: "2026-10-10T08:00:00.000Z" } },
      { id: "s3", data: { ...spend, store: "Grab", categoryId: "gone", date: "2026-10-10", createdAt: "2026-10-10T08:00:00.000Z" } },
    ]);
    const { result, unmount } = await openHook();
    await act(() => result.current.addScreenshotLines([line(" indomaret "), line("Grab"), line("New Shop")], categories));

    const added = (await listDocs("transactions")).filter((d) => d.data.status === "pending_review").map((d) => d.data);
    const indomaret = added.find((d) => d.store === " indomaret ");
    expect(indomaret).toMatchObject({ categoryId: "groceries", categorySuggested: true });
    expect(added.find((d) => d.store === "Grab")).toMatchObject({ categoryId: "" });
    expect(added.find((d) => d.store === "Grab")).not.toHaveProperty("categorySuggested");
    expect(added.find((d) => d.store === "New Shop")).toMatchObject({ categoryId: "" });
    unmount();
  });

  it("puts a later screenshot's lines below the earlier ones", async () => {
    await writeDocs("transactions", [
      waitingDoc("b1", { store: "Second, first line", createdAt: "2026-10-24T09:00:00.000Z", seq: 0 }),
      waitingDoc("a2", { store: "First, second line", createdAt: "2026-10-24T08:00:00.000Z", seq: 1 }),
      waitingDoc("a1", { store: "First, first line", createdAt: "2026-10-24T08:00:00.000Z", seq: 0 }),
    ]);
    const { result, unmount } = await openHook();
    await waitFor(() => expect(result.current.waiting).toHaveLength(3));
    expect(result.current.waiting.map((t) => t.store)).toEqual(["First, first line", "First, second line", "Second, first line"]);
    unmount();
  });
});

describe("editing a waiting line", () => {
  it("shows edits at once and writes them together after a pause in typing", async () => {
    await writeDocs("transactions", [waitingDoc("w1", { categoryId: "groceries", categorySuggested: true })]);
    const { result, unmount } = await openHook();

    act(() => result.current.editWaitingLine("w1", { store: "Kopi" }));
    act(() => result.current.editWaitingLine("w1", { store: "Kopi Kenangan Senopati", amount: null }));
    expect(result.current.waiting[0]).toMatchObject({ store: "Kopi Kenangan Senopati", amount: null, categorySuggested: true });
    expect((await byId("w1"))?.store).toBe("Kopi Kenangan");

    await expect.poll(async () => (await byId("w1"))?.store, { timeout: EDIT_DELAY_MS * 10 }).toBe("Kopi Kenangan Senopati");
    expect((await byId("w1"))?.amount).toBeNull();
    unmount();
  });

  it("ends the suggestion once the category is touched", async () => {
    await writeDocs("transactions", [waitingDoc("w1", { categoryId: "groceries", categorySuggested: true })]);
    const { result, unmount } = await openHook();

    act(() => result.current.editWaitingLine("w1", { categoryId: "food-drink" }));
    expect(result.current.waiting[0].categorySuggested).toBeUndefined();
    await act(() => result.current.flushEdits("w1"));

    const saved = await byId("w1");
    expect(saved).toMatchObject({ categoryId: "food-drink" });
    expect(saved).not.toHaveProperty("categorySuggested");
    unmount();
  });

  it("writes what was typed when the screen closes", async () => {
    await writeDocs("transactions", [waitingDoc("w1")]);
    const { result, unmount } = await openHook();

    act(() => result.current.editWaitingLine("w1", { description: "for the office" }));
    unmount();

    await expect.poll(async () => (await byId("w1"))?.description).toBe("for the office");
  });
});

describe("accepting waiting lines", () => {
  it("accepts one, with edits not yet written", async () => {
    await writeDocs("transactions", [waitingDoc("w1", { amount: null, categoryId: "" })]);
    const { result, unmount } = await openHook();

    act(() => result.current.editWaitingLine("w1", { amount: 30_000, categoryId: "food-drink" }));
    await act(() => result.current.acceptLine("w1"));

    expect((await only()).data).toMatchObject({ status: "confirmed", amount: 30_000, categoryId: "food-drink", source: "ocr" });
    await waitFor(() => expect(result.current.waiting).toHaveLength(0));
    expect(result.current.spends).toHaveLength(1);
    unmount();
  });

  it("won't accept a line that still needs something", async () => {
    await writeDocs("transactions", [
      waitingDoc("noAmount", { amount: null }),
      waitingDoc("noCategory", { categoryId: "" }),
      waitingDoc("noStore", { store: "" }),
      waitingDoc("noDate", { date: "" }),
      waitingDoc("incoming", { direction: "in" }),
      waitingDoc("own", { ownTransfer: true }),
    ]);
    const { result, unmount } = await openHook();
    await waitFor(() => expect(result.current.waiting).toHaveLength(6));

    for (const [id, reason] of [
      ["noAmount", "no amount"],
      ["noCategory", "no category"],
      ["noStore", "no store"],
      ["noDate", "no date"],
      ["incoming", "incoming"],
      ["own", "own transfer"],
    ]) {
      await expect(result.current.acceptLine(id)).rejects.toThrow(reason);
    }
    expect((await listDocs("transactions")).every((d) => d.data.status === "pending_review")).toBe(true);
    unmount();
  });

  it("accepts many in one go", async () => {
    await writeDocs("transactions", [waitingDoc("w1"), waitingDoc("w2", { seq: 1, amount: 12_000 }), waitingDoc("w3", { seq: 2, amount: null })]);
    const { result, unmount } = await openHook();
    await waitFor(() => expect(result.current.waiting).toHaveLength(3));

    await act(() => result.current.acceptLines(["w1", "w2"]));

    const docs = await listDocs("transactions");
    expect(docs.filter((d) => d.data.status === "confirmed").map((d) => d.id).sort()).toEqual(["w1", "w2"]);
    unmount();
  });

  it("accepts none of them if one isn't ready", async () => {
    await writeDocs("transactions", [waitingDoc("w1"), waitingDoc("w2", { seq: 1, categoryId: "" })]);
    const { result, unmount } = await openHook();
    await waitFor(() => expect(result.current.waiting).toHaveLength(2));

    await expect(result.current.acceptLines(["w1", "w2"])).rejects.toThrow("no category");
    expect((await listDocs("transactions")).every((d) => d.data.status === "pending_review")).toBe(true);
    unmount();
  });
});

describe("needs a look", () => {
  it("keeps a line: it counts as money going out and can then be accepted", async () => {
    await writeDocs("transactions", [waitingDoc("in", { direction: "in" }), waitingDoc("own", { seq: 1, ownTransfer: true })]);
    const { result, unmount } = await openHook();
    await waitFor(() => expect(result.current.waiting).toHaveLength(2));

    await act(() => result.current.keepLine("in"));
    await act(() => result.current.keepLine("own"));
    expect(await byId("in")).toMatchObject({ kept: true, direction: "out", status: "pending_review" });
    expect(await byId("own")).toMatchObject({ kept: true, ownTransfer: true });

    await waitFor(() => expect(result.current.waiting.every((t) => t.kept)).toBe(true));
    await act(() => result.current.acceptLines(["in", "own"]));
    expect((await listDocs("transactions")).every((d) => d.data.status === "confirmed")).toBe(true);
    unmount();
  });

  it("throws a waiting line away, but not a saved spend", async () => {
    await writeDocs("transactions", [waitingDoc("w1"), { id: "s1", data: { ...spend, createdAt: "2026-10-20T08:00:00.000Z" } }]);
    const { result, unmount } = await openHook();
    await waitFor(() => expect(result.current.transactions).toHaveLength(2));

    act(() => result.current.editWaitingLine("w1", { store: "typed" }));
    await act(() => result.current.throwAway("w1"));
    await expect(result.current.throwAway("s1")).rejects.toThrow(/saved spend/);

    expect((await only()).id).toBe("s1");
    unmount();
  });
});

describe("documents from before the redesign", () => {
  it("reads and accepts an old waiting line with no direction, bank line or order", async () => {
    await writeDocs("transactions", [
      { id: "old", data: { ...spend, source: "ocr", status: "pending_review", createdAt: "2026-09-01T08:00:00.000Z" } },
      { id: "oldSpend", data: { ...spend, createdAt: "2026-09-01T08:00:00.000Z" } },
    ]);
    const { result, unmount } = await openHook();
    await waitFor(() => expect(result.current.transactions).toHaveLength(2));

    const old = result.current.waiting[0];
    expect(old).toMatchObject({ id: "old", amount: 45_000, store: "Kopi Kenangan" });
    expect(old.direction).toBeUndefined();
    expect(old.bankLine).toBeUndefined();

    await act(() => result.current.acceptLine("old"));
    expect(await byId("old")).toMatchObject({ status: "confirmed" });
    unmount();
  });
});
