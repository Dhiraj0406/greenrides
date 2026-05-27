import { defineConfig, devices } from "@playwright/test";
import * as dotenv from "dotenv";

dotenv.config({ path: `${process.cwd()}/.env.qa` });

export default defineConfig({
  testDir: "./qa",
  timeout: 60_000,
  retries: 1,
  use: {
    screenshot: "only-on-failure",
    video:      "retain-on-failure",
    trace:      "retain-on-failure",
  },
  projects: [
    {
      name: "chromium",
      use:  { ...devices["Desktop Chrome"] },
    },
  ],
  reporter: [
    ["list"],
    ["html",  { outputFolder: "playwright-report", open: "never"   }],
    ["json",  { outputFile:   "playwright-report/results.json"     }],
  ],
});
