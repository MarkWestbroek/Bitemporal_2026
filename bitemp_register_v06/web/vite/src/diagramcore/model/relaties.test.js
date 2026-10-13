// relaties.test.js — relatiepaneel en "relaties mee terug" (2026-10-13).
import test from "node:test";
import assert from "node:assert/strict";
import { relatiesVan, verborgenRelatiesVan } from "./relaties.js";

const types = {
  actor: { id: "actor" }, usecase: { id: "usecase" },
  associatie: { id: "associatie", label: "Associatie", isConnector: true },
  generalisatie: { id: "generalisatie", label: "Generalisatie", isConnector: true },
};
const elements = {
  act: { id: "act", naam: "Klant", elementType: "actor" },
  u1: { id: "u1", naam: "Zet issue door", elementType: "usecase" },
  u2: { id: "u2", naam: "Naar collega", elementType: "usecase" },
  u3: { id: "u3", naam: "Elders", elementType: "usecase" },
  as: { id: "as", naam: "", elementType: "associatie", source: "act", target: "u1" },
  ge: { id: "ge", naam: "", elementType: "generalisatie", source: "u2", target: "u1" },
  as2: { id: "as2", naam: "bel", elementType: "associatie", source: "act", target: "u3" },
};
const diagram = { nodes: [{ elementId: "act" }, { elementId: "u1" }, { elementId: "u2" }], verborgenConnectoren: ["ge"] };

test("relatiesVan: richting, ander uiteinde en stand op het diagram", () => {
  assert.deepEqual(
    relatiesVan("u1", elements, diagram, types).map((r) => [r.typeLabel, r.richting, r.anderNaam, r.stand]),
    [["Associatie", "in", "Klant", "zichtbaar"], ["Generalisatie", "in", "Naar collega", "verborgen"]]
  );
  const klant = relatiesVan("act", elements, diagram, types);
  assert.deepEqual(klant.map((r) => [r.id, r.richting, r.stand]), [["as", "uit", "zichtbaar"], ["as2", "uit", "buiten"]]);
  assert.equal(klant[1].naam, "bel");
});

test("relatiesVan: element niet op het diagram → alles 'buiten'; geen connectoren → leeg", () => {
  assert.ok(relatiesVan("u3", elements, diagram, types).every((r) => r.stand === "buiten"));
  assert.deepEqual(relatiesVan("u1", elements, diagram, {}), []);
});

test("verborgenRelatiesVan: alleen verborgen verbindingen die het element raken", () => {
  assert.deepEqual(verborgenRelatiesVan(diagram, elements, "u1"), ["ge"]);
  assert.deepEqual(verborgenRelatiesVan(diagram, elements, "act"), []);
  assert.deepEqual(verborgenRelatiesVan({}, elements, "u1"), []);
});
