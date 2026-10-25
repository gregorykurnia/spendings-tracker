// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { ToastProvider } from "@/components/ui/toast";
import { CategoryInUseError } from "@/hooks/useCategories";
import { NET_ERROR } from "@/lib/offline";
import type { Category } from "@/types";
import { CategoryForm, type CategoryFormActions } from "./category-form";
import type { CategoryFormMode } from "./organise";

const online = vi.hoisted(() => ({ value: true }));
vi.mock("@/hooks/useOnline", () => ({ useOnline: () => online.value }));
// The form needs the hook's type and its in-use error; the real module opens Firestore.
vi.mock("@/hooks/useCategories", () => ({ CategoryInUseError: class CategoryInUseError extends Error {} }));

afterEach(() => {
  cleanup();
  online.value = true;
});

const categories: Category[] = [
  ["food", "Food & Drink", "🍽️", "apricot"],
  ["groceries", "Groceries", "🛒", "mint"],
  ["travel", "Travel", "✈️", "#2F7FC4"],
].map(([id, name, emoji, color], order) => ({ id, name, emoji, color, order }));

function makeActions() {
  return {
    addCategory: vi.fn(async () => "new"),
    updateCategory: vi.fn(async () => {}),
    categoryUsage: vi.fn(async () => ({ spends: 0, waiting: 0 })),
    deleteCategory: vi.fn(async () => {}),
  };
}

function open(mode: CategoryFormMode, actions = makeActions(), list = categories, onClose = vi.fn()) {
  render(
    <ToastProvider>
      <CategoryForm mode={mode} categories={list} actions={actions as unknown as CategoryFormActions} onClose={onClose} />
    </ToastProvider>
  );
  return { actions, onClose };
}

const type = (label: string | RegExp, value: string) =>
  fireEvent.change(screen.getByLabelText(label), { target: { value } });
const press = (name: string | RegExp) => fireEvent.click(screen.getByRole("button", { name }));
const toastText = () => document.getElementById("toast")?.textContent;

describe("add a category", () => {
  it("starts on a tag and a colour no category uses, needing only a name", () => {
    open({ kind: "add" });
    expect(screen.getByRole("dialog", { name: "Add a category" })).toBeTruthy();
    expect(document.activeElement).toBe(screen.getByLabelText("Name"));
    expect(screen.getByText("Still needed: a name.")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Add category" }).getAttribute("aria-disabled")).toBe("true");
    // Apricot and mint are used, sky stands for the old hex value, so the next unused one is lilac.
    const colours = screen.getAllByRole("radio");
    expect(colours).toHaveLength(13);
    expect(colours.filter((c) => c.getAttribute("aria-checked") === "true").map((c) => c.getAttribute("aria-label"))).toEqual(["Rose"]);
    expect(screen.getAllByRole("button", { name: /^Emoji / })).toHaveLength(28);
  });

  it("refuses an empty name, saying so by the field, and refuses a name already used", () => {
    const { actions } = open({ kind: "add" });
    press("Add category");
    expect(screen.getByText("Add a name.")).toBeTruthy();
    expect(actions.addCategory).not.toHaveBeenCalled();
    type("Name", "groceries");
    expect(screen.getByText("You already have a category called “groceries”.")).toBeTruthy();
    press("Add category");
    expect(actions.addCategory).not.toHaveBeenCalled();
  });

  it("asks for an emoji when what was typed isn't one", () => {
    open({ kind: "add" });
    type("Name", "Pets");
    type("Or type or paste your own", "x");
    expect(screen.getByText("Choose an emoji.")).toBeTruthy();
    expect(screen.getByText("Still needed: an emoji.")).toBeTruthy();
    type("Or type or paste your own", "🙂🙃");
    expect(screen.queryByText("Choose an emoji.")).toBeNull();
    expect((screen.getByLabelText("Or type or paste your own") as HTMLInputElement).value).toBe("🙂");
  });

  it("adds it with the chosen emoji and a swatch name, then says where it went", async () => {
    const { actions, onClose } = open({ kind: "add" });
    type("Name", "  Pets ");
    press("Emoji 🐶");
    fireEvent.click(screen.getByRole("radio", { name: "Plum" }));
    press("Add category");
    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(actions.addCategory).toHaveBeenCalledWith({ name: "Pets", emoji: "🐶", color: "plum" });
    expect(toastText()).toBe("Added Pets at the end of the list.");
  });

  it("with no connection says nothing was saved and keeps what was typed", async () => {
    online.value = false;
    const { actions, onClose } = open({ kind: "add" });
    type("Name", "Pets");
    press("Add category");
    expect(await screen.findByText(NET_ERROR)).toBeTruthy();
    expect(actions.addCategory).not.toHaveBeenCalled();
    expect(onClose).not.toHaveBeenCalled();
    expect((screen.getByLabelText("Name") as HTMLInputElement).value).toBe("Pets");
  });

  it("keeps the form open with a plain message when saving fails", async () => {
    const actions = makeActions();
    actions.addCategory.mockRejectedValueOnce(new Error("boom"));
    vi.spyOn(console, "error").mockImplementation(() => {});
    const { onClose } = open({ kind: "add" }, actions);
    type("Name", "Pets");
    press("Add category");
    expect(await screen.findByText("Couldn't save this. Try again in a moment.")).toBeTruthy();
    expect(onClose).not.toHaveBeenCalled();
  });
});

describe("change a category", () => {
  it("says the change shows everywhere, and always saves a swatch name for an old hex colour", async () => {
    const { actions, onClose } = open({ kind: "change", category: categories[2] });
    expect(screen.getByText("Changes show on every spend in this category.")).toBeTruthy();
    expect(screen.getByRole("radio", { name: "Sky" }).getAttribute("aria-checked")).toBe("true");
    type("Name", "Trips");
    press("Save changes");
    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(actions.updateCategory).toHaveBeenCalledWith("travel", { name: "Trips", emoji: "✈️", color: "sky" });
    expect(toastText()).toBe("Saved changes to Trips.");
  });

  it("lets a category keep its own name", async () => {
    const { actions, onClose } = open({ kind: "change", category: categories[0] });
    press("Save changes");
    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(actions.updateCategory).toHaveBeenCalled();
  });

  it("offers delete, but not for the last category", () => {
    open({ kind: "change", category: categories[0] });
    expect(screen.getByRole("button", { name: "Delete this category" })).toBeTruthy();
    cleanup();
    open({ kind: "change", category: categories[0] }, makeActions(), [categories[0]]);
    expect(screen.queryByRole("button", { name: "Delete this category" })).toBeNull();
  });
});

describe("delete a category", () => {
  const ask = () => screen.getByRole("alertdialog", { name: "Delete this category?" });

  it("checks first, then removes an unused one for good", async () => {
    const { actions, onClose } = open({ kind: "change", category: categories[0] });
    press("Delete this category");
    expect(within(ask()).getByText("Checking if it is used…")).toBeTruthy();
    expect(await within(ask()).findByText("No spends use it. It is removed for good.")).toBeTruthy();
    fireEvent.click(within(ask()).getByRole("button", { name: "Delete" }));
    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(actions.deleteCategory).toHaveBeenCalledWith("food", undefined);
    expect(toastText()).toBe("Deleted Food & Drink.");
  });

  it("makes you choose where the spends and waiting lines go, with no default", async () => {
    const actions = makeActions();
    actions.categoryUsage.mockResolvedValue({ spends: 69, waiting: 1 });
    const { onClose } = open({ kind: "change", category: categories[0] }, actions);
    press("Delete this category");
    const dialog = ask();
    expect(await within(dialog).findByText("69 spends use it. 1 waiting line does too. Choose where they go first.")).toBeTruthy();
    const go = within(dialog).getByRole("button", { name: "Choose a category" });
    expect(go.getAttribute("aria-disabled")).toBe("true");
    fireEvent.click(go);
    expect(actions.deleteCategory).not.toHaveBeenCalled();
    // The category itself is not a place to move to.
    expect(within(dialog).queryByRole("button", { name: /Food & Drink/ })).toBeNull();
    fireEvent.click(within(dialog).getByRole("button", { name: "Groceries" }));
    fireEvent.click(within(dialog).getByRole("button", { name: "Move 70 and delete" }));
    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(actions.deleteCategory).toHaveBeenCalledWith("food", "groceries");
    expect(toastText()).toBe("Deleted Food & Drink. 70 spends moved to Groceries.");
  });

  it("asks again when something was added to it after the check", async () => {
    const actions = makeActions();
    actions.deleteCategory.mockRejectedValueOnce(new CategoryInUseError("still used"));
    actions.categoryUsage.mockResolvedValueOnce({ spends: 0, waiting: 0 }).mockResolvedValue({ spends: 1, waiting: 0 });
    open({ kind: "change", category: categories[0] }, actions);
    press("Delete this category");
    fireEvent.click(await within(ask()).findByRole("button", { name: "Delete" }));
    expect(await within(ask()).findByText("1 spend uses it. Choose where it goes first.")).toBeTruthy();
  });

  it("says when the check failed and offers to try again", async () => {
    const actions = makeActions();
    actions.categoryUsage.mockRejectedValueOnce(new Error("boom"));
    vi.spyOn(console, "error").mockImplementation(() => {});
    open({ kind: "change", category: categories[0] }, actions);
    press("Delete this category");
    expect(await within(ask()).findByText("Couldn't check whether it is used. Try again in a moment.")).toBeTruthy();
    fireEvent.click(within(ask()).getByRole("button", { name: "Try again" }));
    expect(await within(ask()).findByText("No spends use it. It is removed for good.")).toBeTruthy();
  });

  it("cancel goes back to the form", async () => {
    open({ kind: "change", category: categories[0] });
    press("Delete this category");
    await within(ask()).findByText("No spends use it. It is removed for good.");
    fireEvent.click(within(ask()).getByRole("button", { name: "Cancel" }));
    expect(screen.queryByRole("alertdialog")).toBeNull();
    expect(screen.getByRole("dialog", { name: "Change category" })).toBeTruthy();
  });
});
