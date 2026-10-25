import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { act, renderHook, waitFor } from "@testing-library/react";
import { terminate } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { clearEmulator, listDocs, writeDocs } from "../../scripts/test-env";
import { useTransactions } from "./useTransactions";

const spend = {
  amount: 45_000,
  store: "Kopi Kenangan",
  description: "",
  categoryId: "food-drink",
  date: "2026-10-20",
  source: "manual" as const,
  status: "confirmed" as const,
};

async function only() {
  const docs = await listDocs("transactions");
  expect(docs).toHaveLength(1);
  return docs[0];
}

beforeEach(clearEmulator);
afterAll(() => terminate(db));

describe("useTransactions writes", () => {
  it("adds a spend with a createdAt time", async () => {
    const { result, unmount } = renderHook(() => useTransactions());
    await act(() => result.current.addTransaction(spend));

    const saved = await only();
    expect(saved.data).toMatchObject(spend);
    expect(String(saved.data.createdAt)).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    await waitFor(() => expect(result.current.transactions).toHaveLength(1));
    unmount();
  });

  it("changes a spend", async () => {
    await writeDocs("transactions", [{ id: "t1", data: { ...spend, createdAt: "2026-10-20T08:00:00.000Z" } }]);
    const { result, unmount } = renderHook(() => useTransactions());
    await act(() => result.current.updateTransaction("t1", { amount: 52_500, store: "Kopi Janji Jiwa" }));

    expect((await only()).data).toMatchObject({ amount: 52_500, store: "Kopi Janji Jiwa", categoryId: "food-drink" });
    unmount();
  });

  it("deletes a spend", async () => {
    await writeDocs("transactions", [{ id: "t1", data: { ...spend, createdAt: "2026-10-20T08:00:00.000Z" } }]);
    const { result, unmount } = renderHook(() => useTransactions());
    await act(() => result.current.deleteTransaction("t1"));

    expect(await listDocs("transactions")).toHaveLength(0);
    unmount();
  });

  it("confirms a waiting line", async () => {
    await writeDocs("transactions", [
      { id: "w1", data: { ...spend, source: "ocr", status: "pending_review", createdAt: "2026-10-20T08:00:00.000Z" } },
    ]);
    const { result, unmount } = renderHook(() => useTransactions());
    await waitFor(() => expect(result.current.transactions).toHaveLength(1));
    await act(() => result.current.updateTransaction("w1", { status: "confirmed" }));

    expect((await only()).data).toMatchObject({ status: "confirmed", source: "ocr", amount: 45_000 });
    await waitFor(() => expect(result.current.transactions[0].status).toBe("confirmed"));
    unmount();
  });
});
