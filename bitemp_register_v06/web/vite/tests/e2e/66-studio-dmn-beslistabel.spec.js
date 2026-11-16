// Studio — de beslistabel van een DMN-beslissing leeft in het project (16-11).
//  1. Een beslissing zonder tabel: "＋ Maken…" opent de dialoog; Opslaan schrijft data.beslistabel.
//  2. Een kolom binden aan een veld van het canonieke projectmodel (bind… → kies het veld).
//  3. Annuleren laat het element ongemoeid.
import { test, expect } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { openStudio, zetModel, node } from "./helpers/studio.js";

const FIXTURE = path.resolve(path.dirname(fileURLToPath(import.meta.url)),
  "../../src/diagramprofielen/canoniek-uml/fixtures/cg-test/omnium-model-cg-test-v3.json");
const CG_TEST = JSON.parse(fs.readFileSync(FIXTURE, "utf8"));

test.use({ viewport: { width: 1700, height: 1000 } });

const tabel = (page) =>
  page.evaluate(async () => {
    const reg = await import(location.origin + "/viz/react/src/studio/profieltypeRegistry.js");
    return reg.getProfieltype("dmnDrd05").useStore.getState().elements.b1.data.beslistabel || null;
  });

async function opzet(page) {
  await openStudio(page);
  await zetModel(page, { profielId: "dmnDrd05", diagramId: "d_drd", diagramNaam: "Tarief", elementen: [
    { id: "b1", naam: "Bepaal tarief", type: "decision", pos: { x: 200, y: 300 } },
  ] });
  await node(page, "b1").click({ position: { x: 20, y: 10 } });
}

test("beslistabel maken, een regel invullen en opslaan in het project", async ({ page }) => {
  await opzet(page);
  await expect(page.getByTestId("beslistabel-samenvatting")).toHaveText("geen beslistabel");
  await page.getByTestId("beslistabel-bewerken").click();
  const dlg = page.getByTestId("beslistabel-dialoog");
  await expect(dlg).toContainText("Beslistabel — Bepaal tarief");
  await expect(page.getByTestId("beslistabel-opslaan")).toBeDisabled();
  await dlg.getByRole("button", { name: "+ regel" }).click();
  await dlg.locator("tbody tr").first().locator("input.dmn-cell-input").first().fill("> 18");
  expect(await tabel(page)).toBeNull(); // nog niets geschreven: bewerken gebeurt op een kopie
  await page.getByTestId("beslistabel-opslaan").click();
  await expect(dlg).toHaveCount(0);
  const t = await tabel(page);
  expect(t.naam).toBe("Bepaal tarief");
  expect(t.rules).toHaveLength(2);
  expect(Object.values(t.rules[0].inputEntries)).toEqual(["> 18"]);
  await expect(page.getByTestId("beslistabel-samenvatting")).toHaveText("1 in · 1 uit · 2 regels");
});

test("kolom binden aan een veld van het canonieke projectmodel", async ({ page }) => {
  await opzet(page);
  await page.evaluate(async (v3) => {
    const reg = await import(location.origin + "/viz/react/src/studio/profieltypeRegistry.js");
    const { importeerV3 } = await import(location.origin + "/viz/react/src/diagramprofielen/canoniek-uml/serialisatie.js");
    reg.getProfieltypen().find((p) => p?.descriptor?.id === "canoniek-uml").useStore.getState().laadModel(importeerV3(v3));
  }, CG_TEST);
  await page.getByTestId("beslistabel-bewerken").click();
  const dlg = page.getByTestId("beslistabel-dialoog");
  await dlg.locator("th.dmn-th-input").getByRole("button", { name: "bind…" }).click();
  await expect(dlg).toContainText("Kies een veld voor de invoerkolom");
  const model = dlg.locator(".studio-beslistabel__model");
  await model.getByPlaceholder(/Zoek veld/).fill("kaartnummer");
  await model.getByText("gpk_kaartgegevens").first().click(); // het GE openklappen
  await model.getByRole("button", { name: "kies" }).first().click();
  await expect(dlg.locator("th.dmn-th-input .dmn-th-veld")).toContainText("kaartnummer");
  await page.getByTestId("beslistabel-opslaan").click();
  const t = await tabel(page);
  expect(t.inputs[0].fieldRef.veldnaam).toBe("kaartnummer");
});

test("annuleren schrijft niets", async ({ page }) => {
  await opzet(page);
  await page.getByTestId("beslistabel-bewerken").click();
  const dlg = page.getByTestId("beslistabel-dialoog");
  await dlg.getByRole("button", { name: "+ input" }).click();
  await dlg.getByRole("button", { name: "Annuleren" }).click();
  await expect(dlg).toHaveCount(0);
  expect(await tabel(page)).toBeNull();
});
