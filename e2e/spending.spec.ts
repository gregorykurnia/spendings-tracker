import { expect, test, type Page } from "@playwright/test";
import { buildSeed } from "../scripts/seed-emulator";
import { clearEmulator, listDocs, writeDocs, type EmulatorDoc } from "../scripts/test-env";

// Spending (design notes §8, U1 to U8): the total and its comparison, week or month, earlier or
// later, the day chart stepped by keyboard, a category opening All transactions filtered, and a
// biggest spend opening the Change spend form. The browser's clock is fixed to Wednesday 21 October
// 2026, so a week and a month are both still running and every number below can be worked out.

const TODAY = "2026-10-21";
const NOW = new Date(2026, 9, 21, 10, 0, 0);

const spend = (id: string, date: string, amount: number, store: string, categoryId: string): EmulatorDoc => ({
  id,
  data: {
    amount,
    store,
    description: "",
    categoryId,
    date,
    source: "manual",
    status: "confirmed",
    createdAt: "2026-10-01T08:00:00.000Z",
  },
});

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

// October so far: Rp 1.181.000 in seven categories (the last, "Old Shop", has a category that was
// removed). The same days of September (1 to 21): Rp 500.000. Last week's first three days (Monday
// to Wednesday, 12 to 14 Oct): Rp 186.000; this week so far: Rp 100.000. September whole: Rp 900.000.
const SPENDS = [
  spend("o-1", "2026-10-02", 120_000, "Superindo", "groceries"),
  spend("o-2", "2026-10-05", 10_000, "Old Shop", "removed-category"),
  spend("o-3", "2026-10-07", 35_000, "Kimia Farma", "health"),
  spend("o-4", "2026-10-08", 80_000, "Tokopedia", "shopping"),
  spend("o-5", "2026-10-10", 650_000, "Pertamina", "transport"),
  spend("o-6", "2026-10-13", 186_000, "Netflix", "subscriptions"),
  spend("o-7", "2026-10-19", 45_000, "Kopi Kenangan", "food-drink"),
  spend("o-8", "2026-10-21", 30_000, "Gojek", "transport"),
  spend("o-9", "2026-10-21", 25_000, "Warung Bu Sri", "food-drink"),
  spend("s-1", "2026-09-05", 300_000, "Superindo", "groceries"),
  spend("s-2", "2026-09-14", 150_000, "Tokopedia", "shopping"),
  spend("s-3", "2026-09-21", 50_000, "Gojek", "transport"),
  spend("s-4", "2026-09-25", 400_000, "PLN Token", "home-utilities"),
];

async function seed(spends: EmulatorDoc[] = SPENDS, waiting: EmulatorDoc[] = []) {
  const data = buildSeed("normal", TODAY);
  await clearEmulator();
  await writeDocs("meta", data.meta);
  await writeDocs("categories", data.categories);
  if (spends.length + waiting.length) await writeDocs("transactions", [...spends, ...waiting]);
}

async function openSpending(page: Page) {
  await page.clock.setFixedTime(NOW);
  await page.goto("/spending");
  await expect(page.getByRole("heading", { level: 1, name: "Spending" })).toBeVisible({ timeout: 15_000 });
}

const hero = (page: Page) => page.getByRole("region", { name: /so far|^This week|^September|^August|^\d+ to \d+/ });
const periodLabel = (page: Page) => page.locator("main p").filter({ hasText: /^[A-Z][a-z]+ 2026$|^\d+ to \d+ \w+ 2026$/ });
const readout = (page: Page) => page.getByTestId("day-readout");
const section = (page: Page, name: string) =>
  page.locator("section").filter({ has: page.getByRole("heading", { name, exact: true }) });

test.describe("Spending", () => {
  test("the month so far: the total, how it compares like for like, where it went, the biggest spends", async ({ page }) => {
    await seed(SPENDS, [waitingLine("w-1")]);
    await openSpending(page);

    await expect(periodLabel(page)).toHaveText("October 2026");
    await expect(hero(page)).toContainText("October so far");
    // Waiting lines don't count until they are accepted.
    await expect(hero(page)).toContainText("Rp1.181.000");
    await expect(hero(page)).toContainText("Rp 681.000 higher");
    await expect(hero(page)).toContainText("1 to 21 September was Rp 500.000");
    await expect(page.getByRole("button", { name: "Month", exact: true })).toHaveAttribute("aria-pressed", "true");

    // Later is off in the current period, and there is no way "back to this month" yet.
    await expect(page.getByRole("button", { name: "Later month" })).toHaveAttribute("aria-disabled", "true");
    await expect(page.getByRole("button", { name: "Back to this month" })).toHaveCount(0);

    // Where it went: biggest first, the top five, then the rest behind "Show 2 more".
    const cats = section(page, "Where it went");
    const names = cats.getByRole("link");
    await expect(names).toHaveCount(5);
    await expect(names.nth(0)).toContainText("Transport");
    await expect(names.nth(0)).toContainText("Rp 680.000");
    await expect(names.nth(0)).toContainText("58%");
    await expect(names.nth(4)).toContainText("Food & Drink");
    await cats.getByRole("button", { name: "Show 2 more" }).click();
    await expect(names).toHaveCount(7);
    const none = names.filter({ hasText: "No category" });
    await expect(none).toContainText("Rp 10.000");
    await expect(none).toContainText("<1%");
    await cats.getByRole("button", { name: "Show fewer" }).click();
    await expect(names).toHaveCount(5);

    // Biggest spends: five, biggest first, with the date and category under the store.
    const big = section(page, "Biggest spends").getByRole("button");
    await expect(big).toHaveCount(5);
    await expect(big.nth(0)).toContainText("Pertamina");
    await expect(big.nth(0)).toContainText("Sat 10 Oct · Transport");
    await expect(big.nth(0)).toContainText("Rp 650.000");
    await expect(big.nth(1)).toContainText("Netflix");
  });

  test("Week and Month, earlier and later, keeping the date and saying so", async ({ page }) => {
    await seed(SPENDS, [waitingLine("w-1"), waitingLine("w-2")]);
    await openSpending(page);
    const live = page.locator("#live");

    // Week: Monday to Sunday, three days so far against the same three days of the week before.
    await page.getByRole("button", { name: "Week", exact: true }).click();
    await expect(periodLabel(page)).toHaveText("19 to 25 Oct 2026");
    await expect(hero(page)).toContainText("This week so far");
    await expect(hero(page)).toContainText("Rp100.000");
    await expect(hero(page)).toContainText("Rp 86.000 lower");
    await expect(hero(page)).toContainText("12 to 14 Oct was Rp 186.000");
    await expect(page.getByRole("button", { name: "Week", exact: true })).toHaveAttribute("aria-pressed", "true");
    await expect(live).toHaveText("Showing 19 to 25 Oct 2026.");

    // Earlier week, whole: it can be stepped back from, and forward again.
    await page.getByRole("button", { name: "Earlier week" }).click();
    await expect(periodLabel(page)).toHaveText("12 to 18 Oct 2026");
    await expect(hero(page)).toContainText("Rp186.000");
    await expect(hero(page)).toContainText("Rp 589.000 lower");
    await expect(hero(page)).toContainText("5 to 11 Oct was Rp 775.000");
    await expect(page.getByRole("button", { name: "Later week" })).not.toHaveAttribute("aria-disabled", "true");
    await page.getByRole("button", { name: "Back to this week" }).click();
    await expect(periodLabel(page)).toHaveText("19 to 25 Oct 2026");
    await expect(page.getByRole("button", { name: "Back to this week" })).toHaveCount(0);
    await expect(page.getByRole("main")).toBeFocused();

    // Switching keeps the date being looked at: an earlier week of October is still October, and
    // an earlier week of September is September.
    await page.getByRole("button", { name: "Earlier week" }).click();
    await page.getByRole("button", { name: "Month", exact: true }).click();
    await expect(periodLabel(page)).toHaveText("October 2026");
    await expect(hero(page)).toContainText("October so far");
    for (let i = 0; i < 5; i++) await page.getByRole("button", { name: "Earlier month" }).click();
    await expect(periodLabel(page)).toHaveText("May 2026");
    await page.getByRole("button", { name: "Back to this month" }).click();

    // A finished month is counted whole, and has nothing before it to compare with.
    await page.getByRole("button", { name: "Earlier month" }).click();
    await expect(periodLabel(page)).toHaveText("September 2026");
    await expect(hero(page)).toContainText("Rp900.000");
    await expect(hero(page)).toContainText("Nothing to compare with");
    await expect(hero(page)).toContainText("No spending in August");
    await expect(hero(page)).not.toContainText("so far");
    await expect(live).toHaveText("Showing September 2026.");

    // A period with no spending says so and points at the waiting lines; there is no chart.
    await page.getByRole("button", { name: "Earlier month" }).click();
    await expect(periodLabel(page)).toHaveText("August 2026");
    await expect(page.getByText("Nothing spent in August 2026.")).toBeVisible();
    await expect(page.getByText("2 lines are still waiting to be checked. They count once you accept them.")).toBeVisible();
    await expect(page.getByRole("link", { name: "Go and check them" })).toHaveAttribute("href", "/");
    await expect(page.getByRole("heading", { name: "Day by day" })).toHaveCount(0);
    await expect(page.getByRole("heading", { name: "Where it went" })).toHaveCount(0);
    await expect(page.getByRole("heading", { name: "Biggest spends" })).toHaveCount(0);
  });

  test("the day chart steps by keyboard from the biggest day to the first and the last day", async ({ page }) => {
    await seed();
    await openSpending(page);

    // It starts on the biggest day, tagged, and has a text alternative that names it.
    await expect(readout(page)).toHaveText("Sat 10 OctRp 650.000Biggest day");
    await expect(page.getByRole("img", { name: "Spending by day. Biggest day Sat 10 Oct, Rp 650.000." })).toBeVisible();

    // Previous day: Enter on the focused button, then a day with no spending.
    const previous = page.getByRole("button", { name: "Previous day" });
    const next = page.getByRole("button", { name: "Next day" });
    await previous.focus();
    await page.keyboard.press("Enter");
    await expect(readout(page)).toHaveText("Fri 9 OctNothing spent");
    await page.keyboard.press("Space");
    await expect(readout(page)).toHaveText("Thu 8 OctRp 80.000");

    // Tab to Next day: two steps forward are Saturday again.
    await page.keyboard.press("Tab");
    await expect(next).toBeFocused();
    await page.keyboard.press("Enter");
    await page.keyboard.press("Enter");
    await expect(readout(page)).toHaveText("Sat 10 OctRp 650.000Biggest day");

    // All the way to today, which is the last day that can be picked: the rest are still to come.
    for (let i = 0; i < 11; i++) await page.keyboard.press("Enter");
    await expect(readout(page)).toHaveText("Wed 21 OctRp 55.000");
    await expect(next).toHaveAttribute("aria-disabled", "true");
    await page.keyboard.press("Enter");
    await expect(readout(page)).toHaveText("Wed 21 OctRp 55.000");
    await expect(next).toBeFocused();

    // All the way back to the 1st, the first day: Previous is off there.
    await page.keyboard.press("Shift+Tab");
    await expect(previous).toBeFocused();
    for (let i = 0; i < 25; i++) await page.keyboard.press("Enter");
    await expect(readout(page)).toHaveText("Thu 1 OctNothing spent");
    await expect(previous).toHaveAttribute("aria-disabled", "true");

    // A week has seven bars and the picked day is dropped when the period changes.
    await page.getByRole("button", { name: "Week", exact: true }).click();
    await expect(readout(page)).toHaveText("Wed 21 OctRp 55.000Biggest day");
    await expect(page.locator("main [role=img] span").filter({ hasText: /^(Mon|Tue|Wed|Thu|Fri|Sat|Sun)$/ })).toHaveText([
      "Mon",
      "Tue",
      "Wed",
      "Thu",
      "Fri",
      "Sat",
      "Sun",
    ]);
  });

  test("sliding along the chart picks a day, and never one still to come", async ({ page }) => {
    await seed();
    await openSpending(page);
    await page.getByRole("button", { name: "Week", exact: true }).click();
    const chart = page.getByRole("img", { name: /^Spending by day/ });
    const box = (await chart.boundingBox())!;
    // Seven days across: Tuesday is the second, Sunday the last (and still to come).
    await page.mouse.move(box.x + (box.width / 7) * 1.5, box.y + 40);
    await expect(readout(page)).toHaveText("Tue 20 OctNothing spent");
    await page.mouse.move(box.x + (box.width / 7) * 6.5, box.y + 40);
    await expect(readout(page)).toHaveText("Wed 21 OctRp 55.000Biggest day");
    await page.mouse.move(box.x + (box.width / 7) * 0.5, box.y + 40);
    await expect(readout(page)).toHaveText("Mon 19 OctRp 45.000");
  });

  test("a category opens All transactions with that category and the period on", async ({ page }) => {
    await seed();
    await openSpending(page);
    await section(page, "Where it went").getByRole("link", { name: /Transport/ }).click();
    await page.waitForURL(/\/transactions\?/);
    const url = new URL(page.url());
    expect(url.pathname).toBe("/transactions");
    expect(Object.fromEntries(url.searchParams)).toEqual({
      cat: "transport",
      from: "2026-10-01",
      to: TODAY,
      label: "October so far",
      back: "spending",
    });

    // From a past week the span is the whole week, named as the screen names it.
    await page.goBack();
    await page.getByRole("button", { name: "Week", exact: true }).click();
    await page.getByRole("button", { name: "Earlier week" }).click();
    await page.getByRole("button", { name: "Earlier week" }).click();
    await section(page, "Where it went").getByRole("link", { name: /Transport/ }).click();
    await page.waitForURL(/\/transactions\?/);
    const week = new URL(page.url()).searchParams;
    expect([week.get("cat"), week.get("from"), week.get("to"), week.get("label")]).toEqual([
      "transport",
      "2026-10-05",
      "2026-10-11",
      "5 to 11 Oct",
    ]);
  });

  test("a biggest spend opens the Change spend form, and a change shows in the totals", async ({ page }) => {
    await seed();
    await openSpending(page);
    await section(page, "Biggest spends").getByRole("button", { name: /Pertamina/ }).click();

    const form = page.getByRole("dialog", { name: "Change spend" });
    await expect(form).toBeVisible();
    await expect(form.getByLabel("Store")).toHaveValue("Pertamina");
    await expect(form.getByLabel("Amount")).toHaveValue("650.000");

    // Escape closes it with nothing changed, and focus goes back to the spend.
    await page.keyboard.press("Escape");
    await expect(form).toHaveCount(0);
    await expect(section(page, "Biggest spends").getByRole("button", { name: /Pertamina/ })).toBeFocused();

    await section(page, "Biggest spends").getByRole("button", { name: /Pertamina/ }).click();
    await form.getByLabel("Amount").fill("600000");
    await form.getByRole("button", { name: "Save changes" }).click();
    await expect(form).toHaveCount(0);

    await expect(hero(page)).toContainText("Rp1.131.000");
    await expect(hero(page)).toContainText("Rp 631.000 higher");
    await expect(readout(page)).toHaveText("Sat 10 OctRp 600.000Biggest day");
    await expect(section(page, "Biggest spends").getByRole("button").first()).toContainText("Rp 600.000");
    expect((await listDocs("transactions")).find((d) => d.id === "o-5")?.data.amount).toBe(600_000);
  });

  test("typing in a spend from the menu adds it to this month", async ({ page }) => {
    await seed();
    await openSpending(page);
    await page.getByRole("button", { name: "Menu" }).click();
    await page.getByRole("dialog", { name: "Menu" }).getByRole("button", { name: /Type in a spend/ }).click();
    const form = page.getByRole("dialog", { name: "Type in a spend" });
    await form.getByLabel("Store").fill("Bakmi GM");
    await form.getByLabel("Amount").fill("100000");
    await form.getByRole("button", { name: /Food & Drink/ }).click();
    await form.getByRole("button", { name: "Add spend" }).click();
    await expect(form).toHaveCount(0);
    await expect(hero(page)).toContainText("Rp1.281.000");
    await expect(section(page, "Biggest spends").getByRole("button").nth(3)).toContainText("Bakmi GM");
    await expect(section(page, "Biggest spends").getByRole("button").nth(3)).toContainText("Wed 21 Oct · Food & Drink");
  });

  test("first use: nothing to show yet, with a way to the first screenshots", async ({ page }) => {
    await seed([], []);
    await openSpending(page);
    await expect(page.getByText("Nothing to show yet.")).toBeVisible();
    await expect(page.getByText("Once you have accepted some spending, you will see where it went here.")).toBeVisible();
    await expect(page.getByRole("link", { name: "Add your first screenshots" })).toHaveAttribute("href", "/");
    await expect(page.getByRole("button", { name: "Week", exact: true })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Earlier month" })).toHaveCount(0);
  });

  test("a month with only waiting lines says nothing is spent yet and sends you to check them", async ({ page }) => {
    await seed([], [waitingLine("w-1")]);
    await openSpending(page);
    await expect(page.getByText("Nothing spent yet this month.")).toBeVisible();
    await expect(page.getByText("1 line is still waiting to be checked. They count once you accept them.")).toBeVisible();
    await expect(hero(page)).toContainText("Rp0");
    await page.getByRole("link", { name: "Go and check it" }).click();
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("1 to check");
  });
});

test.describe("Spending layout", () => {
  const overflow = (page: Page) =>
    page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  const top = async (page: Page, name: string) => (await page.getByRole("heading", { name, exact: true }).boundingBox())!;

  test("on a phone: one column in the order total, where it went, day by day, biggest spends", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await seed();
    await openSpending(page);
    const heroBox = (await hero(page).boundingBox())!;
    const [cats, days, big] = [await top(page, "Where it went"), await top(page, "Day by day"), await top(page, "Biggest spends")];
    expect(heroBox.y).toBeLessThan(cats.y);
    expect(cats.y).toBeLessThan(days.y);
    expect(days.y).toBeLessThan(big.y);
    expect(await overflow(page)).toBeLessThanOrEqual(0);
    // Every control is 44 high or more.
    for (const name of ["Week", "Month", "Earlier month", "Previous day", "Next day"]) {
      expect((await page.getByRole("button", { name, exact: true }).boundingBox())!.height).toBeGreaterThanOrEqual(44);
    }
  });

  test("wide: the categories sit in a column beside the total, chart and biggest spends", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await seed();
    await openSpending(page);
    const days = await top(page, "Day by day");
    const cats = await top(page, "Where it went");
    const big = await top(page, "Biggest spends");
    expect(cats.x).toBeGreaterThan(days.x + 400);
    expect(Math.abs(days.x - big.x)).toBeLessThan(2);
    expect(days.y).toBeLessThan(big.y);
    expect(await overflow(page)).toBeLessThanOrEqual(0);
  });

  test("a ten-digit total, a very long store name and tiny and huge days fit on a phone", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    const longStore = "PT".padEnd(90, "SinarMasMultiartha");
    await seed([
      spend("big-1", "2026-10-03", 1_250_000_000, longStore, "investments"),
      spend("big-2", "2026-10-04", 85_000, "Kopi", "food-drink"),
      spend("big-3", "2026-10-21", 48_250_000, "Sekolah Pelita Harapan", "education"),
    ]);
    await openSpending(page);
    await expect(hero(page)).toContainText("Rp1.298.335.000");
    expect(await overflow(page)).toBeLessThanOrEqual(0);
    await expect(section(page, "Biggest spends").getByRole("button").first()).toContainText(longStore);
    // The smallest day is still a visible bar, never thinner than a few percent.
    const small = page.locator("main [role=img] > div").first().locator("> span").nth(3).locator("i");
    expect((await small.boundingBox())!.height).toBeGreaterThanOrEqual(3);
  });
});
