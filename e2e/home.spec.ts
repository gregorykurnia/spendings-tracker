import { expect, test, type Page } from "@playwright/test";
import { buildSeed, seedEmulator } from "../scripts/seed-emulator";
import { todayISO } from "../src/lib/dates";
import { clearEmulator, listDocs, writeDocs } from "../scripts/test-env";
import { bankLine, gate, mockOcr, screenshots } from "./fixtures/ocr";

// Home (design notes §8): the import tray, the inbox it feeds, the glance card, the links, the menu,
// first use and "All checked". Claude is never called: `/api/ocr` is answered by `mockOcr`.

// The browser's calendar day, as the app reads it (not UTC).
const today = todayISO();
const yesterday = new Date(Date.now() - 86_400_000).toISOString().slice(0, 10);

const waitingDocs = async () =>
  (await listDocs("transactions")).filter((d) => d.data.status === "pending_review");
const spendDocs = async () =>
  (await listDocs("transactions")).filter((d) => d.data.status === "confirmed");

const toast = (page: Page) => page.locator("#toast");
const title = (page: Page) => page.getByRole("heading", { level: 1 });
const addButton = (page: Page) => page.getByRole("button", { name: "Add screenshots" }).first();
const fileInput = (page: Page) => page.locator('input[type="file"]');

async function openHome(page: Page, heading: string | RegExp) {
  await page.goto("/");
  await expect(title(page)).toHaveText(heading, { timeout: 15_000 });
}

// The normal seed has 60 spends and three waiting lines, all of which look right. This one keeps the
// spends and drops the waiting lines, so a spec can bring in its own. It adds three older spends at
// stores the imports name, so those lines arrive with a suggested category.
async function seedWithoutWaiting() {
  const data = buildSeed("normal", today);
  const known = [
    ["Superindo", "groceries"],
    ["Gojek", "transport"],
    ["Kopi Kenangan", "food-drink"],
  ].map(([store, categoryId], i) => ({
    id: `known-${i}`,
    data: {
      amount: 11_111 + i,
      store,
      description: "",
      categoryId,
      date: "2026-01-05",
      source: "manual",
      status: "confirmed",
      createdAt: "2026-01-05T08:00:00.000Z",
    },
  }));
  await clearEmulator();
  await writeDocs("meta", data.meta);
  await writeDocs("categories", data.categories);
  await writeDocs(
    "transactions",
    [...data.transactions.filter((d) => d.data.status === "confirmed"), ...known]
  );
}

test.describe("importing screenshots", () => {
  test("reads three screenshots (one read, one failed, one with nothing) and the lines wait in the inbox", async ({ page }) => {
    await seedWithoutWaiting();
    const first = gate();
    const ocr = await mockOcr(page, [
      { lines: [bankLine({ store: "Superindo", amount: 87_450, date: yesterday }), bankLine({ store: "Gojek", amount: 38_250, date: today })], hold: first.hold },
      { lines: "fail" },
      { lines: [] },
    ]);

    await openHome(page, "All checked");
    await expect(page.getByText("Add screenshots from your banking app")).toBeVisible();

    await fileInput(page).setInputFiles(screenshots(3));

    // While the first is being read: the tray says so, "Add" is off, the rest wait.
    await expect(page.getByRole("heading", { name: "Reading 3 screenshots" })).toBeVisible();
    await expect(page.getByText("Keep this open until it's done.")).toBeVisible();
    await expect(page.getByRole("progressbar", { name: "Reading screenshot 1" })).toBeVisible();
    await expect(page.getByText("Waiting", { exact: true })).toHaveCount(2);
    await expect(addButton(page)).toHaveAttribute("aria-disabled", "true");
    await expect(title(page)).toHaveText("Nothing to check yet");
    first.open();

    // Then: one read, one that couldn't be, one with nothing in it.
    await expect(page.getByRole("heading", { name: "Read 1 of 3 screenshots" })).toBeVisible();
    await expect(page.getByText("Found 2 transactions. The rest need you.")).toBeVisible();
    await expect(page.getByText("Couldn't read this one")).toBeVisible();
    await expect(page.getByText("Nothing found")).toBeVisible();
    await expect(addButton(page)).not.toHaveAttribute("aria-disabled", "true");
    await expect(title(page)).toHaveText("2 to check");
    await expect(page.getByText("From 1 screenshot, added just now")).toBeVisible();
    await expect(page.getByRole("button", { name: "Accept Superindo, Rp 87.450" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Accept Gojek, Rp 38.250" })).toBeVisible();
    expect(ocr.requests()).toHaveLength(3);

    // What was written: waiting lines that keep what the screenshot said and its order.
    const lines = (await waitingDocs()).sort((a, b) => Number(a.data.seq) - Number(b.data.seq));
    expect(lines).toHaveLength(2);
    expect(lines.map((d) => d.data.store)).toEqual(["Superindo", "Gojek"]);
    expect(lines[0].data).toMatchObject({
      amount: 87_450,
      source: "ocr",
      status: "pending_review",
      direction: "out",
      categorySuggested: true,
      bankLine: { store: "Superindo", date: yesterday, amountText: "87.450,00 DB" },
    });
    expect(lines[0].data.categoryId).toBe("groceries");
    expect(lines.map((d) => d.data.seq)).toEqual([0, 1]);

    // Try again on the failed one.
    ocr.push({ lines: [bankLine({ store: "Kopi Kenangan", amount: 28_750, date: today })] });
    await page.getByRole("button", { name: "Try again" }).click();
    await expect(page.getByRole("heading", { name: "Read 2 of 3 screenshots" })).toBeVisible();
    await expect(page.getByText("Found 3 transactions. The rest need you.")).toBeVisible();
    await expect(page.getByText("Couldn't read this one")).toHaveCount(0);
    await expect(title(page)).toHaveText("3 to check");
    await expect(page.getByText("From 2 screenshots, added just now")).toBeVisible();
    expect(await waitingDocs()).toHaveLength(3);

    // Dismiss the empty one: everything left was read, so the tray says so and then goes.
    await page.getByRole("button", { name: "Dismiss" }).click();
    await expect(page.getByRole("heading", { name: "Read all 2 screenshots" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Read all 2 screenshots" })).toHaveCount(0, { timeout: 8_000 });
    await expect(title(page)).toHaveText("3 to check");

    // The same lines are there after a reload: they were saved, not just shown.
    await page.reload();
    await expect(title(page)).toHaveText("3 to check", { timeout: 15_000 });
    // A new visit: where the lines came from is no longer known, so the title says how old they are.
    await expect(page.getByText(/^Oldest is from /)).toBeVisible();
  });

  test("a screenshot of another kind of line: amount unreadable, incoming money, own transfer", async ({ page }) => {
    await seedWithoutWaiting();
    await mockOcr(page, [
      {
        lines: [
          bankLine({ store: "WARUNG TEGAL", amount: null, amountText: "?", date: today }),
          bankLine({ store: "TRSF E-BANKING CR BUDI", amount: 500_000, direction: "in", date: today }),
          bankLine({ store: "TOP UP GOPAY", amount: 100_000, ownTransfer: true, date: today }),
        ],
      },
    ]);
    await openHome(page, "All checked");
    await fileInput(page).setInputFiles(screenshots(1));

    await expect(title(page)).toHaveText("3 to check");
    await expect(page.getByRole("heading", { name: "Need a look 3" })).toBeVisible();
    await expect(page.getByText("Couldn't read the amount. Check it against the screenshot.")).toBeVisible();
    await expect(page.getByText("Money coming in, so it isn't counted as spending.")).toBeVisible();
    await expect(page.getByText("Money moving between your own accounts, so it isn't counted yet.")).toBeVisible();
    // Nothing that needs a look is offered an accept bar.
    await expect(page.getByRole("button", { name: /^Accept/ })).toHaveCount(0);
    const [unreadable] = (await waitingDocs()).filter((d) => d.data.store === "WARUNG TEGAL");
    expect(unreadable.data.amount).toBeNull();
  });
});

test.describe("checking what was read", () => {
  test.beforeEach(async () => {
    await seedEmulator("normal", today);
  });

  test("a note and a category are kept as they are typed, and are there after a reload", async ({ page }) => {
    await openHome(page, "3 to check");
    await page.getByRole("button", { name: "Indomaret", exact: true }).click();
    await page.getByLabel("What did you buy?").fill("Snacks for the office");
    await page.getByRole("button", { name: /Transport/ }).click();

    await expect
      .poll(async () => (await waitingDocs()).find((d) => d.data.store === "Indomaret")?.data)
      .toMatchObject({ description: "Snacks for the office", categoryId: "transport" });

    await page.reload();
    await expect(title(page)).toHaveText("3 to check", { timeout: 15_000 });
    await page.getByRole("button", { name: "Indomaret", exact: true }).click();
    await expect(page.getByLabel("What did you buy?")).toHaveValue("Snacks for the office");
    await expect(page.getByRole("button", { name: /Transport/ })).toHaveAttribute("aria-pressed", "true");
  });

  test("a tick accepts one line; 'Accept all' takes the rest and home says all is checked", async ({ page }) => {
    const before = (await spendDocs()).length;
    await openHome(page, "3 to check");
    await expect(page.getByRole("button", { name: "Accept all 3" })).toBeVisible();

    await page.getByRole("button", { name: "Accept Indomaret, Rp 15.000" }).click();
    await expect(title(page)).toHaveText("2 to check");
    await expect.poll(async () => (await spendDocs()).length).toBe(before + 1);
    expect((await spendDocs()).find((d) => d.data.store === "Indomaret")?.data.status).toBe("confirmed");

    await page.getByRole("button", { name: "Accept all 2" }).click();
    await expect(toast(page)).toContainText(/^Accepted 2\. Rp [\d.]+ added\.$/);
    await expect(title(page)).toHaveText("All checked");
    await expect(page.getByText("Add screenshots from your banking app")).toBeVisible();
    await expect(page.getByText("Nothing is waiting.")).toBeVisible();
    expect(await waitingDocs()).toHaveLength(0);
    expect((await spendDocs()).length).toBe(before + 3);
  });

  test("Throw away deletes a line, and 'It's a spend' brings an incoming line into 'Look right'", async ({ page }) => {
    await writeDocs("transactions", [
      {
        id: "waiting-in",
        data: {
          amount: 500_000,
          store: "TRSF E-BANKING CR BUDI",
          description: "",
          categoryId: "groceries",
          date: today,
          source: "ocr",
          status: "pending_review",
          createdAt: new Date().toISOString(),
          seq: 9,
          direction: "in",
        },
      },
    ]);
    await openHome(page, "4 to check");
    await expect(page.getByRole("heading", { name: "Need a look 1" })).toBeVisible();

    // Throw away a line that looks right: open it, then the link in the open row.
    await page.getByRole("button", { name: "Grab", exact: true }).click();
    await page
      .getByRole("listitem")
      .filter({ hasText: "Grab" })
      .getByRole("button", { name: "Throw away" })
      .click();
    await expect(title(page)).toHaveText("3 to check");
    await expect.poll(async () => (await waitingDocs()).some((d) => d.data.store === "Grab")).toBe(false);

    // "It's a spend": the line is kept as money going out and joins "Look right".
    await page.getByRole("button", { name: "It's a spend" }).click();
    await expect(page.getByRole("heading", { name: "Need a look 1" })).toHaveCount(0);
    await expect(page.getByRole("heading", { name: "Look right 3" })).toBeVisible();
    await expect
      .poll(async () => (await waitingDocs()).find((d) => d.id === "waiting-in")?.data)
      .toMatchObject({ kept: true, direction: "out" });
    expect(await waitingDocs()).toHaveLength(3);
  });

  test("a thrown-away line can be had again by adding its screenshot again", async ({ page }) => {
    await seedWithoutWaiting();
    await mockOcr(page, [
      { lines: [bankLine({ store: "Superindo", amount: 87_450, date: today })] },
      { lines: [bankLine({ store: "Superindo", amount: 87_450, date: today })] },
    ]);
    await openHome(page, "All checked");
    await fileInput(page).setInputFiles(screenshots(1));
    await expect(title(page)).toHaveText("1 to check");
    await page.getByRole("button", { name: "Superindo", exact: true }).click();
    await page.getByRole("button", { name: "Throw away" }).click();
    await expect(title(page)).toHaveText("All checked");
    await expect.poll(async () => (await waitingDocs()).length).toBe(0);

    await fileInput(page).setInputFiles(screenshots(1));
    await expect(title(page)).toHaveText("1 to check");
    await expect.poll(async () => (await waitingDocs()).length).toBe(1);
  });
});

test.describe("the rest of home", () => {
  test("the glance card totals this month so far and opens Spending", async ({ page }) => {
    await seedEmulator("normal", today);
    const monthStart = `${today.slice(0, 8)}01`;
    const total = (await spendDocs())
      .filter((d) => String(d.data.date) >= monthStart && String(d.data.date) <= today)
      .reduce((sum, d) => sum + Number(d.data.amount), 0);
    const month = new Date(`${today}T00:00:00Z`).toLocaleString("en", { month: "long", timeZone: "UTC" });
    const dotted = String(total).replace(/\B(?=(\d{3})+(?!\d))/g, ".");

    await openHome(page, "3 to check");
    // "so far" is dropped on the month's last day, when it is no longer running.
    const glance = page.getByRole("link", { name: new RegExp(`^${month}( so far)?\\s*Rp\\s*${dotted}\\s*.+\\. Open spending\\.$`) });
    await expect(glance).toBeVisible();
    await expect(glance).toHaveAttribute("href", "/spending");
    await expect(glance).toContainText(/lower than|higher than|Same as|to compare with/);
  });

  test("links to the other places, and typing a spend in from them", async ({ page }) => {
    await seedEmulator("normal", today);
    await openHome(page, "3 to check");
    const more = page.getByRole("navigation", { name: "More" });
    await expect(more.getByRole("link")).toHaveText([/Spending/, /All transactions/, /Categories/]);
    await expect(more.getByRole("link", { name: /All transactions/ })).toHaveAttribute("href", "/transactions");
    await expect(more.getByRole("link", { name: /Categories/ })).toHaveAttribute("href", "/categories");

    await more.getByRole("button", { name: /Type in a spend/ }).click();
    await expect(page.getByRole("dialog", { name: "Type in a spend" })).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(page.getByRole("dialog")).toHaveCount(0);
  });

  test("the menu lists the four places and typing a spend in", async ({ page }) => {
    await seedEmulator("normal", today);
    await openHome(page, "3 to check");
    await page.getByRole("button", { name: "Menu" }).click();
    const menu = page.getByRole("dialog", { name: "Menu" });
    await expect(menu.getByRole("link")).toHaveText([/Home/, /Spending/, /All transactions/, /Categories/]);
    await menu.getByRole("button", { name: /Type in a spend/ }).click();
    await expect(page.getByRole("dialog", { name: "Type in a spend" })).toBeVisible();
  });

  test("first use: three steps, no glance card, and the first screenshot takes the steps away", async ({ page }) => {
    await clearEmulator();
    await mockOcr(page, [{ lines: [bankLine({ store: "WARUNG TEGAL", amount: 45_000, date: today })] }]);
    await openHome(page, "Add your first spending");

    await expect(page.getByText("Screenshots from your banking app are read for you.")).toBeVisible();
    await expect(page.getByText("Take a screenshot of your transactions in the banking app.")).toBeVisible();
    await expect(page.getByText("Add it here. It is read for you.")).toBeVisible();
    await expect(page.getByText("Check what was found, then accept it.")).toBeVisible();
    await expect(page.getByRole("link", { name: /Open spending/ })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Type in a spend" }).first()).toBeVisible();

    await fileInput(page).setInputFiles(screenshots(1));
    await expect(title(page)).toHaveText("1 to check");
    await expect(page.getByText("Take a screenshot of your transactions in the banking app.")).toHaveCount(0);
    await expect(page.getByRole("link", { name: /Open spending/ })).toBeVisible();
  });

  test("with no connection, Add does nothing and says why", async ({ page, context }) => {
    await seedEmulator("normal", today);
    await openHome(page, "3 to check");
    await context.setOffline(true);
    await expect.poll(() => page.evaluate(() => navigator.onLine)).toBe(false);

    let picked = false;
    page.on("filechooser", () => (picked = true));
    // Dimmed and marked aria-disabled, but pressing it still says why (`force`: Playwright won't press it otherwise).
    await expect(addButton(page)).toHaveAttribute("aria-disabled", "true");
    await addButton(page).click({ force: true });
    await expect(toast(page)).toHaveText("No connection. Try again when you are back online.");
    expect(picked).toBe(false);
    await context.setOffline(false);
  });

  test("/ocr goes to home", async ({ page }) => {
    await seedEmulator("normal", today);
    await page.goto("/ocr");
    await expect(page).toHaveURL(/\/$/);
    await expect(title(page)).toHaveText("3 to check", { timeout: 15_000 });
  });
});
