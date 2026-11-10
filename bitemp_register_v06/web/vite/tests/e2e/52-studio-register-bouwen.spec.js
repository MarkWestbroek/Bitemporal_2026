// Studio — "Register bouwen" (07-11, Mark: "het model is de bron voor het genereren"): alleen waar
// de server een devloop is (GET /admin/rebuild/status bestaat); op app (404) blijft het weg.
import { test, expect } from "@playwright/test";
import { openStudio } from "./helpers/studio.js";

test.use({ viewport: { width: 1440, height: 900 } });

async function openProjectMenu(page) {
  // Via data-tour: sinds 10-11 staat de projectnaam naast "Project" in dezelfde knop.
  await page.locator("[data-tour=\"menu-project\"]").first().click();
}

test("zonder rebuild-route (app) geen menu-item Register bouwen", async ({ page }) => {
  await page.route("**/admin/rebuild/status", (r) => r.fulfill({ status: 404, body: "" }));
  await openStudio(page);
  await openProjectMenu(page);
  await expect(page.getByText("Van server ophalen…").first()).toBeVisible();
  await page.waitForTimeout(300);
  await expect(page.getByText("Register bouwen…")).toHaveCount(0);
});

test("met rebuild-route (devloop) staat Register bouwen in het Project-menu, uit zolang het project niet op de server staat", async ({ page }) => {
  await page.route("**/admin/rebuild/status", (r) => r.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ status: "idle" }) }));
  await openStudio(page);
  // Het menu vraagt de route bij de eerste keer openen; daarna ververst het menu zich.
  await openProjectMenu(page);
  await page.keyboard.press("Escape");
  await openProjectMenu(page);
  const item = page.getByText("Register bouwen…").first();
  await expect(item).toBeVisible();
});
