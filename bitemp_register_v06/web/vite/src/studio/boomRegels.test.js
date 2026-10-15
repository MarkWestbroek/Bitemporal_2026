import { test } from "node:test";
import assert from "node:assert/strict";
import { volgDiagram } from "./boomRegels.js";

const elements = {
  a: { id: "a", elementType: "actor" },
  u: { id: "u", elementType: "usecase" },
  k: { id: "k", elementType: "gegevenselement" }, // kind van ent
  ent: { id: "ent", elementType: "entiteit" },
  los: { id: "los", elementType: "usecase" },
  r: { id: "r", elementType: "associatie", source: "a", target: "u" },
};
const diagrams = {
  d1: { id: "d1", nodes: [{ elementId: "a" }, { elementId: "u" }, { elementId: "r" }] },
  d2: { id: "d2", nodes: [{ elementId: "u" }, { elementId: "k" }] },
  d3: { id: "d3", nodes: [{ elementId: "los" }] }, // niet geplaatst
};

test("volgDiagram: eerste geplaatste diagram in boomvolgorde wint; connectoren niet; top-voorouder bij hiërarchie", () => {
  const plaatsing = { "uc::d2": "m2", "uc::d1": "m1" };
  const uit = volgDiagram({ profielId: "uc", elements, diagrams, plaatsing, ouderVan: new Map([["k", "ent"]]) });
  assert.deepEqual(uit, { m2: ["el::uc::u", "el::uc::ent"], m1: ["el::uc::a"] });
});

test("volgDiagram: al geplaatst blijft staan; diagram zonder map telt niet", () => {
  const plaatsing = { "uc::d1": "m1", "el::uc::a": "elders" };
  assert.deepEqual(volgDiagram({ profielId: "uc", elements, diagrams, plaatsing }), { m1: ["el::uc::u"] });
  assert.deepEqual(volgDiagram({ profielId: "uc", elements, diagrams, plaatsing: {} }), {});
});

test("volgDiagram: diagramIds beperkt tot elementen op die diagrammen, de map komt van het eerste geplaatste", () => {
  const plaatsing = { "uc::d1": "m1", "uc::d2": "m2" };
  // u staat op d1 (eerder) én d2: gewijzigd d2 → u hoort in m1.
  assert.deepEqual(volgDiagram({ profielId: "uc", elements, diagrams, plaatsing, diagramIds: ["d2"] }), { m1: ["el::uc::u"], m2: ["el::uc::k"] });
  assert.deepEqual(volgDiagram({ profielId: "uc", elements, diagrams, plaatsing, diagramIds: ["d3"] }), {});
});
