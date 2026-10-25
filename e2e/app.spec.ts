import { expect, test, type Page } from "@playwright/test";
import { seedEmulator } from "../scripts/seed-emulator";
import { clearEmulator, EMULATOR_HOST, EMULATOR_PORT, listDocs } from "../scripts/test-env";

// Whole-app states (design notes §8, "States"): setting up, loading, couldn't load, no connection.
// The screens are still being rebuilt, so "the screen shows" means none of the whole-app states is up
// and the page has a heading; the Phase 2 specs check what each screen holds.

const emulatorUrl = `**://${EMULATOR_HOST}:${EMULATOR_PORT}/**`;

const settingUp = (page: Page) => page.getByRole("heading", { name: "Setting up" });
const noConnection = (page: Page) => page.getByRole("heading", { name: "No connection" });
const couldntLoad = (page: Page) => page.getByRole("heading", { name: /Couldn’t load your/ });
const tryAgain = (page: Page) => page.getByRole("button", { name: "Try again" });
const loadingNote = (page: Page) => page.getByText("Loading your transactions");

// Waits until none of the whole-app states is up (they are headings too, and one can give way to
// another, so all of them are looked at in the same moment) and the page has a heading.
async function expectScreenShows(page: Page, timeout = 10_000) {
  await expect
    .poll(
      async () => {
        const states = await Promise.all(
          [couldntLoad, noConnection, settingUp, loadingNote].map((state) => state(page).count())
        );
        const headings = await page.locator("#app h1").count();
        return states.every((n) => n === 0) && headings > 0;
      },
      { timeout }
    )
    .toBe(true);
}

// Makes the browser report no connection from the first script on, and lets a spec flip it back.
async function startOffline(page: Page) {
  await page.addInitScript(() => {
    let online = false;
    Object.defineProperty(navigator, "onLine", { get: () => online, configurable: true });
    (window as unknown as { __setOnline: (v: boolean) => void }).__setOnline = (v) => {
      online = v;
      window.dispatchEvent(new Event(v ? "online" : "offline"));
    };
  });
}

const goOnline = (page: Page) =>
  page.evaluate(() =>
    (window as unknown as { __setOnline: (v: boolean) => void }).__setOnline(true)
  );

test.describe("whole-app states", () => {
  // The couldn't-load state waits for Firestore to give up on the unreachable emulator.
  test.setTimeout(90_000);

  test("first open shows Setting up, then the empty home", async ({ page }) => {
    await clearEmulator();
    // Notes every time the setting-up screen is on the page, so a fast seeding can't slip past.
    await page.addInitScript(() => {
      const w = window as unknown as { __sawSetup: string[] };
      w.__sawSetup = [];
      new MutationObserver(() => {
        const count = document.body?.innerText.match(/(\d+) of 16/)?.[0];
        if (count && w.__sawSetup[w.__sawSetup.length - 1] !== count) w.__sawSetup.push(count);
      }).observe(document, { childList: true, subtree: true, characterData: true });
    });

    await page.goto("/");
    await expectScreenShows(page);

    const saw = await page.evaluate(
      () => (window as unknown as { __sawSetup: string[] }).__sawSetup
    );
    expect(saw.length).toBeGreaterThan(0);

    expect(await listDocs("categories")).toHaveLength(16);
    expect(await listDocs("transactions")).toHaveLength(0);
  });

  test("Setting up shows the progress while the starters go in", async ({ page }) => {
    await clearEmulator();
    // Hold every database request until released, so the screen can be looked at.
    let release!: () => void;
    const gate = new Promise<void>((resolve) => (release = resolve));
    await page.route(emulatorUrl, async (route) => {
      await gate;
      await route.continue();
    });

    await page.goto("/");
    // Held before anything has arrived: the grey screen, not yet setting up.
    await expect(loadingNote(page)).toBeVisible();
    release();

    await expect(settingUp(page)).toBeVisible();
    await expect(page.getByRole("progressbar", { name: "Adding categories" })).toBeVisible();
    await expect(page.getByText(/^\d+ of 16$/)).toBeVisible();
    await expectScreenShows(page);
  });

  test("loading shows the grey screen until the data arrives", async ({ page }) => {
    await seedEmulator("normal");
    let release!: () => void;
    const gate = new Promise<void>((resolve) => (release = resolve));
    await page.route(emulatorUrl, async (route) => {
      await gate;
      await route.continue();
    });

    await page.goto("/");
    await expect(loadingNote(page)).toBeVisible();
    await expect(page.locator("main#main")).toHaveAttribute("aria-busy", "true");
    await expect(settingUp(page)).toHaveCount(0);

    release();
    await expectScreenShows(page);
  });

  test("couldn't load shows what failed, and Try again recovers", async ({ page }) => {
    await seedEmulator("normal");
    // The emulator is unreachable: every request to it fails.
    await page.route(emulatorUrl, (route) => route.abort("connectionrefused"));

    await page.goto("/");
    await expect(couldntLoad(page)).toBeVisible({ timeout: 60_000 });
    await expect(couldntLoad(page)).toHaveText("Couldn’t load your categories");
    await expect(page.getByText("Something went wrong while loading. Try again in a moment.")).toBeVisible();
    // No raw error text.
    await expect(page.getByText(/unavailable|offline|firestore/i)).toHaveCount(0);

    // Still unreachable: Try again says it is trying, then the failure is back.
    await tryAgain(page).click();
    await expect(page.getByRole("button", { name: "Trying again…" })).toBeVisible();
    await expect(tryAgain(page)).toBeVisible({ timeout: 60_000 });
    await expect(couldntLoad(page)).toBeVisible();

    // Reachable again: Try again loads the screen.
    await page.unroute(emulatorUrl);
    await tryAgain(page).click();
    // The database client may take a while to reconnect after the failures.
    await expectScreenShows(page, 60_000);
  });

  test("no connection at open: Try again says so, and the screen loads once back online", async ({
    page,
  }) => {
    await seedEmulator("normal");
    await startOffline(page);
    await page.route(emulatorUrl, (route) => route.abort("internetdisconnected"));

    await page.goto("/");
    await expect(noConnection(page)).toBeVisible();
    await expect(
      page.getByText("Daybook needs the internet to load your spending. Check your connection, then try again.")
    ).toBeVisible();

    // Still offline: the retry finds the same.
    await tryAgain(page).click();
    await expect(page.getByText("Still no connection.")).toBeVisible();
    await expect(noConnection(page)).toBeVisible();

    // Back online: the data arrives and the screen takes the place of this one.
    await page.unroute(emulatorUrl);
    await goOnline(page);
    await expectScreenShows(page, 60_000);
  });

  test("losing the connection after the screen has loaded keeps the screen", async ({
    page,
    context,
  }) => {
    await seedEmulator("normal");
    await page.goto("/");
    await expectScreenShows(page);

    // Only opening with no data shows the no-connection screen; the offline notice under each
    // screen's bar is checked by the Phase 2 specs.
    await context.setOffline(true);
    await expect.poll(() => page.evaluate(() => navigator.onLine)).toBe(false);
    await expectScreenShows(page);

    await context.setOffline(false);
    await expect.poll(() => page.evaluate(() => navigator.onLine)).toBe(true);
    await expectScreenShows(page);
  });
});
