// npm run compare [-- --skip-build] [-- --only <text>] [-- --refresh-proto]
//
// Shoots about 20 key states of the design prototype (redesign/design/prototype, served locally) and the
// same states of the app, on a phone (390 wide) and wide (1280), and puts each pair side by side
// (prototype on the left, app on the right) so the differences can be read off one image.
//
// Pictures go to redesign/compare/ (not committed, except report.md):
//   proto/<state>-<width>.png   prototype shots, kept between runs (--refresh-proto shoots them again)
//   app/<state>-<width>.png     app shots, shot every run
//   side/<state>-<width>.png    the pair, prototype | app
//
// The app side uses the same test build, emulator and mocked screenshot reader as the e2e suite
// (scripts/test-servers.ts), so nothing reaches Claude or any real database. The browser clock is fixed to
// the prototype's "today" (Sunday 2026-10-25) so both sides show the same weeks. The data is not the
// prototype's: stores and amounts differ, layout and wording should not.
//
// `--only <text>` keeps the states whose id, area or label contains the text (`--only spend`,
// `--only "Categories"`). Without --only, state ids are listed at the end. Nothing here fixes anything.

import { createServer, type Server } from "node:http";
import { existsSync, mkdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { chromium, type Browser, type Page } from "@playwright/test";
import { bankLine, mockOcr, screenshots } from "../e2e/fixtures/ocr";
import { buildSeed, seedEmulator, type SeedSet } from "./seed-emulator";
import { APP_PORT, clearEmulator, EMULATOR_HOST, EMULATOR_PORT, writeDocs } from "./test-env";
import { startTestServers } from "./test-servers";

const root = path.resolve(import.meta.dirname, "..");
const DESIGN_DIR = path.join(root, "redesign", "design");
const OUT = path.join(root, "redesign", "compare");
const BASE = `http://127.0.0.1:${APP_PORT}`;
const PROTO_PORT = 3101;
const TODAY = "2026-10-25"; // the prototype's D.TODAY, a Sunday
const MAX_HEIGHT = 2600; // a stress list can be thousands of pixels tall; the top is what is compared

const VIEWPORTS = [
  { name: "390", width: 390, height: 844 },
  { name: "1280", width: 1280, height: 800 },
] as const;
type Viewport = (typeof VIEWPORTS)[number];

type Data = SeedSet | "no-waiting" | "empty";

type State = {
  id: string;
  area: "Home and form" | "Spending" | "All transactions" | "Categories" | "Whole app";
  label: string;
  /** The prototype's state id (`?state=<proto>`); `stress` adds `&stress`. */
  proto: string;
  stress?: boolean;
  /** Anything to do on the prototype page before the shot (a state id can't open the menu). */
  protoSetup?: (page: Page) => Promise<void>;
  /** An overlay (sheet or dialog) is open: shot at the size of the window, not the whole page. */
  overlay?: boolean;
  route: string;
  data: Data;
  setup: (page: Page) => Promise<void>;
  offline?: boolean;
};

// ---- helpers -------------------------------------------------------------------------------------

async function seed(data: Data) {
  if (data === "normal" || data === "stress") {
    await seedEmulator(data, TODAY);
    return;
  }
  const normal = buildSeed("normal", TODAY);
  await clearEmulator();
  await writeDocs("meta", normal.meta);
  await writeDocs("categories", normal.categories);
  if (data === "no-waiting") {
    await writeDocs("transactions", normal.transactions.filter((d) => d.data.status === "confirmed"));
  }
}

const heading = (page: Page, name: string | RegExp) =>
  page.getByRole("heading", { name }).first().waitFor({ timeout: 20_000 });
const mainOf = (page: Page) => page.getByRole("main");
const dialog = (page: Page, name: string | RegExp) => page.getByRole("dialog", { name });
const openFirstRowButton = async (page: Page) => {
  await mainOf(page).getByRole("listitem").first().getByRole("button").first().click();
};
const typeInSpend = async (page: Page) => {
  await page.getByRole("button", { name: "Menu" }).click();
  await dialog(page, "Menu").waitFor();
  await dialog(page, "Menu").getByRole("button", { name: /Type in a spend/ }).click();
  await dialog(page, "Type in a spend").waitFor();
};
const homeReady = (p: Page) => heading(p, /to check/);

// ---- the states ----------------------------------------------------------------------------------

const STATES: State[] = [
  // Home and form
  { id: "home", area: "Home and form", label: "Home, lines waiting (one open)", proto: "review-fresh", route: "/", data: "normal",
    setup: async (p) => {
      await homeReady(p);
      await p.getByRole("button", { name: "Indomaret", exact: true }).click();
      await p.getByLabel("What did you buy?").waitFor();
    } },
  { id: "home-stress", area: "Home and form", label: "Home, stress data", proto: "review-fresh", stress: true, route: "/", data: "stress", setup: homeReady },
  { id: "home-clear", area: "Home and form", label: "Home, all checked", proto: "review-clear", route: "/", data: "no-waiting", setup: (p) => heading(p, "All checked") },
  { id: "home-import", area: "Home and form", label: "Import tray: one read, one failed, one found nothing", proto: "import-mixed", route: "/", data: "no-waiting",
    setup: async (p) => {
      await mockOcr(p, [
        { lines: [
          bankLine({ store: "WARUNG TEGAL", amount: null, amountText: "?", date: TODAY }),
          bankLine({ store: "TRSF E-BANKING CR BUDI", amount: 500_000, direction: "in", date: TODAY }),
          bankLine({ store: "TOP UP GOPAY", amount: 100_000, ownTransfer: true, date: TODAY }),
          bankLine({ store: "Superindo", amount: 87_450, date: TODAY }),
        ] },
        { lines: "fail" },
        { lines: [] },
      ]);
      await heading(p, "All checked");
      await p.locator('input[type="file"]').setInputFiles(screenshots(3));
      await heading(p, /^Read 1 of 3 screenshots/);
      await heading(p, /Need a look/);
    } },
  { id: "form-add", area: "Home and form", label: "Type in a spend (form)", proto: "form-add", overlay: true, route: "/", data: "normal",
    setup: async (p) => { await homeReady(p); await typeInSpend(p); } },
  { id: "form-notready", area: "Home and form", label: "Type in a spend, not ready to save", proto: "form-notready", overlay: true, route: "/", data: "normal",
    setup: async (p) => {
      await homeReady(p);
      await typeInSpend(p);
      await dialog(p, "Type in a spend").getByRole("button", { name: "Add spend" }).click({ force: true });
      await dialog(p, "Type in a spend").getByRole("alert").first().waitFor().catch(() => {});
    } },
  { id: "menu", area: "Home and form", label: "Menu", proto: "review-fresh", overlay: true,
    protoSetup: async (p) => {
      await p.getByRole("button", { name: "Menu" }).click();
      await p.getByRole("dialog", { name: "Menu" }).waitFor();
    }, route: "/", data: "normal",
    setup: async (p) => {
      await homeReady(p);
      await p.getByRole("button", { name: "Menu" }).click();
      await dialog(p, "Menu").waitFor();
    } },

  // Spending
  { id: "spend", area: "Spending", label: "Spending, this month", proto: "spend-month", route: "/spending", data: "normal", setup: (p) => heading(p, "Spending") },
  { id: "spend-stress", area: "Spending", label: "Spending, stress data", proto: "spend-month", stress: true, route: "/spending", data: "stress", setup: (p) => heading(p, "Spending") },
  { id: "spend-open", area: "Spending", label: "Spending, one of the biggest spends open", proto: "spend-open", overlay: true, route: "/spending", data: "normal",
    setup: async (p) => {
      await heading(p, "Spending");
      await p.getByRole("region", { name: "Biggest spends" }).getByRole("button").first().click();
      await dialog(p, "Change spend").waitFor();
    } },
  { id: "spend-none", area: "Spending", label: "Spending, first use", proto: "app-first-spending", route: "/spending", data: "empty", setup: (p) => heading(p, "Spending") },

  // All transactions
  { id: "find", area: "All transactions", label: "All transactions", proto: "find-all", route: "/transactions", data: "normal", setup: (p) => heading(p, "All transactions") },
  { id: "find-stress", area: "All transactions", label: "All transactions, stress data", proto: "find-all", stress: true, route: "/transactions", data: "stress", setup: (p) => heading(p, "All transactions") },
  { id: "find-filters", area: "All transactions", label: "Filters on (chips)", proto: "find-filters", route: "/transactions?cat=food-drink", data: "normal",
    setup: async (p) => {
      await heading(p, "All transactions");
      await p.getByRole("group", { name: "Filters on" }).waitFor();
    } },
  { id: "find-sheet", area: "All transactions", label: "The filters sheet", proto: "find-sheet", overlay: true, route: "/transactions", data: "normal",
    setup: async (p) => {
      await heading(p, "All transactions");
      await p.getByRole("button", { name: /^Filters/ }).click();
      await dialog(p, "Filters").waitFor();
    } },
  { id: "find-none", area: "All transactions", label: "No results", proto: "find-none", route: "/transactions", data: "normal",
    setup: async (p) => {
      await heading(p, "All transactions");
      await p.getByRole("searchbox").or(p.getByRole("textbox", { name: /search/i })).first().fill("zzzzqqq");
      await p.getByText(/Nothing matches|No results|didn.t find/i).first().waitFor({ timeout: 5_000 }).catch(() => {});
    } },
  { id: "find-form", area: "All transactions", label: "Change a saved spend", proto: "find-form", overlay: true, route: "/transactions", data: "normal",
    setup: async (p) => {
      await heading(p, "All transactions");
      await openFirstRowButton(p);
      await dialog(p, "Change spend").waitFor();
    } },
  { id: "find-delete", area: "All transactions", label: "Delete a spend: asking once", proto: "find-delete", overlay: true, route: "/transactions", data: "normal",
    setup: async (p) => {
      await heading(p, "All transactions");
      await openFirstRowButton(p);
      await dialog(p, "Change spend").getByRole("button", { name: "Delete this spend" }).click();
      await p.getByRole("alertdialog", { name: "Delete this spend?" }).waitFor();
    } },

  // Categories
  { id: "org", area: "Categories", label: "Categories", proto: "org-list", route: "/categories", data: "normal", setup: (p) => heading(p, "Categories") },
  { id: "org-stress", area: "Categories", label: "Categories, stress data", proto: "org-list", stress: true, route: "/categories", data: "stress", setup: (p) => heading(p, "Categories") },
  { id: "org-add", area: "Categories", label: "Add a category", proto: "org-add", overlay: true, route: "/categories", data: "normal",
    setup: async (p) => {
      await heading(p, "Categories");
      await p.getByRole("button", { name: "Add category", exact: true }).click();
      await dialog(p, /^Add a category$/).waitFor();
    } },
  { id: "org-del-has", area: "Categories", label: "Delete a category that has spends", proto: "org-del-has", overlay: true, route: "/categories", data: "normal",
    setup: async (p) => {
      await heading(p, "Categories");
      await mainOf(p).getByRole("listitem").filter({ hasText: "Food & Drink" }).getByRole("button").click();
      await dialog(p, /^Change category$/).getByRole("button", { name: "Delete this category" }).click();
      await p.getByRole("alertdialog", { name: "Delete this category?" }).waitFor();
    } },

  // Whole app
  { id: "app-first", area: "Whole app", label: "First use: nothing at all yet", proto: "app-first", route: "/", data: "empty", setup: (p) => heading(p, "Add your first spending") },
  { id: "app-offline-boot", area: "Whole app", label: "No connection: opening the app", proto: "app-offline-boot", route: "/", data: "normal", offline: true,
    setup: (p) => heading(p, "No connection") },
  { id: "app-offline", area: "Whole app", label: "No connection while using it", proto: "app-offline", route: "/", data: "normal",
    setup: async (p) => {
      await homeReady(p);
      await p.getByRole("button", { name: "Indomaret", exact: true }).click();
      await p.context().setOffline(true);
      await p.waitForFunction(() => !navigator.onLine);
      await p.getByText(/read-only|can.t be saved|no connection/i).first().waitFor({ timeout: 10_000 }).catch(() => {});
    } },
];

// ---- the prototype server -------------------------------------------------------------------------

const MIME: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".webmanifest": "application/manifest+json",
};

function serveDesign(): Promise<Server> {
  const server = createServer((req, res) => {
    const url = new URL(req.url ?? "/", "http://localhost");
    let file = path.join(DESIGN_DIR, decodeURIComponent(url.pathname));
    if (!file.startsWith(DESIGN_DIR)) {
      res.writeHead(403).end();
      return;
    }
    if (existsSync(file) && statSync(file).isDirectory()) file = path.join(file, "index.html");
    if (!existsSync(file)) {
      res.writeHead(404).end();
      return;
    }
    res.writeHead(200, { "Content-Type": MIME[path.extname(file)] ?? "application/octet-stream" });
    res.end(readFileSync(file));
  });
  return new Promise((resolve, reject) => {
    server.once("error", (err) =>
      reject(new Error(`Port ${PROTO_PORT} is already in use (${(err as Error).message}). Stop whatever holds it, then rerun.`))
    );
    server.listen(PROTO_PORT, "127.0.0.1", () => resolve(server));
  });
}

// ---- shooting ------------------------------------------------------------------------------------

async function shoot(page: Page, file: string, overlay: boolean | undefined, vp: Viewport) {
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(600); // a sheet has finished rising
  if (overlay) {
    await page.screenshot({ path: file });
    return;
  }
  const height = await page.evaluate(() => Math.max(document.documentElement.scrollHeight, document.body.scrollHeight));
  await page.screenshot({
    path: file,
    fullPage: true,
    clip: { x: 0, y: 0, width: vp.width, height: Math.min(Math.max(height, vp.height), MAX_HEIGHT) },
  });
}

async function shootProto(browser: Browser, state: State, vp: Viewport, file: string) {
  const context = await browser.newContext({ viewport: { width: vp.width, height: vp.height }, reducedMotion: "reduce", serviceWorkers: "block" });
  const page = await context.newPage();
  try {
    await page.goto(`http://127.0.0.1:${PROTO_PORT}/prototype/?state=${state.proto}${state.stress ? "&stress" : ""}`);
    await page.locator("#app > *").first().waitFor({ timeout: 15_000 });
    await state.protoSetup?.(page);
    await shoot(page, file, state.overlay, vp);
  } finally {
    await context.close();
  }
}

async function shootApp(browser: Browser, state: State, vp: Viewport, file: string) {
  await seed(state.data);
  const context = await browser.newContext({ viewport: { width: vp.width, height: vp.height }, reducedMotion: "reduce", serviceWorkers: "block" });
  if (!state.offline) await context.clock.setFixedTime(new Date(`${TODAY}T09:00:00`));
  const page = await context.newPage();
  try {
    if (state.offline) {
      // As e2e/app.spec.ts does it: the browser says it is offline and the database can't be reached.
      // A string, not a function: tsx adds a helper to functions that the page doesn't have.
      await page.addInitScript(`Object.defineProperty(navigator, "onLine", { get: () => false, configurable: true });`);
      await page.route(`**://${EMULATOR_HOST}:${EMULATOR_PORT}/**`, (route) => route.abort("internetdisconnected"));
    }
    await page.goto(`${BASE}${state.route}`);
    await state.setup(page);
    await shoot(page, file, state.overlay, vp);
  } finally {
    await context.close();
  }
}

/** Puts the two shots in one picture: prototype on the left, app on the right, each captioned. */
async function sideBySide(browser: Browser, state: State, vp: Viewport, protoFile: string, appFile: string, out: string) {
  const col = vp.width === 390 ? 390 : 900; // wide shots are scaled down so the pair stays readable
  const b64 = (f: string) => `data:image/png;base64,${readFileSync(f).toString("base64")}`;
  const cell = (caption: string, file: string) =>
    `<div style="width:${col}px"><div style="font:600 14px system-ui;padding:6px 0;color:#333">${caption}</div>` +
    `<img src="${b64(file)}" style="width:${col}px;display:block;border:1px solid #c33"></div>`;
  const page = await browser.newPage({ viewport: { width: col * 2 + 60, height: 400 } });
  try {
    await page.setContent(
      `<body style="margin:0;padding:12px 16px;background:#fff"><div style="font:700 16px system-ui;margin-bottom:8px">` +
        `${state.id} @${vp.name}: ${state.label}</div><div style="display:flex;gap:28px;align-items:flex-start">` +
        `${cell("PROTOTYPE", protoFile)}${cell("APP", appFile)}</div></body>`
    );
    await page.waitForLoadState("load");
    await page.screenshot({ path: out, fullPage: true });
  } finally {
    await page.close();
  }
}

// ---- run -----------------------------------------------------------------------------------------

function argValue(args: string[], flag: string) {
  const i = args.indexOf(flag);
  return i >= 0 ? args[i + 1] : undefined;
}

async function main() {
  const args = process.argv.slice(2);
  const only = argValue(args, "--only")?.toLowerCase();
  const refresh = args.includes("--refresh-proto");
  const states = STATES.filter(
    (s) => !only || s.id.toLowerCase().includes(only) || s.area.toLowerCase().includes(only) || s.label.toLowerCase().includes(only)
  );
  if (!states.length) throw new Error(`Nothing matches --only ${only}. States: ${STATES.map((s) => s.id).join(", ")}`);

  for (const dir of ["proto", "app", "side"]) mkdirSync(path.join(OUT, dir), { recursive: true });
  const file = (kind: "proto" | "app" | "side", s: State, vp: Viewport) => path.join(OUT, kind, `${s.id}-${vp.name}.png`);

  const design = await serveDesign();
  let servers: Awaited<ReturnType<typeof startTestServers>> | undefined;
  let browser: Browser | undefined;
  const failures: string[] = [];
  try {
    servers = await startTestServers(args.includes("--skip-build"));
    browser = await chromium.launch();
    for (const s of states) {
      for (const vp of VIEWPORTS) {
        try {
          const protoFile = file("proto", s, vp);
          if (refresh || !existsSync(protoFile)) await shootProto(browser, s, vp, protoFile);
          const appFile = file("app", s, vp);
          await shootApp(browser, s, vp, appFile);
          await sideBySide(browser, s, vp, protoFile, appFile, file("side", s, vp));
          console.log(`[compare] ${s.id} @${vp.name}: redesign/compare/side/${s.id}-${vp.name}.png`);
        } catch (err) {
          failures.push(`${s.id} @${vp.name}: ${err instanceof Error ? err.message.split("\n")[0] : err}`);
        }
      }
    }
  } finally {
    await browser?.close();
    await servers?.stop();
    design.close();
  }
  console.log(`\n[compare] ${states.length * VIEWPORTS.length - failures.length} pairs in redesign/compare/side/.`);
  if (failures.length) console.log(`\nFAILED:\n  ${failures.join("\n  ")}`);
  return failures.length ? 1 : 0;
}

main()
  .then((code) => process.exit(code))
  .catch((err) => {
    console.error(`[compare] ${err instanceof Error ? err.message : err}`);
    process.exit(1);
  });
