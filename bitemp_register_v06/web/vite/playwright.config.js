// Playwright config voor visuele/e2e UI-tests van de v06 IDE.
//
// Vereisten:
//   1) Vite dev-server draait (taak "vite: dev server (v06)") op http://localhost:5173.
//      Override via: PLAYWRIGHT_BASE_URL=http://localhost:5174 npx playwright test
//   2) Eenmalig: `npm i -D @playwright/test && npx playwright install chromium`
//
// Draaien:
//   npx playwright test                # headless
//   npx playwright test --ui           # UI mode (aanbevolen voor exploratie)
//   npx playwright test --headed       # met zichtbare browser
//   npx playwright test --debug        # stap-voor-stap
//
import { defineConfig, devices } from "@playwright/test";

const BASE_URL = process.env.PLAYWRIGHT_BASE_URL || "http://localhost:5173";

export default defineConfig({
  testDir: "./tests/e2e",
  timeout: 30_000,
  expect: { timeout: 5_000 },
  fullyParallel: true,
  retries: 0,
  reporter: [["list"], ["html", { open: "never", outputFolder: "playwright-report" }]],
  use: {
    baseURL: BASE_URL,
    viewport: { width: 1440, height: 900 },
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
  },
  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"] } },
  ],
});
