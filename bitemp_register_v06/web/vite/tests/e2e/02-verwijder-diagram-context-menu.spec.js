// Smoke test 2: rechtsklik op diagram in Project Browser → "Verwijder diagram" zichtbaar → Annuleren.
//
// Deze test verifieert de net toegevoegde context-menu actie uit BACKLOG-sectie 0.9
// (B6 + 0.7).
import { test, expect } from "@playwright/test";
import { injectMinimaalModel } from "./helpers/model.js";

test("rechtsklik op diagram toont 'Verwijder diagram' en annuleren laat diagram staan", async ({ page }) => {
  await page.goto("/ide/");
  await injectMinimaalModel(page, { diagramNaam: "Smoke Diagram XYZ" });

  // De diagram-node in de tree heeft de naam die we injecteerden. React-arborist
  // rendert de node-tekst gewoon als <span>-tekst.
  const diagramNode = page.getByText("Smoke Diagram XYZ", { exact: true }).first();
  await expect(diagramNode).toBeVisible({ timeout: 10_000 });

  // Vouw eventueel parent-folders open: probeer de "Diagrammen"-folder open te klikken
  // als de diagram-node niet direct zichtbaar is. (Hier laten we het bij first-attempt;
  // bij failures kun je de assert hierboven gebruiken om te zien of expand nodig was.)

  // Rechtsklik
  await diagramNode.click({ button: "right" });

  // Het context-menu verschijnt; check op "Verwijder diagram…"
  const verwijderItem = page.getByText("Verwijder diagram", { exact: false });
  await expect(verwijderItem).toBeVisible({ timeout: 3_000 });

  // We dismissen een eventuele confirm-dialog door 'm te annuleren — voor het geval
  // we per ongeluk klikken. Hier sluiten we het menu door op de body te klikken.
  page.on("dialog", (dialog) => dialog.dismiss());
  await page.mouse.click(10, 10);

  // Diagram moet er nog zijn
  await expect(page.getByText("Smoke Diagram XYZ", { exact: true }).first()).toBeVisible();

  await page.screenshot({ path: "playwright-report/smoke-context-menu.png" });
});
