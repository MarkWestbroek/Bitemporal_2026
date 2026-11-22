// Studio — de activiteiten Profielen en Transformaties als zicht op één project (Mark 22-11, plan
// Sidecar-project §9, stap 9 deel 2).
//  1. In een gewoon project zegt het zicht dat het geen profielen- en transformatieproject is.
//  2. Met het profielen- en transformatieproject open: Profielen toont alleen de map Profielen
//     (met de Profiel-elementen), Transformaties alleen de map Transformaties.
//  3. Transformaties → Proefdraaien… opent de regelset-lezer.
import { test, expect } from "@playwright/test";
import { openStudio } from "./helpers/studio.js";

test.use({ viewport: { width: 1700, height: 1000 } });

test("Profielen en Transformaties filteren de boom van één project", async ({ page }) => {
  test.setTimeout(120_000);
  await openStudio(page);
  const balk = (naam) => page.locator(`.studio-activitybar [title^='${naam}']`).first();
  const mapnamen = () => page.locator(".studio-project__mapnaam").allTextContents();

  // 1. Een gewoon project: de kop zegt het.
  await balk("Profielen").click();
  await expect(page.getByTestId("zicht-profielenZicht")).toBeVisible();
  await expect(page.getByTestId("zicht-geen-profielenproject")).toBeVisible();

  // Het profielen- en transformatieproject (ERD + de regelsets), als eigen project.
  const buffer = Buffer.from(
    await page.evaluate(async () => {
      const base = location.origin + "/viz/react/src/";
      const { getDiagramType } = await import(base + "diagramcore/types/typeRegistry.js");
      const { sidecarProject } = await import(base + "studio/sidecarProject.js");
      const { alleRegelsets } = await import(base + "transformatie/regelsetCatalogus.js");
      return JSON.stringify(sidecarProject({ descriptors: [getDiagramType("erd")], vermeldingen: alleRegelsets() }));
    }),
    "utf8"
  );
  await page.locator('[data-tour="menu-project"]').first().click();
  const chooser = page.waitForEvent("filechooser");
  await page.getByText("Importeer project…").first().click();
  await (await chooser).setFiles({ name: "sidecar.studio-project.json", mimeType: "application/json", buffer });
  await page.getByRole("button", { name: "Importeer", exact: true }).click();

  // 2. Profielen: alleen de map Profielen, met het Profiel ERD.
  await balk("Profielen").click();
  await expect(page.getByTestId("zicht-geen-profielenproject")).toHaveCount(0);
  await expect(page.locator('[data-boomsleutel="el:el::m3Profiel05::p_erd_profiel"]')).toBeVisible();
  expect(await mapnamen()).toEqual(["Profielen"]);

  // Transformaties: alleen de map Transformaties, geen Profiel.
  await balk("Transformaties").click();
  await expect(page.getByTestId("zicht-transformatiesZicht")).toBeVisible();
  await expect.poll(mapnamen).toEqual(["Transformaties"]);
  await expect(page.locator('[data-boomsleutel="el:el::m3Profiel05::p_erd_profiel"]')).toHaveCount(0);

  // Modelleren toont nog steeds alles.
  await balk("Modelleren").click();
  await expect.poll(async () => (await mapnamen()).sort()).toEqual(["Profielen", "Transformaties"]);

  // 3. Proefdraaien… opent de lezer.
  await balk("Transformaties").click();
  await page.getByTestId("zicht-transformatiesZicht").getByRole("button", { name: "Proefdraaien…" }).click();
  await expect(page.getByTestId("regelset-lijst")).toBeVisible();
});
