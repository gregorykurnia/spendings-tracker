import { describe, expect, it } from "vitest";
import type { Transaction } from "@/types";
import { REVIEW_REASONS, groupWaiting, isRepeat, reviewReasons, sortWaiting } from "./review";

function line(over: Partial<Transaction> = {}): Transaction {
  return {
    id: "w1",
    amount: 28_000,
    store: "KOPI KENANGAN SCBD",
    description: "",
    categoryId: "food",
    date: "2026-10-25",
    source: "ocr",
    status: "pending_review",
    createdAt: "2026-10-25T08:00:00.000Z",
    ...over,
  };
}

const saved = (over: Partial<Transaction> = {}) => line({ id: "s1", status: "confirmed", ...over });
const ids = new Set(["food", "groceries"]);

describe("reviewReasons", () => {
  it("has none for a normal line", () => {
    expect(reviewReasons(line(), [], ids)).toEqual([]);
  });

  it("puts an own-account transfer first, then incoming money", () => {
    expect(reviewReasons(line({ ownTransfer: true, direction: "in" }), [], ids)).toEqual(["ownTransfer", "incoming"]);
    expect(reviewReasons(line({ direction: "in" }), [], ids)).toEqual(["incoming"]);
  });

  it("stops flagging those three after Keep it or It's a spend", () => {
    const dup = saved();
    expect(reviewReasons(line({ ownTransfer: true, direction: "in", kept: true }), [dup], ids)).toEqual([]);
    expect(reviewReasons(line({ kept: true }), [dup], ids)).toEqual([]);
  });

  it("keeps flagging missing pieces after kept", () => {
    expect(reviewReasons(line({ kept: true, amount: null }), [], ids)).toEqual(["amount"]);
  });

  it("flags a repeat of a saved spend with the same date, amount and store", () => {
    expect(reviewReasons(line(), [saved()], ids)).toEqual(["repeat"]);
    expect(reviewReasons(line(), [saved({ store: "  kopi kenangan scbd " })], ids)).toEqual(["repeat"]);
    expect(reviewReasons(line(), [saved({ amount: 27_000 })], ids)).toEqual([]);
    expect(reviewReasons(line(), [saved({ date: "2026-10-24" })], ids)).toEqual([]);
    expect(reviewReasons(line(), [saved({ store: "KOPI" })], ids)).toEqual([]);
  });

  it("doesn't take another waiting line for a repeat", () => {
    expect(reviewReasons(line(), [saved({ status: "pending_review" })], ids)).toEqual([]);
  });

  it("flags a missing or zero amount", () => {
    expect(reviewReasons(line({ amount: null }), [], ids)).toEqual(["amount"]);
    expect(reviewReasons(line({ amount: 0 }), [], ids)).toEqual(["amount"]);
  });

  it("flags a blank store, a missing date and no category, in that order after the amount", () => {
    expect(reviewReasons(line({ amount: null, store: "  ", date: "", categoryId: "" }), [], ids)).toEqual([
      "amount",
      "store",
      "date",
      "category",
    ]);
  });

  it("counts a category that no longer exists as no category", () => {
    expect(reviewReasons(line({ categoryId: "gone" }), [], ids)).toEqual(["category"]);
      });

  it("is never a repeat for incoming money, an unread amount or a missing date", () => {
    expect(isRepeat(line({ direction: "in" }), [saved()])).toBe(false);
    expect(isRepeat(line({ amount: null }), [saved({ amount: null })])).toBe(false);
    expect(isRepeat(line({ date: "" }), [saved({ date: "" })])).toBe(false);
  });
});

describe("REVIEW_REASONS", () => {
  it("offers the fix first for a missing piece and Throw away first for the rest", () => {
    expect(REVIEW_REASONS.amount.actions.map((a) => a.label)).toEqual(["Add amount", "Throw away"]);
    expect(REVIEW_REASONS.category.actions.map((a) => a.label)).toEqual(["Choose category", "Throw away"]);
    expect(REVIEW_REASONS.ownTransfer.actions.map((a) => a.label)).toEqual(["Throw away", "It's a spend"]);
    expect(REVIEW_REASONS.incoming.actions.map((a) => a.label)).toEqual(["Throw away", "It's a spend"]);
    expect(REVIEW_REASONS.repeat.actions.map((a) => a.label)).toEqual(["Throw away", "Keep it"]);
    for (const info of Object.values(REVIEW_REASONS)) {
      expect(info.actions[0].primary).toBe(true);
      expect(info.actions[1].primary).toBe(false);
    }
  });
  it("words the own-transfer reason as the plan says", () => {
    expect(REVIEW_REASONS.ownTransfer.why).toBe("Money moving between your own accounts, so it isn't counted yet.");
  });
  it("draws only missing pieces in the alert colour, except the category", () => {
    expect(Object.entries(REVIEW_REASONS).filter(([, v]) => v.alert).map(([k]) => k)).toEqual(["amount", "store", "date"]);
  });
});

describe("sortWaiting and groupWaiting", () => {
  const a = line({ id: "a", createdAt: "2026-10-25T08:00:00.000Z", seq: 0 });
  const b = line({ id: "b", createdAt: "2026-10-25T08:00:00.000Z", seq: 1, amount: null });
  const c = line({ id: "c", createdAt: "2026-10-25T08:00:00.000Z", seq: 2 });
  const d = line({ id: "d", createdAt: "2026-10-25T09:00:00.000Z", seq: 0, direction: "in" });
  const e = line({ id: "e", createdAt: "2026-10-25T09:00:00.000Z", seq: 1 });

  it("keeps lines in the order they arrived, whatever order they are given in", () => {
    expect(sortWaiting([e, c, a, d, b]).map((l) => l.id)).toEqual(["a", "b", "c", "d", "e"]);
  });

  it("splits into lines that look right and lines that need a look, each in arrival order", () => {
    const groups = groupWaiting([e, d, c, b, a], [], ids);
    expect(groups.lookRight.map((l) => l.id)).toEqual(["a", "c", "e"]);
    expect(groups.needLook.map((n) => [n.line.id, n.reasons])).toEqual([
      ["b", ["amount"]],
      ["d", ["incoming"]],
    ]);
  });

  it("keeps every line in exactly one group", () => {
    const all = [a, b, c, d, e];
    const g = groupWaiting(all, [saved({ date: a.date, amount: a.amount, store: a.store })], ids);
    expect(g.lookRight.length + g.needLook.length).toBe(all.length);
    expect(g.needLook.map((n) => n.line.id)).toContain("a");
    expect(g.needLook.map((n) => n.line.id)).toContain("c"); // same date, amount and store as a saved spend
  });

  it("has two empty groups when nothing is waiting", () => {
    expect(groupWaiting([], [], ids)).toEqual({ lookRight: [], needLook: [] });
  });
});
