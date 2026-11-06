import { test } from "node:test";
import assert from "node:assert/strict";
import { volgDiagram, bouwHierarchie } from "./boomRegels.js";

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

// ── bouwHierarchie (fase 0 "Linked data als M2" §8, 06-11) ──────────────

const rel = (id, type, source, target) => ({ id, elementType: type, source, target });

test("bouwHierarchie: de boomouder is de eerste in vaste volgorde (connector-id), niet de laatste", () => {
  const els = {
    A: { id: "A" }, B: { id: "B" }, K: { id: "K" },
    // In elementvolgorde komt B eerst, maar de relatie naar A heeft het kleinere id.
    r2: rel("r2", "breder", "K", "B"),
    r1: rel("r1", "breder", "K", "A"),
  };
  const { ouderVan, kinderenVan } = bouwHierarchie(els, [{ type: "breder", omgekeerd: true }]);
  assert.equal(ouderVan.get("K"), "A");
  // De weergave blijft onder beide ouders (OAS/GraphQL gebruiken de hiërarchie als graaf).
  assert.deepEqual(kinderenVan.get("A"), ["K"]);
  assert.deepEqual(kinderenVan.get("B"), ["K"]);
  // Dezelfde uitkomst bij een andere elementvolgorde (andere client).
  const omgedraaid = Object.fromEntries(Object.entries(els).reverse());
  assert.equal(bouwHierarchie(omgedraaid, [{ type: "breder", omgekeerd: true }]).ouderVan.get("K"), "A");
});

test("bouwHierarchie: relaties gaan vóór de paren van de hook; een kring wordt overgeslagen en gemeld", () => {
  const els = { P: { id: "P" }, Q: { id: "Q" }, X: { id: "X" }, b1: rel("b1", "bevat", "P", "X") };
  const { ouderVan } = bouwHierarchie(els, "bevat", [["Q", "X"]]);
  assert.equal(ouderVan.get("X"), "P");

  const kring = { A: { id: "A" }, B: { id: "B" }, r1: rel("r1", "bevat", "A", "B"), r2: rel("r2", "bevat", "B", "A") };
  const uit = bouwHierarchie(kring, ["bevat"]);
  assert.equal(uit.ouderVan.get("B"), "A");
  assert.equal(uit.ouderVan.has("A"), false, "de sluitende kant van de kring telt niet");
  assert.deepEqual(uit.kringen, [["B", "A"]]);
});

test("bouwHierarchie: zonder hierarchie leeg; onbekende uiteinden tellen niet", () => {
  assert.equal(bouwHierarchie({ a: rel("a", "bevat", "X", "Y") }, undefined).ouderVan.size, 0);
  assert.equal(bouwHierarchie({ a: rel("a", "bevat", "X", "Y") }, "bevat").ouderVan.size, 0);
});
