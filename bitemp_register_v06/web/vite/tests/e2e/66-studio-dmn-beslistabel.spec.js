// Studio — de beslistabel van een DMN-beslissing leeft in het project (16-11).
//  1. De invoerkolommen volgen uit de pijlen van het DRD: invoergegevens en vereiste beslissingen.
//  2. Het veld staat op het invoergegeven (eigenschap "gegeven"); de kolom neemt het over.
//  3. Uitvoer binden aan een veld van het canonieke projectmodel (bind… → kies het veld).
//  4. Annuleren laat het element ongemoeid.
import { test, expect } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { openStudio, zetModel, node } from "./helpers/studio.js";

const FIXTURE = path.resolve(path.dirname(fileURLToPath(import.meta.url)),
  "../../src/diagramprofielen/canoniek-uml/fixtures/cg-test/omnium-model-cg-test-v3.json");
const CG_TEST = JSON.parse(fs.readFileSync(FIXTURE, "utf8"));

test.use({ viewport: { width: 1700, height: 1000 } });

const element = (page, id) =>
  page.evaluate(async (id) => {
    const reg = await import(location.origin + "/viz/react/src/studio/profieltypeRegistry.js");
    return reg.getProfieltype("dmnDrd05").useStore.getState().elements[id];
  }, id);
const tabel = async (page, id) => (await element(page, id)).data.beslistabel || null;

/** Marks voorbeeld: Top ← Onderliggend ← (naam, geboortedatum); Top ← inkomen. */
async function opzet(page) {
  await openStudio(page);
  await zetModel(page, { profielId: "dmnDrd05", diagramId: "d_drd", diagramNaam: "Tarief", elementen: [
    { id: "top", naam: "Top", type: "decision", pos: { x: 500, y: 250 } },
    { id: "onder", naam: "Onderliggend", type: "decision", pos: { x: 300, y: 450 } },
    { id: "a", naam: "naam", type: "inputData", pos: { x: 150, y: 650 } },
    { id: "b", naam: "geboortedatum", type: "inputData", pos: { x: 450, y: 650 } },
    { id: "c", naam: "inkomen", type: "inputData", pos: { x: 750, y: 450 } },
    { id: "p1", type: "infoReq", source: "a", target: "onder" },
    { id: "p2", type: "infoReq", source: "b", target: "onder" },
    { id: "p3", type: "infoReq", source: "onder", target: "top" },
    { id: "p4", type: "infoReq", source: "c", target: "top" },
  ] });
}

async function laadCanoniek(page) {
  await page.evaluate(async (v3) => {
    const reg = await import(location.origin + "/viz/react/src/studio/profieltypeRegistry.js");
    const { importeerV3 } = await import(location.origin + "/viz/react/src/diagramprofielen/canoniek-uml/serialisatie.js");
    reg.getProfieltypen().find((p) => p?.descriptor?.id === "canoniek-uml").useStore.getState().laadModel(importeerV3(v3));
  }, CG_TEST);
}

const kies = (page, id) => node(page, id).click({ position: { x: 20, y: 10 } });

test("invoerkolommen volgen uit de pijlen: invoergegevens en het resultaat van een beslissing", async ({ page }) => {
  await opzet(page);
  await kies(page, "onder");
  await expect(page.getByTestId("beslistabel-samenvatting")).toHaveText("geen beslistabel");
  await page.getByTestId("beslistabel-bewerken").click();
  const dlg = page.getByTestId("beslistabel-dialoog");
  await expect(dlg).toContainText("Beslistabel — Onderliggend");
  await expect(dlg.getByTestId("dmn-kolom-invoer")).toHaveCount(2);
  await expect(dlg.getByTestId("dmn-kolom-invoer").first()).toContainText("geboortedatum");
  await expect(dlg.getByRole("button", { name: "+ input" })).toHaveCount(0);
  // De uitvoer als tussenresultaat (ad-hoc), een regel invullen en opslaan.
  await dlg.getByRole("button", { name: "ad-hoc" }).click();
  await dlg.locator("tbody tr").first().locator("input.dmn-cell-input").first().fill("< 2000");
  expect(await tabel(page, "onder")).toBeNull(); // nog niets geschreven: bewerken gebeurt op een kopie
  await page.getByTestId("beslistabel-opslaan").click();
  await expect(dlg).toHaveCount(0);
  const t = await tabel(page, "onder");
  expect(t.naam).toBe("Onderliggend");
  expect(t.inputs.map((c) => [c.naam, c.bron.soort, c.bron.elementId])).toEqual([["geboortedatum", "invoer", "b"], ["naam", "invoer", "a"]]);
  expect(Object.values(t.rules[0].inputEntries)).toContain("< 2000");
  await expect(page.getByTestId("beslistabel-samenvatting")).toHaveText("2 in · 1 uit · 1 regel");

  // Top: het invoergegeven inkomen en het resultaat van Onderliggend.
  await kies(page, "top");
  await page.getByTestId("beslistabel-bewerken").click();
  await expect(dlg.getByTestId("dmn-kolom-invoer")).toContainText("inkomen");
  await expect(dlg.getByTestId("dmn-kolom-beslissing")).toContainText("Onderliggend");
  await expect(dlg.getByTestId("dmn-kolom-beslissing")).toContainText("resultaat van de beslissing");
  // De invoer uit het diagram is al een wijziging: zo op te slaan.
  await page.getByTestId("beslistabel-opslaan").click();
  expect((await tabel(page, "top")).inputs.map((c) => c.bron.soort)).toEqual(["invoer", "beslissing"]);
});

test("het veld staat op het invoergegeven; de kolom neemt het over", async ({ page }) => {
  await opzet(page);
  await laadCanoniek(page);
  await kies(page, "a");
  const veld = page.getByTestId("veld-verwijzing-gegeven");
  await veld.locator("select").nth(0).selectOption("diagram05");
  const ge = await veld.locator("select").nth(1).locator("option").evaluateAll((os) => os.find((o) => /kaartgegevens/i.test(o.textContent))?.value);
  await veld.locator("select").nth(1).selectOption(ge);
  await expect(veld.locator("select").nth(2).locator("option", { hasText: /^kaartnummer/ })).toHaveCount(1);
  const kaartnummer = await veld.locator("select").nth(2).locator("option").evaluateAll((os) => os.find((o) => /^kaartnummer/.test(o.textContent))?.value);
  await veld.locator("select").nth(2).selectOption(kaartnummer);
  await expect.poll(async () => (await element(page, "a")).data.gegeven).toMatchObject({ profielId: "diagram05", elementId: ge, veldNaam: "kaartnummer" });

  await kies(page, "onder");
  await page.getByTestId("beslistabel-bewerken").click();
  const dlg = page.getByTestId("beslistabel-dialoog");
  await expect(dlg.getByTestId("dmn-kolom-invoer").nth(1)).toContainText("kaartnummer");
  await expect(dlg).toContainText('Invoergegeven "geboortedatum" wijst nog niet naar een veld');
  await page.getByTestId("beslistabel-opslaan").click();
  const t = await tabel(page, "onder");
  expect(t.inputs[1].naam).toBe("naam");
  expect(t.inputs[1].fieldRef.veldnaam).toBe("kaartnummer");
});

test("uitvoer binden aan een veld van het canonieke projectmodel", async ({ page }) => {
  await opzet(page);
  await laadCanoniek(page);
  await kies(page, "onder");
  await page.getByTestId("beslistabel-bewerken").click();
  const dlg = page.getByTestId("beslistabel-dialoog");
  await dlg.locator("th.dmn-th-output").getByRole("button", { name: "bind…" }).click();
  await expect(dlg).toContainText("Kies een veld voor de uitvoerkolom");
  const model = dlg.locator(".studio-beslistabel__model");
  await model.getByPlaceholder(/Zoek veld/).fill("kaartnummer");
  await model.getByText("gpk_kaartgegevens").first().click(); // het GE openklappen
  await model.getByRole("button", { name: "kies" }).first().click();
  await expect(dlg.locator("th.dmn-th-output .dmn-th-veld")).toContainText("kaartnummer");
  await page.getByTestId("beslistabel-opslaan").click();
  expect((await tabel(page, "onder")).outputs[0].fieldRef.veldnaam).toBe("kaartnummer");
});

test("annuleren schrijft niets", async ({ page }) => {
  await opzet(page);
  await kies(page, "onder");
  await page.getByTestId("beslistabel-bewerken").click();
  const dlg = page.getByTestId("beslistabel-dialoog");
  await dlg.getByRole("button", { name: "+ regel" }).click();
  await dlg.getByRole("button", { name: "Annuleren" }).click();
  await expect(dlg).toHaveCount(0);
  expect(await tabel(page, "onder")).toBeNull();
});

test("een oude tabel wissen en opnieuw beginnen met de invoer uit het diagram", async ({ page }) => {
  await opzet(page);
  // Een oude tabel op Top: één kolom van vóór de DRD-regel en vier regels.
  await page.evaluate(async () => {
    const reg = await import(location.origin + "/viz/react/src/studio/profieltypeRegistry.js");
    const s = reg.getProfieltype("dmnDrd05").useStore.getState();
    const outputEntries = (w) => ({ o1: w });
    s.updateElementen({ top: { data: { beslistabel: { naam: "Top", hitPolicy: "UNIQUE", inputs: [{ id: "in_oud", naam: "oud", fieldRef: { veldpad: "X.oud" } }], outputs: [{ id: "o1", naam: "uit", adhoc: true }],
      rules: ["naam", "langenaam", "beide", "geen"].map((w, i) => ({ id: `r${i}`, inputEntries: { in_oud: "" }, outputEntries: outputEntries(w) })) } } } });
  });
  await kies(page, "top");
  await expect(page.getByTestId("beslistabel-samenvatting")).toHaveText("1 in · 1 uit · 4 regels");
  await page.getByTestId("beslistabel-bewerken").click();
  const dlg = page.getByTestId("beslistabel-dialoog");
  await dlg.getByTestId("beslistabel-wissen").click();
  await page.locator(".studio-dialoog").getByRole("button", { name: "Wissen" }).click();
  await expect(dlg).toHaveCount(0);
  await expect.poll(() => tabel(page, "top")).toBeNull();
  await expect(page.getByTestId("beslistabel-samenvatting")).toHaveText("geen beslistabel");
  // Opnieuw: alleen de invoer uit het diagram, één lege regel, en geen wisknop (nog niets opgeslagen).
  await page.getByTestId("beslistabel-bewerken").click();
  await expect(dlg.getByTestId("beslistabel-wissen")).toHaveCount(0);
  await expect(dlg.locator("thead th.dmn-th-input[data-testid]")).toHaveCount(2);
  await expect(dlg.locator("tbody tr")).toHaveCount(1);
});

test("een getekende «traceert naar» wordt het gegeven: één veld vanzelf, bij meer velden open", async ({ page }) => {
  await opzet(page);
  // Twee elementen in een eigen taal: één met één veld, één met twee.
  await page.evaluate(async () => {
    const reg = await import(location.origin + "/viz/react/src/studio/profieltypeRegistry.js");
    const cm = reg.getProfieltypen().find((p) => p?.descriptor?.id === "canoniek-uml");
    const s = cm.useStore.getState();
    const ge = (id, naam, velden) => s.addElement({ id, naam, elementType: "gegevenselement", data: {}, compartimenten: [{ compartmentType: "velden", velden: velden.map((v) => ({ naam: v, fieldType: "attribuut", data: { typeLabel: "string" } })) }] });
    ge("geb", "Geboorte", ["datum"]);
    ge("npn", "NP-naam", ["naam", "langeNaam"]);
    const { useKruisStore } = await import(location.origin + "/viz/react/src/studio/activities/koppelingenActivity.jsx");
    const k = useKruisStore.getState();
    k.legLink({ profielId: "dmnDrd05", elementId: "b" }, { profielId: cm.id, elementId: "geb" }, "traceert naar");
    k.legLink({ profielId: "dmnDrd05", elementId: "a" }, { profielId: cm.id, elementId: "npn" }, "traceert naar");
    window.__cmId = cm.id;
  });
  const cmId = await page.evaluate(() => window.__cmId);
  await expect.poll(async () => (await element(page, "b")).data.gegeven).toMatchObject({ profielId: cmId, elementId: "geb", veldNaam: "datum" }); // met de uuid van het veld
  await expect.poll(async () => (await element(page, "a")).data.gegeven).toEqual({ profielId: cmId, elementId: "npn" });
  // De getekende lijnen zijn weg; de lijn volgt nu uit het gegeven.
  const links = await page.evaluate(async () => {
    const { useKruisStore } = await import(location.origin + "/viz/react/src/studio/activities/koppelingenActivity.jsx");
    return useKruisStore.getState().links.filter((l) => l.soort === "traceert naar").length;
  });
  expect(links).toBe(0);
  // In Eigenschappen: het element staat, het veld is nog te kiezen.
  await kies(page, "a");
  const veld = page.getByTestId("veld-verwijzing-gegeven");
  await expect(veld.locator("select").nth(1)).toHaveValue("npn");
  await expect(veld.locator("select").nth(2)).toHaveValue("");
});
