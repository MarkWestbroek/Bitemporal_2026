// zelfbericht.test.js — sequence: een handgetekend zelf-bericht krijgt zijn ontvangpunt 15px lager.
// Run: node --import ./test/register-aliases.mjs --test src/diagramprofielen/sequence/zelfbericht.test.js

import test from "node:test";
import assert from "node:assert/strict";

import { ontvangpuntVoorZelfbericht, HAAK } from "./zelfbericht.js";

function store() {
  const s = {
    elements: {
      L: { id: "L", elementType: "levenslijn" },
      p: { id: "p", elementType: "punt", data: { randVan: "L" } },
      c: { id: "c", elementType: "synchroon", source: "p", target: "p", data: { sourceHandle: "source-right", targetHandle: "target-top" } },
    },
    diagrams: { d: { id: "d", nodes: [{ elementId: "L", position: { x: 100, y: 0 } }, { elementId: "p", position: { x: 1, y: 200 } }] } },
    addElement(el) { s.elements[el.id] = el; },
    addElementToDiagram(dId, id, position) { s.diagrams[dId].nodes.push({ elementId: id, position }); },
    updateElement(id, patch) { s.elements[id] = { ...s.elements[id], ...patch }; },
  };
  return s;
}
const maakPunt = () => ({ id: "nieuw", naam: "", elementType: "punt", compartimenten: [], data: {} });

test("zelf-bericht: nieuw punt op dezelfde lijn, 15px lager; handles van de sleep vervallen", () => {
  const s = store();
  assert.equal(ontvangpuntVoorZelfbericht(s.elements.c, { s, diagramId: "d", maakPunt }), "nieuw");
  assert.deepEqual(s.elements.nieuw.data, { randVan: "L" });
  assert.deepEqual(s.diagrams.d.nodes.at(-1), { elementId: "nieuw", position: { x: 1, y: 200 + HAAK } });
  assert.equal(s.elements.c.target, "nieuw");
  assert.deepEqual(s.elements.c.data, { sourceHandle: null, targetHandle: null });
});

test("zelf-bericht vanaf een activatie: zend- en ontvangpunt op de hoogte van de activatie", () => {
  const s = store();
  s.elements.p.elementType = "activatie";
  s.diagrams.d.nodes[1].size = { width: 14, height: 60 };
  let n = 0;
  const twee = () => ({ id: `n${++n}`, naam: "", elementType: "punt", compartimenten: [], data: {} });
  assert.equal(ontvangpuntVoorZelfbericht(s.elements.c, { s, diagramId: "d", maakPunt: twee }), "n2");
  assert.deepEqual([s.elements.c.source, s.elements.c.target], ["n1", "n2"]);
  const pos = (id) => s.diagrams.d.nodes.find((x) => x.elementId === id).position;
  assert.deepEqual(pos("n1"), { x: 1, y: 200 + 30 - 6 }, "midden van de activatie");
  assert.deepEqual(pos("n2"), { x: 1, y: 200 + 30 - 6 + HAAK });
  assert.equal(s.elements.n1.data.randVan, "L");
  assert.equal(s.elements.p.elementType, "activatie", "de activatie blijft staan");
});

test("geen zelf-bericht, geen punt of niet op het diagram: niets", () => {
  const s = store();
  assert.equal(ontvangpuntVoorZelfbericht({ ...s.elements.c, target: "q" }, { s, diagramId: "d", maakPunt }), null);
  s.elements.p.elementType = "levenslijn";
  assert.equal(ontvangpuntVoorZelfbericht(s.elements.c, { s, diagramId: "d", maakPunt }), null);
  s.elements.p.elementType = "punt";
  assert.equal(ontvangpuntVoorZelfbericht(s.elements.c, { s, diagramId: "x", maakPunt }), null);
});
