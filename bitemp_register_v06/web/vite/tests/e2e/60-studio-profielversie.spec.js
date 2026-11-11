// 60-studio-profielversie.spec.js — een project noteert de versie van zijn profielen (11-11).
//
// M1 leunt op M2: het werkbestand krijgt `profielVersies` (profiel-id → versie waarmee het is
// bewaard). Een project dat met een nieuwere profielversie is bewaard dan deze Studio heeft,
// geeft bij het openen een melding, en houdt bij het bewaren zijn nieuwere notitie.
// Zie src/diagramcore/types/profielVersie.js.
//
// Draaien: zie helpers/studio.js (eigen dev-server, API gemockt).
import fs from "node:fs";
import { test, expect } from "@playwright/test";
import { openStudio, zetModel, wachtOpNode } from "./helpers/studio.js";

test.beforeEach(async ({ page }) => {
  await openStudio(page);
});

async function exporteer(page) {
  await page.locator('[data-tour="menu-project"]').first().click();
  const download = page.waitForEvent("download");
  await page.getByText("Exporteer project (structuur + modellen)…").first().click();
  return JSON.parse(fs.readFileSync(await (await download).path(), "utf8"));
}

test("export noteert de profielversie; een nieuwere notitie geeft een melding en blijft staan", async ({ page }) => {
  await zetModel(page, {
    profielId: "diagram05",
    diagramId: "d1",
    diagramNaam: "Kern",
    elementen: [{ id: "Aanvraag", naam: "Aanvraag", type: "entiteit", pos: { x: 80, y: 450 } }],
  });
  await wachtOpNode(page, "Aanvraag");

  const uit = await exporteer(page);
  expect(uit.profielVersies).toEqual({ diagram05: "1.0.0" });

  // Hetzelfde project, maar bewaard met een nieuwere hoofdversie van het profiel.
  const nieuwer = { ...uit, profielVersies: { diagram05: "2.0.0" } };
  await page.locator('[data-tour="menu-project"]').first().click();
  const chooser = page.waitForEvent("filechooser");
  await page.getByText("Importeer project…").first().click();
  await (await chooser).setFiles({ name: "nieuwer.json", mimeType: "application/json", buffer: Buffer.from(JSON.stringify(nieuwer)) });
  await page.getByRole("button", { name: "Importeer", exact: true }).click();
  await expect(page.getByText("Nieuwere profielversie")).toBeVisible();
  await expect(page.getByText(/project 2\.0\.0, deze Studio 1\.0\.0/)).toBeVisible();
  await page.keyboard.press("Escape");

  // Hier bewaren maakt de inhoud niet ouder: de notitie blijft 2.0.0.
  const terug = await exporteer(page);
  expect(terug.profielVersies).toEqual({ diagram05: "2.0.0" });
});
