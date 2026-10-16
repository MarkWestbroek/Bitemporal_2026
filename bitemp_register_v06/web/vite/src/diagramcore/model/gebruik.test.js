import { test } from "node:test";
import assert from "node:assert/strict";
import { gebruikVan, gebruikteIds } from "./gebruik.js";

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

test("gebruikteIds: alles wat ergens als knoop staat", () => {
  assert.deepEqual([...gebruikteIds(diagrams)].sort(), ["a", "b"]);
});
