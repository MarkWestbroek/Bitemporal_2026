// Studio — naam/pad uniek per domein (altijd actief) en FieldRefs gebonden via de uuid (31-10).
//  1. Twee entiteiten met dezelfde naam in één domein: ⚠ op het canvas, melding in de inspector.
//  2. Een DMN-kolom met een FieldRef (uuid) volgt een hernoeming van het modelveld.
import { test, expect } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { openStudio, zetModel, node } from "./helpers/studio.js";

const FIXTURE = path.resolve(path.dirname(fileURLToPath(import.meta.url)),
  "../../src/diagramprofielen/canoniek-uml/fixtures/cg-test/omnium-model-cg-test-v3.json");
const CG_TEST = JSON.parse(fs.readFileSync(FIXTURE, "utf8"));
const UUID = "44444444-4444-4444-8444-444444444444";

test.use({ viewport: { width: 1440, height: 900 } });

/** Profielstore op descriptor-id (canoniek-uml draait als activiteit "diagram05"). */
async function store(page, descriptorId) {
  return page.evaluate(async (descriptorId) => {
    const reg = await import(location.origin + "/viz/react/src/studio/profieltypeRegistry.js");
    let p = null;
    for (let i = 0; i < 150 && !p; i++) {
      p = reg.getProfieltypen().find((x) => x?.descriptor?.id === descriptorId);
      if (!p) await new Promise((r) => setTimeout(r, 100));
    }
    window.__stores = window.__stores || {};
    window.__stores[descriptorId] = p.useStore;
    return p.id;
  }, descriptorId);
}

test("dubbele naam in een domein: ⚠ op het canvas en een melding in de inspector", async ({ page }) => {
  await openStudio(page);
  const profielId = await store(page, "canoniek-uml");
  await zetModel(page, { profielId, diagramId: "d_dubbel", diagramNaam: "Dubbel", elementen: [
    { id: "e1", naam: "Kaart", type: "entiteit", data: { domein: "proef" }, pos: { x: 100, y: 450 } },
    { id: "e2", naam: "Kaart", type: "entiteit", data: { domein: "proef" }, pos: { x: 420, y: 450 } },
    { id: "e3", naam: "Kaart", type: "entiteit", data: { domein: "elders" }, pos: { x: 100, y: 650 } },
  ] });
  await expect(node(page, "e1").locator('[data-testid="node-fout"]')).toBeVisible();
  await expect(node(page, "e2").locator('[data-testid="node-fout"]')).toBeVisible();
  await expect(node(page, "e3").locator('[data-testid="node-fout"]')).toHaveCount(0);
  await node(page, "e1").click({ position: { x: 20, y: 10 } });
  await expect(page.getByTestId("inspector-meldingen")).toContainText("Namen zijn uniek per domein");
});

test("DMN-kolom volgt een hernoeming van het modelveld via de uuid", async ({ page }) => {
  await openStudio(page);
  await store(page, "canoniek-uml");
  await store(page, "dmn-drd");
  const v3 = JSON.parse(JSON.stringify(CG_TEST));
  const ge = v3.model.entiteiten.find((e) => e.typenaam === "Gehandicaptenparkeerkaart").gegevenselementen.find((g) => (g.velden || []).some((v) => v.naam === "kaartnummer"));
  ge.velden.find((v) => v.naam === "kaartnummer").uuid = UUID;

  const geId = `Gehandicaptenparkeerkaart_${ge.naam}`;
  await page.evaluate(async ({ v3, uuid, geId }) => {
    const { importeerV3 } = await import(location.origin + "/viz/react/src/diagramprofielen/canoniek-uml/serialisatie.js");
    window.__stores["canoniek-uml"].getState().laadModel(importeerV3(v3));
    window.__stores["dmn-drd"].getState().addElement({
      id: "beslis1", naam: "Proef", elementType: "decision", compartimenten: [],
      data: { beslistabel: { inputs: [{ id: "in1", naam: "kaart", fieldRef: { uuid, typenaam: geId, veldnaam: "kaartnummer", veldpad: "oud.pad.kaartnummer" } }], outputs: [] } },
    });
  }, { v3, uuid: UUID, geId });

  // Bij het laden: het naampad wordt uit de uuid gezet.
  const veldpad = () => page.evaluate(() => window.__stores["dmn-drd"].getState().elements.beslis1.data.beslistabel.inputs[0].fieldRef.veldpad);
  await expect.poll(veldpad).toMatch(/^Gehandicaptenparkeerkaart\.[a-z_]+\.kaartnummer$/);

  // Hernoemen in het canonieke model → de kolom volgt.
  await page.evaluate(({ geId }) => {
    const s = window.__stores["canoniek-uml"].getState();
    const el = s.elements[geId];
    const compartimenten = el.compartimenten.map((c) =>
      c.compartmentType === "velden" ? { ...c, velden: c.velden.map((v) => (v.naam === "kaartnummer" ? { ...v, naam: "pasnummer" } : v)) } : c
    );
    s.updateElementen({ [geId]: { compartimenten } });
  }, { geId });
  await expect.poll(veldpad).toMatch(/\.pasnummer$/);
});
