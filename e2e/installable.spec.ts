import { expect, test } from "@playwright/test";
import { seedEmulator } from "../scripts/seed-emulator";

// The service worker is off in every other spec (playwright.config.ts); this one needs it.
test.use({ serviceWorkers: "allow" });

test("after one visit, opening with no connection shows Daybook's no-connection screen", async ({
  page,
  context,
}) => {
  await seedEmulator("normal");
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "No connection" })).toHaveCount(0);

  // The worker installs by itself and keeps the four screens, their scripts and the icons.
  await page.evaluate(() => navigator.serviceWorker.ready);
  const kept = await page.evaluate(async () => {
    const shell = await caches.open("daybook-shell-v2");
    const statics = await caches.open("daybook-static-v2");
    const paths = async (cache: Cache) => (await cache.keys()).map((r) => new URL(r.url).pathname);
    return { shell: await paths(shell), statics: await paths(statics), all: await caches.keys() };
  });
  for (const route of ["/", "/spending", "/transactions", "/categories", "/icons/icon-192.png"]) {
    expect(kept.shell).toContain(route);
  }
  expect(kept.statics.some((p) => p.endsWith(".js"))).toBe(true);
  expect(kept.statics.some((p) => p.endsWith(".css"))).toBe(true);
  // Nothing from `/api/` or a data request is ever kept, and old caches are gone.
  expect([...kept.shell, ...kept.statics].some((p) => p.startsWith("/api/"))).toBe(false);
  expect(kept.all.sort()).toEqual(["daybook-shell-v2", "daybook-static-v2"]);

  // Offline, a reload (and a screen other than home, with a filter in its address) is still Daybook.
  await context.setOffline(true);
  await expect.poll(() => page.evaluate(() => navigator.onLine)).toBe(false);
  await page.reload();
  await expect(page.getByRole("heading", { name: "No connection" })).toBeVisible();
  await page.goto("/transactions?q=bakery");
  await expect(page.getByRole("heading", { name: "No connection" })).toBeVisible();
  await expect(page.getByRole("button", { name: /try again/i })).toBeVisible();

  // Back online, the same page loads its screen (Try again, if the screen is still waiting).
  await context.setOffline(false);
  await expect.poll(() => page.evaluate(() => navigator.onLine)).toBe(true);
  const again = page.getByRole("button", { name: /try again/i });
  if (await again.isVisible()) await again.click();
  await expect(page.getByRole("heading", { name: "No connection" })).toHaveCount(0);
});

test("the manifest and the icons describe an installable Daybook", async ({ request }) => {
  const res = await request.get("/manifest.webmanifest");
  expect(res.ok()).toBe(true);
  const manifest = await res.json();
  expect(manifest).toMatchObject({
    name: "Daybook",
    short_name: "Daybook",
    start_url: "/",
    scope: "/",
    display: "standalone",
    background_color: "#FFFCEE",
    theme_color: "#FFFCEE",
  });
  expect(manifest.icons.map((i: { purpose: string; sizes: string }) => `${i.sizes} ${i.purpose}`)).toEqual([
    "192x192 any",
    "512x512 any",
    "512x512 maskable",
  ]);
  for (const icon of manifest.icons) expect((await request.get(icon.src)).ok()).toBe(true);
  expect((await request.get("/icons/apple-touch-icon.png")).ok()).toBe(true);
  const favicon = await request.get("/icon.svg");
  expect(favicon.ok()).toBe(true);
  expect(favicon.headers()["content-type"]).toContain("image/svg+xml");
});
