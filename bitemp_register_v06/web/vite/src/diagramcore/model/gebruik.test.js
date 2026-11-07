import { test } from "node:test";
import assert from "node:assert/strict";
import { gebruikInProject, gebruikVan, gebruikteIds } from "./gebruik.js";

const diagrams = {
  d2: { id: "d2", naam: "Zeta", nodes: [{ elementId: "a" }, { elementId: "a", nodeId: "a~2" }] },
  d1: { id: "d1", naam: "Alfa", nodes: [{ elementId: "a" }, { elementId: "b", gedaante: "ingebed" }] },
  d3: { id: "d3", nodes: [] },
};

test("gebruikVan: diagrammen op naam, met het aantal voorkomens", () => {
  assert.deepEqual(gebruikVan("a", diagrams), [{ id: "d1", naam: "Alfa", aantal: 1 }, { id: "d2", naam: "Zeta", aantal: 2 }]);
  assert.deepEqual(gebruikVan("b", diagrams), [{ id: "d1", naam: "Alfa", aantal: 1 }], "ingebed telt als gebruik");
  assert.deepEqual(gebruikVan("x", diagrams), []);
  assert.deepEqual(gebruikVan("a", null), []);
});

test("gebruikInProject: ook diagrammen van andere talen waar het als verwijzing staat", () => {
  const talen = [
    { profielId: "uml", label: "Canoniek", diagrams: { m: { id: "m", naam: "Mix", nodes: [{ elementId: "k" }, { elementId: "archi::a" }] } } },
    { profielId: "archi", label: "ArchiMate", diagrams },
  ];
  assert.deepEqual(gebruikInProject("archi", "a", talen), [
    { id: "d1", naam: "Alfa", aantal: 1, profielId: "archi", taal: null },
    { id: "d2", naam: "Zeta", aantal: 2, profielId: "archi", taal: null },
    { id: "m", naam: "Mix", aantal: 1, profielId: "uml", taal: "Canoniek" },
  ]);
  // Een eigen element met dezelfde id in een andere taal telt niet mee.
  assert.deepEqual(gebruikInProject("uml", "a", talen), []);
});

test("gebruikteIds: alles wat ergens als knoop staat", () => {
  assert.deepEqual([...gebruikteIds(diagrams)].sort(), ["a", "b"]);
});
