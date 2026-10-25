// @vitest-environment jsdom
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi, type Mock } from "vitest";
import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { ToastProvider } from "@/components/ui/toast";
import { NET_SHORT } from "@/lib/offline";
import type { Category, Transaction } from "@/types";
import { Inbox, LEAVE_MS, type InboxActions } from "./inbox";

const online = vi.hoisted(() => ({ value: true }));
vi.mock("@/hooks/useOnline", () => ({ useOnline: () => online.value }));
// The inbox only needs the hook's type; its module opens Firestore, which a unit test never does.
vi.mock("@/hooks/useTransactions", () => ({}));

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  cleanup();
  online.value = true;
  vi.useRealTimers();
});

const categories: Category[] = [
  ["food", "Food & Drink", "🍽️"],
  ["groceries", "Groceries", "🛒"],
  ["transport", "Transport", "🚗"],
  ["home", "Home & Utilities", "🏠"],
  ["travel", "Travel", "✈️"],
].map(([id, name, emoji], order) => ({ id, name, emoji, color: "mint", order }));

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
    bankLine: { store: `STORE ${n}`, date: "2026-10-24", amountText: "28.000,00 DB" },
    ...over,
  };
}

type Mocks = { [K in keyof InboxActions]: ReturnType<typeof vi.fn> };

function makeActions(): Mocks {
  return {
    editWaitingLine: vi.fn(),
    acceptLine: vi.fn(async () => {}),
    acceptLines: vi.fn(async () => {}),
    throwAway: vi.fn(async () => {}),
    keepLine: vi.fn(async () => {}),
  };
}

type Setup = {
  waiting: Transaction[];
  spends?: Transaction[];
  actions?: Mocks;
  saveError?: string | null;
  editedId?: string | null;
  onCorrect?: Mock<(line: Transaction, focus?: "store" | "amount" | "date") => void>;
  tray?: ReactNode;
  firstUse?: boolean;
};

function ui({
  waiting,
  spends = [],
  actions = makeActions(),
  saveError = null,
  editedId = null,
  onCorrect = vi.fn(),
  tray,
  firstUse,
}: Setup) {
  return (
    <ToastProvider>
      <main id="main" tabIndex={-1}>
        <Inbox
          waiting={waiting}
          spends={spends}
          categories={categories}
          actions={actions as unknown as InboxActions}
          saveError={saveError}
          editedId={editedId}
          onCorrect={onCorrect}
          tray={tray}
          firstUse={firstUse}
          headAction={<button type="button">Add</button>}
          emptyPanel={<p>The empty panel</p>}
        />
      </main>
    </ToastProvider>
  );
}

function open(setup: Setup) {
  const actions = setup.actions ?? makeActions();
  const onCorrect = setup.onCorrect ?? vi.fn<(line: Transaction, focus?: "store" | "amount" | "date") => void>();
  const view = render(ui({ ...setup, actions, onCorrect }));
  return {
    actions,
    onCorrect,
    // What the data does after a write: the line is gone.
    update: (next: Partial<Setup>) => view.rerender(ui({ ...setup, actions, onCorrect, ...next })),
  };
}

const press = (name: string | RegExp) => fireEvent.click(screen.getByRole("button", { name }));
const toastText = () => document.getElementById("toast")?.textContent;
const liveText = () => document.getElementById("live")?.textContent;
const flush = async () => {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(0);
  });
};
const pass = async (ms: number) => {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(ms);
  });
};
// The live region is filled a moment after `announce`, so the same words said twice are read twice.
const announced = () => pass(40);

describe("the groups", () => {
  it("says how many are waiting and splits them into Look right and Need a look", () => {
    const a = line({ store: "KOPI KENANGAN" });
    const b = line({ store: "GRAB" });
    const c = line({ store: "ALFAMART", amount: null });
    open({ waiting: [a, b, c] });
    expect(screen.getByRole("heading", { level: 1 }).textContent).toBe("3 to check");
    const right = screen.getByRole("region", { name: /Look right/ });
    const look = screen.getByRole("region", { name: /Need a look/ });
    expect(within(right).getAllByRole("listitem")).toHaveLength(2);
    expect(within(look).getAllByRole("listitem")).toHaveLength(1);
    expect(within(look).getByText("Couldn't read the amount. Check it against the screenshot.")).toBeTruthy();
    expect(within(look).getByText("No amount")).toBeTruthy();
    expect(screen.getByRole("button", { name: "1 needs a look" })).toBeTruthy();
  });

  it("keeps the lines in the order they arrived", () => {
    const a = line({ store: "FIRST", seq: 0 });
    const b = line({ store: "SECOND", seq: 1 });
    const c = line({ store: "THIRD", seq: 2 });
    open({ waiting: [c, a, b] });
    const names = screen.getAllByRole("button", { name: /^(FIRST|SECOND|THIRD)$/ }).map((el) => el.textContent);
    expect(names).toEqual(["FIRST", "SECOND", "THIRD"]);
  });

  it("shows only the heading when nothing is waiting", () => {
    open({ waiting: [] });
    expect(screen.getByRole("heading", { level: 1 }).textContent).toBe("All checked");
    expect(screen.getByText("Nothing is waiting.")).toBeTruthy();
    expect(screen.queryByRole("region", { name: /Look right/ })).toBeNull();
  });
});

describe("the tick", () => {
  it("is named for the store and the amount", () => {
    open({ waiting: [line({ store: "TOKOPEDIA", amount: 1249000 })] });
    expect(screen.getByRole("button", { name: "Accept TOKOPEDIA, Rp 1.249.000" })).toBeTruthy();
  });

  it("accepts one line, shows it busy, then lets it leave and moves focus to the next", async () => {
    const a = line({ store: "FIRST", seq: 0 });
    const b = line({ store: "SECOND", seq: 1 });
    const c = line({ store: "THIRD", seq: 2 });
    const { actions, update } = open({ waiting: [a, b, c] });
    let finish = () => {};
    actions.acceptLine.mockImplementation(() => new Promise<void>((resolve) => (finish = resolve)));

    press("Accept SECOND, Rp 28.000");
    expect(actions.acceptLine).toHaveBeenCalledWith(b.id);
    expect(screen.getByRole("img", { name: "Accepting SECOND" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Accept SECOND, Rp 28.000" })).toBeNull();

    // The data drops the line the moment it is written; the row stays until it has left, and the
    // count drops with the row, not before.
    update({ waiting: [a, c], spends: [{ ...b, status: "confirmed" }] });
    expect(screen.getByText("SECOND")).toBeTruthy();
    expect(screen.getByRole("heading", { level: 1 }).textContent).toBe("3 to check");

    finish();
    await flush();
    await announced();
    expect(liveText()).toBe("Accepted SECOND, Rp 28.000. 2 lines left to check.");
    expect(screen.getByText("SECOND")).toBeTruthy();
    await pass(LEAVE_MS);
    expect(screen.queryByText("SECOND")).toBeNull();
    expect(screen.getByRole("heading", { level: 1 }).textContent).toBe("2 to check");
    expect(document.activeElement).toBe(screen.getByRole("button", { name: "Accept THIRD, Rp 28.000" }));
    // One tick has no toast.
    expect(toastText()).toBe("");
  });

  it("keeps the line and says why when accepting fails", async () => {
    const a = line({ store: "FIRST" });
    const b = line({ store: "SECOND" });
    const actions = makeActions();
    actions.acceptLine.mockRejectedValue(new Error("down"));
    vi.spyOn(console, "error").mockImplementation(() => {});
    open({ waiting: [a, b], actions });
    press("Accept FIRST, Rp 28.000");
    await flush();
    expect(screen.getByRole("button", { name: "Accept FIRST, Rp 28.000" })).toBeTruthy();
    expect(screen.getByText("Couldn't accept this one. Try again in a moment.")).toBeTruthy();
  });

  it("does nothing with no connection, dims, and says why", () => {
    online.value = false;
    const { actions } = open({ waiting: [line({ store: "FIRST" })] });
    const tick = screen.getByRole("button", { name: "Accept FIRST, Rp 28.000" });
    expect(tick.getAttribute("aria-disabled")).toBe("true");
    press("Accept FIRST, Rp 28.000");
    expect(actions.acceptLine).not.toHaveBeenCalled();
    expect(toastText()).toBe(NET_SHORT);
  });
});

describe("the accept bar", () => {
  it("says 'the N that look right' and accepts exactly the lines in Look right", async () => {
    const ok1 = line();
    const ok2 = line();
    const ok3 = line();
    const noAmount = line({ amount: null });
    const incoming = line({ direction: "in" });
    const noCategory = line({ categoryId: "" });
    const { actions } = open({ waiting: [ok1, noAmount, ok2, incoming, ok3, noCategory] });
    expect(screen.getByRole("heading", { level: 1 }).textContent).toBe("6 to check");
    press("Accept the 3 that look right");
    expect(actions.acceptLines).toHaveBeenCalledTimes(1);
    expect(actions.acceptLines).toHaveBeenCalledWith([ok1.id, ok2.id, ok3.id]);
    expect(screen.getByRole("button", { name: "Accepting 3…" }).getAttribute("aria-disabled")).toBe("true");
    await flush();
  });

  it("says 'all N' when nothing needs a look, then toasts what was added once the rows have gone", async () => {
    const a = line({ amount: 87450 });
    const b = line({ amount: 43000 });
    const { actions, update } = open({ waiting: [a, b] });
    press("Accept all 2");
    expect(actions.acceptLines).toHaveBeenCalledWith([a.id, b.id]);
    update({ waiting: [] });
    // The bar stays, busy, until the rows have left.
    expect(screen.getByRole("button", { name: "Accepting 2…" })).toBeTruthy();
    await flush();
    expect(toastText()).toBe("");
    await pass(LEAVE_MS);
    expect(toastText()).toBe("Accepted 2. Rp 130.450 added.");
    expect(screen.queryByRole("button", { name: /Accept/ })).toBeNull();
  });

  it("is not there for a single line, which has its own tick", () => {
    open({ waiting: [line(), line({ amount: null })] });
    expect(screen.queryByRole("button", { name: /Accept (all|the)/ })).toBeNull();
  });

  it("goes when no line looks right", () => {
    open({ waiting: [line({ amount: null }), line({ direction: "in" })] });
    expect(screen.queryByRole("button", { name: /Accept (all|the)/ })).toBeNull();
  });

  it("says why when accepting fails, and puts the lines back", async () => {
    const actions = makeActions();
    actions.acceptLines.mockRejectedValue(new Error("down"));
    vi.spyOn(console, "error").mockImplementation(() => {});
    open({ waiting: [line(), line()], actions });
    press("Accept all 2");
    await flush();
    expect(screen.getByText("Couldn't accept them. Try again in a moment.")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Accept all 2" })).toBeTruthy();
  });

  it("does nothing with no connection, dims, and says why", () => {
    online.value = false;
    const { actions } = open({ waiting: [line(), line()] });
    expect(screen.getByRole("button", { name: "Accept all 2" }).getAttribute("aria-disabled")).toBe("true");
    press("Accept all 2");
    expect(actions.acceptLines).not.toHaveBeenCalled();
    expect(toastText()).toBe(NET_SHORT);
  });
});

describe("with no connection in the open row", () => {
  it("refuses Throw away and says why", () => {
    online.value = false;
    const { actions } = open({ waiting: [line({ store: "FIRST" }), line()] });
    press("FIRST");
    press("Throw away");
    expect(actions.throwAway).not.toHaveBeenCalled();
    expect(toastText()).toBe(NET_SHORT);
    expect(screen.getByRole("button", { name: "FIRST" })).toBeTruthy();
  });

  it("refuses a category chosen in a picker opened before the connection went, and stays open", () => {
    const a = line({ store: "FIRST" });
    const { actions, update } = open({ waiting: [a, line()] });
    press("FIRST");
    press(/More/);
    online.value = false;
    update({});
    fireEvent.click(within(screen.getByRole("dialog", { name: "Choose a category" })).getByRole("button", { name: /Travel/ }));
    expect(actions.editWaitingLine).not.toHaveBeenCalled();
    expect(toastText()).toBe(NET_SHORT);
    expect(screen.getByRole("dialog", { name: "Choose a category" })).toBeTruthy();
  });
});

describe("the open row", () => {
  it("opens from the name, shows the crop, the note and the quick categories, and closes again", () => {
    const a = line({ store: "KOPI KENANGAN", categorySuggested: true });
    open({ waiting: [a, line()] });
    const name = screen.getByRole("button", { name: "KOPI KENANGAN" });
    expect(name.getAttribute("aria-expanded")).toBe("false");
    fireEvent.click(name);
    expect(name.getAttribute("aria-expanded")).toBe("true");
    expect(screen.getByText("From the screenshot")).toBeTruthy();
    expect(screen.getByText("28.000,00 DB")).toBeTruthy();
    expect(screen.getByLabelText("What did you buy?")).toBeTruthy();
    expect(screen.getByText("Suggested from the store name")).toBeTruthy();
    expect(screen.getByRole("button", { name: /Food & Drink/ }).getAttribute("aria-pressed")).toBe("true");
    fireEvent.click(name);
    expect(screen.queryByText("From the screenshot")).toBeNull();
  });

  it("shows the line's own amount on the crop when the screenshot's text is empty, or there is none", () => {
    const empty = line({ store: "FIRST", amount: 45000, bankLine: { store: "FIRST", date: "2026-10-24", amountText: "" } });
    const old = line({ store: "SECOND", amount: 12000, bankLine: undefined });
    open({ waiting: [empty, old] });
    fireEvent.click(screen.getByRole("button", { name: "FIRST" }));
    expect(screen.getByText("45.000,00 DB")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "SECOND" }));
    expect(screen.getByText("12.000,00 DB")).toBeTruthy();
  });

  it("keeps one row open at a time", () => {
    open({ waiting: [line({ store: "FIRST" }), line({ store: "SECOND" })] });
    fireEvent.click(screen.getByRole("button", { name: "FIRST" }));
    fireEvent.click(screen.getByRole("button", { name: "SECOND" }));
    expect(screen.getByRole("button", { name: "FIRST" }).getAttribute("aria-expanded")).toBe("false");
    expect(screen.getAllByText("From the screenshot")).toHaveLength(1);
  });

  it("keeps the note as it is typed", () => {
    const a = line({ store: "FIRST", description: "latte" });
    const { actions } = open({ waiting: [a, line()] });
    fireEvent.click(screen.getByRole("button", { name: "FIRST" }));
    const note = screen.getByLabelText("What did you buy?") as HTMLInputElement;
    expect(note.value).toBe("latte");
    fireEvent.change(note, { target: { value: "latte and a roll" } });
    expect(actions.editWaitingLine).toHaveBeenCalledWith(a.id, { description: "latte and a roll" });
  });

  it("changes the category with a chip, and from the full list behind More", () => {
    const a = line({ store: "FIRST" });
    const { actions } = open({ waiting: [a, line()] });
    fireEvent.click(screen.getByRole("button", { name: "FIRST" }));
    press(/Groceries/);
    expect(actions.editWaitingLine).toHaveBeenLastCalledWith(a.id, { categoryId: "groceries" });
    press(/More/);
    const picker = screen.getByRole("dialog", { name: "Choose a category" });
    fireEvent.click(within(picker).getByRole("button", { name: /Travel/ }));
    expect(actions.editWaitingLine).toHaveBeenLastCalledWith(a.id, { categoryId: "travel" });
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("opens the form from Edit details, and throws the line away", async () => {
    const a = line({ store: "FIRST" });
    const { actions, onCorrect } = open({ waiting: [a, line()] });
    fireEvent.click(screen.getByRole("button", { name: "FIRST" }));
    press("Edit details");
    expect(onCorrect).toHaveBeenCalledWith(a);
    press("Throw away");
    expect(actions.throwAway).toHaveBeenCalledWith(a.id);
    await flush();
    await announced();
    expect(liveText()).toBe("Thrown away FIRST. 1 line left to check.");
  });

  it("can't be typed in with no connection", () => {
    online.value = false;
    open({ waiting: [line({ store: "FIRST" }), line()] });
    fireEvent.click(screen.getByRole("button", { name: "FIRST" }));
    expect(screen.getByLabelText("What did you buy?").hasAttribute("readonly")).toBe(true);
  });
});

describe("Need a look", () => {
  it("offers 'Throw away' first and 'It's a spend' second for money coming in, and keeps it", async () => {
    const a = line({ store: "TRSF E-BANKING CR", direction: "in" });
    const { actions } = open({ waiting: [a] });
    expect(screen.getByText("Money coming in, so it isn't counted as spending.")).toBeTruthy();
    const buttons = within(screen.getByRole("region", { name: /Need a look/ })).getAllByRole("button");
    expect(buttons.map((b) => b.textContent)).toEqual(["Throw away", "It's a spend"]);
    press("It's a spend");
    expect(actions.keepLine).toHaveBeenCalledWith(a.id);
    await flush();
    await announced();
    expect(liveText()).toBe("Kept. It moved to Look right.");
  });

  it("says when a kept line still needs something", async () => {
    const a = line({ direction: "in", amount: null });
    open({ waiting: [a] });
    // Incoming money is the reason shown; keeping it leaves the missing amount.
    press("It's a spend");
    await flush();
    await announced();
    expect(liveText()).toBe("Kept. One more thing is needed before it can be accepted.");
  });

  it("explains an own-account transfer first, then the missing amount", () => {
    open({ waiting: [line({ store: "TOP UP GOPAY", ownTransfer: true, direction: "in", amount: null })] });
    expect(screen.getByText("Money moving between your own accounts, so it isn't counted yet.")).toBeTruthy();
    expect(screen.queryByText("Couldn't read the amount. Check it against the screenshot.")).toBeNull();
  });

  it("explains a repeat of a saved spend", () => {
    const saved = line({ status: "confirmed", store: "NETFLIX.COM", amount: 186000, date: "2026-10-23" });
    const again = line({ store: "NETFLIX.COM", amount: 186000, date: "2026-10-23" });
    const { actions } = open({ waiting: [again], spends: [saved] });
    expect(screen.getByText("You already have this one: same store, day and amount.")).toBeTruthy();
    press("Keep it");
    expect(actions.keepLine).toHaveBeenCalledWith(again.id);
  });

  it("opens the form on the field that is missing", () => {
    const a = line({ store: "ALFAMART", amount: null });
    const b = line({ store: "", categoryId: "food", amount: 5000 });
    const c = line({ store: "WARUNG", date: "" });
    const { onCorrect } = open({ waiting: [a, b, c] });
    press("Add amount");
    expect(onCorrect).toHaveBeenLastCalledWith(a, "amount");
    press("Add store");
    expect(onCorrect).toHaveBeenLastCalledWith(b, "store");
    press("Add date");
    expect(onCorrect).toHaveBeenLastCalledWith(c, "date");
    expect(screen.getByText("No store name")).toBeTruthy();
    expect(screen.getByText("No date")).toBeTruthy();
  });

  it("chooses a category from the full list, and says nothing was lost", () => {
    const a = line({ store: "CV MAJU JAYA", categoryId: "" });
    const { actions } = open({ waiting: [a] });
    press("Choose category");
    const picker = screen.getByRole("dialog", { name: "Choose a category" });
    fireEvent.click(within(picker).getByRole("button", { name: /Transport/ }));
    expect(actions.editWaitingLine).toHaveBeenCalledWith(a.id, { categoryId: "transport" });
  });

  it("throws a line away, and puts it back with a message if that fails", async () => {
    const a = line({ store: "ALFAMART", amount: null });
    const actions = makeActions();
    actions.throwAway.mockRejectedValue(new Error("down"));
    vi.spyOn(console, "error").mockImplementation(() => {});
    open({ waiting: [a], actions });
    press("Throw away");
    await flush();
    await pass(LEAVE_MS);
    expect(screen.getByText("ALFAMART")).toBeTruthy();
    expect(screen.getByText("Couldn't throw this one away. Try again in a moment.")).toBeTruthy();
  });

  it("jumps to the group from the link in Look right, and focuses its heading", () => {
    open({ waiting: [line(), line({ amount: null })] });
    const scroll = vi.fn();
    window.HTMLElement.prototype.scrollIntoView = scroll;
    press("1 needs a look");
    expect(scroll).toHaveBeenCalled();
    expect(document.activeElement?.textContent).toMatch(/Need a look/);
  });

  it("dims the buttons that write with no connection, and says why", () => {
    online.value = false;
    const { actions } = open({ waiting: [line({ direction: "in" })] });
    press("It's a spend");
    expect(actions.keepLine).not.toHaveBeenCalled();
    expect(toastText()).toBe(NET_SHORT);
  });
});

describe("a failed save", () => {
  it("is shown beside the line that was being edited, not instead of the screen", () => {
    const a = line({ store: "FIRST" });
    const b = line({ store: "SECOND" });
    open({ waiting: [a, b], saveError: "firestore says no", editedId: b.id });
    const rows = screen.getAllByRole("listitem");
    expect(within(rows[1]).getByText("Couldn't save your last change. Try again in a moment.")).toBeTruthy();
    expect(within(rows[0]).queryByText(/Couldn't save/)).toBeNull();
    expect(screen.queryByText(/firestore says no/)).toBeNull();
    expect(screen.getByRole("heading", { level: 1 }).textContent).toBe("2 to check");
  });

  it("is said under the title when that line is gone", () => {
    const a = line({ store: "FIRST" });
    open({ waiting: [a], saveError: "no", editedId: "gone" });
    const head = screen.getByRole("heading", { level: 1 }).parentElement as HTMLElement;
    expect(within(head).getByText("Couldn't save your last change. Try again in a moment.")).toBeTruthy();
  });

  it("is not shown when nothing failed", () => {
    open({ waiting: [line()], saveError: null, editedId: "w1" });
    expect(screen.queryByText(/Couldn't save/)).toBeNull();
  });
});

describe("with nothing waiting", () => {
  it("says all is checked and shows the empty panel", () => {
    open({ waiting: [] });
    expect(screen.getByRole("heading", { level: 1 }).textContent).toBe("All checked");
    expect(screen.getByText("Nothing is waiting.")).toBeTruthy();
    expect(screen.getByText("The empty panel")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Add" })).toBeTruthy();
  });

  it("asks for a first spending on a first open", () => {
    open({ waiting: [], firstUse: true });
    expect(screen.getByRole("heading", { level: 1 }).textContent).toBe("Add your first spending");
    expect(screen.getByText("Screenshots from your banking app are read for you.")).toBeTruthy();
  });

  it("shows the tray, and not the empty panel, while one is up", () => {
    open({ waiting: [], tray: <p>The tray</p> });
    expect(screen.getByRole("heading", { level: 1 }).textContent).toBe("Nothing to check yet");
    expect(screen.getByText("The tray")).toBeTruthy();
    expect(screen.queryByText("The empty panel")).toBeNull();
    expect(screen.queryByText("Nothing is waiting.")).toBeNull();
  });

  it("shows the empty panel only after the last line has left, and keeps the tray above the lines", () => {
    open({ waiting: [line()], tray: <p>The tray</p> });
    expect(screen.queryByText("The empty panel")).toBeNull();
    expect(screen.getByRole("heading", { level: 1 }).textContent).toBe("1 to check");
    expect(screen.getByText("The tray")).toBeTruthy();
  });
});
