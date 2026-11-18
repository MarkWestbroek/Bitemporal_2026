// 65-studio-metamodel-m3.spec.js — de metamodellen openen in de Studio (plan 2026-11-15, stap 2+3).
//
// docs/metamodel/*.studio-project.json (gegenereerd door `npm run metamodellen`: het M3 en het
// projectmetamodel) laten zich importeren als project; elk pakket staat in de boom en elk
// pakket-diagram toont al zijn voorkomens.
//
// Draaien: zie helpers/studio.js (eigen dev-server, API gemockt). SCHERM=<map> bewaart per diagram
// een schermafbeelding (om de layout te bekijken).
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { test, expect } from "@playwright/test";
import { openStudio } from "./helpers/studio.js";

const MAP = fileURLToPath(new URL("../../../../docs/metamodel/", import.meta.url));
const GEVALLEN = [
  { bestand: "omnium-m3.studio-project.json", pakketten: ["Definitie", "Stijl", "Implementatie"], klasse: { Definitie: "DiagramType", Stijl: "ShapeType", Implementatie: "ShapeRenderer" } },
  { bestand: "omnium-projectmetamodel.studio-project.json", pakketten: ["Werkbestand", "Model", "Werkruimte"], klasse: { Werkbestand: "Structuur", Model: "DiagramNode", Werkruimte: "Viewport" } },
];

for (const g of GEVALLEN) {
  test(`${g.bestand} importeren en de pakket-diagrammen openen`, async ({ page }) => {
    test.setTimeout(120_000);
    const buffer = fs.readFileSync(path.join(MAP, g.bestand));
    const diagrammen = Object.values(JSON.parse(buffer.toString("utf8")).profielen.puurUml05.diagrams);
    await openStudio(page);

    await page.locator('[data-tour="menu-project"]').first().click();
    const chooser = page.waitForEvent("filechooser");
    await page.getByText("Importeer project…").first().click();
    await (await chooser).setFiles({ name: g.bestand, mimeType: "application/json", buffer });
    await page.getByRole("button", { name: "Importeer", exact: true }).click();

    for (const naam of g.pakketten) await expect(page.getByText(naam, { exact: true }).first()).toBeVisible();

    for (const d of diagrammen) {
      await page.evaluate(async ({ diagramId }) => {
        const { menuBus } = await import(location.origin + "/viz/react/src/studio/menuBus.js");
        menuBus.emit("studio:open-diagram", { profielId: "puurUml05", diagramId });
      }, { diagramId: d.id });
      await expect(page.locator(".react-flow:visible .react-flow__node")).toHaveCount(d.nodes.length, { timeout: 20_000 });
      await expect(page.locator(".react-flow:visible").getByText(g.klasse[d.naam], { exact: true }).first()).toBeVisible();
      if (process.env.SCHERM) {
        await page.locator(".react-flow:visible .react-flow__controls-fitview").first().click().catch(() => {});
        await page.waitForTimeout(400);
        await page.screenshot({ path: path.join(process.env.SCHERM, `studio-${d.id}.png`) });
      }
    }
  });
}
