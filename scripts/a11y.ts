// npm run a11y [-- --skip-build] [-- --only <text>]
//
// Scans every screen and the main overlays with axe (WCAG 2.0 to 2.2 A and AA, plus axe's best
// practices), on a phone (390 wide) and wide (1280), with the normal and the stress data, then runs
// the keyboard checks for the inbox, the form and the day chart. Design notes §6.
//
// It uses the same test build, emulator and app server as the e2e suite (scripts/test-servers.ts), and
// the mocked screenshot reader, so no scan reaches Claude or any real database.
//
// `--only <text>` keeps the scans whose name contains the text (`--only /spending`, `--only "form"`);
// the keyboard checks run only when `--only` is absent or matches their name ("keyboard").
// Exit code 1 when anything serious or critical is found, or a keyboard check fails. Moderate and minor
// findings are listed but don't fail the run.

import { chromium, type Browser, type BrowserContext, type Page } from "@playwright/test";
import axe, { type Result } from "axe-core";
import { bankLine, mockOcr, screenshots } from "../e2e/fixtures/ocr";
import { buildSeed, seedEmulator, type SeedSet } from "./seed-emulator";
import { APP_PORT, clearEmulator, EMULATOR_HOST, EMULATOR_PORT, writeDocs } from "./test-env";
import { startTestServers } from "./test-servers";

const BASE = `http://127.0.0.1:${APP_PORT}`;
const VIEWPORTS = [
  { name: "390", width: 390, height: 844 },
  { name: "1280", width: 1280, height: 800 },
] as const;
const TAGS = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa", "best-practice"];

type Data = SeedSet | "no-waiting" | "empty";

type Scan = {
  name: string;
  data: Data;
  /** Where to start, and anything to do before the scan (open an overlay). */
  route: string;
  setup?: (page: Page) => Promise<void>;
  /** Run offline from the first script on. */
  offline?: boolean;
};

const todayISO = () => new Date().toISOString().slice(0, 10);

async function seed(data: Data) {
  if (data === "normal" || data === "stress") {
    await seedEmulator(data, todayISO());
    return;
  }
  const normal = buildSeed("normal", todayISO());
  await clearEmulator();
  await writeDocs("meta", normal.meta);
  await writeDocs("categories", normal.categories);
  if (data === "no-waiting") {
    await writeDocs(
      "transactions",
      normal.transactions.filter((d) => d.data.status === "confirmed")
    );
  }
}

const heading = (page: Page, name: string | RegExp) =>
  page.getByRole("heading", { name }).first().waitFor({ timeout: 20_000 });
const mainOf = (page: Page) => page.getByRole("main");
const dialog = (page: Page, name: string | RegExp) => page.getByRole("dialog", { name });
const openMenu = async (page: Page) => {
  await page.getByRole("button", { name: "Menu" }).click();
  await dialog(page, "Menu").waitFor();
};
const typeInSpend = async (page: Page) => {
  await openMenu(page);
  await dialog(page, "Menu").getByRole("button", { name: /Type in a spend/ }).click();
  await dialog(page, "Type in a spend").waitFor();
};
const openFirstRowButton = async (page: Page) => {
  await mainOf(page).getByRole("listitem").first().getByRole("button").first().click();
};

const SCANS: Scan[] = [
  // Home
  { name: "home", route: "/", data: "normal", setup: (p) => heading(p, /to check/) },
  { name: "home, stress data", route: "/", data: "stress", setup: (p) => heading(p, /to check/) },
  {
    name: "home, a waiting line open",
    route: "/",
    data: "normal",
    setup: async (p) => {
      await heading(p, /to check/);
      await p.getByRole("button", { name: "Indomaret", exact: true }).click();
      await p.getByLabel("What did you buy?").waitFor();
    },
  },
  { name: "home, all checked", route: "/", data: "no-waiting", setup: (p) => heading(p, "All checked") },
  { name: "home, first use", route: "/", data: "empty", setup: (p) => heading(p, "Add your first spending") },
  {
    name: "home, import tray and lines that need a look",
    route: "/",
    data: "no-waiting",
    setup: async (p) => {
      await mockOcr(p, [
        {
          lines: [
            bankLine({ store: "WARUNG TEGAL", amount: null, amountText: "?", date: todayISO() }),
            bankLine({ store: "TRSF E-BANKING CR BUDI", amount: 500_000, direction: "in", date: todayISO() }),
            bankLine({ store: "TOP UP GOPAY", amount: 100_000, ownTransfer: true, date: todayISO() }),
            bankLine({ store: "Superindo", amount: 87_450, date: todayISO() }),
          ],
        },
        { lines: "fail" },
        { lines: [] },
      ]);
      await heading(p, "All checked");
      await p.locator('input[type="file"]').setInputFiles(screenshots(3));
      await heading(p, /^Read 1 of 3 screenshots/);
      await heading(p, /Need a look/);
    },
  },
  { name: "home, menu", route: "/", data: "normal", setup: async (p) => { await heading(p, /to check/); await openMenu(p); } },
  {
    name: "home, type in a spend form",
    route: "/",
    data: "normal",
    setup: async (p) => {
      await heading(p, /to check/);
      await typeInSpend(p);
    },
  },
  {
    name: "home, type in a spend form, errors shown",
    route: "/",
    data: "normal",
    setup: async (p) => {
      await heading(p, /to check/);
      await typeInSpend(p);
      await dialog(p, "Type in a spend").getByRole("button", { name: "Add spend" }).click({ force: true });
      await dialog(p, "Type in a spend").getByRole("alert").first().waitFor().catch(() => {});
    },
  },

  // Spending
  { name: "/spending", route: "/spending", data: "normal", setup: (p) => heading(p, "Spending") },
  { name: "/spending, stress data", route: "/spending", data: "stress", setup: (p) => heading(p, "Spending") },
  { name: "/spending, first use", route: "/spending", data: "empty", setup: (p) => heading(p, "Spending") },
  {
    name: "/spending, change spend form",
    route: "/spending",
    data: "normal",
    setup: async (p) => {
      await heading(p, "Spending");
      await p.getByRole("heading", { name: "Biggest spends" }).waitFor();
      await p.getByRole("region", { name: "Biggest spends" }).getByRole("button").first().click();
      await dialog(p, "Change spend").waitFor();
    },
  },

  // All transactions
  { name: "/transactions", route: "/transactions", data: "normal", setup: (p) => heading(p, "All transactions") },
  { name: "/transactions, stress data", route: "/transactions", data: "stress", setup: (p) => heading(p, "All transactions") },
  { name: "/transactions, first use", route: "/transactions", data: "empty", setup: (p) => heading(p, "All transactions") },
  {
    name: "/transactions, no results",
    route: "/transactions",
    data: "normal",
    setup: async (p) => {
      await heading(p, "All transactions");
      await p.getByRole("searchbox").or(p.getByRole("textbox", { name: /search/i })).first().fill("zzzzqqq");
      await p.getByText(/Nothing matches|No results|didn.t find/i).first().waitFor({ timeout: 5_000 }).catch(() => {});
    },
  },
  {
    name: "/transactions, filters",
    route: "/transactions",
    data: "normal",
    setup: async (p) => {
      await heading(p, "All transactions");
      await p.getByRole("button", { name: /^Filters/ }).click();
      await dialog(p, "Filters").waitFor();
      await dialog(p, "Filters").getByRole("button", { name: /Food & Drink/ }).click();
    },
  },
  {
    name: "/transactions, filters on (chips)",
    route: "/transactions?cat=food-drink",
    data: "normal",
    setup: async (p) => {
      await heading(p, "All transactions");
      await p.getByRole("group", { name: "Filters on" }).waitFor();
    },
  },
  {
    name: "/transactions, change spend form",
    route: "/transactions",
    data: "normal",
    setup: async (p) => {
      await heading(p, "All transactions");
      await openFirstRowButton(p);
      await dialog(p, "Change spend").waitFor();
    },
  },
  {
    name: "/transactions, delete spend question",
    route: "/transactions",
    data: "normal",
    setup: async (p) => {
      await heading(p, "All transactions");
      await openFirstRowButton(p);
      await dialog(p, "Change spend").getByRole("button", { name: "Delete this spend" }).click();
      await p.getByRole("alertdialog", { name: "Delete this spend?" }).waitFor();
    },
  },

  // Categories
  { name: "/categories", route: "/categories", data: "normal", setup: (p) => heading(p, "Categories") },
  { name: "/categories, stress data", route: "/categories", data: "stress", setup: (p) => heading(p, "Categories") },
  {
    name: "/categories, add form",
    route: "/categories",
    data: "normal",
    setup: async (p) => {
      await heading(p, "Categories");
      await p.getByRole("button", { name: "Add category", exact: true }).click();
      await dialog(p, /^Add a category$/).waitFor();
    },
  },
  {
    name: "/categories, change form",
    route: "/categories",
    data: "normal",
    setup: async (p) => {
      await heading(p, "Categories");
      await openFirstRowButton(p);
      await dialog(p, /^Change category$/).waitFor();
    },
  },
  {
    name: "/categories, delete a used category",
    route: "/categories",
    data: "normal",
    setup: async (p) => {
      await heading(p, "Categories");
      await mainOf(p).getByRole("listitem").filter({ hasText: "Food & Drink" }).getByRole("button").click();
      await dialog(p, /^Change category$/).getByRole("button", { name: "Delete this category" }).click();
      await p.getByRole("alertdialog", { name: "Delete this category?" }).waitFor();
    },
  },

  // Other states
  { name: "not found (/nope)", route: "/nope", data: "normal", setup: (p) => p.waitForLoadState("load") },
  {
    name: "/transactions, offline after loading (read-only notice)",
    route: "/transactions",
    data: "normal",
    setup: async (p) => {
      await heading(p, "All transactions");
      await p.context().setOffline(true);
      await p.waitForFunction(() => !navigator.onLine);
      await p.getByText(/read-only|can.t be saved|no connection/i).first().waitFor({ timeout: 10_000 });
    },
  },
  {
    name: "no connection",
    route: "/",
    data: "normal",
    offline: true,
    setup: (p) => heading(p, /No connection|Couldn’t load your/),
  },
];

type Hit = { scan: string; viewport: string; id: string; impact: string; help: string; nodes: string[] };

async function scan(page: Page): Promise<Result[]> {
  await page.addScriptTag({ content: axe.source });
  await page.waitForTimeout(400); // animations (a sheet rising) have settled
  return page.evaluate(
    (tags) =>
      (window as unknown as { axe: typeof axe }).axe
        .run(document, { runOnly: { type: "tag", values: tags }, resultTypes: ["violations"] })
        .then((r) => r.violations),
    TAGS
  );
}

async function newPage(browser: Browser, vp: (typeof VIEWPORTS)[number], offline = false) {
  const context: BrowserContext = await browser.newContext({
    viewport: { width: vp.width, height: vp.height },
    serviceWorkers: "block",
  });
  const page = await context.newPage();
  if (offline) {
    // As e2e/app.spec.ts does it: the browser says it is offline and the database can't be reached.
    await page.addInitScript(() => {
      Object.defineProperty(navigator, "onLine", { get: () => false, configurable: true });
    });
    await page.route(`**://${EMULATOR_HOST}:${EMULATOR_PORT}/**`, (route) => route.abort("internetdisconnected"));
  }
  return { page, close: () => context.close() };
}

// ---- keyboard checks ------------------------------------------------------------------------------

type Check = { name: string; run: (page: Page) => Promise<string | null> };

const focusedName = (page: Page) =>
  page.evaluate(() => {
    const el = document.activeElement as HTMLElement | null;
    return el ? (el.getAttribute("aria-label") ?? el.textContent ?? el.tagName).trim().slice(0, 60) : "";
  });

/** Presses Tab up to `n` times and says where focus left the dialog, if it did. */
async function tabStaysIn(page: Page, root: string, n: number) {
  for (let i = 0; i < n; i++) {
    await page.keyboard.press("Tab");
    const inside = await page.evaluate((sel) => !!document.activeElement?.closest(sel), root);
    if (!inside) return `Tab ${i + 1} left the dialog (focus on "${await focusedName(page)}")`;
  }
  return null;
}

const CHECKS: Check[] = [
  {
    name: "keyboard: inbox (open a line, change it, accept it)",
    run: async (page) => {
      await seed("normal");
      await page.goto(BASE);
      await heading(page, "3 to check");
      const open = page.getByRole("button", { name: "Indomaret", exact: true });
      await open.focus();
      await page.keyboard.press("Enter");
      if ((await open.getAttribute("aria-expanded")) !== "true") return "Enter on a line didn't open it";
      const note = page.getByLabel("What did you buy?");
      await page.keyboard.press("Tab");
      // Somewhere in the opened line there is a way to type; walk to the note with Tab.
      for (let i = 0; i < 12 && !(await note.evaluate((el) => el === document.activeElement)); i++) {
        await page.keyboard.press("Tab");
      }
      if (!(await note.evaluate((el) => el === document.activeElement))) return "Tab never reached the note field in an open line";
      await page.keyboard.type("Snacks");
      if ((await note.inputValue()) !== "Snacks") return "typing in the note didn't land";
      const category = page.getByRole("button", { name: /Transport/ });
      await category.focus();
      await page.keyboard.press("Space");
      if ((await category.getAttribute("aria-pressed")) !== "true") return "Space on a category didn't choose it";
      await open.focus();
      await page.keyboard.press("Enter");
      if ((await open.getAttribute("aria-expanded")) !== "false") return "Enter on an open line didn't close it";
      const tick = page.getByRole("button", { name: "Accept Indomaret, Rp 15.000" });
      await tick.focus();
      await page.keyboard.press("Enter");
      await heading(page, "2 to check");
      return null;
    },
  },
  {
    name: "keyboard: form (open from the menu, Tab stays inside, Escape returns focus)",
    run: async (page) => {
      await seed("normal");
      await page.goto(`${BASE}/spending`);
      await heading(page, "Spending");
      const menu = page.getByRole("button", { name: "Menu" });
      await menu.focus();
      await page.keyboard.press("Enter");
      const menuDialog = dialog(page, "Menu");
      await menuDialog.waitFor();
      const stuck = await tabStaysIn(page, '[role="dialog"]', 12);
      if (stuck) return `menu: ${stuck}`;
      await menuDialog.getByRole("button", { name: /Type in a spend/ }).focus();
      await page.keyboard.press("Enter");
      const form = dialog(page, "Type in a spend");
      await form.waitFor();
      const first = await page.evaluate(() => !!document.activeElement?.closest('[role="dialog"]'));
      if (!first) return "form: focus didn't move into the dialog when it opened";
      const stuckForm = await tabStaysIn(page, '[role="dialog"]', 40);
      if (stuckForm) return `form: ${stuckForm}`;
      for (let i = 0; i < 40; i++) {
        await page.keyboard.press("Shift+Tab");
        if (!(await page.evaluate(() => !!document.activeElement?.closest('[role="dialog"]')))) {
          return `form: Shift+Tab ${i + 1} left the dialog`;
        }
      }
      await page.keyboard.press("Escape");
      await form.waitFor({ state: "detached" });
      if (!(await menu.evaluate((el) => el === document.activeElement))) {
        return `form: after Escape focus is on "${await focusedName(page)}", not the Menu button`;
      }
      return null;
    },
  },
  {
    name: "keyboard: day chart (Previous and Next day, Enter and Space)",
    run: async (page) => {
      await seed("normal");
      await page.goto(`${BASE}/spending`);
      await heading(page, "Spending");
      const previous = page.getByRole("button", { name: "Previous day" });
      const next = page.getByRole("button", { name: "Next day" });
      await previous.focus();
      const before = await page.locator("main").innerText();
      await page.keyboard.press("Enter");
      const afterEnter = await page.locator("main").innerText();
      if (afterEnter === before) return "Enter on Previous day changed nothing";
      await page.keyboard.press("Space");
      if ((await page.locator("main").innerText()) === afterEnter) return "Space on Previous day changed nothing";
      await page.keyboard.press("Tab");
      if (!(await next.evaluate((el) => el === document.activeElement))) return "Tab from Previous day didn't reach Next day";
      const img = page.getByRole("img", { name: /^Spending by day/ });
      if ((await img.count()) !== 1) return "the day chart has no text alternative (role img, 'Spending by day…')";
      return null;
    },
  },
];

// ---- run ------------------------------------------------------------------------------------------

function argValue(args: string[], flag: string) {
  const i = args.indexOf(flag);
  return i >= 0 ? args[i + 1] : undefined;
}

async function main() {
  const args = process.argv.slice(2);
  const only = argValue(args, "--only")?.toLowerCase();
  const scans = SCANS.filter((s) => !only || s.name.toLowerCase().includes(only) || s.route.toLowerCase().includes(only));
  const checks = CHECKS.filter((c) => !only || c.name.toLowerCase().includes(only));
  if (!scans.length && !checks.length) throw new Error(`Nothing matches --only ${only}`);

  const servers = await startTestServers(args.includes("--skip-build"));
  const browser = await chromium.launch();
  const hits: Hit[] = [];
  const failures: string[] = [];
  let scanned = 0;
  try {
    // Each scan seeds again: some of them change the data (an import).
    for (const s of scans) {
      for (const vp of VIEWPORTS) {
        await seed(s.data);
        const { page, close } = await newPage(browser, vp, s.offline);
        try {
          await page.goto(`${BASE}${s.route}`);
          await s.setup?.(page);
          const violations = await scan(page);
          scanned++;
          for (const v of violations) {
            hits.push({
              scan: s.name,
              viewport: vp.name,
              id: v.id,
              impact: v.impact ?? "minor",
              help: v.help,
              nodes: v.nodes.slice(0, 4).map((n) => `${n.target.join(" ")}  ${n.html.slice(0, 110)}\n        ${(JSON.stringify(n.any[0]?.data) ?? n.failureSummary ?? "").slice(0, 300)}`),
            });
          }
          console.log(`[a11y] ${s.name} @${vp.name}: ${violations.length ? violations.map((v) => `${v.id} (${v.impact})`).join(", ") : "clean"}`);
        } catch (err) {
          const shot = `test-results/a11y/${s.name.replace(/[^a-z0-9]+/gi, "-")}-${vp.name}.png`;
          await page.screenshot({ path: shot }).catch(() => {});
          failures.push(`${s.name} @${vp.name} (screenshot: ${shot}): couldn't be scanned: ${err instanceof Error ? err.message.split("\n")[0] : err}`);
        } finally {
          await close();
        }
      }
    }

    for (const c of checks) {
      const { page, close } = await newPage(browser, VIEWPORTS[0]);
      try {
        const problem = await c.run(page);
        console.log(`[a11y] ${c.name}: ${problem ?? "ok"}`);
        if (problem) failures.push(`${c.name}: ${problem}`);
      } catch (err) {
        failures.push(`${c.name}: ${err instanceof Error ? err.message.split("\n")[0] : err}`);
      } finally {
        await close();
      }
    }
  } finally {
    await browser.close();
    await servers.stop();
  }

  const serious = hits.filter((h) => h.impact === "serious" || h.impact === "critical");
  const other = hits.filter((h) => !serious.includes(h));
  const show = (list: Hit[]) => {
    const byRule = new Map<string, Hit[]>();
    for (const h of list) byRule.set(h.id, [...(byRule.get(h.id) ?? []), h]);
    for (const [id, group] of byRule) {
      console.log(`\n  ${id} (${group[0].impact}): ${group[0].help}`);
      for (const h of group) console.log(`    - ${h.scan} @${h.viewport}\n        ${h.nodes.join("\n        ")}`);
    }
  };
  console.log(`\n[a11y] ${scanned} scans, ${checks.length} keyboard checks.`);
  if (other.length) {
    console.log(`\nModerate and minor (not failing):`);
    show(other);
  }
  if (serious.length) {
    console.log(`\nSERIOUS OR CRITICAL:`);
    show(serious);
  }
  if (failures.length) console.log(`\nFAILED:\n  ${failures.join("\n  ")}`);
  if (!serious.length && !failures.length) console.log("[a11y] nothing serious or critical.");
  return serious.length || failures.length ? 1 : 0;
}

main()
  .then((code) => process.exit(code))
  .catch((err) => {
    console.error(`[a11y] ${err instanceof Error ? err.message : err}`);
    process.exit(1);
  });
