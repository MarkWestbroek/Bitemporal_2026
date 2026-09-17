// migratie.test.js — oude presentatie-edges ENT ◆ GE → compositie-connectoren.
// Run: npm test  (vanuit web/vite/; node --test)

import test from "node:test";
import assert from "node:assert/strict";

import { vouwOudeComposities } from "./migratie.js";
import { vanCanoniekModel } from "./adapter.js";
import { canoniekUmlDiagramType } from "./index.js";

/** Het profiel is de bron van de veldnamen: altijd de echte elementtypen meegeven. */
const TYPES = canoniekUmlDiagramType.elementTypes;
const vouw = (state) => vouwOudeComposities(state, TYPES);

/** Sandbox zoals de heenreis hem vóór 2026-09-15 opsloeg. */
function oudeSandbox() {
  return {
    elements: {
      B: { id: "B", naam: "B", elementType: "entiteit", compartimenten: [], data: {} },
      X: { id: "X", naam: "X", elementType: "gegevenselement", compartimenten: [], data: { bron: { naamLabelTerug: "van" } } },
      Y: { id: "Y", naam: "Y", elementType: "gegevenselement", compartimenten: [], data: {} },
      Z: { id: "Z", naam: "Z", elementType: "gegevenselement", compartimenten: [], data: {} },
      T: { id: "T", naam: "T", elementType: "gegevenstype", compartimenten: [], data: {} },
    },
    diagrams: {
      d1: {
        id: "d1",
        nodes: [{ elementId: "B" }, { elementId: "X" }, { elementId: "Y" }, { elementId: "T" }],
        edges: [
          { id: "se1", source: "B", target: "X", sourceHandle: "bottom", targetHandle: "top",
            data: { presentatie: { markerStart: "ruit" }, bron: { rolnaam: "X", kardinaliteit: "0..1", momentvoorkomen: "enkelvoudig" } } },
          { id: "se2", source: "B", target: "Y", data: { presentatie: { markerStart: "ruit" }, bron: { kardinaliteit: "0..1" } } },
          { id: "dep", source: "X", target: "T", data: { bron: { isDependency: true } } },
        ],
      },
    },
    meta: {
      compositieEdges: [
        { id: "se1", source: "B", target: "X", data: { rolnaam: "X", kardinaliteit: "0..1", momentvoorkomen: "enkelvoudig" } },
        { id: "se2", source: "B", target: "Y", data: { kardinaliteit: "0..1" } },
        // Z staat op geen enkel diagram: alleen de meta-kopie kent hem.
        { id: "se3", source: "B", target: "Z", data: { kardinaliteit: "1" } },
      ],
    },
  };
}

test("vouwt oude presentatie-edges én meta-composities tot connectoren", () => {
  const r = vouw(oudeSandbox());
  const comps = Object.values(r.elements).filter((e) => e.elementType === "compositie");
  assert.deepEqual(comps.map((c) => `${c.source}->${c.target}`).sort(), ["B->X", "B->Y", "B->Z"]);

  const x = comps.find((c) => c.target === "X");
  assert.equal(x.id, "comp_se1");
  assert.equal(x.data.structuralEdgeId, "se1");
  assert.equal(x.data.rolnaam, "X");
  assert.equal(x.data.momentvoorkomen, "enkelvoudig");
  assert.equal(x.data.naamLabelTerug, "van");
  assert.equal(x.data.sourceHandle, "source-bottom");
  assert.equal(x.data.targetHandle, "target-top");

  // Presentatie-edges van composities weg; «use» blijft staan.
  assert.deepEqual(r.diagrams.d1.edges.map((e) => e.id), ["dep"]);
  assert.equal(r.meta.compositiesGevouwen, true);
});

test("idempotent: tweede ronde doet niets", () => {
  const eerste = vouw(oudeSandbox());
  assert.equal(vouw(eerste), null);
});

test("een na de migratie verwijderde compositie komt niet terug uit meta", () => {
  const eerste = vouw(oudeSandbox());
  const { comp_se3: _weg, ...zonderZ } = eerste.elements;
  assert.equal(vouw({ ...eerste, elements: zonderZ }), null);
});

test("bestaande connector wordt niet verdubbeld; lege sandbox doet niets", () => {
  const s = oudeSandbox();
  s.elements.c = { id: "c", elementType: "compositie", source: "B", target: "X", data: {} };
  const r = vouw(s);
  assert.equal(Object.values(r.elements).filter((e) => e.target === "X" && e.elementType === "compositie").length, 1);
  assert.equal(vouw({ elements: {}, diagrams: {}, meta: {} }), null);
});

test("een verse heenreis is al gevouwen", () => {
  const vers = vanCanoniekModel({ elements: {}, structuralEdges: [], diagrams: {} });
  assert.equal(vers.meta.compositiesGevouwen, true);
});

test("vult ontbrekende compositie-velden (jsonRolnaam) aan uit data.bron, maar laat bewerkte waarden staan", () => {
  const eerste = vouw(oudeSandbox());
  const comp = eerste.elements.comp_se1;
  // Vóór de compositie-properties gevouwen: jsonRolnaam alleen in bron.
  const oud = { ...comp, data: { ...comp.data, bron: { ...comp.data.bron, jsonRolnaam: "xen" } } };
  const bewerkt = { ...eerste.elements.comp_se2, data: { ...eerste.elements.comp_se2.data, kardinaliteit: "", bron: { kardinaliteit: "0..1" } } };
  const r = vouw({ ...eerste, elements: { ...eerste.elements, comp_se1: oud, comp_se2: bewerkt } });
  assert.equal(r.elements.comp_se1.data.jsonRolnaam, "xen");
  assert.equal(r.elements.comp_se2.data.kardinaliteit, "", "leeggemaakt blijft leeg");
  assert.equal(vouw(r), null, "daarna niets meer te doen");
});

test("vult GE-velden (typenaam, beschrijving, meervoud, labels) aan uit data.bron", () => {
  const s = oudeSandbox();
  s.meta.compositiesGevouwen = true;
  s.diagrams.d1.edges = [];
  s.elements.Y = {
    ...s.elements.Y,
    data: { meervoud: "", bron: { typenaam: "B_Y", description: "Uitleg", meervoud: "ys", naamLabelHeen: "heeft" } },
  };
  const r = vouw(s);
  assert.equal(r.elements.Y.data.typenaam, "B_Y");
  assert.equal(r.elements.Y.data.description, "Uitleg");
  assert.equal(r.elements.Y.data.naamLabelHeen, "heeft");
  assert.equal(r.elements.Y.data.meervoud, "", "leeggemaakt blijft leeg");
  assert.equal(vouw(r), null);
});

test("vult ook entiteit- en relatievelden (subtype, beschrijving) aan uit data.bron", () => {
  const s = oudeSandbox();
  s.meta.compositiesGevouwen = true;
  s.diagrams.d1.edges = [];
  s.elements.B = { ...s.elements.B, data: { stereotype: "«referentielijst»", bron: { entiteitSubtype: "referentielijst", description: "Lijst" } } };
  s.elements.R = { id: "R", naam: "R", elementType: "relatie", source: "B", target: "B", compartimenten: [], data: { bron: { relatieSubtype: "associatie", meervoud: "rs" } } };
  const r = vouw(s);
  assert.equal(r.elements.B.data.entiteitSubtype, "referentielijst");
  assert.equal(r.elements.B.data.description, "Lijst");
  assert.equal(r.elements.R.data.relatieSubtype, "associatie");
  assert.equal(r.elements.R.data.meervoud, "rs");
});
