// Studio — exportstap "Inrichtingsartefacten" in het transformatiepaneel (stap a+b, 30-10):
// e-dienst + V3-model + referentielijsten kiezen → zip met de artefacten, en met
// "vergelijk" per artefact nieuw/gewijzigd/ongewijzigd uit het (nagebootste) register.
import { test, expect } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { openStudio, zetModel, inModelleren } from "./helpers/studio.js";

const FIX = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../src/diagramprofielen/canoniek-uml/fixtures/cg-test");
const fix = (naam) => path.join(FIX, naam);
const REGISTER = "https://omnium.fundament.common-ground-lab.nl";
const GPK = JSON.parse(fs.readFileSync(fix("gpk-edienst.json"), "utf8"));

test.use({ viewport: { width: 1440, height: 900 } });

async function openPaneel(page) {
  await openStudio(page);
  await zetModel(page, { profielId: "usecase05", diagramId: "d_inr", diagramNaam: "Inrichting", elementen: [
    { id: "u1", naam: "Aanvragen", type: "usecase", pos: { x: 300, y: 300 } },
  ] });
  const mapId = await inModelleren(page, `
    const s = ms.getState();
    const m = s.nieuweMap("GPK");
    s.plaatsMeerdere(["usecase05::d_inr"], m);
    return m;`);
  await page.evaluate(async (id) => {
    const { useTransformStore } = await import(location.origin + "/viz/react/src/studio/activities/TransformatiePaneel.jsx");
    useTransformStore.getState().openen(id, "export");
  }, mapId);
  await page.getByText("Inrichtingsartefacten (e-dienst → register op Fundament)").click();
}

async function kies(page, optie, bestanden) {
  const chooser = page.waitForEvent("filechooser");
  await page.locator(`[data-optie="${optie}"] button`).first().click();
  await (await chooser).setFiles(bestanden);
}

test("zip met alle artefacten van de GPK-e-dienst", async ({ page }) => {
  await openPaneel(page);
  const uitvoeren = page.getByRole("button", { name: "Uitvoeren" });
  await expect(uitvoeren).toBeDisabled(); // e-dienst is verplicht
  await kies(page, "edienst", fix("gpk-edienst.json"));
  await kies(page, "model", fix("omnium-model-cg-test-v3.json"));
  await kies(page, "referentielijsten", [fix("aanvraag-aanvraagtypen.json"), fix("relatiebeheer-partijrollen.json")]);
  await expect(page.locator('[data-optie="referentielijsten"]')).toContainText("relatiebeheer-partijrollen.json");

  const download = page.waitForEvent("download");
  await uitvoeren.click();
  expect((await download).suggestedFilename()).toBe(`inrichting-gehandicaptenparkeerkaart-aanvragen-${GPK.edienst.versienummer}.zip`);
  const n = GPK.artefacten.length;
  await expect(page.getByText(`${n} van ${n} artefacten gemaakt`)).toBeVisible();
  await expect(page.locator("table[data-rapport] tbody tr")).toHaveCount(n);
  await expect(page.locator("table[data-rapport]")).toContainText("niet vergeleken");
});

test("vergelijken met het register: ongewijzigd, gewijzigd, nieuw", async ({ page }) => {
  // Eerst de echte hashes ophalen via een run zonder register, dan het register nabootsen.
  await openPaneel(page);
  await kies(page, "edienst", fix("gpk-edienst.json"));
  await kies(page, "model", fix("omnium-model-cg-test-v3.json"));
  await kies(page, "referentielijsten", [fix("aanvraag-aanvraagtypen.json"), fix("relatiebeheer-partijrollen.json")]);
  const eerste = page.waitForEvent("download");
  await page.getByRole("button", { name: "Uitvoeren" }).click();
  const zip = fs.readFileSync(await (await eerste).path(), "latin1");
  const hashObjecttype = /"payloadHash": "([0-9a-f]{64})"/.exec(zip)[1]; // eerste bestand = het objecttype

  const vk = (data, extra = {}) => [{ rel_id: 1, data: [{ versie: 1, ...data }], ...extra }];
  const full = {
    "full/artefactsoorten": { items: [{ id: 202, artefactsoort_gegevens: vk({ code: "objecttype" }) }, { id: 201, artefactsoort_gegevens: vk({ code: "zaaktype" }) }] },
    "full/ediensten": { items: [{ id: 2, edienst_namen: vk({ naam: GPK.edienst.naam }) }] },
    "full/edienstversies": { items: [{ id: 3, edienstversie_nummers: vk({ versienummer: GPK.edienst.versienummer }), edienstversie_ediensten: vk({}, { edienst_id: 2 }) }] },
    "full/artefacten": { items: [
      { id: 1, artefact_identificaties: vk({ soort: 202, identifier: "gehandicaptenparkeerkaartaanvraag" }), artefact_inhouden: vk({ payloadHash: hashObjecttype }), artefact_edienstversies: vk({}, { edienstversie_id: 3 }) },
      { id: 2, artefact_identificaties: vk({ soort: 201, identifier: "GPK" }), artefact_inhouden: vk({ payloadHash: "0".repeat(64) }), artefact_edienstversies: vk({}, { edienstversie_id: 3 }) },
    ] },
  };
  let auth = null;
  await page.route(`${REGISTER}/full/**`, (route) => {
    const url = new URL(route.request().url());
    auth = route.request().headers().authorization || auth;
    const body = full[url.pathname.slice(1)] || { items: [] };
    route.fulfill({ status: 200, contentType: "application/json", headers: { "access-control-allow-origin": "*" }, body: JSON.stringify(body) });
  });
  await page.getByText("vergelijk met het inrichting-register").click();
  await page.locator('input[type="password"]').fill("geheim-token");
  const tweede = page.waitForEvent("download");
  await page.getByRole("button", { name: "Uitvoeren" }).click();
  await tweede;
  const rijen = page.locator("table[data-rapport] tbody tr");
  const status = (id) => rijen.filter({ has: page.locator("td", { hasText: new RegExp(`^${id}$`) }) }).locator("td").last();
  await expect(status("gehandicaptenparkeerkaartaanvraag")).toHaveText("ongewijzigd");
  await expect(status("GPK")).toHaveText("gewijzigd");
  await expect(status("gehandicaptenparkeerkaart-aanvragen")).toHaveText("nieuw");
  expect(auth).toBe("Bearer geheim-token");
});

// Het model uit de map werkt, maar geeft nog niet dezelfde payloads: de omzetting
// V3 ↔ canoniek profiel verliest verplicht/uniek/type van velden (BACKLOG, 30-10).
// Zodra dat is opgelost: de fixme weg, dan bewaakt deze test de gelijkheid.
test("zonder V3-bestand: het canonieke model uit de map geeft een waarschuwing", async ({ page }) => {
  await openPaneel(page);
  // Het cg-test-model in het canonieke profiel laden en in de map zetten.
  const v3 = JSON.parse(fs.readFileSync(fix("omnium-model-cg-test-v3.json"), "utf8"));
  await page.evaluate(async (v3) => {
    const { importeerV3 } = await import(location.origin + "/viz/react/src/diagramprofielen/canoniek-uml/serialisatie.js");
    const { getProfieltype } = await import(location.origin + "/viz/react/src/studio/profieltypeRegistry.js");
    const { useModellerenStore: ms } = await import(location.origin + "/viz/react/src/studio/activities/modellerenActivity.jsx");
    const { useTransformStore } = await import(location.origin + "/viz/react/src/studio/activities/TransformatiePaneel.jsx");
    const st = getProfieltype("diagram05").useStore;
    st.getState().laadModel(importeerV3(v3));
    const s = st.getState();
    const map = ms.getState().nieuweMap("Canoniek");
    ms.getState().plaatsMeerdere([
      ...Object.keys(s.diagrams).map((d) => `diagram05::${d}`),
      ...Object.values(s.elements).filter((e) => !e.source).map((e) => `el::diagram05::${e.id}`),
    ], map);
    useTransformStore.getState().sluiten();
    useTransformStore.getState().openen(map, "export");
  }, v3);
  await page.getByText("Inrichtingsartefacten (e-dienst → register op Fundament)").click();
  await kies(page, "edienst", fix("gpk-edienst.json"));
  await kies(page, "referentielijsten", [fix("aanvraag-aanvraagtypen.json"), fix("relatiebeheer-partijrollen.json")]);
  const uitMap = page.waitForEvent("download");
  await page.getByRole("button", { name: "Uitvoeren" }).click();
  await uitMap;
  const n = GPK.artefacten.length;
  await expect(page.getByText(`${n} van ${n} artefacten gemaakt`)).toBeVisible();
  await expect(page.getByText("INR-MODEL-UIT-MAP").first()).toBeAttached(); // in de dichtgeklapte meldingen
});

test.fixme("zonder V3-bestand: zelfde payloads als uit het bestand", async ({ page }) => {
  await openPaneel(page);
  const v3 = JSON.parse(fs.readFileSync(fix("omnium-model-cg-test-v3.json"), "utf8"));
  await page.evaluate(async (v3) => {
    const { importeerV3 } = await import(location.origin + "/viz/react/src/diagramprofielen/canoniek-uml/serialisatie.js");
    const { getProfieltype } = await import(location.origin + "/viz/react/src/studio/profieltypeRegistry.js");
    const { useModellerenStore: ms } = await import(location.origin + "/viz/react/src/studio/activities/modellerenActivity.jsx");
    const { useTransformStore } = await import(location.origin + "/viz/react/src/studio/activities/TransformatiePaneel.jsx");
    const st = getProfieltype("diagram05").useStore;
    st.getState().laadModel(importeerV3(v3));
    const s = st.getState();
    const map = ms.getState().nieuweMap("Canoniek");
    ms.getState().plaatsMeerdere([
      ...Object.keys(s.diagrams).map((d) => `diagram05::${d}`),
      ...Object.values(s.elements).filter((e) => !e.source).map((e) => `el::diagram05::${e.id}`),
    ], map);
    useTransformStore.getState().sluiten();
    useTransformStore.getState().openen(map, "export");
  }, v3);
  await page.getByText("Inrichtingsartefacten (e-dienst → register op Fundament)").click();
  await kies(page, "edienst", fix("gpk-edienst.json"));
  await kies(page, "referentielijsten", [fix("aanvraag-aanvraagtypen.json"), fix("relatiebeheer-partijrollen.json")]);
  const n = GPK.artefacten.length;
  const uitMap = page.waitForEvent("download");
  await page.getByRole("button", { name: "Uitvoeren" }).click();
  await uitMap;
  const hashes = async () => page.locator("table[data-rapport] tbody tr td:nth-child(3)").allTextContents();
  const vanMap = await hashes();

  await kies(page, "model", fix("omnium-model-cg-test-v3.json"));
  const uitBestand = page.waitForEvent("download");
  await page.getByRole("button", { name: "Uitvoeren" }).click();
  await uitBestand;
  await expect(page.getByText(`${n} van ${n} artefacten gemaakt`)).toBeVisible();
  expect(vanMap).toEqual(await hashes());
});
