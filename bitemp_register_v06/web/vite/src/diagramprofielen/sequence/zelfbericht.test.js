// zelfbericht.test.js — sequence: een handgetekend bericht krijgt zijn punten op de levenslijn.
// Run: node --import ./test/register-aliases.mjs --test src/diagramprofielen/sequence/zelfbericht.test.js

import test from "node:test";
import assert from "node:assert/strict";

import { puntenVoorBericht, ontvangpuntVoorZelfbericht, ruimPuntenOp, HAAK } from "./zelfbericht.js";

function store() {
  const s = {
    elements: {
      L: { id: "L", elementType: "levenslijn" },
      M: { id: "M", elementType: "levenslijn" },
      p: { id: "p", elementType: "punt", data: { randVan: "L" } },
      c: { id: "c", elementType: "synchroon", source: "p", target: "p", data: { sourceHandle: "source-right", targetHandle: "target-top" } },
    },
    diagrams: { d: { id: "d", nodes: [
      { elementId: "L", position: { x: 100, y: 0 } },
      { elementId: "M", position: { x: 400, y: 20 } },
      { elementId: "p", position: { x: 1, y: 200 } },
    ] } },
    addElement(el) { s.elements[el.id] = el; },
    deleteElement(id) { delete s.elements[id]; for (const e of Object.values(s.elements)) if (e.source === id || e.target === id) delete s.elements[e.id]; },
    addElementToDiagram(dId, id, position) { s.diagrams[dId].nodes.push({ elementId: id, position }); },
    updateElement(id, patch) { s.elements[id] = { ...s.elements[id], ...patch }; },
  };
  return s;
}
let n = 0;
const maakPunt = () => ({ id: `n${++n}`, naam: "", elementType: "punt", compartimenten: [], data: {} });
const pos = (s, id) => s.diagrams.d.nodes.find((x) => x.elementId === id).position;

test("levenslijn → levenslijn: punten op de muishoogte, horizontaal", () => {
  const s = store();
  s.elements.c = { id: "c", elementType: "synchroon", source: "L", target: "M", data: { sourceHandle: "source-right" } };
  const uit = puntenVoorBericht(s.elements.c, { s, diagramId: "d", maakPunt, van: { x: 107, y: 300 }, naar: { x: 407, y: 340 } });
  assert.ok(uit);
  assert.deepEqual([s.elements.c.source, s.elements.c.target], [uit.source, uit.target]);
  assert.deepEqual(pos(s, uit.source), { x: 1, y: 300 - 0 - 6 }, "zendpunt op de muishoogte, relatief aan L");
  assert.deepEqual(pos(s, uit.target), { x: 1, y: 300 - 20 - 6 }, "ontvangpunt op dezelfde hoogte, relatief aan M (20 lager)");
  assert.equal(s.elements[uit.source].data.randVan, "L");
  assert.equal(s.elements[uit.target].data.randVan, "M");
  assert.deepEqual(s.elements.c.data, { sourceHandle: null, targetHandle: null });
});

test("levenslijn → dezelfde levenslijn: haakje; zonder muispositie een standaardhoogte", () => {
  const s = store();
  s.elements.c = { id: "c", elementType: "synchroon", source: "L", target: "L", data: {} };
  const uit = puntenVoorBericht(s.elements.c, { s, diagramId: "d", maakPunt });
  assert.equal(pos(s, uit.target).y - pos(s, uit.source).y, HAAK);
  assert.equal(pos(s, uit.source).y, 80 - 6);
});

test("punt → zelfde punt: ontvangpunt 15px lager; punt → ander punt: niets", () => {
  const s = store();
  assert.equal(ontvangpuntVoorZelfbericht(s.elements.c, { s, diagramId: "d", maakPunt }), `n${n}`);
  assert.equal(s.elements.c.source, "p", "het zendpunt blijft");
  assert.deepEqual(pos(s, s.elements.c.target), { x: 1, y: 200 + HAAK });
  const t = store();
  t.elements.q = { id: "q", elementType: "punt", data: { randVan: "M" } };
  t.diagrams.d.nodes.push({ elementId: "q", position: { x: 1, y: 180 } });
  assert.equal(puntenVoorBericht({ ...t.elements.c, target: "q" }, { s: t, diagramId: "d", maakPunt }), null);
});

test("activatie → zichzelf: zend- en ontvangpunt op de hoogte van het midden; de activatie blijft", () => {
  const s = store();
  s.elements.p.elementType = "activatie";
  s.diagrams.d.nodes[2].size = { width: 14, height: 60 };
  const uit = puntenVoorBericht(s.elements.c, { s, diagramId: "d", maakPunt });
  assert.deepEqual(pos(s, uit.source), { x: 1, y: 200 + 30 - 6 });
  assert.deepEqual(pos(s, uit.target), { x: 1, y: 200 + 30 - 6 + HAAK });
  assert.equal(s.elements.p.elementType, "activatie");
});

test("levenslijn → bestaand punt op een andere lijn: alleen het zendpunt ontstaat", () => {
  const s = store();
  s.elements.q = { id: "q", elementType: "punt", data: { randVan: "M" } };
  s.diagrams.d.nodes.push({ elementId: "q", position: { x: 1, y: 180 } });
  s.elements.c = { id: "c", elementType: "synchroon", source: "L", target: "q", data: {} };
  const uit = puntenVoorBericht(s.elements.c, { s, diagramId: "d", maakPunt, van: { x: 0, y: 250 } });
  assert.equal(uit.target, "q");
  assert.deepEqual(pos(s, uit.source), { x: 1, y: 250 - 6 });
});

test("na verwijderen gaan de eigen punten mee, gedeelde punten en notitie-lijnen niet", () => {
  const s = store();
  s.elements.q = { id: "q", elementType: "punt", data: { randVan: "M" } };
  s.elements.c = { id: "c", elementType: "synchroon", source: "p", target: "q" };
  s.elements.c2 = { id: "c2", elementType: "synchroon", source: "q", target: "p" };
  s.elements.nl = { id: "nl", elementType: "notitielijn", source: "n", target: "p" };
  const conn = s.elements.c;
  delete s.elements.c; // de store heeft hem al verwijderd
  assert.deepEqual(ruimPuntenOp(conn, { s }), [], "q en p worden nog door c2 gebruikt");
  delete s.elements.c2;
  assert.deepEqual(ruimPuntenOp(conn, { s }).sort(), ["p", "q"], "een notitie-lijn houdt een punt niet in leven");
  assert.equal(s.elements.p, undefined);
});

test("niets te doen: onbekend diagram of geen levenslijn aan een kant", () => {
  const s = store();
  assert.equal(puntenVoorBericht(s.elements.c, { s, diagramId: "x", maakPunt }), null);
  s.elements.p = { id: "p", elementType: "notitie", data: {} };
  assert.equal(puntenVoorBericht(s.elements.c, { s, diagramId: "d", maakPunt }), null);
});
