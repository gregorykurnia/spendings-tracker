import path from "node:path";
import { defineConfig } from "vitest/config";
import { TEST_ENV } from "./scripts/test-env";

export default defineConfig({
  resolve: {
    alias: { "@": path.resolve(import.meta.dirname, "src") },
  },
  test: {
    projects: [
      {
        extends: true,
        test: {
          // `npm test`: fast tests, no emulator.
          name: "unit",
          include: ["src/**/*.test.{ts,tsx}", "scripts/**/*.test.ts"],
          environment: "node",
        },
      },
      {
        extends: true,
        test: {
          // `npm run test:db`: run inside `firebase emulators:exec`.
          name: "db",
          include: ["src/**/*.test.db.{ts,tsx}"],
          environment: "jsdom",
          env: TEST_ENV,
          // Files share one emulator database.
          fileParallelism: false,
        },
      },
    ],
  },
});
