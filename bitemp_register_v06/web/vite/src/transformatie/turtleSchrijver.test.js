// turtleSchrijver.test.js — de schrijver: plan → triples → Turtle.
// Run: node --import ./test/register-aliases.mjs --test src/transformatie/turtleSchrijver.test.js

import test from "node:test";
import assert from "node:assert/strict";

import { planNaarTriples, triplesNaarTurtle, schrijfTurtle } from "./turtleSchrijver.js";

const context = {
  prefixes: { odrl: "http://www.w3.org/ns/odrl/2/", rdfs: "http://www.w3.org/2000/01/rdf-schema#", dct: "http://purl.org/dc/terms/", xsd: "http://www.w3.org/2001/XMLSchema#", ex: "https://voorbeeld.example/term/", b: "https://voorbeeld.example/beleid/" },
  basis: "b",
  taal: "nl",
  naam: { standaard: "rdfs:label", perType: { "odrl:Permission": "dct:title" } },
  predicaten: {
    "dct:description": { soort: "tekst" },
    "dct:issued": { soort: "datum" },
    "odrl:operator": { soort: "iri" },
    "odrl:or": { soort: "lijst" },
  },
  secties: [
    { titel: "Regels", types: ["odrl:Permission"], iri: "^b:hulp-" },
    { titel: "Voorwaarden", types: ["odrl:Constraint", "odrl:LogicalConstraint"] },
  ],
};

const element = (sleutel, type, naam, data = {}) => ({ sleutel, type, naam, data });
const connector = (type, bron, doel) => ({ sleutel: `${type}:${bron}>${doel}`, type, bron, doel, naam: "", data: {} });
const objecten = (triples, s, p) => triples.filter((t) => t.s === s && t.p === p).map((t) => t.o);

test("schrijver: het type is een klasse, de naam volgt het type, data-sleutels zijn predicaten", () => {
  const { triples } = planNaarTriples(
    { elementen: [element("regel-1", "odrl:Permission", "inzage", { "dct:description": "Een zin.", "dct:issued": "2026-10-05" }), element("ex:begintMet", "odrl:Operator", "begint met")], connectoren: [] },
    context
  );
  assert.deepEqual(objecten(triples, "b:regel-1", "a"), [{ soort: "iri", waarde: "odrl:Permission" }]);
  assert.deepEqual(objecten(triples, "b:regel-1", "dct:title"), [{ soort: "literal", waarde: "inzage", taal: "nl" }]);
  assert.deepEqual(objecten(triples, "b:regel-1", "dct:description"), [{ soort: "literal", waarde: "Een zin.", taal: "nl" }]);
  assert.deepEqual(objecten(triples, "b:regel-1", "dct:issued"), [{ soort: "literal", waarde: "2026-10-05", datatype: "xsd:date" }]);
  // Een sleutel met een bekende prefix houdt die; de naam valt terug op de standaard.
  assert.deepEqual(objecten(triples, "ex:begintMet", "rdfs:label"), [{ soort: "literal", waarde: "begint met", taal: "nl" }]);
});

test("schrijver: getypeerde waarden — getal, boolean, iri, tekst, letterlijk, datum, zelf en lijsten", () => {
  const data = {
    getal: 2024,
    waar: true,
    verwijzing: { iri: "odrl:purpose" },
    lokaal: { iri: "doel-x" },
    tekst: { tekst: "hallo", taal: "en" },
    kaal: { letterlijk: 'met "aanhalingstekens" en # erin' },
    dag: { datum: "2026-05-01" },
    "odrl:uid": { zelf: true },
    meer: [{ letterlijk: "a" }, 2, { iri: "ex:b" }],
    "odrl:operator": "odrl:eq, ex:begintMet",
    leeg: "",
    niets: undefined,
    vreemd: { onbekend: 1 },
  };
  const { triples, diagnostics } = planNaarTriples({ elementen: [element("v", "odrl:Constraint", "", data)], connectoren: [] }, context);
  const o = (p) => objecten(triples, "b:v", p);
  assert.deepEqual(o("getal"), [{ soort: "kaal", waarde: "2024" }]);
  assert.deepEqual(o("waar"), [{ soort: "kaal", waarde: "true" }]);
  assert.deepEqual(o("verwijzing"), [{ soort: "iri", waarde: "odrl:purpose" }]);
  assert.deepEqual(o("lokaal"), [{ soort: "iri", waarde: "b:doel-x" }], "zonder prefix: een plan-element");
  assert.deepEqual(o("tekst"), [{ soort: "literal", waarde: "hallo", taal: "en" }]);
  assert.deepEqual(o("kaal"), [{ soort: "literal", waarde: 'met "aanhalingstekens" en # erin' }], "geen ingebedde notatie, dus niets te ontsnappen");
  assert.deepEqual(o("dag"), [{ soort: "literal", waarde: "2026-05-01", datatype: "xsd:date" }]);
  assert.deepEqual(o("odrl:uid"), [{ soort: "iri", waarde: "b:v" }]);
  assert.deepEqual(o("meer"), [{ soort: "literal", waarde: "a" }, { soort: "kaal", waarde: "2" }, { soort: "iri", waarde: "ex:b" }]);
  assert.deepEqual(o("odrl:operator"), [{ soort: "iri", waarde: "odrl:eq" }, { soort: "iri", waarde: "ex:begintMet" }], "iri-tekst: meer waarden met komma's");
  assert.deepEqual([o("leeg"), o("niets"), o("vreemd")], [[], [], []], "lege waarden worden niet geschreven");
  assert.equal(o("naam").length, 0, "zonder naam geen label");
  assert.deepEqual(diagnostics.map((d) => d.code), ["TTL-WAARDE"]);
});

test("schrijver: connectoren zijn triples; een lijst-predicaat wordt één RDF-lijst in planvolgorde", () => {
  const plan = {
    elementen: [element("g", "odrl:LogicalConstraint", "ten minste één"), element("c", "odrl:Constraint", "c"), element("a", "odrl:Constraint", "a"), element("b", "odrl:Constraint", "b"), element("r", "odrl:Permission", "r")],
    connectoren: [connector("odrl:or", "g", "c"), connector("odrl:or", "g", "a"), connector("odrl:or", "g", "b"), connector("odrl:constraint", "r", "g"), connector("odrl:constraint", "r", "a"), connector("odrl:constraint", "r", "weg")],
  };
  const { triples } = planNaarTriples(plan, context);
  assert.deepEqual(objecten(triples, "b:g", "odrl:or"), [{ soort: "lijst", leden: ["b:c", "b:a", "b:b"] }], "volgorde van het plan, niet alfabetisch");
  assert.deepEqual(objecten(triples, "b:r", "odrl:constraint").map((o) => o.waarde), ["b:g", "b:a"], "een connector naar een onbekend element valt weg");
  const tekst = triplesNaarTurtle(triples, context);
  assert.match(tekst, /b:g a odrl:LogicalConstraint ;\n {4}rdfs:label "ten minste één"@nl ;\n {4}odrl:or \( b:c b:a b:b \) \./);
  assert.match(tekst, /odrl:constraint b:g , b:a \./);
});

test("schrijver: extra klassen horen bij het type; secties volgen het eerste type of een IRI-patroon", () => {
  const plan = {
    elementen: [
      element("v", "odrl:Constraint", "v", { "rdf:type": { iri: "ex:Maatregel" } }),
      element("hulp-1", "odrl:Action", "", { "rdf:value": { iri: "odrl:read" } }),
      element("r", "odrl:Permission", "r"),
      element("los", "ex:Iets", "los"),
    ],
    connectoren: [connector("rdf:type", "r", "v")],
  };
  const { tekst } = schrijfTurtle(plan, context, { kop: "# kop" });
  assert.match(tekst, /^# kop\n\n@prefix odrl: {3}<http:\/\/www\.w3\.org\/ns\/odrl\/2\/> \./);
  assert.match(tekst, /b:v a odrl:Constraint , ex:Maatregel ;/);
  assert.match(tekst, /b:r a odrl:Permission , b:v ;/, "ook een rdf:type-connector wordt een type");
  const plek = (stuk) => tekst.indexOf(stuk);
  assert.ok(plek("# ── Regels") < plek("b:hulp-1 a odrl:Action") && plek("b:hulp-1 a odrl:Action") < plek("b:r a odrl:Permission"), "hulpknoop in de sectie Regels, in planvolgorde");
  assert.ok(plek("b:r a odrl:Permission") < plek("# ── Voorwaarden") && plek("# ── Voorwaarden") < plek("b:v a odrl:Constraint"));
  assert.ok(plek("b:v a odrl:Constraint") < plek("b:los a ex:Iets"), "wat nergens bij hoort komt achteraan, zonder kop");
});

test("schrijver: dezelfde invoer geeft dezelfde tekst, en vreemde tekens in een sleutel worden veilig", () => {
  const plan = { elementen: [element("vw: een (rare) sleutel!", "odrl:Constraint", 'met "quotes"\nen een nieuwe regel')], connectoren: [] };
  const een = schrijfTurtle(plan, context).tekst;
  assert.equal(een, schrijfTurtle(structuredClone(plan), context).tekst);
  assert.match(een, /b:vw--een--rare--sleutel- a odrl:Constraint ;\n {4}rdfs:label "met \\"quotes\\"\\nen een nieuwe regel"@nl \./);
});
