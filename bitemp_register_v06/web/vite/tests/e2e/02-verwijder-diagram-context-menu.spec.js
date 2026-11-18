// Smoke test 2: rechtsklik op diagram in Project Browser → "Verwijder diagram" zichtbaar → Annuleren.
//
// Deze test verifieert de net toegevoegde context-menu actie uit BACKLOG-sectie 0.9
// (B6 + 0.7).
import { test, expect } from "@playwright/test";
import { injectMinimaalModel } from "./helpers/model.js";

test("rechtsklik op diagram toont 'Verwijder diagram' en annuleren laat diagram staan", async ({ page }) => {
  await page.goto("/viz/react/ide/");
  // /viz/react/ is de Vite base; /ide/ is de React Router route
  await injectMinimaalModel(page, { diagramNaam: "Smoke Diagram XYZ" });

  // Na injectie: wacht tot react-arborist de tree heeft gerenderd.
  // De diagram-node zit onder "Diagrammen" folder in het domein "test_dom".
  // Strategie: 1) wacht tot we "Diagrammen" zien, 2) expand het via click, 3) vind diagram-node
  
  // Wacht tot Project Browser iets toont (root-element)
  await page.waitForSelector('[role="treeitem"], [class*="Tree"], [class*="tree"]', { timeout: 10_000 }).catch(() => null);

  // Screenshot om te zien wat er is
  await page.screenshot({ path: "playwright-report/02-after-inject.png" });

  // Het diagram staat in de boom onder het domein "test_dom" (map Diagrammen). Klap open wat
  // dicht staat: eerst het domein, dan zo nodig de map.
  const zichtbaar = () => page.getByText("Smoke Diagram XYZ", { exact: true }).isVisible().catch(() => false);
  for (const naam of ["test_dom", "Diagrammen"]) {
    if (await zichtbaar()) break;
    const rij = page.getByRole("treeitem").filter({ hasText: naam }).first();
    const doel = (await rij.count()) ? rij : page.getByText(naam, { exact: true }).first();
    if (await doel.isVisible().catch(() => false)) {
      // Klikken selecteert alleen; pijl-rechts klapt de geselecteerde rij open.
      await doel.click();
      await page.keyboard.press("ArrowRight");
      await page.waitForTimeout(300);
    }
  }
  await page.screenshot({ path: "playwright-report/02-expanded.png" });

  // Nu proberen we "Smoke Diagram XYZ" te vinden en rechtsklikken
  const diagramNode = page.locator("text=/Smoke Diagram XYZ|smoke/i").first();
  
  // Wacht tot het zichtbaar is (tot 5 seconden)
  try {
    await diagramNode.waitFor({ timeout: 5_000 });
  } catch (e) {
    // Fallback: screenshot en error
    await page.screenshot({ path: "playwright-report/02-notfound.png" });
    throw new Error("Diagram node 'Smoke Diagram XYZ' niet gevonden in tree. Zie 02-notfound.png en 02-after-inject.png");
  }

  // Rechtsklik
  await diagramNode.click({ button: "right" });
  await page.waitForTimeout(200);

  // Het context-menu verschijnt; check op "Verwijder diagram…"
  const verwijderItem = page.locator("text=/Verwijder diagram/i");
  await expect(verwijderItem).toBeVisible({ timeout: 3_000 });

  // We dismissen een eventuele confirm-dialog door 'm te annuleren
  page.on("dialog", (dialog) => dialog.dismiss());
  
  // Sluit menu door op body te klikken
  await page.mouse.click(10, 10);
  await page.waitForTimeout(200);

  // Diagram moet er nog zijn
  await expect(diagramNode).toBeVisible();

  await page.screenshot({ path: "playwright-report/02-success.png" });
});
