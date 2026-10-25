import { expect, test, type Page } from "@playwright/test";
import { buildSeed } from "../scripts/seed-emulator";
import { clearEmulator, listDocs, writeDocs, type EmulatorDoc } from "../scripts/test-env";

// Categories (design notes §8, O1 to O6): the list with counts, add, a duplicate name refused,
// change (it shows on a spend), reorder, delete an unused one, delete a used one by moving its
// spends and waiting lines first. The data is the sixteen starter categories and a few spends, so
// every count below can be worked out.

const TODAY = "2026-10-21";

const spend = (id: string, date: string, amount: number, store: string, categoryId: string, description = ""): EmulatorDoc => ({
  id,
  data: { amount, store, description, categoryId, date, source: "ocr", status: "confirmed", createdAt: "2026-10-01T08:00:00.000Z" },
});

// Food & Drink has three spends and one waiting line; Groceries one; Transport two. Investments
// and Education have none.
const TRANSACTIONS: EmulatorDoc[] = [
  spend("t1", "2026-10-20", 28_000, "Kopi Kenangan", "food-drink", "Latte with Dina"),
  spend("t2", "2026-10-19", 35_000, "Warung Bu Sri", "food-drink"),
  spend("t3", "2026-10-12", 60_000, "Bakmi GM", "food-drink"),
  spend("t4", "2026-10-05", 120_000, "Superindo", "groceries"),
  spend("t5", "2026-10-10", 650_000, "Pertamina", "transport", "Fuel"),
  spend("t6", "2026-10-08", 25_000, "Gojek", "transport"),
  {
    id: "w1",
    data: {
      amount: 15_000,
      store: "Indomaret",
      description: "",
      categoryId: "food-drink",
      date: "2026-10-20",
      source: "ocr",
      status: "pending_review",
      createdAt: "2026-10-20T08:00:00.000Z",
      seq: 0,
      categorySuggested: true,
    },
  },
];

async function seed() {
  const data = buildSeed("normal", TODAY);
  await clearEmulator();
  await writeDocs("meta", data.meta);
  // Travel keeps an old hex colour, as the live data does; the screen reads it as the nearest swatch.
  await writeDocs(
    "categories",
    data.categories.map((c) => (c.id === "travel" ? { ...c, data: { ...c.data, color: "#2F7FC4" } } : c))
  );
  await writeDocs("transactions", TRANSACTIONS);
}

async function open(page: Page) {
  await page.goto("/categories");
  await expect(page.getByRole("heading", { level: 1, name: "Categories" })).toBeVisible({ timeout: 15_000 });
  await expect(rows(page).first()).toBeVisible();
}

const rows = (page: Page) => page.getByRole("main").getByRole("listitem");
const names = (page: Page) => rows(page).locator(":scope > :is(button, div) > span:nth-child(2) > span:first-child").allTextContents();
const row = (page: Page, name: string) => rows(page).filter({ hasText: name });
const form = (page: Page) => page.getByRole("dialog", { name: /^(Add a category|Change category)$/ });
const question = (page: Page) => page.getByRole("alertdialog", { name: "Delete this category?" });
const toast = (page: Page) => page.locator("#toast");
const savedCategories = async () => (await listDocs("categories")).sort((a, b) => Number(a.data.order) - Number(b.data.order));
const byId = async (id: string) => (await savedCategories()).find((c) => c.id === id);

const STARTER_ORDER = [
  "Food & Drink",
  "Groceries",
  "Transport",
  "Home & Utilities",
  "Business",
  "Health",
  "Shopping",
  "Entertainment",
  "Church & Giving",
  "Investments",
  "Education",
  "Travel",
  "Relationship",
  "Subscriptions",
  "Telecommunications",
  "Other",
];

test.describe("Categories", () => {
  test("every category in the owner's order, with how many spends it has", async ({ page }) => {
    await seed();
    await open(page);

    await expect(page.getByText("16 categories. Tap one to change it.")).toBeVisible();
    expect(await names(page)).toEqual(STARTER_ORDER);
    // Spends only: the waiting line in Food & Drink isn't counted.
    await expect(row(page, "Food & Drink")).toContainText("3 spends");
    await expect(row(page, "Groceries")).toContainText("1 spend");
    await expect(row(page, "Groceries")).not.toContainText("1 spends");
    await expect(row(page, "Transport")).toContainText("2 spends");
    await expect(row(page, "Investments")).toContainText("No spends yet");
    await expect(page.getByRole("link", { name: "Home" })).toHaveAttribute("href", "/");
  });

  test("add a category: only the name can be missing, and it goes at the end", async ({ page }) => {
    await seed();
    await open(page);

    await page.getByRole("button", { name: "Add a category" }).click();
    await expect(form(page)).toBeVisible();
    await expect(form(page).getByLabel("Name")).toBeFocused();
    await expect(form(page).getByText("Still needed: a name.")).toBeVisible();
    // Tapping the button anyway says what is missing and does nothing else.
    // (Playwright treats aria-disabled as not clickable, so the press is forced.)
    await form(page).getByRole("button", { name: "Add category" }).click({ force: true });
    await expect(form(page).getByText("Add a name.")).toBeVisible();
    await expect(form(page).getByRole("button", { name: "Add category" })).toHaveAttribute("aria-disabled", "true");

    await form(page).getByLabel("Name").fill("Pets");
    await expect(form(page).getByText("Still needed")).toHaveCount(0);
    await form(page).getByRole("button", { name: "Emoji 🐶" }).click();
    await expect(form(page).getByRole("button", { name: "Emoji 🐶" })).toHaveAttribute("aria-pressed", "true");
    await form(page).getByRole("radio", { name: "Plum" }).click();
    await expect(form(page).getByRole("radio", { name: "Plum" })).toHaveAttribute("aria-checked", "true");
    await form(page).getByRole("button", { name: "Add category" }).click();

    await expect(form(page)).toHaveCount(0);
    await expect(toast(page)).toContainText("Added Pets at the end of the list.");
    await expect(page.getByText("17 categories. Tap one to change it.")).toBeVisible();
    expect((await names(page)).at(-1)).toBe("Pets");
    await expect(row(page, "Pets")).toContainText("No spends yet");

    // Saved as a swatch name, last in the order, and still there after a reload.
    const saved = (await savedCategories()).at(-1)!;
    expect(saved.data).toMatchObject({ name: "Pets", emoji: "🐶", color: "plum", order: 16 });
    await page.reload();
    await expect(row(page, "Pets")).toBeVisible();
    expect((await names(page)).at(-1)).toBe("Pets");
  });

  test("a new category starts as different as it can be, and any emoji can be typed", async ({ page }) => {
    await seed();
    await open(page);
    await page.getByRole("button", { name: "Add a category" }).click();
    // Every colour but Cyan is used by a starter (Travel's old hex counts as Sky), so Cyan is the start.
    await expect(form(page).getByRole("radio", { checked: true })).toHaveAccessibleName("Cyan");

    await form(page).getByLabel("Name").fill("Pets");
    await form(page).getByLabel("Or type or paste your own").fill("x");
    await expect(form(page).getByText("Choose an emoji.")).toBeVisible();
    await expect(form(page).getByText("Still needed: an emoji.")).toBeVisible();
    await form(page).getByLabel("Or type or paste your own").fill("🙂🙃");
    await expect(form(page).getByLabel("Or type or paste your own")).toHaveValue("🙂");
    await form(page).getByRole("button", { name: "Add category" }).click();
    await expect(toast(page)).toContainText("Added Pets");
    expect((await savedCategories()).at(-1)!.data.emoji).toBe("🙂");
  });

  test("a name that is already used is refused, capitals ignored", async ({ page }) => {
    await seed();
    await open(page);
    await page.getByRole("button", { name: "Add a category" }).click();
    await form(page).getByLabel("Name").fill("groceries");
    // The message shows once the field is left (or the button is pressed).
    await form(page).getByLabel("Name").blur();
    await expect(form(page).getByText("You already have a category called “groceries”.")).toBeVisible();
    await form(page).getByRole("button", { name: "Add category" }).click({ force: true });
    await expect(form(page)).toBeVisible();
    await form(page).getByRole("button", { name: "Cancel" }).click();
    await expect(form(page)).toHaveCount(0);
    await expect(rows(page)).toHaveCount(16);
    expect(await savedCategories()).toHaveLength(16);

    // Changing a category to another one's name is refused too; keeping its own name is fine.
    await row(page, "Transport").getByRole("button").click();
    await form(page).getByLabel("Name").fill("FOOD & DRINK");
    await form(page).getByLabel("Name").blur();
    await expect(form(page).getByText("You already have a category called “FOOD & DRINK”.")).toBeVisible();
    await form(page).getByLabel("Name").fill("Transport");
    await expect(form(page).getByText("You already have")).toHaveCount(0);
  });

  test("change a category: it shows on its spends, and an old hex colour is saved as a swatch name", async ({ page }) => {
    await seed();
    await open(page);

    await row(page, "Food & Drink").getByRole("button").click();
    await expect(form(page)).toBeVisible();
    await expect(form(page).getByText("Changes show on every spend in this category.")).toBeVisible();
    await expect(form(page).getByLabel("Name")).toHaveValue("Food & Drink");
    await expect(form(page).getByRole("button", { name: "Emoji 🍔" })).toHaveAttribute("aria-pressed", "false");
    await form(page).getByLabel("Name").fill("Eating out");
    await form(page).getByRole("button", { name: "Emoji 🍔" }).click();
    await form(page).getByRole("radio", { name: "Rose" }).click();
    await form(page).getByRole("button", { name: "Save changes" }).click();
    await expect(form(page)).toHaveCount(0);
    await expect(toast(page)).toContainText("Saved changes to Eating out.");
    await expect(row(page, "Eating out")).toContainText("3 spends");
    expect((await byId("food-drink"))!.data).toMatchObject({ name: "Eating out", emoji: "🍔", color: "rose", order: 0 });

    // Every screen reads the same list: its spends now say "Eating out".
    await page.goto("/transactions");
    await expect(page.getByRole("heading", { level: 1, name: "All transactions" })).toBeVisible({ timeout: 15_000 });
    await expect(page.getByRole("main").getByRole("listitem").filter({ hasText: "Kopi Kenangan" })).toContainText("Eating out · Latte with Dina");

    // Travel was stored as a hex colour: it reads as Sky, and saving writes the name.
    await page.goto("/categories");
    await row(page, "Travel").getByRole("button").click();
    await expect(form(page).getByRole("radio", { name: "Sky" })).toHaveAttribute("aria-checked", "true");
    await form(page).getByRole("button", { name: "Save changes" }).click();
    await expect(toast(page)).toContainText("Saved changes to Travel.");
    expect((await byId("travel"))!.data.color).toBe("sky");
  });

  test("change the order with the arrows, with the first four marked as quick choices", async ({ page }) => {
    await seed();
    await open(page);

    await page.getByRole("button", { name: "Change order" }).click();
    await expect(page.getByRole("button", { name: "Done" })).toHaveAttribute("aria-pressed", "true");
    await expect(page.getByText("Use the arrows to move a category. The first four are the quick choices")).toBeVisible();
    await expect(page.getByRole("button", { name: "Add a category" })).toHaveAttribute("aria-disabled", "true");
    // The dashed line sits after the fourth row and is not read out.
    await expect(page.getByText("Quick choices end here")).toBeVisible();
    await expect(page.getByRole("button", { name: "Move up: Food & Drink, now 1 of 16" })).toHaveAttribute("aria-disabled", "true");
    await expect(page.getByRole("button", { name: "Move down: Other, now 16 of 16" })).toHaveAttribute("aria-disabled", "true");

    // Groceries up to first. Focus follows it to its new place; "up" is now off, so it lands on "down".
    await page.getByRole("button", { name: "Move up: Groceries, now 2 of 16" }).click();
    await expect(page.getByRole("button", { name: "Move down: Groceries, now 1 of 16" })).toBeFocused();
    await expect(page.getByRole("button", { name: "Move up: Groceries, now 1 of 16" })).toHaveAttribute("aria-disabled", "true");
    // Pressing the first row's disabled "up" does nothing.
    await page.getByRole("button", { name: "Move up: Groceries, now 1 of 16" }).click({ force: true });
    // Health down two places.
    await page.getByRole("button", { name: "Move down: Health, now 6 of 16" }).click();
    await page.getByRole("button", { name: "Move down: Health, now 7 of 16" }).click();
    const expected = [...STARTER_ORDER];
    expected.splice(1, 1);
    expected.unshift("Groceries");
    expected.splice(expected.indexOf("Health"), 1);
    expected.splice(expected.indexOf("Shopping") + 2, 0, "Health");
    // Groceries, Food & Drink, Transport, Home & Utilities, Business, Shopping, Entertainment, Health, ...
    await expect.poll(() => names(page)).toEqual(expected);

    await page.getByRole("button", { name: "Done" }).click();
    await expect(page.getByRole("button", { name: "Change order" })).toBeVisible();
    await expect(page.getByText("16 categories. Tap one to change it.")).toBeVisible();
    expect(await names(page)).toEqual(expected);
    await expect.poll(async () => (await savedCategories()).map((c) => c.data.name)).toEqual(expected);

    await page.reload();
    await expect(row(page, "Groceries")).toBeVisible();
    expect(await names(page)).toEqual(expected);
  });

  test("delete a category nothing uses: asked first, then gone for good", async ({ page }) => {
    await seed();
    await open(page);

    await row(page, "Investments").getByRole("button").click();
    await form(page).getByRole("button", { name: "Delete this category" }).click();
    await expect(question(page)).toBeVisible();
    await expect(question(page).getByRole("heading", { name: "Delete Investments?" })).toBeVisible();
    await expect(question(page).getByText("No spends use it. It is removed for good.")).toBeVisible();
    // The safe button comes first and has focus; Cancel goes back to the form with nothing deleted.
    await expect(question(page).getByRole("button", { name: "Cancel" })).toBeFocused();
    await question(page).getByRole("button", { name: "Cancel" }).click();
    await expect(question(page)).toHaveCount(0);
    await expect(form(page)).toBeVisible();
    expect(await byId("investments")).toBeTruthy();

    await form(page).getByRole("button", { name: "Delete this category" }).click();
    await question(page).getByRole("button", { name: "Delete", exact: true }).click();
    await expect(question(page)).toHaveCount(0);
    await expect(form(page)).toHaveCount(0);
    await expect(toast(page)).toContainText("Deleted Investments.");
    await expect(page.getByText("15 categories. Tap one to change it.")).toBeVisible();
    await expect(row(page, "Investments")).toHaveCount(0);
    expect(await byId("investments")).toBeUndefined();
  });

  test("delete a category that is used: choose where its spends and waiting lines go first", async ({ page }) => {
    await seed();
    await open(page);

    await row(page, "Food & Drink").getByRole("button").click();
    await form(page).getByRole("button", { name: "Delete this category" }).click();
    await expect(question(page).getByText("3 spends use it. 1 waiting line does too. Choose where they go first.")).toBeVisible();
    // No default: the button says so and does nothing; the category itself is not a place to move to.
    const go = question(page).getByRole("button", { name: "Choose a category" });
    await expect(go).toHaveAttribute("aria-disabled", "true");
    await go.click({ force: true });
    await expect(question(page)).toBeVisible();
    expect(await byId("food-drink")).toBeTruthy();
    await expect(question(page).getByRole("button", { name: /Food & Drink/ })).toHaveCount(0);
    await expect(question(page).getByRole("button", { name: /Groceries/ })).toBeVisible();

    await question(page).getByRole("button", { name: /Groceries/ }).click();
    await expect(question(page).getByRole("button", { name: /Groceries/ })).toHaveAttribute("aria-pressed", "true");
    await question(page).getByRole("button", { name: "Move 4 and delete" }).click();

    await expect(question(page)).toHaveCount(0);
    await expect(form(page)).toHaveCount(0);
    await expect(toast(page)).toContainText("Deleted Food & Drink. 4 spends moved to Groceries.");
    await expect(row(page, "Food & Drink")).toHaveCount(0);
    // Groceries had one spend and took the three.
    await expect(row(page, "Groceries")).toContainText("4 spends");

    expect(await byId("food-drink")).toBeUndefined();
    const moved = (await listDocs("transactions")).filter((t) => ["t1", "t2", "t3", "w1"].includes(t.id));
    expect(moved.map((t) => t.data.categoryId)).toEqual(["groceries", "groceries", "groceries", "groceries"]);
    // The waiting line's category is now a choice, not a suggestion.
    expect(moved.find((t) => t.id === "w1")!.data.categorySuggested).toBeUndefined();

    await page.reload();
    await expect(row(page, "Groceries")).toContainText("4 spends");
  });
});
