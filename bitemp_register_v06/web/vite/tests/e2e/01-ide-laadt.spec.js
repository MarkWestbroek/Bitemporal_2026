// Smoke test 1: IDE pagina laadt (na auth via globalSetup cookie).
import { test, expect } from "@playwright/test";

test("IDE pagina laadt en window.__useModelStore is beschikbaar", async ({ page }) => {
  // storageState uit playwright.config.js zorgt dat de auth-cookie al aanwezig is.
  // /viz/react/ is de Vite base; /ide/ is de React Router route.
  await page.goto("/viz/react/ide/", { waitUntil: "domcontentloaded" });

  // Wacht tot React de app heeft gemount: dev-only window-hook moet beschikbaar zijn.
  // Als dit faalt: controleer of de API draait en auth werkt (zie global-setup.js).
  await page.waitForFunction(() => !!window.__useModelStore, null, { timeout: 20_000 })
    .catch(async (e) => {
      await page.screenshot({ path: "playwright-report/01-hook-timeout.png", fullPage: true });
      throw new Error("window.__useModelStore niet gevonden na 20s. Zie 01-hook-timeout.png.\n" + e.message);
    });

  await expect(page.locator("body")).toBeVisible();
  await page.screenshot({ path: "playwright-report/01-ide-load-success.png", fullPage: true });
});
