// Studio — Modelleren → Bestand → "Importeer V3 in project (alleen wijzigingen)…" (31-10):
// het canonieke model staat al in het project (met een eigen diagram); een V3-bestand met één
// nieuwe GE en één gewijzigd veld komt als delta binnen, na een review. Het eigen diagram blijft.
import { test, expect } from "@playwright/test";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { openStudio } from "./helpers/studio.js";

const FIXTURE = path.resolve(path.dirname(fileURLToPath(import.meta.url)),
  "../../src/diagramprofielen/canoniek-uml/fixtures/cg-test/omnium-model-cg-test-v3.json");
const CG_TEST = JSON.parse(fs.readFileSync(FIXTURE, "utf8"));

test.use({ viewport: { width: 1440, height: 900 } });

test("delta-import: review, nieuwe GE erbij, eigen diagram blijft", async ({ page }) => {
  await openStudio(page);
  await page.evaluate(async (v3) => {
    const base = location.origin + "/viz/react/";
    const reg = await import(base + "src/studio/profieltypeRegistry.js");
    const { importeerV3 } = await import(base + "src/diagramprofielen/canoniek-uml/serialisatie.js");
    let p = null;
    for (let i = 0; i < 150 && !p; i++) {
      p = reg.getProfieltypen().find((x) => x?.descriptor?.id === "canoniek-uml");
      if (!p) await new Promise((r) => setTimeout(r, 100));
    }
    const s = p.useStore.getState();
    s.laadModel(importeerV3(v3));
    s.addDiagram({ id: "eigen", naam: "Mijn GPK-view", diagramType: "canoniek-uml" });
    s.addElementToDiagram("eigen", "Gehandicaptenparkeerkaart", { x: 40, y: 40 });
    window.__canoniek = p.useStore;
  }, CG_TEST);

  // Het bestand: één nieuwe GE en één gewijzigde beschrijving.
  const v3 = JSON.parse(JSON.stringify(CG_TEST));
  const gpk = v3.model.entiteiten.find((e) => e.typenaam === "Gehandicaptenparkeerkaart");
  gpk.gegevenselementen.push({ naam: "GpkOpmerking", meervoud: "gpk_opmerkingen", momentvoorkomen: "enkelvoudig", velden: [{ naam: "tekst", type: "string" }] });
  gpk.gegevenselementen[0].velden[0].description = "nieuw uitgelegd";
  const bestand = path.join(fs.mkdtempSync(path.join(os.tmpdir(), "v3delta-")), "cg-test-gewijzigd.json");
  fs.writeFileSync(bestand, JSON.stringify(v3));

  await page.evaluate(async () => {
    const { importeerV3InProject } = await import(location.origin + "/viz/react/src/studio/activities/v3ImportProject.js");
    window.__import = importeerV3InProject();
  });
  const chooser = page.waitForEvent("filechooser");
  await page.getByRole("button", { name: "Verder" }).click();
  await (await chooser).setFiles(bestand);

  const review = page.getByText("V3-import — wat gaat mee?");
  await expect(review).toBeVisible();
  await expect(page.getByText("gegevenselement GpkOpmerking")).toBeVisible();
  await page.getByRole("button", { name: "Importeer" }).click();
  await expect(page.getByText("V3-model geïmporteerd")).toBeVisible();

  const stand = await page.evaluate(() => {
    const s = window.__canoniek.getState();
    return {
      nieuweGe: !!s.elements.Gehandicaptenparkeerkaart_GpkOpmerking,
      eigen: s.diagrams.eigen?.naam,
      eigenNodes: (s.diagrams.eigen?.nodes || []).length,
    };
  });
  expect(stand).toEqual({ nieuweGe: true, eigen: "Mijn GPK-view", eigenNodes: 1 });
});
