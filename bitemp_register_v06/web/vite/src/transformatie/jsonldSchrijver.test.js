// jsonldSchrijver.test.js — JSON-LD als tweede schrijfvorm van dezelfde triples als de Turtle.
// Run: node --import ./test/register-aliases.mjs --test src/transformatie/jsonldSchrijver.test.js

import test from "node:test";
import assert from "node:assert/strict";

import { triplesNaarJsonLd, jsonLdNaarTriples, schrijfJsonLd } from "./jsonldSchrijver.js";
import { planNaarTriples } from "./turtleSchrijver.js";
import { leesTurtle, RdfGraaf } from "./turtleLezer.js";
import { toegangsspraakNaarOdrl, odrlContext } from "../toegangsspraak/odrlExport.js";
import { VOORBEELDEN, VOLLEDIG_BELEID } from "../toegangsspraak/fixtures/voorbeelden.js";

const CONTEXT = { prefixes: { ex: "https://example.org/", xsd: "http://www.w3.org/2001/XMLSchema#" }, basis: "ex", taal: "nl", predicaten: { "ex:op": { soort: "datum" }, "ex:leden": { soort: "lijst" }, "ex:ziet": { soort: "iri" } } };

test("elke soort waarde krijgt haar JSON-LD-vorm", () => {
  const plan = {
    elementen: [
      { sleutel: "a", type: "ex:Ding", naam: "Een ding", data: { "ex:aantal": 3, "ex:waar": true, "ex:op": "2026-05-01", "ex:kaal": "tekst", "ex:ziet": "ex:b, ex:c", "rdf:type": { iri: "ex:Ander" } } },
      { sleutel: "b", type: "ex:Ding", naam: "", data: {} },
      { sleutel: "c", type: "ex:Ding", naam: "", data: {} },
    ],
    connectoren: [
      { sleutel: "1", type: "ex:leden", bron: "a", doel: "b" },
      { sleutel: "2", type: "ex:leden", bron: "a", doel: "c" },
    ],
  };
  const { document, tekst } = schrijfJsonLd(plan, CONTEXT);
  assert.deepEqual(document["@context"], CONTEXT.prefixes);
  assert.deepEqual(document["@graph"][0], {
    "@id": "ex:a",
    "@type": ["ex:Ding", "ex:Ander"],
    "rdfs:label": { "@value": "Een ding", "@language": "nl" },
    "ex:aantal": 3,
    "ex:waar": true,
    "ex:op": { "@value": "2026-05-01", "@type": "xsd:date" },
    "ex:kaal": "tekst",
    "ex:ziet": [{ "@id": "ex:b" }, { "@id": "ex:c" }],
    "ex:leden": { "@list": [{ "@id": "ex:b" }, { "@id": "ex:c" }] },
  });
  // Eén type is geen lijst.
  assert.equal(document["@graph"][1]["@type"], "ex:Ding");
  assert.deepEqual(JSON.parse(tekst), document);
});

test("heen en terug: de JSON-LD draagt precies de triples van de Turtle-schrijver", () => {
  for (const [naam, beleid] of Object.entries({ ...VOORBEELDEN, volledig: VOLLEDIG_BELEID })) {
    const uit = toegangsspraakNaarOdrl(beleid, { uitgegeven: "2026-10-05" });
    const context = odrlContext({ beleidSlug: "x" });
    const { triples } = planNaarTriples(uit.plan, context);
    // De markering voor de meerregelige schrijfwijze van Turtle hoort niet bij de inhoud.
    const kaal = (lijst) => lijst.map((t) => JSON.stringify({ s: t.s, p: t.p, o: { ...t.o, lang: undefined } })).sort();
    assert.deepEqual(kaal(jsonLdNaarTriples(triplesNaarJsonLd(triples, context))), kaal(triples), naam);
    // En de export geeft beide vormen uit dezelfde triples: evenveel als de Turtle-lezer telt.
    const gelezen = leesTurtle(uit.turtle).triples;
    const g = new RdfGraaf(gelezen);
    const zonderLijstknopen = gelezen.filter((t) => !(t.s.type === "blank" && g.isLijst(t.s))).length;
    assert.equal(jsonLdNaarTriples(uit.jsonld).length, zonderLijstknopen, `${naam}: evenveel triples in Turtle en JSON-LD`);
  }
});
