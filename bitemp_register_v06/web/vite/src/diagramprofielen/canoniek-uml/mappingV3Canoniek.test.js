// mappingV3Canoniek.test.js — het profiel is de bron van de veldnamen voor heenreis,
// terugreis en migratie (sandbox ↔ oude datavorm).
// Run: npm test  (vanuit web/vite/; node --test)

import test from "node:test";
import assert from "node:assert/strict";

import { vertaalbareVelden, EIGEN_VERTALING } from "./mappingV3Canoniek.js";
import { canoniekUmlDiagramType } from "./index.js";
import { vanCanoniekModel, naarCanoniekModel } from "./adapter.js";
import { exporteerV3, importeerV3 } from "./serialisatie.js";

const typeVan = (id) => canoniekUmlDiagramType.elementTypes.find((et) => et.id === id);

/** Minimale oude store: entiteit E ◆ GE G, en relatie R van E naar F. */
function bronState(geData = {}, edgeData = {}, extra = {}) {
  return {
    elements: {
      E: { id: "E", naam: "E", type: "entiteit", data: { typenaam: "E", velden: [], ...(extra.E || {}) } },
      F: { id: "F", naam: "F", type: "entiteit", data: { typenaam: "F", velden: [] } },
      G: { id: "G", naam: "G", type: "gegevenselement", data: { klassenaam: "G", velden: [], ...geData } },
      R: { id: "R", naam: "R", type: "relatie", data: { typenaam: "R", doelEntiteit: "F", velden: [], ...(extra.R || {}) } },
    },
    structuralEdges: [
      { id: "se", source: "E", target: "G", data: edgeData },
      { id: "se_r", source: "E", target: "R", data: {} },
    ],
    diagrams: {},
  };
}

/** Een geldige, herkenbare waarde per property-datatype. */
function proefwaarde(typeId, regel) {
  if (regel.datatype === "boolean") return true;
  if (regel.datatype === "keuze") return regel.opties[regel.opties.length - 1].waarde;
  return `${typeId}-${regel.key}`;
}

/**
 * Proefwaarden voor alle properties van een type (minus de eigen vertalingen).
 * Bewust rechtstreeks uit het profiel en níet via vertaalbareVelden: anders
 * toetst de test stilletjes niets zodra een type uit GENERIEKE_TYPES valt.
 */
function proefwaarden(typeId) {
  const regels = typeVan(typeId).properties.filter((p) => !EIGEN_VERTALING.has(p.key));
  assert.ok(regels.length > 0, `${typeId} heeft te toetsen properties`);
  return Object.fromEntries(regels.map((p) => [p.key, proefwaarde(typeId, p)]));
}

test("vertaalbare velden = properties van het profiel, zonder de eigen vertalingen", () => {
  const ge = vertaalbareVelden(typeVan("gegevenselement"));
  const verwacht = typeVan("gegevenselement").properties.map((p) => p.key).filter((k) => !EIGEN_VERTALING.has(k));
  assert.deepEqual(ge, verwacht);
  assert.ok(ge.includes("meervoud") && !ge.includes("materieel"));
  assert.ok(vertaalbareVelden(typeVan("entiteit")).includes("entiteitSubtype"));
  assert.ok(vertaalbareVelden(typeVan("relatie")).includes("bronKardinaliteit"));
  assert.deepEqual(vertaalbareVelden(typeVan("gegevenstype")), [], "niet-generieke typen doen niet mee");
});

test("elk vertaalbaar profielveld gaat heen en terug (entiteit, GE, relatie, compositie)", () => {
  const w = {
    entiteit: proefwaarden("entiteit"),
    gegevenselement: proefwaarden("gegevenselement"),
    relatie: proefwaarden("relatie"),
    compositie: proefwaarden("compositie"),
  };
  const core = vanCanoniekModel(bronState());
  const comp = Object.values(core.elements).find((el) => el.elementType === "compositie");
  Object.assign(core.elements.E.data, w.entiteit);
  Object.assign(core.elements.G.data, w.gegevenselement);
  Object.assign(core.elements.R.data, w.relatie);
  Object.assign(comp.data, w.compositie);

  const terug = naarCanoniekModel(core);
  const se = terug.structuralEdges.find((e) => e.source === "E" && e.target === "G");
  for (const [k, v] of Object.entries(w.entiteit)) assert.equal(terug.elements.E.data[k], v, `entiteit.${k}`);
  for (const [k, v] of Object.entries(w.gegevenselement)) assert.equal(terug.elements.G.data[k], v, `GE.${k}`);
  for (const [k, v] of Object.entries(w.relatie)) assert.equal(terug.elements.R.data[k], v, `relatie.${k}`);
  for (const [k, v] of Object.entries(w.compositie)) assert.equal(se.data[k], v, `compositie.${k}`);

  // En de heenreis leest ze weer in data.
  const weer = vanCanoniekModel(
    bronState(w.gegevenselement, w.compositie, { E: w.entiteit, R: w.relatie })
  );
  const weerComp = Object.values(weer.elements).find((el) => el.elementType === "compositie");
  for (const [k, v] of Object.entries(w.entiteit)) assert.equal(weer.elements.E.data[k], v, `heen entiteit.${k}`);
  for (const [k, v] of Object.entries(w.gegevenselement)) assert.equal(weer.elements.G.data[k], v, `heen GE.${k}`);
  for (const [k, v] of Object.entries(w.relatie)) assert.equal(weer.elements.R.data[k], v, `heen relatie.${k}`);
  for (const [k, v] of Object.entries(w.compositie)) assert.equal(weerComp.data[k], v, `heen compositie.${k}`);
});

test("stereotype volgt het bewerkte subtype; zonder subtype-sleutel het opgeslagen stereotype", () => {
  const hook = typeVan("entiteit").hooks.stereotype;
  assert.equal(hook({ data: { stereotype: "«referentielijst»" } }), undefined, "oude sandbox: geen mening");
  assert.equal(hook({ data: { entiteitSubtype: "referentielijst_item", stereotype: "«referentielijst»" } }), "«ref.lijst item»");
  assert.equal(hook({ data: { entiteitSubtype: "", stereotype: "«referentielijst»" } }), "", "leeg → type-stereotype");
  assert.equal(typeVan("relatie").hooks.stereotype({ data: { relatieSubtype: "referentielijst_items" } }), "«ref.lijst items»");
});

test("entiteit hernoemen: typenaam en V3-ids volgen de naam, GE blijft eraan hangen", () => {
  const core = vanCanoniekModel(bronState());
  core.elements.E.naam = "Persoon";
  const terug = naarCanoniekModel(core);
  assert.equal(terug.elements.E.data.typenaam, "Persoon");

  const { v3 } = exporteerV3(core);
  const weer = importeerV3(v3);
  assert.ok(weer.elements.Persoon, "entiteit onder de nieuwe V3-id");
  const comp = Object.values(weer.elements).find((el) => el.elementType === "compositie" && el.source === "Persoon");
  assert.ok(comp, "compositie hangt aan de hernoemde entiteit");
  assert.equal(weer.elements[comp.target]?.naam, "G");
});

test("een property die alleen in het profiel wordt toegevoegd, gaat vanzelf mee", () => {
  const ge = typeVan("gegevenselement");
  const extra = { key: "proefVeld", label: "proef", datatype: "string" };
  ge.properties.push(extra);
  try {
    const core = vanCanoniekModel(bronState({ proefVeld: "uit model" }));
    assert.equal(core.elements.G.data.proefVeld, "uit model", "heenreis");
    core.elements.G.data.proefVeld = "bewerkt";
    assert.equal(naarCanoniekModel(core).elements.G.data.proefVeld, "bewerkt", "terugreis");
  } finally {
    ge.properties.splice(ge.properties.indexOf(extra), 1);
  }
});
