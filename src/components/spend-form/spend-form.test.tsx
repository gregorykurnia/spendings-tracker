// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { ToastProvider } from "@/components/ui/toast";
import { NET_ERROR } from "@/lib/offline";
import type { Category, Transaction } from "@/types";
import { SpendForm, type SpendFormActions } from "./spend-form";
import type { SpendFormMode } from "./rules";

const online = vi.hoisted(() => ({ value: true }));
vi.mock("@/hooks/useOnline", () => ({ useOnline: () => online.value }));
// The form only needs the hook's type; its module opens Firestore, which a unit test never does.
vi.mock("@/hooks/useTransactions", () => ({}));

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

const saved: Transaction = {
  id: "t1",
  amount: 28000,
  store: "KOPI JANJI JIWA",
  description: "latte",
  categoryId: "food",
  date: "2026-10-20",
  source: "manual",
  status: "confirmed",
  createdAt: "2026-10-20T01:00:00.000Z",
};

const waiting: Transaction = {
  ...saved,
  id: "w1",
  source: "ocr",
  status: "pending_review",
  bankLine: { store: "KOPI JANJI JIWA", date: "2026-10-20", amountText: "28.000,00 DB" },
};

function makeActions(): { [K in keyof SpendFormActions]: ReturnType<typeof vi.fn> } {
  return {
    addSpend: vi.fn(async () => "new"),
    updateSpend: vi.fn(async () => {}),
    editWaitingLine: vi.fn(),
    flushEdits: vi.fn(async () => {}),
    acceptLine: vi.fn(async () => {}),
    deleteTransaction: vi.fn(async () => {}),
  };
}

function open(mode: SpendFormMode, actions = makeActions(), onClose = vi.fn()) {
  render(
    <ToastProvider>
      <SpendForm mode={mode} categories={categories} actions={actions as unknown as SpendFormActions} onClose={onClose} />
    </ToastProvider>
  );
  return { actions, onClose };
}

const type = (label: string | RegExp, value: string) =>
  fireEvent.change(screen.getByLabelText(label), { target: { value } });
const press = (name: string | RegExp) => fireEvent.click(screen.getByRole("button", { name }));
const toastText = () => document.getElementById("toast")?.textContent;

describe("type in a spend", () => {
  it("is called 'Type in a spend', starts on today's date and says what is still needed", () => {
    open({ kind: "add" });
    expect(screen.getByRole("dialog", { name: "Type in a spend" })).toBeTruthy();
    expect(screen.getByText("Still needed: store, amount and category.")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Add spend" }).getAttribute("aria-disabled")).toBe("true");
    expect(document.activeElement).toBe(screen.getByLabelText("Store"));
  });

  it("answers a press while not ready by naming what is missing and focusing the first", () => {
    const { actions } = open({ kind: "add" });
    press("Add spend");
    expect(actions.addSpend).not.toHaveBeenCalled();
    expect(screen.getByText("Add the store name.")).toBeTruthy();
    expect(screen.getByText("Enter an amount above Rp 0.")).toBeTruthy();
    expect(screen.getByText("Choose a category.")).toBeTruthy();
    expect(screen.getByLabelText("Store").getAttribute("aria-invalid")).toBe("true");
    expect(document.activeElement).toBe(screen.getByLabelText("Store"));
  });

  it("shows a field's message only after leaving the field", () => {
    open({ kind: "add" });
    expect(screen.queryByText("Add the store name.")).toBeNull();
    fireEvent.blur(screen.getByLabelText("Store"));
    expect(screen.getByText("Add the store name.")).toBeTruthy();
  });

  it("formats the amount with dots as it is typed", () => {
    open({ kind: "add" });
    type("Amount", "1234567");
    expect((screen.getByLabelText("Amount") as HTMLInputElement).value).toBe("1.234.567");
  });

  it("saves the trimmed spend through addSpend, then closes with a message", async () => {
    const { actions, onClose } = open({ kind: "add" });
    type("Store", "  KOPI  ");
    type("Amount", "28000");
    press(/Food & Drink/);
    type(/Note/, " latte ");
    expect(screen.queryByText(/Still needed/)).toBeNull();
    press("Add spend");
    await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1));
    expect(actions.addSpend).toHaveBeenCalledWith({
      store: "KOPI",
      amount: 28000,
      date: expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/),
      categoryId: "food",
      description: "latte",
    });
    expect(toastText()).toBe("Added KOPI, Rp 28.000.");
  });

  it("keeps the sheet open, with what was typed, when the save fails", async () => {
    const actions = makeActions();
    actions.addSpend.mockRejectedValueOnce(new Error("boom"));
    vi.spyOn(console, "error").mockImplementation(() => {});
    const { onClose } = open({ kind: "add" }, actions);
    type("Store", "KOPI");
    type("Amount", "28000");
    press(/Food & Drink/);
    press("Add spend");
    expect(await screen.findByText("Couldn't save this. Try again in a moment.")).toBeTruthy();
    expect(onClose).not.toHaveBeenCalled();
    expect((screen.getByLabelText("Store") as HTMLInputElement).value).toBe("KOPI");
    expect(screen.getByRole("button", { name: "Add spend" }).getAttribute("aria-busy")).toBeNull();
  });

  it("shows busy on the main button and can't be dismissed while saving", async () => {
    const actions = makeActions();
    let finish = () => {};
    actions.addSpend.mockReturnValueOnce(new Promise<string>((resolve) => (finish = () => resolve("x"))));
    const { onClose } = open({ kind: "add" }, actions);
    type("Store", "KOPI");
    type("Amount", "28000");
    press(/Food & Drink/);
    press("Add spend");
    const main = screen.getByRole("button", { name: "Saving…" });
    expect(main.getAttribute("aria-busy")).toBe("true");
    expect((screen.getByLabelText("Store") as HTMLInputElement).readOnly).toBe(true);
    fireEvent.keyDown(document, { key: "Escape" });
    expect(onClose).not.toHaveBeenCalled();
    await act(async () => finish());
    await waitFor(() => expect(onClose).toHaveBeenCalled());
  });

  it("never saves with no connection: says so, and keeps what was typed", () => {
    online.value = false;
    const { actions, onClose } = open({ kind: "add" });
    type("Store", "KOPI");
    type("Amount", "28000");
    press(/Food & Drink/);
    press("Add spend");
    expect(actions.addSpend).not.toHaveBeenCalled();
    expect(onClose).not.toHaveBeenCalled();
    const alert = screen.getByRole("alert");
    expect(alert.textContent).toBe(NET_ERROR);
    expect((screen.getByLabelText("Store") as HTMLInputElement).value).toBe("KOPI");
    expect((screen.getByLabelText("Amount") as HTMLInputElement).value).toBe("28.000");
  });

  it("offers every category behind 'More', and picking one chooses it", () => {
    open({ kind: "add" });
    expect(screen.queryByRole("button", { name: /Travel/ })).toBeNull();
    press(/More/);
    const picker = screen.getByRole("dialog", { name: "Choose a category" });
    fireEvent.click(within(picker).getByRole("button", { name: /Travel/ }));
    expect(screen.queryByRole("dialog", { name: "Choose a category" })).toBeNull();
    // The chosen one now sits among the quick choices, pressed.
    expect(screen.getByRole("button", { name: /Travel/ }).getAttribute("aria-pressed")).toBe("true");
  });
});

describe("change a saved spend", () => {
  it("is called 'Change spend' with 'Save changes', and says where it came from", () => {
    open({ kind: "change", spend: saved });
    expect(screen.getByRole("dialog", { name: "Change spend" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Save changes" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Cancel" })).toBeTruthy();
    expect(screen.getByText("Typed in by hand")).toBeTruthy();
    expect((screen.getByLabelText("Store") as HTMLInputElement).value).toBe("KOPI JANJI JIWA");
    expect((screen.getByLabelText("Amount") as HTMLInputElement).value).toBe("28.000");
    expect(screen.getByRole("button", { name: /Food & Drink/ }).getAttribute("aria-pressed")).toBe("true");
  });

  it("says a screenshot spend came from a screenshot", () => {
    open({ kind: "change", spend: { ...saved, source: "ocr" } });
    expect(screen.getByText("Added from a screenshot")).toBeTruthy();
  });

  it("saves through updateSpend and writes nothing until then", async () => {
    const { actions, onClose } = open({ kind: "change", spend: saved });
    type("Amount", "30000");
    expect(actions.updateSpend).not.toHaveBeenCalled();
    press("Save changes");
    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(actions.updateSpend).toHaveBeenCalledWith("t1", {
      store: "KOPI JANJI JIWA",
      amount: 30000,
      date: "2026-10-20",
      categoryId: "food",
      description: "latte",
    });
    expect(toastText()).toBe("Saved changes.");
  });

  it("asks for a new category at once when the old one was removed, and won't save without", () => {
    const { actions } = open({ kind: "change", spend: { ...saved, categoryId: "gone" } });
    expect(screen.getByText("That category was removed. Choose another.")).toBeTruthy();
    expect(screen.getByText("Still needed: category.")).toBeTruthy();
    press("Save changes");
    expect(actions.updateSpend).not.toHaveBeenCalled();
  });
});

describe("delete a saved spend", () => {
  it("asks once, with the safe button first and focused", () => {
    open({ kind: "change", spend: saved });
    press(/Delete this spend/);
    const ask = screen.getByRole("alertdialog", { name: "Delete this spend?" });
    expect(within(ask).getByText("KOPI JANJI JIWA")).toBeTruthy();
    expect(within(ask).getByText("Rp 28.000")).toBeTruthy();
    expect(within(ask).getByText("It is removed for good and stops counting in your totals.")).toBeTruthy();
    const buttons = within(ask).getAllByRole("button").map((b) => b.textContent);
    expect(buttons.slice(-2)).toEqual(["Cancel", "Delete"]);
    expect(document.activeElement).toBe(within(ask).getByRole("button", { name: "Cancel" }));
  });

  it("Cancel goes back to the form without deleting", () => {
    const { actions } = open({ kind: "change", spend: saved });
    press(/Delete this spend/);
    fireEvent.click(within(screen.getByRole("alertdialog")).getByRole("button", { name: "Cancel" }));
    expect(screen.queryByRole("alertdialog")).toBeNull();
    expect(screen.getByRole("dialog", { name: "Change spend" })).toBeTruthy();
    expect(actions.deleteTransaction).not.toHaveBeenCalled();
  });

  it("Delete removes it, says so, and closes everything", async () => {
    const { actions, onClose } = open({ kind: "change", spend: saved });
    press(/Delete this spend/);
    fireEvent.click(within(screen.getByRole("alertdialog")).getByRole("button", { name: "Delete" }));
    await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1));
    expect(actions.deleteTransaction).toHaveBeenCalledWith("t1");
    expect(toastText()).toBe("Deleted KOPI JANJI JIWA, Rp 28.000.");
  });

  it("says 'Deleting…' and can't be dismissed meanwhile", async () => {
    const actions = makeActions();
    let finish = () => {};
    actions.deleteTransaction.mockReturnValueOnce(new Promise<void>((resolve) => (finish = resolve)));
    open({ kind: "change", spend: saved }, actions);
    press(/Delete this spend/);
    const ask = screen.getByRole("alertdialog");
    fireEvent.click(within(ask).getByRole("button", { name: "Delete" }));
    expect(within(ask).getByRole("button", { name: "Deleting…" }).getAttribute("aria-busy")).toBe("true");
    fireEvent.keyDown(document, { key: "Escape" });
    expect(screen.getByRole("alertdialog")).toBeTruthy();
    await act(async () => finish());
  });

  it("with no connection says nothing was deleted", () => {
    online.value = false;
    const { actions } = open({ kind: "change", spend: saved });
    press(/Delete this spend/);
    fireEvent.click(within(screen.getByRole("alertdialog")).getByRole("button", { name: "Delete" }));
    expect(actions.deleteTransaction).not.toHaveBeenCalled();
    expect(within(screen.getByRole("alertdialog")).getByRole("alert").textContent).toBe(NET_ERROR);
  });

  it("is not offered when typing in a spend or correcting a waiting line", () => {
    open({ kind: "add" });
    expect(screen.queryByRole("button", { name: /Delete this spend/ })).toBeNull();
    cleanup();
    open({ kind: "correct", line: waiting });
    expect(screen.queryByRole("button", { name: /Delete this spend/ })).toBeNull();
  });
});

describe("correct a waiting line", () => {
  it("is called 'Edit details' with 'Done' and 'Accept', and shows the crop", () => {
    open({ kind: "correct", line: waiting });
    expect(screen.getByRole("dialog", { name: "Edit details" })).toBeTruthy();
    expect(screen.getByText("Changes are kept as you go.")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Done" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Accept" })).toBeTruthy();
    expect(screen.getByText("From the screenshot")).toBeTruthy();
    expect(screen.getByText("28.000,00 DB")).toBeTruthy();
  });

  it("keeps what is typed as it is typed, without saving the line as a spend", () => {
    const { actions } = open({ kind: "correct", line: waiting });
    type("Store", "KOPI JANJI JIWA 2");
    expect(actions.editWaitingLine).toHaveBeenLastCalledWith("w1", { store: "KOPI JANJI JIWA 2" });
    type("Amount", "31500");
    expect(actions.editWaitingLine).toHaveBeenLastCalledWith("w1", { amount: 31500 });
    type(/Note/, "with a friend");
    expect(actions.editWaitingLine).toHaveBeenLastCalledWith("w1", { description: "with a friend" });
    press(/Transport/);
    expect(actions.editWaitingLine).toHaveBeenLastCalledWith("w1", { categoryId: "transport" });
    expect(actions.acceptLine).not.toHaveBeenCalled();
    expect(actions.addSpend).not.toHaveBeenCalled();
  });

  it("shows the line's own values, so edits kept by the hook appear at once", () => {
    const { rerender } = render(
      <ToastProvider>
        <SpendForm
          mode={{ kind: "correct", line: waiting }}
          categories={categories}
          actions={makeActions() as unknown as SpendFormActions}
          onClose={() => {}}
        />
      </ToastProvider>
    );
    rerender(
      <ToastProvider>
        <SpendForm
          mode={{ kind: "correct", line: { ...waiting, store: "EDITED" } }}
          categories={categories}
          actions={makeActions() as unknown as SpendFormActions}
          onClose={() => {}}
        />
      </ToastProvider>
    );
    expect((screen.getByLabelText("Store") as HTMLInputElement).value).toBe("EDITED");
  });

  it("'Done' writes what is waiting and closes; nothing typed is lost", async () => {
    const { actions, onClose } = open({ kind: "correct", line: waiting });
    type("Store", "X");
    press("Done");
    await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1));
    expect(actions.flushEdits).toHaveBeenCalledWith("w1");
  });

  it("closes on Escape the same way", async () => {
    const { actions, onClose } = open({ kind: "correct", line: waiting });
    fireEvent.keyDown(document, { key: "Escape" });
    await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1));
    expect(actions.flushEdits).toHaveBeenCalledWith("w1");
  });

  it("'Accept' saves the line as a spend and says so", async () => {
    const { actions, onClose } = open({ kind: "correct", line: waiting });
    press("Accept");
    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(actions.acceptLine).toHaveBeenCalledWith("w1");
    expect(toastText()).toBe("Accepted KOPI JANJI JIWA, Rp 28.000.");
  });

  it("won't accept a line with no amount, and points at the screenshot", () => {
    const { actions } = open({ kind: "correct", line: { ...waiting, amount: null }, focus: "amount" });
    expect(document.activeElement).toBe(screen.getByLabelText("Amount"));
    expect(screen.getByText("Still needed: amount.")).toBeTruthy();
    press("Accept");
    expect(actions.acceptLine).not.toHaveBeenCalled();
    expect(screen.getByText("Couldn't read this amount. Check the screenshot and type it in.")).toBeTruthy();
  });

  it("shows the crop from the line's own values when it has no bank line", () => {
    open({ kind: "correct", line: { ...waiting, bankLine: undefined, direction: "in" } });
    expect(screen.getByText("28.000,00 CR")).toBeTruthy();
  });

  it("says 'Suggested from the store name' until the category is touched", () => {
    open({ kind: "correct", line: { ...waiting, categorySuggested: true } });
    expect(screen.getByText("Suggested from the store name")).toBeTruthy();
    press(/Transport/);
    expect(screen.queryByText("Suggested from the store name")).toBeNull();
  });

  it("asks to decide first about incoming money or an own transfer", () => {
    const { actions } = open({ kind: "correct", line: { ...waiting, direction: "in" } });
    expect(screen.getByText("Decide about this one first: throw it away, or say it's a spend.")).toBeTruthy();
    press("Accept");
    expect(actions.acceptLine).not.toHaveBeenCalled();
  });

  it("with no connection can't be typed in, dims the category choices, and says why", () => {
    online.value = false;
    const { actions } = open({ kind: "correct", line: waiting });
    expect((screen.getByLabelText("Store") as HTMLInputElement).readOnly).toBe(true);
    expect(screen.getByRole("alert").textContent).toBe(NET_ERROR);
    press(/Transport/);
    expect(actions.editWaitingLine).not.toHaveBeenCalled();
    press("Accept");
    expect(actions.acceptLine).not.toHaveBeenCalled();
  });

  it("keeps the form open when accepting fails", async () => {
    const actions = makeActions();
    actions.acceptLine.mockRejectedValueOnce(new Error("boom"));
    vi.spyOn(console, "error").mockImplementation(() => {});
    const { onClose } = open({ kind: "correct", line: waiting }, actions);
    press("Accept");
    expect(await screen.findByText("Couldn't save this. Try again in a moment.")).toBeTruthy();
    expect(onClose).not.toHaveBeenCalled();
  });
});
