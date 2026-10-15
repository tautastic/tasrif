import { defineConfig } from "@playwright/test";
import { chromiumExecutable, firefoxExecutable, firefoxSelected } from "./e2e/support/paths.ts";

const isCi = Boolean(process.env.CI);

const browser = firefoxSelected()
  ? { browserName: "firefox" as const, launchOptions: { executablePath: firefoxExecutable(), args: [] } }
  : { launchOptions: { executablePath: chromiumExecutable(), args: ["--no-sandbox"] } };

export default defineConfig({
  testDir: "./e2e/specs",
  outputDir: "./e2e/.artifacts/test-results",
  globalSetup: "./e2e/global-setup.ts",
  globalTeardown: "./e2e/global-teardown.ts",
  forbidOnly: isCi,
  retries: isCi ? 1 : 0,
  timeout: 45_000,
  expect: { timeout: 8_000 },
  reporter: [["list"], ["html", { outputFolder: "e2e/.artifacts/report", open: "never" }]],
  use: {
    trace: isCi ? "on-first-retry" : "retain-on-failure",
    screenshot: "only-on-failure",
    viewport: { width: 1200, height: 900 },
    ...browser,
  },
  projects: [
    {
      name: "public",
      testMatch: /.*\.public\.spec\.ts/,
      fullyParallel: true,
      workers: 4,
    },
    {
      name: "stateful",
      testMatch: /.*\.stateful\.spec\.ts/,
      fullyParallel: false,
      workers: 1,
      dependencies: ["public"],
    },
  ],
});
