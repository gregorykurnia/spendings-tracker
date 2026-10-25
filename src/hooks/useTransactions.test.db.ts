import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { act, renderHook, waitFor } from "@testing-library/react";
import { deleteDoc, doc, terminate, waitForPendingWrites } from "firebase/firestore";
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

// A hook that unmounts writes what is left without waiting (leaving never loses typing). Let those
// writes land before the next test clears the emulator, or they reach the next test's documents.
beforeEach(async () => {
  await waitForPendingWrites(db);
  await clearEmulator();
});
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

  it("changes a spend through updateSpend, which ends a suggestion and refuses an unfinished one", async () => {
    await writeDocs("transactions", [
      { id: "t1", data: { ...spend, categorySuggested: true, createdAt: "2026-10-20T08:00:00.000Z" } },
    ]);
    const { result, unmount } = await openHook();
    const fields = { amount: 52_500, store: "Kopi", description: "latte", categoryId: "groceries", date: "2026-10-21" };
    await act(() => result.current.updateSpend("t1", fields));
    const stored = (await only()).data;
    expect(stored).toMatchObject(fields);
    expect(stored).not.toHaveProperty("categorySuggested");

    for (const missing of [{ amount: null }, { amount: 0 }, { categoryId: "" }, { store: " " }, { date: "" }]) {
      await expect(result.current.updateSpend("t1", { ...fields, ...missing })).rejects.toThrow(/can't be saved/);
    }
    expect((await only()).data).toMatchObject(fields);
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

  it("never shows the old values again between writing an edit and the stored data catching up", async () => {
    await writeDocs("transactions", [waitingDoc("w1", { categoryId: "", store: "Kopi" })]);
    const seen: string[] = [];
    const hook = renderHook(() => {
      const t = useTransactions();
      seen.push(t.waiting[0] ? `${t.waiting[0].store}|${t.waiting[0].categoryId}` : "none");
      return t;
    });
    await waitFor(() => expect(hook.result.current.loading).toBe(false));

    // The pause in typing writes it, outside `act`, so every render in between is seen.
    act(() => hook.result.current.editWaitingLine("w1", { store: "Kopi Senopati", categoryId: "groceries" }));
    await expect
      .poll(async () => (await byId("w1"))?.categoryId, { timeout: EDIT_DELAY_MS * 10 })
      .toBe("groceries");
    await new Promise((resolve) => setTimeout(resolve, 300));

    const typed = seen.indexOf("Kopi Senopati|groceries");
    expect(typed).toBeGreaterThan(0);
    expect(seen.slice(typed).every((v) => v === "Kopi Senopati|groceries")).toBe(true);
    hook.unmount();
  });

  it("writes what was typed when the screen closes", async () => {
    await writeDocs("transactions", [waitingDoc("w1")]);
    const { result, unmount } = await openHook();

    act(() => result.current.editWaitingLine("w1", { description: "for the office" }));
    unmount();

    await expect.poll(async () => (await byId("w1"))?.description).toBe("for the office");
  });
  it("keeps what was typed when a write fails, and says so apart from loading", async () => {
    await writeDocs("transactions", [waitingDoc("w1")]);
    const { result, unmount } = await openHook();

    // `undefined` is a value Firestore refuses, so this write fails.
    act(() => result.current.editWaitingLine("w1", { store: "Kopi Senopati", description: undefined }));
    await waitFor(() => expect(result.current.saveError).not.toBeNull(), { timeout: EDIT_DELAY_MS * 10 });

    expect(result.current.error).toBeNull();
    expect(result.current.waiting[0].store).toBe("Kopi Senopati");
    expect((await byId("w1"))?.store).toBe("Kopi Kenangan");
    unmount();
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

  it("saves the store and note without stray spaces, one or many", async () => {
    await writeDocs("transactions", [waitingDoc("w1"), waitingDoc("w2", { seq: 1, description: " latte " })]);
    const { result, unmount } = await openHook();
    await waitFor(() => expect(result.current.waiting).toHaveLength(2));

    act(() => result.current.editWaitingLine("w1", { store: "  Kopi Senopati ", description: "oat  " }));
    await act(() => result.current.acceptLine("w1"));
    await act(() => result.current.acceptLines(["w2"]));

    expect(await byId("w1")).toMatchObject({ store: "Kopi Senopati", description: "oat" });
    expect(await byId("w2")).toMatchObject({ description: "latte" });
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

  it("accepts more than one batch holds", async () => {
    const many = Array.from({ length: 451 }, (_, i) => waitingDoc(`w${i}`, { seq: i }));
    await writeDocs("transactions", many);
    const { result, unmount } = await openHook();
    await waitFor(() => expect(result.current.waiting).toHaveLength(451));

    await act(() => result.current.acceptLines(many.map((d) => d.id)));

    expect((await listDocs("transactions")).filter((d) => d.data.status === "confirmed")).toHaveLength(451);
    unmount();
  });

  it("keeps the edits of a line it couldn't accept, unless the line is gone", async () => {
    await writeDocs("transactions", [waitingDoc("w1"), waitingDoc("w2", { seq: 1 })]);
    const { result, unmount } = await openHook();
    await waitFor(() => expect(result.current.waiting).toHaveLength(2));

    act(() => result.current.editWaitingLine("w1", { store: "Kopi Senopati", description: undefined }));
    await expect(result.current.acceptLine("w1")).rejects.toThrow();
    await waitFor(() => expect(result.current.waiting[0].store).toBe("Kopi Senopati"));
    expect((await byId("w1"))?.status).toBe("pending_review");

    act(() => result.current.editWaitingLine("w2", { store: "Grab" }));
    await deleteDoc(doc(db, "transactions", "w2"));
    await expect(result.current.acceptLine("w2")).rejects.toThrow();
    // The line is gone, so its edits were dropped: there is nothing left to write, and no save error.
    await act(() => result.current.flushEdits("w2"));
    expect(result.current.saveError).toBeNull();
    unmount();
  });

  it("drops the typing on a line that is thrown away elsewhere, with no save error", async () => {
    await writeDocs("transactions", [waitingDoc("w1")]);
    const { result, unmount } = await openHook();
    await waitFor(() => expect(result.current.waiting).toHaveLength(1));

    act(() => result.current.editWaitingLine("w1", { store: "Grab" }));
    await deleteDoc(doc(db, "transactions", "w1"));
    await waitFor(() => expect(result.current.waiting).toHaveLength(0));
    // The pause before writing passes; the write finds no line.
    await act(() => new Promise((resolve) => setTimeout(resolve, EDIT_DELAY_MS + 500)));
    expect(result.current.saveError).toBeNull();
    expect(await listDocs("transactions")).toHaveLength(0);
    unmount();
  });

  it("accepts none of them if one isn't ready", async () => {
    await writeDocs("transactions", [waitingDoc("w1"), waitingDoc("w2", { seq: 1, categoryId: "" })]);
    console.log("DBG server", (await listDocs("transactions")).map((d) => d.id));
    const { result, unmount } = await openHook();
    console.log("DBG first", result.current.waiting.map((t) => t.id));
    try { await waitFor(() => expect(result.current.waiting).toHaveLength(2), { timeout: 8000 }); } catch (e) { console.log("DBG late", result.current.waiting.map((t) => t.id), result.current.transactions?.map?.((t: {id:string}) => t.id)); throw e; }

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
  it("reads old dates: a date with a time keeps its day, anything else is no date", async () => {
    await writeDocs("transactions", [
      { id: "t1", data: { ...spend, date: "2026-10-05T00:00:00", createdAt: "2026-10-20T08:00:00.000Z" } },
      { id: "t2", data: { ...spend, date: "5 Oct", createdAt: "2026-10-20T08:00:00.000Z" } },
      { id: "t3", data: { ...spend, date: "", createdAt: "2026-10-20T08:00:00.000Z" } },
    ]);
    const { result, unmount } = await openHook();
    await waitFor(() => expect(result.current.spends).toHaveLength(3));
    const dates = Object.fromEntries(result.current.spends.map((t) => [t.id, t.date]));
    expect(dates).toEqual({ t1: "2026-10-05", t2: "", t3: "" });
    unmount();
  });

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
