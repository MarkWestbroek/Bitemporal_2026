// nesting.test.js — containers houden hun inhoud vast (backlog §31.3).
// Run: npm test  (vanuit web/vite/; node --test)

import test from "node:test";
import assert from "node:assert/strict";

import { bepaalNesting, containerVanElementen, nakomelingenVan } from "./nesting.js";

const elementTypesById = {
  pool: { id: "pool", containerVoor: "bevat" },
  lane: { id: "lane", containerVoor: "bevat" },
  taak: { id: "taak" },
  boundary: { id: "boundary", randElement: true },
  bevat: { id: "bevat", isConnector: true },
};
const el = (id, elementType, extra = {}) => ({ id, elementType, ...extra });
const bevat = (id, source, target) => el(id, "bevat", { source, target });

const elements = Object.fromEntries(
  [
    el("P", "pool"),
    el("L", "lane"),
    el("T1", "taak"),
    el("T2", "taak"),
    el("T3", "taak"),
    bevat("b1", "P", "L"),
    bevat("b2", "L", "T1"),
    bevat("b3", "L", "T2"),
  ].map((e) => [e.id, e])
);
const diagram = {
  nodes: [
    { elementId: "P", position: { x: 0, y: 0 }, size: { width: 800, height: 400 } },
    { elementId: "L", position: { x: 30, y: 0 }, size: { width: 770, height: 200 } },
    { elementId: "T1", position: { x: 100, y: 50 }, size: { width: 120, height: 60 } },
    // lid van de lane, maar ligt erbuiten → blijft vrij (lijn blijft zichtbaar)
    { elementId: "T2", position: { x: 1200, y: 50 }, size: { width: 120, height: 60 } },
    // ligt erin, maar is geen lid → blijft vrij
    { elementId: "T3", position: { x: 300, y: 50 }, size: { width: 120, height: 60 } },
  ],
};

test("containerVanElementen volgt de containerVoor-connector van het brontype", () => {
  const m = containerVanElementen(elements, elementTypesById);
  assert.equal(m.get("L"), "P");
  assert.equal(m.get("T1"), "L");
  assert.equal(m.has("T3"), false);
});

test("alleen leden die geometrisch in hun container liggen worden genest", () => {
  const n = bepaalNesting(elements, diagram, elementTypesById);
  assert.equal(n.ouderVan.get("T1"), "L");
  assert.equal(n.ouderVan.get("L"), "P");
  assert.equal(n.ouderVan.has("T2"), false, "lid buiten de container blijft vrij");
  assert.equal(n.ouderVan.has("T3"), false, "niet-lid in de container blijft vrij");
  assert.equal(n.diepte.get("L"), 1);
  assert.equal(n.diepte.get("T1"), 2);
});

test("nakomelingenVan geeft ook diepere leden", () => {
  const n = bepaalNesting(elements, diagram, elementTypesById);
  assert.deepEqual(nakomelingenVan(n, "P").sort(), ["L", "T1"]);
  assert.deepEqual(nakomelingenVan(n, "L"), ["T1"]);
});

test("aangehecht rand-element en lidmaatschapskring nesten niet", () => {
  const els = {
    ...elements,
    B: el("B", "boundary", { data: { randVan: "T1" } }),
    b4: bevat("b4", "L", "B"),
  };
  const d = { nodes: [...diagram.nodes, { elementId: "B", position: { x: 110, y: 60 } }] };
  assert.equal(bepaalNesting(els, d, elementTypesById).ouderVan.has("B"), false);

  // Kring: A in B én B in A, en ze overlappen geometrisch.
  const kring = {
    A: el("A", "lane"),
    B: el("B", "lane"),
    k1: bevat("k1", "A", "B"),
    k2: bevat("k2", "B", "A"),
  };
  const dk = {
    nodes: [
      { elementId: "A", position: { x: 0, y: 0 }, size: { width: 300, height: 300 } },
      { elementId: "B", position: { x: 10, y: 10 }, size: { width: 280, height: 280 } },
    ],
  };
  assert.equal(bepaalNesting(kring, dk, elementTypesById).ouderVan.size, 0, "kring → niemand genest");
});

test("gemeten maten tellen mee als het voorkomen geen eigen maat heeft", () => {
  const d = {
    nodes: [
      { elementId: "L", position: { x: 0, y: 0 } },
      { elementId: "T1", position: { x: 400, y: 300 } },
    ],
  };
  assert.equal(bepaalNesting(elements, d, elementTypesById).ouderVan.has("T1"), false);
  const n = bepaalNesting(elements, d, elementTypesById, { L: { width: 900, height: 600 } });
  assert.equal(n.ouderVan.get("T1"), "L");
});
