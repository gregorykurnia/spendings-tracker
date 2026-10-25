import { expect, test, type Page } from "@playwright/test";
import { buildSeed } from "../scripts/seed-emulator";
import { todayISO } from "../src/lib/dates";
import { clearEmulator, listDocs, writeDocs, type EmulatorDoc } from "../scripts/test-env";
import { bankLine, mockOcr, screenshots } from "./fixtures/ocr";

// Phase 2 end-to-end (plan 2.7): the screens used together, the way the owner uses them. One journey
// from a screenshot to a deleted spend, one rename that has to show on every screen, and one session
// that loses its connection halfway. Screens are reached from each other (links and the menu), not by
// typing addresses, so what one screen leaves behind is what the next one reads. Claude is never
// called: `/api/ocr` is answered by `mockOcr`.

// The browser's calendar day, as the app reads it (not UTC).
const today = todayISO();

const NET_ERROR = "No connection. Nothing was saved. Try again when you are back online.";
const NET_SHORT = "No connection. Try again when you are back online.";

const title = (page: Page) => page.getByRole("heading", { level: 1 });
const toast = (page: Page) => page.locator("#toast");
const rows = (page: Page) => page.getByRole("main").getByRole("listitem");
const savedSpends = async () => (await listDocs("transactions")).filter((d) => d.data.status === "confirmed");
const spendNamed = async (store: string) => (await savedSpends()).find((d) => d.data.store === store);

const spend = (id: string, store: string, amount: number, categoryId: string, date = "2026-01-05"): EmulatorDoc => ({
  id,
  data: { amount, store, description: "", categoryId, date, source: "manual", status: "confirmed", createdAt: `${date}T08:00:00.000Z` },
});

/** The normal data set (60 spends, three waiting lines), without the waiting lines unless asked, plus any spends a test needs. */
async function seed({ waiting = true, extra = [] as EmulatorDoc[] } = {}) {
  const data = buildSeed("normal", today);
  await clearEmulator();
  await writeDocs("meta", data.meta);
  await writeDocs("categories", data.categories);
  await writeDocs(
    "transactions",
    [...data.transactions.filter((d) => waiting || d.data.status === "confirmed"), ...extra]
  );
}

/** Opens a screen from the menu, which every screen has, so nothing reloads. */
async function goTo(page: Page, link: RegExp, heading: string | RegExp) {
  await page.getByRole("button", { name: "Menu" }).click();
  await page.getByRole("dialog", { name: "Menu" }).getByRole("link", { name: link }).click();
  await expect(title(page)).toHaveText(heading, { timeout: 15_000 });
}

async function openHome(page: Page, heading: string | RegExp) {
  await page.goto("/");
  await expect(title(page)).toHaveText(heading, { timeout: 15_000 });
}

async function goOffline(page: Page, offline: boolean) {
  await page.context().setOffline(offline);
  await expect.poll(() => page.evaluate(() => navigator.onLine)).toBe(!offline);
}

test.describe("from a screenshot to a deleted spend", () => {
  test("import and accept, find it on Spending, open its category's spends, change it, delete it", async ({ page }) => {
    // A spend at the same store, long ago, so the new line arrives with its category already chosen.
    await seed({ waiting: false, extra: [spend("known-0", "Toko Journey", 11_111, "groceries")] });
    await mockOcr(page, [{ lines: [bankLine({ store: "Toko Journey", amount: 9_876_000, date: today })] }]);

    // Home: bring the screenshot in, accept the line.
    await openHome(page, "All checked");
    await page.locator('input[type="file"]').setInputFiles(screenshots(1));
    await expect(title(page)).toHaveText("1 to check");
    await page.getByRole("button", { name: "Accept Toko Journey, Rp 9.876.000" }).click();
    await expect(title(page)).toHaveText("All checked");
    // Two spends carry this store (the old one and the new one), in no fixed order.
    await expect
      .poll(async () => (await savedSpends()).filter((d) => d.data.store === "Toko Journey").map((d) => d.data.amount).sort())
      .toEqual([11_111, 9_876_000]);
    expect((await listDocs("transactions")).filter((d) => d.data.status === "pending_review")).toHaveLength(0);
    expect((await savedSpends()).filter((d) => d.data.store === "Toko Journey")).toHaveLength(2);

    // Spending: it is the biggest spend of the month, and its category leads the list.
    await page.getByRole("navigation", { name: "More" }).getByRole("link", { name: /Spending/ }).click();
    await expect(title(page)).toHaveText("Spending", { timeout: 15_000 });
    const biggest = page.locator("section").filter({ has: page.getByRole("heading", { name: "Biggest spends", exact: true }) });
    await expect(biggest.getByRole("button").first()).toContainText("Toko Journey");
    await expect(biggest.getByRole("button").first()).toContainText("Rp 9.876.000");
    await expect(biggest.getByRole("button").first()).toContainText("Groceries");

    // Its category opens All transactions with that category and this month on.
    await page.getByRole("link", { name: /Groceries/ }).first().click();
    await expect(title(page)).toHaveText("All transactions", { timeout: 15_000 });
    await expect(page).toHaveURL(/cat=groceries/);
    await expect(rows(page).filter({ hasText: "Toko Journey" })).toHaveCount(1);
    await expect(rows(page).filter({ hasText: "Rp 9.876.000" })).toHaveCount(1);

    // Change it.
    await rows(page).filter({ hasText: "Rp 9.876.000" }).getByRole("button").click();
    const form = page.getByRole("dialog", { name: "Change spend" });
    await expect(form.getByLabel("Store")).toHaveValue("Toko Journey");
    await form.getByLabel("Amount").fill("5432100");
    await form.getByLabel("Note (optional)").fill("Weekly shop");
    await form.getByRole("button", { name: "Save changes" }).click();
    await expect(form).toHaveCount(0);
    const changed = rows(page).filter({ hasText: "Rp 5.432.100" });
    await expect(changed).toHaveCount(1);
    await expect(changed).toContainText("Weekly shop");
    expect((await savedSpends()).find((d) => d.data.amount === 5_432_100)?.data).toMatchObject({
      store: "Toko Journey",
      description: "Weekly shop",
      categoryId: "groceries",
      source: "ocr",
    });

    // Delete it, after the one question.
    await changed.getByRole("button").click();
    await form.getByRole("button", { name: "Delete this spend" }).click();
    await page.getByRole("alertdialog", { name: "Delete this spend?" }).getByRole("button", { name: "Delete", exact: true }).click();
    await expect(form).toHaveCount(0);
    await expect(toast(page)).toContainText("Deleted Toko Journey, Rp 5.432.100.");
    await expect(rows(page).filter({ hasText: "Rp 5.432.100" })).toHaveCount(0);
    expect((await savedSpends()).map((d) => d.data.amount)).not.toContain(5_432_100);

    // Back on Spending the month no longer has it.
    await page.getByRole("link", { name: "Spending" }).click();
    await expect(title(page)).toHaveText("Spending", { timeout: 15_000 });
    await expect(biggest.getByRole("button").first()).not.toContainText("Toko Journey");
    await expect(page.getByRole("main")).not.toContainText("Rp 5.432.100");
  });
});

test.describe("one category, every screen", () => {
  test("a renamed category shows its new name on home, Spending, All transactions and in the form", async ({ page }) => {
    // One big grocery spend this month, so Groceries leads "Where it went" and the filter finds it.
    await seed({ extra: [spend("big-groceries", "Toko Rename", 7_000_000, "groceries", today)] });
    await openHome(page, "3 to check");

    // Rename it on Categories.
    await goTo(page, /Categories/, "Categories");
    await page.getByRole("main").getByRole("listitem").filter({ hasText: "Groceries" }).getByRole("button").click();
    const categoryForm = page.getByRole("dialog", { name: "Change category" });
    await categoryForm.getByLabel("Name").fill("Pantry");
    await categoryForm.getByRole("button", { name: "Save changes" }).click();
    await expect(toast(page)).toContainText("Saved changes to Pantry.");
    await expect(page.getByRole("main").getByRole("listitem").filter({ hasText: "Pantry" })).toBeVisible();
    await expect(page.getByRole("main").getByText("Groceries")).toHaveCount(0);

    // All transactions: the spend says Pantry, and the category is a filter under its new name.
    await goTo(page, /All transactions/, "All transactions");
    const row = rows(page).filter({ hasText: "Toko Rename" });
    await expect(row).toContainText("Pantry");
    await expect(row).not.toContainText("Groceries");
    await page.getByRole("button", { name: /^Filters/ }).click();
    const filters = page.getByRole("dialog", { name: "Filters" });
    await expect(filters.getByRole("button", { name: /Pantry/ })).toBeVisible();
    await expect(filters.getByRole("button", { name: /Groceries/ })).toHaveCount(0);
    await page.keyboard.press("Escape");

    // Spending: the category line.
    await goTo(page, /Spending/, "Spending");
    const where = page.locator("section").filter({ has: page.getByRole("heading", { name: "Where it went", exact: true }) });
    await expect(where.getByRole("link", { name: /Pantry/ })).toContainText(/Rp [\d.]+/);
    await expect(where.getByText("Groceries")).toHaveCount(0);

    // Home: a waiting line that was in it opens with the new name chosen.
    await goTo(page, /Home/, "3 to check");
    await page.getByRole("button", { name: "Indomaret", exact: true }).click();
    await expect(page.getByRole("button", { name: /Pantry/ })).toHaveAttribute("aria-pressed", "true");
    await expect(page.getByRole("button", { name: /Groceries/ })).toHaveCount(0);

    // And the form for a new spend offers it.
    await page.getByRole("navigation", { name: "More" }).getByRole("button", { name: /Type in a spend/ }).click();
    const add = page.getByRole("dialog", { name: "Type in a spend" });
    await expect(add.getByRole("button", { name: /Pantry/ })).toBeVisible();
    await expect(add.getByRole("button", { name: /Groceries/ })).toHaveCount(0);
  });
});

test.describe("losing the connection halfway", () => {
  test("a change in the form is refused offline, what was typed stays, and it saves once back online", async ({ page }) => {
    await seed({ extra: [spend("probe", "Offline Probe", 40_000, "transport", today)] });
    await openHome(page, "3 to check");
    await goTo(page, /All transactions/, "All transactions");
    await page.getByRole("searchbox", { name: "Search store or note" }).fill("Offline Probe");
    await expect(rows(page)).toHaveCount(1);
    await rows(page).first().getByRole("button").click();

    const form = page.getByRole("dialog", { name: "Change spend" });
    await form.getByLabel("Store").fill("Typed While Offline");
    await form.getByLabel("Amount").fill("12345");
    await form.getByLabel("Note (optional)").fill("Kept as typed");

    await goOffline(page, true);
    await expect(page.getByRole("status").filter({ hasText: "You can look around" })).toBeVisible();

    // The save is refused, says why in the form, and keeps everything typed.
    await form.getByRole("button", { name: "Save changes" }).click();
    await expect(form.getByRole("alert")).toHaveText(NET_ERROR);
    await expect(form).toBeVisible();
    await expect(form.getByLabel("Store")).toHaveValue("Typed While Offline");
    await expect(form.getByLabel("Amount")).toHaveValue("12.345");
    await expect(form.getByLabel("Note (optional)")).toHaveValue("Kept as typed");
    expect((await spendNamed("Offline Probe"))?.data.amount).toBe(40_000);

    // Deleting is refused the same way, and the spend stays.
    await form.getByRole("button", { name: "Delete this spend" }).click();
    const ask = page.getByRole("alertdialog", { name: "Delete this spend?" });
    await ask.getByRole("button", { name: "Delete", exact: true }).click();
    await expect(ask.getByRole("alert")).toHaveText(NET_ERROR);
    await ask.getByRole("button", { name: "Cancel" }).click();
    await expect(ask).toHaveCount(0);
    expect(await spendNamed("Offline Probe")).toBeDefined();

    // Back online: the same form, still filled in, saves.
    await goOffline(page, false);
    await expect(page.getByRole("status").filter({ hasText: "You can look around" })).toHaveCount(0);
    await expect(form.getByLabel("Store")).toHaveValue("Typed While Offline");
    await form.getByRole("button", { name: "Save changes" }).click();
    await expect(form).toHaveCount(0);
    expect(await spendNamed("Offline Probe")).toBeUndefined();
    expect((await spendNamed("Typed While Offline"))?.data).toMatchObject({ amount: 12_345, description: "Kept as typed" });
  });

  test("on home, offline: ticks and Accept all say why, a new spend keeps what was typed, then it adds", async ({ page }) => {
    await seed();
    await openHome(page, "3 to check");
    const before = (await savedSpends()).length;

    await goOffline(page, true);
    // Dimmed and marked aria-disabled, but pressing says why (`force`: Playwright won't press them otherwise).
    await page.getByRole("button", { name: "Accept Indomaret, Rp 15.000" }).click({ force: true });
    await expect(toast(page)).toHaveText(NET_SHORT);
    await page.getByRole("button", { name: "Accept all 3" }).click({ force: true });
    await expect(toast(page)).toHaveText(NET_SHORT);
    await expect(title(page)).toHaveText("3 to check");
    expect((await savedSpends()).length).toBe(before);

    // Typing a spend in works as far as typing; adding it is refused and nothing is lost.
    await page.getByRole("navigation", { name: "More" }).getByRole("button", { name: /Type in a spend/ }).click();
    const add = page.getByRole("dialog", { name: "Type in a spend" });
    await add.getByLabel("Store").fill("Bakmi Journey");
    await add.getByLabel("Amount").fill("100000");
    await add.getByRole("button", { name: /Food & Drink/ }).click();
    await add.getByRole("button", { name: "Add spend" }).click();
    await expect(add.getByRole("alert")).toHaveText(NET_ERROR);
    await expect(add.getByLabel("Store")).toHaveValue("Bakmi Journey");
    await expect(add.getByLabel("Amount")).toHaveValue("100.000");
    expect(await spendNamed("Bakmi Journey")).toBeUndefined();

    await goOffline(page, false);
    await add.getByRole("button", { name: "Add spend" }).click();
    await expect(add).toHaveCount(0);
    await expect.poll(async () => (await spendNamed("Bakmi Journey"))?.data.amount ?? 0).toBe(100_000);
    expect((await savedSpends()).length).toBe(before + 1);
  });
});
