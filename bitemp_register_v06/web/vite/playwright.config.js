// Playwright config voor visuele/e2e UI-tests van de v06 IDE.
//
// Vereisten:
//   1) Vite dev-server draait op http://localhost:5174 (of override via PLAYWRIGHT_BASE_URL)
//   2) Go API draait op http://localhost:8082 (voor auth-login in globalSetup)
//   3) Eenmalig: `npm i -D @playwright/test && npx playwright install chromium`
//
// Auth:
//   Stel PLAYWRIGHT_USERNAME + PLAYWRIGHT_PASSWORD in (default: admin / admin123)
//   globalSetup logt eenmalig in en slaat cookie op in tests/e2e/.auth/user.json
//
import { defineConfig, devices } from "@playwright/test";
import { AUTH_STATE_PATH } from "./tests/e2e/global-setup.js";

const BASE_URL = process.env.PLAYWRIGHT_BASE_URL || "http://localhost:5174";
// De Vite dev-server serveert de React app op /viz/react/ (zie vite.config.js base)
// baseURL is alleen de origin; tests gebruiken het volledige pad /viz/react/ide/ etc.

export default defineConfig({
  testDir: "./tests/e2e",
  globalSetup: "./tests/e2e/global-setup.js",
  timeout: 60_000,
  expect: { timeout: 10_000 },
  fullyParallel: true,
  retries: 0,
  reporter: [["list"], ["html", { open: "never", outputFolder: "playwright-report" }]],
  use: {
    baseURL: BASE_URL,
    storageState: AUTH_STATE_PATH,  // hergebruik auth-cookie uit globalSetup
    viewport: { width: 1440, height: 900 },
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
  },
  // Start de dev-server als die nog niet draait; hergebruik als hij al op poort loopt.
  webServer: {
    command: "npm run dev -- --host",
    url: BASE_URL + "/viz/react/",
    reuseExistingServer: true,
    timeout: 120_000,
    stdout: "pipe",
    stderr: "pipe",
  },
  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"] } },
  ],
});
