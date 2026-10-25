// npm run test:e2e [-- --skip-build] [-- <playwright args>]
//
// 1. Builds the app into .next-test with the fake settings from
//    scripts/test-env.ts (skipped with --skip-build, for reruns).
// 2. Checks that build talks to the emulator only.
// 3. Starts the Firestore emulator (port 8181) and `next start -p 3100`.
// 4. Runs Playwright with the remaining arguments
//    (e.g. `e2e/smoke.spec.ts`, `--last-failed`).
// 5. Stops both servers by their PIDs (and their children), whatever happened.
// (Steps 1 to 3 and 5 live in scripts/test-servers.ts.)

import { binPath, run, startTestServers } from "./test-servers";

let stop: (() => Promise<void>) | undefined;
let exitCode = 1;
for (const signal of ["SIGINT", "SIGTERM"] as const) {
  process.on(signal, () => {
    (stop?.() ?? Promise.resolve()).finally(() => process.exit(130));
  });
}

async function main() {
  const args = process.argv.slice(2);
  const skipBuild = args.includes("--skip-build");
  const playwrightArgs = args.filter((a) => a !== "--skip-build");
  const servers = await startTestServers(skipBuild);
  stop = servers.stop;
  return run(binPath("playwright"), ["test", ...playwrightArgs]);
}

main()
  .then((code) => {
    exitCode = code;
  })
  .catch((err) => {
    console.error(`[e2e] ${err instanceof Error ? err.message : err}`);
  })
  .finally(async () => {
    await stop?.();
    console.log("[e2e] servers stopped");
    process.exit(exitCode);
  });
