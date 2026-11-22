// Studio — de taal van het Profiel-ontwerp is het M3 (Mark 19-11, ontwerptaal.js).
//  1. Een bestaand profiel (ERD) als ontwerp laden: de knopen dragen de M3-namen (m3:kleur, …),
//     de eigenschappen van het profiel staan op het diagram.
//  2. De inspector toont de M3-eigenschappen, met een JSON-invoer voor samengestelde waarden.
//  3. Een M3-waarde wijzigen en het profiel activeren: de wijziging zit in het geregistreerde profiel.
import { test, expect } from "@playwright/test";
import { openStudio, kiesActiviteit } from "./helpers/studio.js";

test.use({ viewport: { width: 1700, height: 1000 } });

async function menu(page, label) {
  await page.locator(".studio-menubar").getByText("Ontwerp", { exact: true }).click();
  await page.getByRole("menuitem", { name: label, exact: true }).click();
}

async function dialoog(page, waarde) {
  const d = page.locator(".studio-dialoog");
  await expect(d).toBeVisible();
  if (waarde !== undefined) await d.locator("input").first().fill(waarde);
  await d.locator("button").last().click();
}

test("een profiel als ontwerp in de M3-taal: laden, bekijken, wijzigen en activeren", async ({ page }) => {
  await openStudio(page);
  // Activeren schrijft in de dev-server een bestand naar web/vite/profielen/ (en dat herlaadt de
  // pagina); in deze test niet.
  await page.route("**/__studio05/profielen/**", (r) => (r.request().method() === "PUT" ? r.fulfill({ status: 200, json: {} }) : r.continue()));
  await kiesActiviteit(page, "profielOntwerp05");
  await page.waitForFunction(() => !!window.__profielOntwerpStore);
  await menu(page, "Bekijk bestaand profiel als ontwerp…");
  await dialoog(page, "erd");

  const stand = await page.evaluate(() => {
    const st = window.__profielOntwerpStore.getState();
    const diagram = st.diagrams[st.actiefDiagramId];
    const opDiagram = new Set(diagram.nodes.map((n) => n.elementId));
    const entiteit = Object.values(st.elements).find((e) => e.elementType === "elementDef" && e.naam === "Entiteit" && opDiagram.has(e.id));
    return { id: entiteit.id, data: entiteit.data, m3Profiel: diagram.m3Profiel };
  });
  expect(stand.data).toMatchObject({ "m3:id": "entiteit", "m3:kleur": "#fef9c3", "m3:kort": "ENT", "m3:aard": "gegevens" });
  expect(stand.data.doelKleur).toBeUndefined();
  expect(stand.m3Profiel["m3:versie"]).toMatch(/^\d+\.\d+\.\d+$/);

  // De inspector: de M3-eigenschappen, met hun type; samengestelde waarden als JSON.
  await page.locator(`.react-flow__node[data-id="${stand.id}"]`).click();
  await expect(page.locator(".dc-veldlabel", { hasText: "kleur (string)" })).toBeVisible();
  await expect(page.getByTestId("m3-json-m3:edgePresentatie")).toHaveCount(1);

  // Een M3-waarde wijzigen en activeren: het geregistreerde profiel heeft hem.
  await page.evaluate((id) => {
    const store = window.__profielOntwerpStore;
    store.getState().updateElement(id, { data: { "m3:kort": "TAB", "m3:minBreedte": 220 } });
  }, stand.id);
  await menu(page, "Activeer profiel… (registreer/ververs)");
  await dialoog(page, "erd-m3-proef");
  await dialoog(page, "ERD (M3-proef)");
  await dialoog(page, "");
  const geregistreerd = await page.evaluate(async () => {
    const { getDiagramType } = await import(location.origin + "/viz/react/src/diagramcore/types/typeRegistry.js");
    const dt = getDiagramType("erd-m3-proef");
    const et = dt?.elementTypes.find((e) => e.id === "entiteit");
    return et && { kort: et.kort, minBreedte: et.minBreedte, kleur: et.kleur, compartments: et.compartments.map((c) => c.id) };
  });
  expect(geregistreerd).toEqual({ kort: "TAB", minBreedte: 220, kleur: "#fef9c3", compartments: ["sleutel", "kolommen"] });
});
