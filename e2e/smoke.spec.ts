import { expect, test, type Page } from "@playwright/test";
import { seedEmulator } from "../scripts/seed-emulator";
import {
  APP_PORT,
  clearEmulator,
  EMULATOR_HOST,
  EMULATOR_PORT,
  listDocs,
} from "../scripts/test-env";

const emulatorOrigin = `${EMULATOR_HOST}:${EMULATOR_PORT}`;
const appOrigin = `127.0.0.1:${APP_PORT}`;

// Records every request that leaves the app's own server, so a spec can
// prove the data went to the emulator and nowhere else.
function watchOutsideRequests(page: Page) {
  const outside: string[] = [];
  page.on("request", (req) => {
    const url = new URL(req.url());
    if (url.protocol.startsWith("http") && url.host !== appOrigin) {
      outside.push(url.host);
    }
  });
  return outside;
}

async function openHomeAndWaitForEmulator(page: Page) {
  const reachedEmulator = page.waitForRequest((req) =>
    req.url().includes(emulatorOrigin)
  );
  await page.goto("/");
  await reachedEmulator;
}

test("first open seeds the sixteen categories into the emulator", async ({ page }) => {
  await clearEmulator();
  const outside = watchOutsideRequests(page);

  await openHomeAndWaitForEmulator(page);

  await expect
    .poll(async () => (await listDocs("categories")).length, { timeout: 15_000 })
    .toBe(16);
  expect(new Set(outside)).toEqual(new Set([emulatorOrigin]));
});

test("opens against the seeded emulator without seeding again", async ({ page }) => {
  await seedEmulator("normal");
  const outside = watchOutsideRequests(page);

  await openHomeAndWaitForEmulator(page);
  // Give a second seeding (if there were one) time to land.
  await page.waitForTimeout(1_000);

  const categories = await listDocs("categories");
  expect(categories).toHaveLength(16);
  expect(categories.map((c) => c.id)).toContain("food-drink");
  expect(new Set(outside)).toEqual(new Set([emulatorOrigin]));
});
