import { expect, test, type Page } from "@playwright/test";
import { buildSeed } from "../scripts/seed-emulator";
import { clearEmulator, listDocs, writeDocs, type EmulatorDoc } from "../scripts/test-env";

// All transactions (design notes §8, F1 to F7): type in a spend, search, a filter and clear all,
// change a spend, delete one. The browser's clock is fixed to Wednesday 21 October 2026 so every
// date, span and total below can be worked out.

const TODAY = "2026-10-21";
const NOW = new Date(2026, 9, 21, 10, 0, 0);

const spend = (
  id: string,
  date: string,
  amount: number,
  store: string,
  categoryId: string,
  description = "",
  source: "ocr" | "manual" = "ocr"
): EmulatorDoc => ({
  id,
  data: {
    amount,
    store,
    description,
    categoryId,
    date,
    source,
    status: "confirmed",
    createdAt: "2026-10-01T08:00:00.000Z",
  },
});

// Newest first they are t1 to t7. Total Rp 1.179.000. Screenshot: t1, t3, t4, t6. Typed in: t2, t5, t7.
// "Old Shop" has a category that was removed. The last one is from last year.
const SPENDS = [
  spend("t1", "2026-10-20", 28_000, "Kopi Kenangan", "food-drink", "Latte with Dina"),
  spend("t2", "2026-10-19", 35_000, "Warung Bu Sri", "food-drink", "", "manual"),
  spend("t3", "2026-10-10", 650_000, "Pertamina", "transport", "Fuel"),
  spend("t4", "2026-10-05", 120_000, "Superindo", "groceries"),
  spend("t5", "2026-09-14", 150_000, "Tokopedia", "shopping", "kopi grinder", "manual"),
  spend("t6", "2026-09-03", 10_000, "Old Shop", "removed-category"),
  spend("t7", "2025-12-31", 186_000, "Netflix", "subscriptions", "", "manual"),
];

const waitingLine = (id: string): EmulatorDoc => ({
  id,
  data: {
    amount: 15_000,
    store: "Indomaret",
    description: "",
    categoryId: "groceries",
    date: "2026-10-20",
    source: "ocr",
    status: "pending_review",
    createdAt: "2026-10-20T08:00:00.000Z",
    seq: 0,
  },
});

async function seed(spends: EmulatorDoc[] = SPENDS, waiting: EmulatorDoc[] = []) {
  const data = buildSeed("normal", TODAY);
  await clearEmulator();
  await writeDocs("meta", data.meta);
  await writeDocs("categories", data.categories);
  if (spends.length + waiting.length) await writeDocs("transactions", [...spends, ...waiting]);
}

async function open(page: Page, query = "") {
  await page.clock.setFixedTime(NOW);
  await page.goto(`/transactions${query}`);
  await expect(page.getByRole("heading", { level: 1, name: "All transactions" })).toBeVisible({ timeout: 15_000 });
}

const rows = (page: Page) => page.getByRole("main").getByRole("listitem");
const count = (page: Page) => page.locator("main p[aria-live=polite]");
const search = (page: Page) => page.getByRole("searchbox", { name: "Search store or note" });
const filtersButton = (page: Page) => page.getByRole("button", { name: /^Filters/ });
const filterChips = (page: Page) => page.getByRole("group", { name: "Filters on" });
const sheet = (page: Page) => page.getByRole("dialog", { name: "Filters" });
const stores = async (page: Page) => (await rows(page).locator("button > span:nth-child(2) > span:first-child").allTextContents());

test.describe("All transactions", () => {
  test("every saved spend, newest first, each readable at a glance, waiting lines left out", async ({ page }) => {
    await seed(SPENDS, [waitingLine("w-1")]);
    await open(page);

    await expect(count(page)).toHaveText("7 spends · Rp 1.179.000");
    expect(await stores(page)).toEqual([
      "Kopi Kenangan",
      "Warung Bu Sri",
      "Pertamina",
      "Superindo",
      "Tokopedia",
      "Old Shop",
      "Netflix",
    ]);
    const first = rows(page).nth(0);
    await expect(first).toContainText("Food & Drink · Latte with Dina");
    await expect(first).toContainText("Rp 28.000");
    await expect(first).toContainText("Tue 20 Oct");
    await expect(first).toContainText("From a screenshot.");
    await expect(rows(page).nth(1)).toContainText("Typed in.");
    // The year shows only when it isn't this year; a removed category is said in words.
    await expect(rows(page).nth(6)).toContainText("Wed 31 Dec 2025");
    await expect(rows(page).nth(5)).toContainText("No category");
    // Nothing is filtered, so there are no chips and no number on the button.
    await expect(filterChips(page)).toHaveCount(0);
    await expect(filtersButton(page)).toHaveText("Filters");
    await expect(page.getByRole("link", { name: "Home" })).toHaveAttribute("href", "/");
  });

  test("the order: newest, oldest, highest and lowest amount", async ({ page }) => {
    await seed();
    await open(page);
    const order = page.getByRole("combobox", { name: "Order" });
    await order.selectOption("Highest amount");
    expect((await stores(page)).slice(0, 3)).toEqual(["Pertamina", "Netflix", "Tokopedia"]);
    await order.selectOption("Lowest amount");
    expect((await stores(page)).slice(0, 2)).toEqual(["Old Shop", "Kopi Kenangan"]);
    await order.selectOption("Oldest first");
    expect((await stores(page)).slice(0, 2)).toEqual(["Netflix", "Old Shop"]);
    await order.selectOption("Newest first");
    expect((await stores(page))[0]).toBe("Kopi Kenangan");
  });

  test("search looks in the store and the note, all words, capitals ignored, and marks the match", async ({ page }) => {
    await seed();
    await open(page);

    await search(page).fill("KOPI");
    await expect(count(page)).toHaveText("2 spends · Rp 178.000");
    expect(await stores(page)).toEqual(["Kopi Kenangan", "Tokopedia"]);
    // The store of one and the note of the other are marked.
    await expect(rows(page).nth(0).locator("mark")).toHaveText("Kopi");
    await expect(rows(page).nth(1).locator("mark")).toHaveText("kopi");

    await search(page).fill("kopi dina");
    expect(await stores(page)).toEqual(["Kopi Kenangan"]);
    await expect(rows(page).nth(0).locator("mark")).toHaveText(["Kopi", "Dina"]);

    // The search is not a filter: no number on the button, no chip.
    await expect(filtersButton(page)).toHaveText("Filters");
    await expect(filterChips(page)).toHaveCount(0);

    // Its own clear button empties it and puts the cursor back in the box.
    await page.getByRole("button", { name: "Clear search" }).click();
    await expect(search(page)).toHaveValue("");
    await expect(search(page)).toBeFocused();
    await expect(count(page)).toHaveText("7 spends · Rp 1.179.000");
    await expect(page.getByRole("button", { name: "Clear search" })).toHaveCount(0);
  });

  test("no results says what was asked and one button clears the search and the filters", async ({ page }) => {
    await seed();
    await open(page, "?cat=food-drink");
    await search(page).fill("zzz");
    await expect(count(page)).toHaveText("0 spends");
    await expect(page.getByText("No spends match.")).toBeVisible();
    await expect(page.getByText("Nothing for “zzz” with 1 filter on.")).toBeVisible();
    await page.getByRole("button", { name: "Clear search and filters" }).click();
    await expect(search(page)).toHaveValue("");
    await expect(search(page)).toBeFocused();
    await expect(filterChips(page)).toHaveCount(0);
    await expect(count(page)).toHaveText("7 spends · Rp 1.179.000");
    await expect(page.locator("#live")).toHaveText("Search and filters cleared.");
  });

  test("filters apply as you go, show as lemon chips, and clear one by one or all together", async ({ page }) => {
    await seed();
    await open(page);

    await filtersButton(page).click();
    const dialog = sheet(page);
    await expect(dialog).toBeVisible();
    await expect(dialog.getByRole("button", { name: "Clear all" })).toHaveAttribute("aria-disabled", "true");

    // Categories: tap several; the main button says what you'll see.
    await dialog.getByRole("button", { name: /Food & Drink/ }).click();
    await expect(dialog.getByRole("button", { name: "Show 2 spends" })).toBeVisible();
    await dialog.getByRole("button", { name: /Transport/ }).click();
    await expect(dialog.getByRole("button", { name: "Show 3 spends" })).toBeVisible();
    // Amount: at least.
    await dialog.getByLabel("At least").fill("100000");
    await expect(dialog.getByLabel("At least")).toHaveValue("100.000");
    await expect(dialog.getByRole("button", { name: "Show 1 spend" })).toBeVisible();
    await dialog.getByLabel("At most").fill("50000");
    await expect(dialog.getByText("The most is below the least.")).toBeVisible();
    await expect(dialog.getByRole("button", { name: "No spends match" })).toHaveAttribute("aria-disabled", "true");
    await dialog.getByLabel("At most").fill("");
    // Source.
    await dialog.getByRole("button", { name: "Typed in" }).click();
    await expect(dialog.getByRole("button", { name: "No spends match" })).toBeVisible();
    await dialog.getByRole("button", { name: "Screenshot" }).click();
    await expect(dialog.getByRole("button", { name: "Show 1 spend" })).toBeVisible();

    await dialog.getByRole("button", { name: "Show 1 spend" }).click();
    await expect(dialog).toHaveCount(0);
    await expect(filtersButton(page)).toBeFocused();
    await expect(filtersButton(page)).toContainText("3");
    await expect(filterChips(page).getByRole("button")).toHaveText([
      "Food & Drink, Transport",
      "Rp 100.000 or more",
      "Screenshot",
      "Clear all",
    ]);
    expect(await stores(page)).toEqual(["Pertamina"]);
    await expect(count(page)).toHaveText("1 spend · Rp 650.000");

    // One chip off: the others stay.
    await page.getByRole("button", { name: "Remove filter: Rp 100.000 or more" }).click();
    await expect(filtersButton(page)).toContainText("2");
    expect(await stores(page)).toEqual(["Kopi Kenangan", "Pertamina"]);
    await expect(page.locator("#live")).toHaveText("Filter removed. 2 spends.");
    await expect(filtersButton(page)).toBeFocused();

    // Clear all on the page takes every filter off but keeps the search.
    await search(page).fill("pert");
    await filterChips(page).getByRole("button", { name: "Clear all" }).click();
    await expect(filterChips(page)).toHaveCount(0);
    await expect(search(page)).toHaveValue("pert");
    expect(await stores(page)).toEqual(["Pertamina"]);
    await expect(page.locator("#live")).toHaveText("Filters cleared.");

    // Clear all in the sheet does the same.
    await search(page).fill("");
    await filtersButton(page).click();
    await sheet(page).getByRole("button", { name: /Groceries/ }).click();
    await sheet(page).getByRole("button", { name: "Clear all" }).click();
    await expect(sheet(page).getByRole("button", { name: "Show 7 spends" })).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(filterChips(page)).toHaveCount(0);
    await expect(filtersButton(page)).toBeFocused();
  });

  test("dates: a month stepped earlier and later, a custom span, a one-sided span", async ({ page }) => {
    await seed();
    await open(page);
    await filtersButton(page).click();
    const dialog = sheet(page);

    await dialog.getByRole("button", { name: "A month" }).click();
    await expect(dialog.getByText("October 2026")).toBeVisible();
    await expect(dialog.getByRole("button", { name: "Show 4 spends" })).toBeVisible();
    // Later is off in the current month; earlier goes to September.
    await expect(dialog.getByRole("button", { name: "Later month" })).toHaveAttribute("aria-disabled", "true");
    await dialog.getByRole("button", { name: "Earlier month" }).click();
    await expect(dialog.getByText("September 2026")).toBeVisible();
    await expect(dialog.getByRole("button", { name: "Show 2 spends" })).toBeVisible();
    await expect(dialog.getByRole("button", { name: "Later month" })).not.toHaveAttribute("aria-disabled", "true");

    // A day: the same date, jumped to another.
    await dialog.getByRole("button", { name: "A day" }).click();
    await dialog.getByLabel("Jump to a date").fill("2026-09-14");
    await expect(dialog.getByRole("button", { name: "Show 1 spend" })).toBeVisible();

    // Custom starts from the days the kind covered.
    await dialog.getByRole("button", { name: "Custom" }).click();
    await expect(dialog.getByLabel("From")).toHaveValue("2026-09-14");
    await expect(dialog.getByLabel("To")).toHaveValue("2026-09-14");
    await dialog.getByLabel("To").fill("2026-09-01");
    await expect(dialog.getByText("The end is before the start.")).toBeVisible();
    await dialog.getByLabel("From").fill("2026-09-01");
    await dialog.getByLabel("To").fill("2026-09-30");
    await expect(dialog.getByRole("button", { name: "Show 2 spends" })).toBeVisible();
    await dialog.getByLabel("To").fill("");
    await dialog.getByLabel("From").fill("2026-10-06");
    await expect(dialog.getByRole("button", { name: "Show 3 spends" })).toBeVisible();
    await dialog.getByRole("button", { name: "Show 3 spends" }).click();
    await expect(filterChips(page).getByRole("button").first()).toHaveText("From 6 Oct 2026");

    // All time drops it.
    await filtersButton(page).click();
    await sheet(page).getByRole("button", { name: "All time" }).click();
    await page.keyboard.press("Escape");
    await expect(filterChips(page)).toHaveCount(0);
  });

  test("arriving from Spending starts with its category and span on, and a way back", async ({ page }) => {
    await seed();
    await open(page, "?cat=transport&from=2026-10-01&to=2026-10-21&label=October+so+far&back=spending");

    await expect(filterChips(page).getByRole("button")).toHaveText(["October so far", "Transport", "Clear all"]);
    expect(await stores(page)).toEqual(["Pertamina"]);
    await expect(page.getByRole("link", { name: "Spending" })).toHaveAttribute("href", "/spending");

    await page.getByRole("button", { name: "Remove filter: Transport" }).click();
    expect(await stores(page)).toEqual(["Kopi Kenangan", "Warung Bu Sri", "Pertamina", "Superindo"]);
  });

  test("a category on Spending opens its spends here, and the menu's All transactions starts clean", async ({ page }) => {
    await seed();
    await page.clock.setFixedTime(NOW);
    await page.goto("/spending");
    await expect(page.getByRole("heading", { level: 1, name: "Spending" })).toBeVisible({ timeout: 15_000 });
    await page.getByRole("link", { name: /Transport/ }).click();
    await expect(page.getByRole("heading", { level: 1, name: "All transactions" })).toBeVisible();
    await expect(filterChips(page).getByRole("button")).toHaveText(["October so far", "Transport", "Clear all"]);
    expect(await stores(page)).toEqual(["Pertamina"]);

    // The back link goes to Spending; the menu's link to this page starts with nothing filtered.
    await page.getByRole("button", { name: "Menu" }).click();
    await page.getByRole("dialog", { name: "Menu" }).getByRole("link", { name: /All transactions/ }).click();
    await expect(filterChips(page)).toHaveCount(0);
    await expect(count(page)).toHaveText("7 spends · Rp 1.179.000");
    await expect(page.getByRole("link", { name: "Home" })).toBeVisible();
    await expect(page).toHaveURL(/\/transactions$/);
  });

  test("the Search link in the bar opens All transactions with the cursor in the search box", async ({ page }) => {
    await seed();
    await page.clock.setFixedTime(NOW);
    await page.goto("/spending");
    await expect(page.getByRole("heading", { level: 1, name: "Spending" })).toBeVisible({ timeout: 15_000 });
    await page.getByRole("link", { name: "Search" }).click();
    await expect(page.getByRole("heading", { level: 1, name: "All transactions" })).toBeVisible();
    await expect(search(page)).toBeFocused();
  });

  test("a spend whose category was removed says so, can be found, and asks for a new one", async ({ page }) => {
    await seed();
    await open(page, "?cat=__none__");
    await expect(filterChips(page).getByRole("button").first()).toHaveText("No category");
    expect(await stores(page)).toEqual(["Old Shop"]);
    await expect(rows(page).nth(0)).toContainText("No category");

    await filtersButton(page).click();
    await expect(sheet(page).getByRole("button", { name: /No category/ })).toHaveAttribute("aria-pressed", "true");
    await page.keyboard.press("Escape");

    await rows(page).nth(0).getByRole("button").click();
    const form = page.getByRole("dialog", { name: "Change spend" });
    await expect(form.getByText("That category was removed. Choose another.")).toBeVisible();
    await form.getByRole("button", { name: /Transport/ }).click();
    await form.getByRole("button", { name: "Save changes" }).click();
    await expect(form).toHaveCount(0);
    // It no longer has a missing category, so the filter finds nothing and says so.
    await expect(page.getByText("No spends match.")).toBeVisible();
    expect((await listDocs("transactions")).find((d) => d.id === "t6")?.data.categoryId).toBe("transport");
  });

  test("type in a spend from the menu, and it is in the list", async ({ page }) => {
    await seed();
    await open(page);
    await page.getByRole("button", { name: "Menu" }).click();
    await page.getByRole("dialog", { name: "Menu" }).getByRole("button", { name: /Type in a spend/ }).click();
    const form = page.getByRole("dialog", { name: "Type in a spend" });
    await form.getByLabel("Store").fill("Bakmi GM");
    await form.getByLabel("Amount").fill("100000");
    await form.getByRole("button", { name: /Food & Drink/ }).click();
    await form.getByRole("button", { name: "Add spend" }).click();
    await expect(form).toHaveCount(0);

    await expect(count(page)).toHaveText("8 spends · Rp 1.279.000");
    const added = rows(page).nth(0);
    await expect(added).toContainText("Bakmi GM");
    await expect(added).toContainText("Food & Drink");
    await expect(added).toContainText("Rp 100.000");
    await expect(added).toContainText("Wed 21 Oct");
    await expect(added).toContainText("Typed in.");
    await expect(page.locator("#toast")).toContainText("Added Bakmi GM, Rp 100.000.");
    const saved = (await listDocs("transactions")).find((d) => d.data.store === "Bakmi GM");
    expect(saved?.data).toMatchObject({ amount: 100_000, categoryId: "food-drink", source: "manual", status: "confirmed", date: TODAY });
  });

  test("change a spend: the form opens filled in, Escape keeps it, a save shows in the list and the database", async ({ page }) => {
    await seed();
    await open(page);
    await search(page).fill("kopi");
    await rows(page).nth(0).getByRole("button").click();

    const form = page.getByRole("dialog", { name: "Change spend" });
    await expect(form.getByLabel("Store")).toHaveValue("Kopi Kenangan");
    await expect(form.getByLabel("Amount")).toHaveValue("28.000");
    await expect(form.getByLabel("Note (optional)")).toHaveValue("Latte with Dina");
    await expect(form.getByText("Added from a screenshot")).toBeVisible();

    await page.keyboard.press("Escape");
    await expect(form).toHaveCount(0);
    await expect(rows(page).nth(0).getByRole("button")).toBeFocused();
    expect((await listDocs("transactions")).find((d) => d.id === "t1")?.data.amount).toBe(28_000);

    await rows(page).nth(0).getByRole("button").click();
    await form.getByLabel("Amount").fill("30000");
    await form.getByLabel("Store").fill("Kopi Kenangan Senopati");
    await form.getByRole("button", { name: "Save changes" }).click();
    await expect(form).toHaveCount(0);

    // The list keeps the search and shows the change, with the new store marked.
    await expect(search(page)).toHaveValue("kopi");
    await expect(rows(page).nth(0)).toContainText("Kopi Kenangan Senopati");
    await expect(rows(page).nth(0)).toContainText("Rp 30.000");
    await expect(rows(page).nth(0).locator("mark")).toHaveText("Kopi");
    await expect(count(page)).toHaveText("2 spends · Rp 180.000");
    expect((await listDocs("transactions")).find((d) => d.id === "t1")?.data).toMatchObject({
      amount: 30_000,
      store: "Kopi Kenangan Senopati",
    });
  });

  test("delete a spend after one question, which can be cancelled", async ({ page }) => {
    await seed();
    await open(page);
    await rows(page).nth(1).getByRole("button").click();
    const form = page.getByRole("dialog", { name: "Change spend" });
    await form.getByRole("button", { name: "Delete this spend" }).click();

    const ask = page.getByRole("alertdialog", { name: "Delete this spend?" });
    await expect(ask).toContainText("Warung Bu Sri");
    await expect(ask).toContainText("Mon 19 Oct");
    await expect(ask).toContainText("Rp 35.000");
    await expect(ask).toContainText("It is removed for good and stops counting in your totals.");
    await expect(ask.getByRole("button", { name: "Cancel" })).toBeFocused();

    // Cancel keeps the spend.
    await ask.getByRole("button", { name: "Cancel" }).click();
    await expect(ask).toHaveCount(0);
    await expect(count(page)).toHaveText("7 spends · Rp 1.179.000");

    await form.getByRole("button", { name: "Delete this spend" }).click();
    await ask.getByRole("button", { name: "Delete", exact: true }).click();
    await expect(ask).toHaveCount(0);
    await expect(form).toHaveCount(0);

    await expect(count(page)).toHaveText("6 spends · Rp 1.144.000");
    expect(await stores(page)).not.toContain("Warung Bu Sri");
    await expect(page.locator("#toast")).toContainText("Deleted Warung Bu Sri, Rp 35.000.");
    expect((await listDocs("transactions")).map((d) => d.id)).not.toContain("t2");
  });

  test("sixty rows at a time, then Show more", async ({ page }) => {
    const bulk = Array.from({ length: 70 }, (_, i) =>
      spend(`b-${String(i).padStart(2, "0")}`, "2026-08-15", 1_000 + i, `Bulk Store ${i}`, "other")
    );
    await seed(bulk);
    await open(page);
    await expect(count(page)).toHaveText(/^70 spends/);
    await expect(rows(page)).toHaveCount(60);
    await page.getByRole("button", { name: "Show 10 more" }).click();
    await expect(rows(page)).toHaveCount(70);
    await expect(page.getByRole("button", { name: /Show \d+ more/ })).toHaveCount(0);
    // A new search starts again from the first sixty.
    await search(page).fill("bulk");
    await expect(rows(page)).toHaveCount(60);
    await expect(page.getByRole("button", { name: "Show 10 more" })).toBeVisible();
  });

  test("first use: nothing yet, with a way to the first screenshots", async ({ page }) => {
    await seed([], []);
    await open(page);
    await expect(page.getByText("No spends yet.")).toBeVisible();
    await expect(page.getByText("Accepted and typed-in spends show up here, ready to search.")).toBeVisible();
    await expect(page.getByRole("link", { name: "Add screenshots" })).toHaveAttribute("href", "/");
    await expect(search(page)).toHaveCount(0);
    await expect(filtersButton(page)).toHaveCount(0);
  });

  test("only waiting lines: nothing saved yet, and the link goes to check them", async ({ page }) => {
    await seed([], [waitingLine("w-1")]);
    await open(page);
    await expect(page.getByText("No spends yet.")).toBeVisible();
    await page.getByRole("link", { name: "Go and check them" }).click();
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("1 to check");
  });
});

test.describe("All transactions layout", () => {
  const overflow = (page: Page) =>
    page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);

  test("on a phone: long names wrap, nothing runs off the screen, every control is 44 high", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    const longStore = "PT".padEnd(90, "SinarMasMultiartha");
    await seed([
      spend("l-1", "2026-10-20", 1_250_000_000, longStore, "investments", "A note ".repeat(20)),
      spend("l-2", "2026-10-19", 48_250_000, "Sekolah Pelita Harapan", "education"),
    ]);
    await open(page, "?cat=investments&from=2026-10-01&to=2026-10-21&label=October+so+far+with+a+very+long+name+for+a+span");
    await expect(rows(page).first()).toContainText(longStore);
    expect(await overflow(page)).toBeLessThanOrEqual(0);
    expect((await filtersButton(page).boundingBox())!.height).toBeGreaterThanOrEqual(44);
    expect((await page.getByRole("combobox", { name: "Order" }).boundingBox())!.height).toBeGreaterThanOrEqual(44);
    expect((await search(page).boundingBox())!.height).toBeGreaterThanOrEqual(44);
    for (const chip of await filterChips(page).getByRole("button").all()) {
      expect((await chip.boundingBox())!.height).toBeGreaterThanOrEqual(44);
    }
    await filtersButton(page).click();
    expect(await overflow(page)).toBeLessThanOrEqual(0);
  });

  test("wide: a column of rows in the narrow page width, and the filters open as a dialog", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await seed();
    await open(page);
    const main = (await page.getByRole("main").boundingBox())!;
    expect(main.width).toBeLessThanOrEqual(760 + 1);
    await filtersButton(page).click();
    const box = (await sheet(page).boundingBox())!;
    expect(box.width).toBeLessThanOrEqual(560 + 1);
    // A dialog sits clear of the bottom edge of the window; a sheet would touch it.
    expect(box.y + box.height).toBeLessThan(900);
    expect(await overflow(page)).toBeLessThanOrEqual(0);
  });
});
