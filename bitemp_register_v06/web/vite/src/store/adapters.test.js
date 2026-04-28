// adapters.test.js — tests voor domein-filter en merge helpers.
// Run: node --test src/store/adapters.test.js  (vanuit web/vite/)

import test from "node:test";
import assert from "node:assert/strict";

import { filterStoreByDomein, mergeStoreDomein } from "./adapters.js";

// === filterStoreByDomein ==============================================

test("filterStoreByDomein: alleen elementen van opgegeven domein", () => {
  const store = {
    elements: {
      a: { typenaam: "A", domein: "kern" },
      b: { typenaam: "B", domein: "uitbreiding" },
      c: { typenaam: "C", domein: "kern" },
    },
    structuralEdges: [],
    diagrams: {},
    domains: ["kern", "uitbreiding"],
    domainMeta: { kern: { kleur: "#fff" }, uitbreiding: {} },
  };
  const out = filterStoreByDomein(store, "kern");
  assert.deepEqual(Object.keys(out.elements).sort(), ["a", "c"]);
  assert.deepEqual(out.domains, ["kern"]);
  assert.equal(out.domainMeta.kern.kleur, "#fff");
});

test("filterStoreByDomein: structuralEdges blijven alleen als beide kanten in domein", () => {
  const store = {
    elements: {
      a: { typenaam: "A", domein: "kern" },
      b: { typenaam: "B", domein: "kern" },
      c: { typenaam: "C", domein: "ander" },
    },
    structuralEdges: [
      { source: "a", target: "b", soort: "compositie" },
      { source: "a", target: "c", soort: "compositie" }, // cross-domein
    ],
  };
  const out = filterStoreByDomein(store, "kern");
  assert.equal(out.structuralEdges.length, 1);
  assert.equal(out.structuralEdges[0].target, "b");
});

test("filterStoreByDomein: diagrammen worden gefilterd op domein", () => {
  const store = {
    elements: {},
    structuralEdges: [],
    diagrams: {
      d1: { naam: "Klassen kern", domein: "kern" },
      d2: { naam: "Klassen ander", domein: "ander" },
    },
  };
  const out = filterStoreByDomein(store, "kern");
  assert.deepEqual(Object.keys(out.diagrams), ["d1"]);
});

test("filterStoreByDomein: lege store geeft lege resultaten", () => {
  const out = filterStoreByDomein({}, "kern");
  assert.deepEqual(out.elements, {});
  assert.deepEqual(out.structuralEdges, []);
  assert.deepEqual(out.diagrams, {});
});

test("filterStoreByDomein: lege domein-string filtert elementen met empty domein", () => {
  const store = {
    elements: {
      a: { typenaam: "A", domein: "" },
      b: { typenaam: "B", domein: "kern" },
    },
  };
  const out = filterStoreByDomein(store, "");
  assert.deepEqual(Object.keys(out.elements), ["a"]);
});

// === mergeStoreDomein =================================================

test("mergeStoreDomein: vervangt elementen van het domein, behoudt andere", () => {
  const bestaand = {
    elements: {
      a: { typenaam: "A", domein: "kern" },
      b: { typenaam: "B", domein: "kern" },
      c: { typenaam: "C", domein: "ander" },
    },
    structuralEdges: [],
  };
  const nieuw = {
    elements: {
      a2: { typenaam: "A2", domein: "kern" },
    },
    structuralEdges: [],
    diagrams: {},
    domains: ["kern"],
    domainMeta: {},
  };
  const out = mergeStoreDomein(bestaand, nieuw, "kern");
  assert.deepEqual(Object.keys(out.elements).sort(), ["a2", "c"]);
});

test("mergeStoreDomein: oude edges in andere domeinen blijven", () => {
  const bestaand = {
    elements: {
      a: { typenaam: "A", domein: "kern" },
      x: { typenaam: "X", domein: "ander" },
      y: { typenaam: "Y", domein: "ander" },
    },
    structuralEdges: [
      { source: "x", target: "y", soort: "compositie" }, // ander - blijft
      { source: "a", target: "a", soort: "self" },        // kern - weg
    ],
  };
  const nieuw = {
    elements: { a2: { typenaam: "A2", domein: "kern" } },
    structuralEdges: [],
  };
  const out = mergeStoreDomein(bestaand, nieuw, "kern");
  assert.equal(out.structuralEdges.length, 1);
  assert.equal(out.structuralEdges[0].source, "x");
});

test("mergeStoreDomein: nieuwe edges worden toegevoegd, mits beide kanten bestaan", () => {
  const bestaand = {
    elements: { x: { typenaam: "X", domein: "ander" } },
    structuralEdges: [],
  };
  const nieuw = {
    elements: {
      a: { typenaam: "A", domein: "kern" },
      b: { typenaam: "B", domein: "kern" },
    },
    structuralEdges: [
      { source: "a", target: "b", soort: "compositie" },     // OK
      { source: "a", target: "ghost", soort: "compositie" }, // ghost ontbreekt → wordt overgeslagen
    ],
  };
  const out = mergeStoreDomein(bestaand, nieuw, "kern");
  assert.equal(out.structuralEdges.length, 1);
  assert.equal(out.structuralEdges[0].target, "b");
});

test("mergeStoreDomein: domainMeta wordt samengevoegd", () => {
  const bestaand = { elements: {}, structuralEdges: [], domainMeta: { kern: { v: 1 } } };
  const nieuw = { elements: {}, structuralEdges: [], domainMeta: { uitbreiding: { v: 2 } } };
  const out = mergeStoreDomein(bestaand, nieuw, "uitbreiding");
  assert.equal(out.domainMeta.kern.v, 1);
  assert.equal(out.domainMeta.uitbreiding.v, 2);
});

test("mergeStoreDomein: domains-set is uniek na merge", () => {
  const bestaand = { elements: {}, structuralEdges: [], domains: ["kern", "ander"] };
  const nieuw = { elements: {}, structuralEdges: [], domains: ["ander", "nieuw"] };
  const out = mergeStoreDomein(bestaand, nieuw, "ander");
  assert.deepEqual(out.domains.sort(), ["ander", "kern", "nieuw"]);
});

test("mergeStoreDomein: diagrammen van vervangen domein worden vervangen", () => {
  const bestaand = {
    elements: {},
    structuralEdges: [],
    diagrams: {
      d1: { naam: "oud", domein: "kern" },
      d2: { naam: "behouden", domein: "ander" },
    },
  };
  const nieuw = {
    elements: {},
    structuralEdges: [],
    diagrams: { d3: { naam: "nieuw", domein: "kern" } },
  };
  const out = mergeStoreDomein(bestaand, nieuw, "kern");
  assert.deepEqual(Object.keys(out.diagrams).sort(), ["d2", "d3"]);
});

test("mergeStoreDomein: modelMeta blijft van bestaande state", () => {
  const bestaand = { elements: {}, structuralEdges: [], modelMeta: { versie: 5 } };
  const nieuw = { elements: {}, structuralEdges: [], modelMeta: { versie: 99 } };
  const out = mergeStoreDomein(bestaand, nieuw, "kern");
  assert.equal(out.modelMeta.versie, 5);
});
