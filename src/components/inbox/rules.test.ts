import { describe, expect, it } from "vitest";
import type { Transaction } from "@/types";
import {
  acceptBarLabel,
  acceptedManyMessage,
  acceptedOneMessage,
  inboxGroups,
  inboxSub,
  inboxTitle,
  jumpLabel,
  keptMessage,
  nextFocusId,
  showAcceptBar,
  thrownAwayMessage,
  tickLabel,
  type Departing,
} from "./rules";

const categories = new Set(["food", "transport"]);

let n = 0;
function line(over: Partial<Transaction> = {}): Transaction {
  n += 1;
  return {
    id: `w${n}`,
    amount: 28000,
    store: `STORE ${n}`,
    description: "",
    categoryId: "food",
    date: "2026-10-24",
    source: "ocr",
    status: "pending_review",
    createdAt: "2026-10-25T01:00:00.000Z",
    seq: n,
    ...over,
  };
}

function spend(over: Partial<Transaction> = {}): Transaction {
  return line({ status: "confirmed", source: "manual", ...over });
}

describe("the groups", () => {
  it("puts lines that need nothing in Look right and the rest in Need a look, each in arrival order", () => {
    const a = line({ createdAt: "2026-10-25T01:00:00.000Z", seq: 0 });
    const b = line({ amount: null, createdAt: "2026-10-25T01:00:00.000Z", seq: 1 });
    const c = line({ createdAt: "2026-10-25T01:00:00.000Z", seq: 2 });
    const d = line({ direction: "in", createdAt: "2026-10-25T01:00:00.000Z", seq: 3 });
    // A later screenshot, handed over out of order.
    const e = line({ createdAt: "2026-10-25T02:00:00.000Z", seq: 0 });
    const groups = inboxGroups([e, d, c, b, a], [], categories);
    expect(groups.lookRight.map((i) => i.line.id)).toEqual([a.id, c.id, e.id]);
    expect(groups.needLook.map((i) => i.line.id)).toEqual([b.id, d.id]);
    expect(groups.lookRight.every((i) => i.reasons.length === 0)).toBe(true);
    expect(groups.needLook.map((i) => i.reasons[0])).toEqual(["amount", "incoming"]);
  });

  it("counts a line with no category, or a deleted one, as needing a look", () => {
    const none = line({ categoryId: "" });
    const gone = line({ categoryId: "deleted" });
    const groups = inboxGroups([none, gone], [], categories);
    expect(groups.lookRight).toEqual([]);
    expect(groups.needLook.map((i) => i.reasons)).toEqual([["category"], ["category"]]);
  });

  it("shows own transfers first, then incoming money, then a repeat, then what is missing", () => {
    const transfer = line({ ownTransfer: true, direction: "in", amount: null });
    const repeat = line({ store: "Kopi", amount: 30000, date: "2026-10-20" });
    const saved = spend({ store: " kopi ", amount: 30000, date: "2026-10-20" });
    const groups = inboxGroups([transfer, repeat], [saved], categories);
    expect(groups.needLook[0].reasons).toEqual(["ownTransfer", "incoming", "amount"]);
    expect(groups.needLook[1].reasons).toEqual(["repeat"]);
  });

  it("moves a kept line to Look right once nothing else is missing", () => {
    const kept = line({ direction: "out", kept: true, ownTransfer: true });
    const stillMissing = line({ direction: "out", kept: true, ownTransfer: true, amount: null });
    const groups = inboxGroups([kept, stillMissing], [], categories);
    expect(groups.lookRight.map((i) => i.line.id)).toEqual([kept.id]);
    expect(groups.needLook.map((i) => i.reasons)).toEqual([["amount"]]);
  });

  it("keeps a line that has just been accepted where it was, not as a repeat of itself", () => {
    const first = line({ seq: 0, store: "Kopi", amount: 30000 });
    const second = line({ seq: 1 });
    const third = line({ seq: 2 });
    // `first` is confirmed now: the data has dropped it from the waiting lines and has it as a spend.
    const saved = { ...first, status: "confirmed" as const };
    const ghost: Departing = {
      line: first,
      reasons: [],
      group: "lookRight",
      phase: "leaving",
    };
    const groups = inboxGroups([second, third], [saved], categories, new Map([[first.id, ghost]]));
    expect(groups.lookRight.map((i) => i.line.id)).toEqual([first.id, second.id, third.id]);
    expect(groups.needLook).toEqual([]);
  });

  it("shows a leaving line once while the data still has it", () => {
    const a = line();
    const ghost: Departing = { line: a, reasons: [], group: "lookRight", phase: "accepting" };
    const groups = inboxGroups([a], [], categories, new Map([[a.id, ghost]]));
    expect(groups.lookRight.map((i) => i.line.id)).toEqual([a.id]);
  });

  it("keeps a line thrown away from Need a look in that group, with the reason it had", () => {
    const a = line({ seq: 0, amount: null });
    const b = line({ seq: 1, amount: null });
    const ghost: Departing = { line: a, reasons: ["amount"], group: "needLook", phase: "leaving" };
    const groups = inboxGroups([b], [], categories, new Map([[a.id, ghost]]));
    expect(groups.needLook.map((i) => [i.line.id, i.reasons])).toEqual([
      [a.id, ["amount"]],
      [b.id, ["amount"]],
    ]);
  });
});

describe("the title and what is under it", () => {
  it("says how many are waiting, or that all are checked", () => {
    expect(inboxTitle(7)).toBe("7 to check");
    expect(inboxTitle(1)).toBe("1 to check");
    expect(inboxTitle(0)).toBe("All checked");
  });

  it("says how old the oldest line is, with the year only when it is not this year", () => {
    const lines = [{ date: "2026-10-24" }, { date: "2026-10-22" }, { date: "" }, { date: "2026-10-23" }];
    expect(inboxSub(lines, "2026-10-25")).toBe("Oldest is from Thu 22 Oct");
    expect(inboxSub([{ date: "2025-12-30" }], "2026-10-25")).toBe("Oldest is from Tue 30 Dec 2025");
  });

  it("says nothing is waiting, and says nothing when no line has a date", () => {
    expect(inboxSub([], "2026-10-25")).toBe("Nothing is waiting.");
    expect(inboxSub([{ date: "" }], "2026-10-25")).toBe("");
  });

  it("words the jump link for one and for many", () => {
    expect(jumpLabel(1)).toBe("1 needs a look");
    expect(jumpLabel(2)).toBe("2 need a look");
  });
});

describe("the tick", () => {
  it("names the store and the amount", () => {
    expect(tickLabel({ store: "KOPI KENANGAN SCBD", amount: 28000 })).toBe(
      "Accept KOPI KENANGAN SCBD, Rp 28.000"
    );
    expect(tickLabel({ store: "TOKOPEDIA", amount: 1249000 })).toBe("Accept TOKOPEDIA, Rp 1.249.000");
  });
});

describe("the accept bar", () => {
  it("appears for two lines that look right, not for one", () => {
    expect(showAcceptBar(0)).toBe(false);
    expect(showAcceptBar(1)).toBe(false);
    expect(showAcceptBar(2)).toBe(true);
  });

  it("says 'the N that look right' while some need a look, and 'all N' when none do", () => {
    expect(acceptBarLabel({ ready: 5, needLook: 2, accepting: null })).toBe("Accept the 5 that look right");
    expect(acceptBarLabel({ ready: 5, needLook: 0, accepting: null })).toBe("Accept all 5");
  });

  it("says Accepting while it works, with the number it took", () => {
    expect(acceptBarLabel({ ready: 0, needLook: 2, accepting: 5 })).toBe("Accepting 5…");
  });

  it("accepts exactly the lines in Look right: the count is the group's size, never the lines that need a look", () => {
    const lines = [line(), line(), line(), line({ amount: null }), line({ direction: "in" }), line({ categoryId: "" })];
    const groups = inboxGroups(lines, [], categories);
    expect(groups.lookRight).toHaveLength(3);
    expect(groups.needLook).toHaveLength(3);
    expect(
      acceptBarLabel({ ready: groups.lookRight.length, needLook: groups.needLook.length, accepting: null })
    ).toBe("Accept the 3 that look right");
  });
});

describe("what is said afterwards", () => {
  it("adds up what was accepted", () => {
    expect(acceptedManyMessage([{ amount: 87450 }, { amount: 43000 }, { amount: 1249000 }])).toBe(
      "Accepted 3. Rp 1.379.450 added."
    );
  });

  it("says what was accepted or thrown away and how many are left", () => {
    expect(acceptedOneMessage({ store: "GRAB* A-7XK2", amount: 43000 }, 6)).toBe(
      "Accepted GRAB* A-7XK2, Rp 43.000. 6 lines left to check."
    );
    expect(acceptedOneMessage({ store: "NETFLIX.COM", amount: 186000 }, 1)).toBe(
      "Accepted NETFLIX.COM, Rp 186.000. 1 line left to check."
    );
    expect(acceptedOneMessage({ store: "NETFLIX.COM", amount: 186000 }, 0)).toBe(
      "Accepted NETFLIX.COM, Rp 186.000. Nothing left to check."
    );
    expect(thrownAwayMessage({ store: "SHOPEE" }, 2)).toBe("Thrown away SHOPEE. 2 lines left to check.");
    expect(thrownAwayMessage({ store: " " }, 2)).toBe("Thrown away a line with no store name. 2 lines left to check.");
  });

  it("says whether a kept line moved on or still needs something", () => {
    expect(keptMessage(false)).toBe("Kept. It moved to Look right.");
    expect(keptMessage(true)).toBe("Kept. One more thing is needed before it can be accepted.");
  });
});

describe("where focus goes when lines leave", () => {
  const order = ["a", "b", "c", "d"];

  it("goes to the line below", () => {
    expect(nextFocusId(order, new Set(["b"]))).toBe("c");
  });

  it("goes to the line above when the last one left", () => {
    expect(nextFocusId(order, new Set(["d"]))).toBe("c");
  });

  it("skips lines that left with it", () => {
    expect(nextFocusId(order, new Set(["b", "c"]))).toBe("d");
    expect(nextFocusId(order, new Set(["c", "d"]))).toBe("b");
  });

  it("is nothing when nothing is left, or nothing left", () => {
    expect(nextFocusId(order, new Set(order))).toBeNull();
    expect(nextFocusId(order, new Set(["z"]))).toBeNull();
  });
});
