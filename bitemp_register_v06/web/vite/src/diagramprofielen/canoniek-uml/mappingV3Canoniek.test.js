// mappingV3Canoniek.test.js — het profiel is de bron van de veldnamen voor heenreis,
// terugreis en migratie (sandbox ↔ oude datavorm).
// Run: npm test  (vanuit web/vite/; node --test)

import test from "node:test";
import assert from "node:assert/strict";

import { vertaalbareVelden, EIGEN_VERTALING } from "./mappingV3Canoniek.js";
import { canoniekUmlDiagramType } from "./index.js";
import { vanCanoniekModel, naarCanoniekModel } from "./adapter.js";

const typeVan = (id) => canoniekUmlDiagramType.elementTypes.find((et) => et.id === id);

/** Minimale oude store: één entiteit met één GE via een compositie. */
function bronState(geData = {}, edgeData = {}) {
  return {
    elements: {
      E: { id: "E", naam: "E", type: "entiteit", data: { typenaam: "E", velden: [] } },
      G: { id: "G", naam: "G", type: "gegevenselement", data: { klassenaam: "G", velden: [], ...geData } },
    },
    structuralEdges: [{ id: "se", source: "E", target: "G", data: edgeData }],
    diagrams: {},
  };
}

test("vertaalbare velden = properties van het profiel, zonder de eigen vertalingen", () => {
  const ge = vertaalbareVelden(typeVan("gegevenselement"));
  const verwacht = typeVan("gegevenselement").properties.map((p) => p.key).filter((k) => !EIGEN_VERTALING.has(k));
  assert.deepEqual(ge, verwacht);
  assert.ok(ge.includes("meervoud") && !ge.includes("materieel"));
  assert.deepEqual(vertaalbareVelden(typeVan("gegevenstype")), [], "niet-generieke typen doen niet mee");
});

test("elk vertaalbaar profielveld gaat heen en terug (GE en compositie)", () => {
  const geVelden = vertaalbareVelden(typeVan("gegevenselement"));
  const compVelden = vertaalbareVelden(typeVan("compositie"));
  const core = vanCanoniekModel(bronState());
  const comp = Object.values(core.elements).find((el) => el.elementType === "compositie");
  for (const k of geVelden) core.elements.G.data[k] = `ge-${k}`;
  for (const k of compVelden) comp.data[k] = `comp-${k}`;

  const terug = naarCanoniekModel(core);
  for (const k of geVelden) assert.equal(terug.elements.G.data[k], `ge-${k}`, `GE-veld ${k}`);
  const se = terug.structuralEdges.find((e) => e.source === "E" && e.target === "G");
  for (const k of compVelden) assert.equal(se.data[k], `comp-${k}`, `compositie-veld ${k}`);

  // En de heenreis leest ze weer in data.
  const weer = vanCanoniekModel(bronState(
    Object.fromEntries(geVelden.map((k) => [k, `ge-${k}`])),
    Object.fromEntries(compVelden.map((k) => [k, `comp-${k}`]))
  ));
  for (const k of geVelden) assert.equal(weer.elements.G.data[k], `ge-${k}`);
  const weerComp = Object.values(weer.elements).find((el) => el.elementType === "compositie");
  for (const k of compVelden) assert.equal(weerComp.data[k], `comp-${k}`);
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
