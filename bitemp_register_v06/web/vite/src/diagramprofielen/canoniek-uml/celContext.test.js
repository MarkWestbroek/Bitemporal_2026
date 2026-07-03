// celContext.test.js — familie-context voor de CEL-editor (0.5-model).
// Run: npm test  (vanuit web/vite/; node --test)

import test from "node:test";
import assert from "node:assert/strict";

import { berekenCelContextVelden } from "./celContext.js";

const elements = {
  NP: {
    id: "NP",
    naam: "NatuurlijkPersoon",
    elementType: "entiteit",
    compartimenten: [
      { compartmentType: "afgeleid", velden: [{ naam: "weergavenaam", fieldType: "afgeleidVeld", data: { typeLabel: "string" } }] },
    ],
  },
  Naam: {
    id: "Naam",
    naam: "Naam",
    elementType: "gegevenselement",
    compartimenten: [
      {
        compartmentType: "velden",
        velden: [
          { naam: "roepnaam", fieldType: "attribuut", data: { typeLabel: "string" } },
          { naam: "achternaam", fieldType: "attribuut", data: { typeLabel: "string" } },
        ],
      },
    ],
  },
  Adres: {
    id: "Adres",
    naam: "Adres",
    elementType: "gegevenselement",
    compartimenten: [
      { compartmentType: "velden", velden: [{ naam: "postcode", fieldType: "attribuut", data: { typeLabel: "NLPostcode" } }] },
    ],
  },
  // Gematerialiseerde connector (fase 2-vorm)
  c1: { id: "c1", naam: "", elementType: "compositie", source: "NP", target: "Adres", data: {} },
};

const diagrams = {
  d1: {
    id: "d1",
    nodes: [],
    // Gespiegelde presentatie-edge met ruit (fase 1-adaptervorm)
    edges: [{ id: "e1", source: "NP", target: "Naam", data: { presentatie: { markerStart: "ruit" } } }],
  },
};

test("entiteit ziet eigen velden + GE-velden als GE.veld (beide compositie-bronnen)", () => {
  const ctx = berekenCelContextVelden(elements, diagrams, "NP");
  const paden = ctx.map((v) => v.pad);
  assert.ok(paden.includes("weergavenaam"), "eigen afgeleid veld");
  assert.ok(paden.includes("Naam.roepnaam"), "via presentatie-edge (ruit)");
  assert.ok(paden.includes("Adres.postcode"), "via connector-element");
  assert.equal(ctx.find((v) => v.pad === "Adres.postcode").type, "NLPostcode");
});

test("gegevenselement ziet parent-velden en sibling-velden, niet zichzelf dubbel", () => {
  const ctx = berekenCelContextVelden(elements, diagrams, "Naam");
  const paden = ctx.map((v) => v.pad);
  assert.ok(paden.includes("roepnaam"), "eigen veld simpel pad");
  assert.ok(paden.includes("weergavenaam"), "parent-entiteit velden");
  assert.ok(paden.includes("Adres.postcode"), "sibling-GE");
  assert.ok(!paden.includes("Naam.roepnaam"), "eigen velden niet ook geprefixt");
});
