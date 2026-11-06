// subtypeTijdlijn.test.js — een subtype heeft geen eigen tijdlijn (besluit Mark 06-11, via BACKEND;
// CODEGEN.md §7.3d): materieel en tijdprecisie uit in de inspector, een waarschuwing, en niet in
// de V3-export.
import test from "node:test";
import assert from "node:assert/strict";

import { canoniekUmlDiagramType, supertypeVan } from "./index.js";
import { naarCanoniekModel } from "./adapter.js";
import { storeNaarV3Model } from "../../store/adapters.js";
import { valideerElement } from "../../diagramcore/model/validatie.js";

const ent = (id, naam, data = {}) => ({ id, naam, elementType: "entiteit", compartimenten: [], data });
const elements = {
  A: ent("A", "Aanvraag", { materieel: true }),
  G: ent("G", "GpkAanvraag", { materieel: true, tijdprecisie: "tijdstip" }),
  g: { id: "g", naam: "", elementType: "generalisatie", source: "G", target: "A", compartimenten: [], data: {} },
};
const entType = canoniekUmlDiagramType.elementTypes.find((t) => t.id === "entiteit");

test("supertypeVan: de ouder via de generalisatie; de ouder zelf heeft er geen", () => {
  assert.equal(supertypeVan(elements.G, elements)?.naam, "Aanvraag");
  assert.equal(supertypeVan(elements.A, elements), null);
});

test("eigenschapUit: materieel en tijdprecisie uit bij het subtype, met de ouder in de reden; niet bij de ouder", () => {
  const uit = entType.hooks.eigenschapUit;
  assert.match(uit(elements.G, "materieel", { elements }), /Aanvraag/);
  assert.match(uit(elements.G, "tijdprecisie", { elements }), /Aanvraag/);
  assert.equal(uit(elements.G, "kleur", { elements }), null);
  assert.equal(uit(elements.A, "materieel", { elements }), null);
});

test("modelcontrole waarschuwt bij materieel op een subtype", () => {
  const meldingen = valideerElement(entType, elements.G, { elements });
  assert.ok(meldingen.some((m) => /subtype/.test(m.tekst)), JSON.stringify(meldingen));
  assert.ok(!valideerElement(entType, elements.A, { elements }).some((m) => /subtype/.test(m.tekst)));
});

test("V3-export: geen isMaterieel/tijdprecisie op het subtype; de ouder houdt ze", () => {
  const uit = storeNaarV3Model(naarCanoniekModel({ elements, diagrams: {} }));
  const v3 = uit.model || uit;
  const g = v3.entiteiten.find((e) => e.typenaam === "GpkAanvraag");
  const a = v3.entiteiten.find((e) => e.typenaam === "Aanvraag");
  assert.equal(g.erft, "Aanvraag");
  assert.ok(!g.isMaterieel, "subtype niet materieel");
  assert.equal(g.tijdprecisie, undefined);
  assert.equal(a.isMaterieel, true);
});
