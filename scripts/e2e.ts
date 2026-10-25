// npm run test:e2e [-- --skip-build] [-- <playwright args>]
//
// 1. Builds the app into .next-test with the fake settings from
//    scripts/test-env.ts (skipped with --skip-build, for reruns).
// 2. Checks that build talks to the emulator only.
// 3. Starts the Firestore emulator (port 8181) and `next start -p 3100`.
// 4. Runs Playwright with the remaining arguments
//    (e.g. `e2e/smoke.spec.ts`, `--last-failed`).
// 5. Stops both servers by their PIDs (and their children), whatever happened.

import { spawn, type ChildProcess } from "node:child_process";
import { mkdirSync, openSync, readdirSync, readFileSync, statSync } from "node:fs";
import net from "node:net";
import path from "node:path";
import {
  APP_PORT,
  EMULATOR_HOST,
  EMULATOR_PORT,
  TEST_DIST_DIR,
  TEST_ENV,
  TEST_PROJECT_ID,
} from "./test-env";

const root = path.resolve(import.meta.dirname, "..");
const bin = (name: string) => path.join(root, "node_modules", ".bin", name);
const env = { ...process.env, ...TEST_ENV, NEXT_DIST_DIR: TEST_DIST_DIR };
const started: ChildProcess[] = [];

function run(cmd: string, args: string[]): Promise<number> {
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args, { cwd: root, env, stdio: "inherit" });
    child.on("error", reject);
    child.on("exit", (code, signal) => resolve(code ?? (signal ? 1 : 0)));
  });
}

// Started in its own process group so stopping it also stops its children
// (the emulator's Java process, Next's server workers).
function startServer(name: string, cmd: string, args: string[]) {
  const logDir = path.join(root, TEST_DIST_DIR, "logs");
  mkdirSync(logDir, { recursive: true });
  const log = openSync(path.join(logDir, `${name}.log`), "w");
  const child = spawn(cmd, args, {
    cwd: root,
    env,
    detached: true,
    stdio: ["ignore", log, log],
  });
  started.push(child);
  console.log(`[e2e] started ${name} (pid ${child.pid}), log in ${TEST_DIST_DIR}/logs/${name}.log`);
  return child;
}

function portInUse(port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const socket = net.connect(port, "127.0.0.1");
    socket.once("connect", () => {
      socket.destroy();
      resolve(true);
    });
    socket.once("error", () => resolve(false));
  });
}

async function waitForHttp(url: string, child: ChildProcess, timeoutMs: number) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (child.exitCode !== null) throw new Error(`${url}: the server exited early`);
    try {
      const res = await fetch(url);
      if (res.status < 500) return;
    } catch {
      // not up yet
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error(`${url} didn't answer within ${timeoutMs / 1000}s`);
}

async function stopAll() {
  await Promise.all(
    started.map(async (child) => {
      if (child.pid === undefined || child.exitCode !== null) return;
      const exited = new Promise((r) => child.once("exit", r));
      try {
        process.kill(-child.pid, "SIGTERM");
      } catch {
        return;
      }
      const timedOut = await Promise.race([
        exited.then(() => false),
        new Promise((r) => setTimeout(() => r(true), 15_000)),
      ]);
      if (timedOut) {
        try {
          process.kill(-child.pid, "SIGKILL");
        } catch {
          // already gone
        }
      }
    })
  );
}

// The test build must carry the demo project and the emulator address, and
// no other Firebase project ID.
function checkBuild() {
  const files: string[] = [];
  const walk = (dir: string) => {
    for (const name of readdirSync(dir)) {
      const p = path.join(dir, name);
      if (statSync(p).isDirectory()) walk(p);
      else if (p.endsWith(".js")) files.push(p);
    }
  };
  walk(path.join(root, TEST_DIST_DIR, "static"));
  const text = files.map((f) => readFileSync(f, "utf8")).join("\n");
  if (!text.includes(TEST_PROJECT_ID) || !text.includes(`${EMULATOR_HOST}:${EMULATOR_PORT}`)) {
    throw new Error(`${TEST_DIST_DIR} doesn't carry the demo project and emulator address`);
  }
  const projectIds = new Set(
    [...text.matchAll(/projectId:"([^"]+)"/g)].map((m) => m[1])
  );
  const others = [...projectIds].filter((id) => id !== TEST_PROJECT_ID);
  if (others.length) {
    throw new Error(`${TEST_DIST_DIR} carries other project IDs: ${others.join(", ")}`);
  }
}

async function main() {
  const args = process.argv.slice(2);
  const skipBuild = args.includes("--skip-build");
  const playwrightArgs = args.filter((a) => a !== "--skip-build");

  for (const port of [EMULATOR_PORT, APP_PORT]) {
    if (await portInUse(port)) {
      throw new Error(
        `Port ${port} is already in use. It isn't this run's, so it's left alone: stop whatever holds it, then rerun.`
      );
    }
  }

  if (!skipBuild) {
    console.log(`[e2e] building into ${TEST_DIST_DIR}`);
    if ((await run(bin("next"), ["build"])) !== 0) throw new Error("next build failed");
  }
  checkBuild();

  const emulator = startServer("emulator", bin("firebase"), [
    "emulators:start",
    "--only",
    "firestore",
    "--project",
    TEST_PROJECT_ID,
  ]);
  const app = startServer("app", bin("next"), ["start", "-p", String(APP_PORT)]);
  await waitForHttp(`http://${EMULATOR_HOST}:${EMULATOR_PORT}/`, emulator, 60_000);
  await waitForHttp(`http://127.0.0.1:${APP_PORT}/`, app, 60_000);

  return run(bin("playwright"), ["test", ...playwrightArgs]);
}

let exitCode = 1;
for (const signal of ["SIGINT", "SIGTERM"] as const) {
  process.on(signal, () => {
    stopAll().finally(() => process.exit(130));
  });
}
main()
  .then((code) => {
    exitCode = code;
  })
  .catch((err) => {
    console.error(`[e2e] ${err instanceof Error ? err.message : err}`);
  })
  .finally(async () => {
    await stopAll();
    console.log("[e2e] servers stopped");
    process.exit(exitCode);
  });
