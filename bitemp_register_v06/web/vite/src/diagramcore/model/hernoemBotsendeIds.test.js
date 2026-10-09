// hernoemBotsendeIds.test.js — importmodel "ernaast": botsende ids hernoemen mét verwijzingen.
// Run: node --import ./test/register-aliases.mjs --test src/diagramcore/model/hernoemBotsendeIds.test.js

import test from "node:test";
import assert from "node:assert/strict";
import { hernoemBotsendeIds } from "./hernoemBotsendeIds.js";

const model = {
  elements: {
    a: { id: "a", naam: "A", elementType: "klasse" },
    b: { id: "b", naam: "B", elementType: "klasse" },
    ab: { id: "ab", naam: "", elementType: "associatie", source: "a", target: "b" },
  },
  diagrams: {
    d1: {
      id: "d1",
      naam: "D",
      diagramType: "puur-uml",
      nodes: [{ elementId: "a", position: { x: 0, y: 0 } }, { elementId: "b", position: { x: 1, y: 1 } }],
      edges: [],
      verborgenConnectoren: ["ab"],
      connectorVoorkomens: { ab: { bronNodeId: "a", doelNodeId: "b" } },
    },
  },
};

test("zonder botsing blijft alles gelijk", () => {
  const uit = hernoemBotsendeIds(model, { elements: {}, diagrams: {} }, "T");
  assert.deepEqual(Object.keys(uit.elements), ["a", "b", "ab"]);
  assert.equal(uit.hernoemd, 0);
  assert.equal(uit.eersteDiagramId, "d1");
});

test("botsende element- en diagram-ids worden hernoemd, verwijzingen gaan mee", () => {
  const state = { elements: { a: { id: "a" }, ab: { id: "ab" } }, diagrams: { d1: { id: "d1" } } };
  const uit = hernoemBotsendeIds(model, state, "T");
  assert.deepEqual(Object.keys(uit.elements).sort(), ["b", "impT_a", "impT_ab"].sort());
  assert.equal(uit.elements.impT_ab.source, "impT_a");
  assert.equal(uit.elements.impT_ab.target, "b");
  const d = uit.diagrams.impT_d1;
  assert.ok(d, "diagram hernoemd");
  assert.equal(d.id, "impT_d1");
  assert.deepEqual(d.nodes.map((n) => n.elementId), ["impT_a", "b"]);
  assert.deepEqual(d.verborgenConnectoren, ["impT_ab"]);
  assert.deepEqual(Object.keys(d.connectorVoorkomens), ["impT_ab"]);
  assert.equal(uit.hernoemd, 3);
  assert.equal(uit.eersteDiagramId, "impT_d1");
});
