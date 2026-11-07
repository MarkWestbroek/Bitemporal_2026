import { test } from "node:test";
import assert from "node:assert/strict";
import { metVreemdeElementen, ontleedVreemdeId, vreemdeId, vreemdeProfielen } from "./vreemd.js";

const eigen = {
  id: "uml",
  elementTypes: [{ id: "klasse", label: "Klasse", compartments: [{ id: "attr" }] }],
  fieldTypes: [{ id: "attribuut" }],
};
const archi = {
  id: "archi",
  label: "ArchiMate",
  elementTypes: [
    { id: "app", label: "Applicatie", compartments: [{ id: "attr" }], hooks: { valideer: (el) => (el.naam ? [] : [{ niveau: "fout", tekst: "naam" }]) } },
    { id: "flow", label: "Flow", isConnector: true, bron: { elementTypes: ["app"] }, doel: { elementTypes: ["app"] }, hooks: { edgeLabels: (c, { elements }) => ({ kaal: [elements[c.source].naam] }) } },
  ],
  fieldTypes: [{ id: "attribuut" }, { id: "eigenschap" }],
};
const archiElementen = {
  a: { id: "a", naam: "A", elementType: "app" },
  b: { id: "b", naam: "B", elementType: "app" },
  c: { id: "c", naam: "C", elementType: "app" },
  f: { id: "f", naam: "", elementType: "flow", source: "a", target: "b" },
  g: { id: "g", naam: "", elementType: "flow", source: "a", target: "c" },
};
const bron = (p) => (p === "archi" ? { elements: archiElementen, descriptor: archi } : null);

test("vreemdeId en ontleedVreemdeId zijn elkaars omgekeerde", () => {
  assert.equal(vreemdeId("archi", "a"), "archi::a");
  assert.deepEqual(ontleedVreemdeId("archi::a"), { profielId: "archi", elementId: "a" });
  assert.equal(ontleedVreemdeId("a"), null);
  assert.equal(ontleedVreemdeId("::a"), null);
  assert.equal(ontleedVreemdeId(null), null);
});

test("zonder vreemde nodes blijft alles hetzelfde object", () => {
  const elements = { k: { id: "k", elementType: "klasse" } };
  const diagram = { nodes: [{ elementId: "k" }] };
  const uit = metVreemdeElementen({ elements, descriptor: eigen, diagram, bron });
  assert.equal(uit.elements, elements);
  assert.equal(uit.descriptor, eigen);
  assert.equal(vreemdeProfielen(diagram).size, 0);
});

test("vreemde elementen, hun onderlinge relaties en typen komen erbij", () => {
  const elements = { k: { id: "k", elementType: "klasse" } };
  const diagram = { nodes: [{ elementId: "k" }, { elementId: "archi::a", profielId: "archi" }, { elementId: "archi::b", profielId: "archi" }] };
  const uit = metVreemdeElementen({ elements, descriptor: eigen, diagram, bron });
  assert.deepEqual(Object.keys(uit.elements).sort(), ["archi::a", "archi::b", "archi::f", "k"]);
  const f = uit.elements["archi::f"];
  assert.equal(f.source, "archi::a");
  assert.equal(f.target, "archi::b");
  assert.equal(f.elementType, "archi::flow");
  assert.deepEqual(uit.elements["archi::a"].data.vreemd, { profielId: "archi", elementId: "a", taal: "ArchiMate" });
  // g wijst naar c, dat niet op het diagram staat: niet mee.
  assert.equal(uit.elements["archi::g"], undefined);
  const typen = Object.fromEntries(uit.descriptor.elementTypes.map((t) => [t.id, t]));
  assert.ok(typen["archi::app"] && typen["archi::flow"] && typen.klasse);
  // Op dit diagram maak je geen nieuwe relatie van de andere taal.
  assert.deepEqual(typen["archi::flow"].bron.elementTypes, []);
  // Veldtypen: eigen wint, ontbrekende komen erbij.
  assert.deepEqual(uit.descriptor.fieldTypes.map((f) => f.id), ["attribuut", "eigenschap"]);
});

test("weergave-hooks krijgen het origineel en de elementen van hun eigen taal", () => {
  const diagram = { nodes: [{ elementId: "archi::a" }, { elementId: "archi::b" }] };
  const uit = metVreemdeElementen({ elements: {}, descriptor: eigen, diagram, bron });
  const flowType = uit.descriptor.elementTypes.find((t) => t.id === "archi::flow");
  assert.deepEqual(flowType.hooks.edgeLabels(uit.elements["archi::f"], { elements: uit.elements }), { kaal: ["A"] });
  const appType = uit.descriptor.elementTypes.find((t) => t.id === "archi::app");
  assert.deepEqual(appType.hooks.valideer(uit.elements["archi::a"], {}), []);
});

test("een onbekende taal of verdwenen element slaat over", () => {
  const diagram = { nodes: [{ elementId: "bestaatniet::x" }, { elementId: "archi::weg" }] };
  const uit = metVreemdeElementen({ elements: {}, descriptor: eigen, diagram, bron });
  assert.deepEqual(uit.elements, {});
  assert.equal(uit.descriptor, eigen);
});
