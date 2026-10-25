import { defineConfig, devices } from "@playwright/test";
import { APP_PORT } from "./scripts/test-env";

// Run through `npm run test:e2e`, which builds the test app and starts the
// emulator and the app server first (scripts/e2e.ts).
export default defineConfig({
  testDir: "e2e",
  // Specs share one emulator database, so they run one at a time.
  workers: 1,
  fullyParallel: false,
  forbidOnly: true,
  retries: 0,
  reporter: "list",
  use: {
    baseURL: `http://127.0.0.1:${APP_PORT}`,
    trace: "retain-on-failure",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
});
