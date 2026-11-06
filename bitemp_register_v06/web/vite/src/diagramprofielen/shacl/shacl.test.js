// shacl.test.js — het SHACL-profiel (M2): descriptor, pad als tekst, de import
// (Turtle → model), de afleiding (regelweergave en pijlen) en de lint (plan
// "Linked data als M2" §11).
// Run: node --import ./test/register-aliases.mjs --test src/diagramprofielen/shacl/shacl.test.js

import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

import { registreerShacl, shaclDiagramType, maakElement, SHACL_ID } from "./index.js";
import { getDiagramType, valideerDiagramType } from "../../diagramcore/types/typeRegistry.js";
import { vanTurtle, meldingenAlsTekst, ontInspring } from "./adapter.js";
import { leidAf, kardinaliteit, regelWeergave } from "./afleiding.js";
import { padNaarTekst } from "./pad.js";
import { leesTurtle, RdfGraaf } from "../../transformatie/turtleLezer.js";

const hier = path.dirname(fileURLToPath(import.meta.url));
const LD = path.resolve(hier, "../../../../../model-exchange/linked-data");
const lees = (b) => readFileSync(path.join(LD, b), "utf8");

const KOP = `
@prefix sh: <http://www.w3.org/ns/shacl#> .
@prefix rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#> .
@prefix xsd: <http://www.w3.org/2001/XMLSchema#> .
@prefix ex: <http://voorbeeld.org/ns#> .
`;
const codes = (m) => m.meldingen.map((x) => x.code).filter(Boolean).sort();
const regels = (el) => (el.compartimenten || []).flatMap((c) => c.velden || []);
const pijlen = (els) => Object.values(els).filter((e) => e.elementType === "verwijzing");

test("descriptor is geldig en registreert zich", () => {
  assert.deepEqual(valideerDiagramType(shaclDiagramType), []);
  registreerShacl();
  assert.equal(getDiagramType(SHACL_ID)?.id, SHACL_ID);
  assert.equal(maakElement("nodeshape").elementType, "nodeshape");
  assert.equal(maakElement("verwijzing"), null);
});

test("pad als tekst: reeks, alternatief, invers en herhaling", () => {
  const { triples, prefixen } = leesTurtle(`${KOP}
    ex:s ex:p1 ( ex:a ex:b ) ;
         ex:p2 [ sh:alternativePath ( ex:a [ sh:inversePath ex:b ] ) ] ;
         ex:p3 [ sh:zeroOrMorePath ( ex:a ex:b ) ] ;
         ex:p4 ( ex:a ) .`);
  const g = new RdfGraaf(triples, prefixen);
  const s = { type: "iri", waarde: "http://voorbeeld.org/ns#s" };
  const pad = (p) => padNaarTekst(g, g.object(s, `http://voorbeeld.org/ns#${p}`))?.tekst ?? null;
  assert.equal(pad("p1"), "ex:a/ex:b");
  assert.equal(pad("p2"), "ex:a|^ex:b");
  assert.equal(pad("p3"), "(ex:a/ex:b)*");
  assert.equal(pad("p4"), null); // een reeks van één lid is geen geldig pad
});

test("kardinaliteit: ontbreken = 0..*, niet de UML-standaard 1", () => {
  assert.equal(kardinaliteit(undefined, undefined), "0..*");
  assert.equal(kardinaliteit(1, 1), "1");
  assert.equal(kardinaliteit(1, undefined), "1..*");
  assert.equal(kardinaliteit(undefined, 1), "0..1");
  assert.equal(regelWeergave({ datatype: "xsd:string", minCount: 1, pattern: "^[0-9]{4}$" }), "xsd:string [1..*] {pattern ^[0-9]{4}$}");
});

test("import van de ODRL 2.2-kern: shapes, regels, pijlen, constraints, geen meldingen", () => {
  const m = vanTurtle(lees("odrl22-kern.shacl.ttl"), { bestandsnaam: "odrl22-kern.shacl.ttl" });
  assert.deepEqual(m.meldingen, []);
  const els = m.elements;
  const shapes = Object.values(els).filter((e) => e.elementType === "nodeshape");
  assert.equal(shapes.length, 14);

  const policy = els.ns_ok_PolicyShape;
  assert.equal(policy.naam, "Policy");
  assert.equal(policy.data.iri, "ok:PolicyShape");
  assert.equal(policy.data.doelklassen, "odrl:Policy, odrl:Set, odrl:Offer, odrl:Agreement");
  // sh:order bepaalt de volgorde; het alternatieve pad wordt a|b|c.
  assert.deepEqual(regels(policy).slice(0, 2).map((r) => `${r.naam} : ${r.data.typeLabel}`), [
    "odrl:uid : IRI [1]",
    "odrl:permission|odrl:prohibition|odrl:obligation : [1..*]",
  ]);
  assert.match(regels(policy).at(-1).data.typeLabel, /^\[0\.\.\*\] \{in \( odrl:perm odrl:prohibit o…, Warning\}$/);

  // sh:or van alleen sh:class: korte vorm, twee pijlen met {or}.
  const constraint = regels(els.ns_ok_RuleShape).find((r) => r.naam === "odrl:constraint");
  assert.equal(constraint.data.klasse, "odrl:Constraint | odrl:LogicalConstraint");
  const naarConstraint = pijlen(els).filter((p) => p.source === "ns_ok_RuleShape" && p.data.rolnaam === "odrl:constraint");
  assert.deepEqual(naarConstraint.map((p) => p.target).sort(), ["ns_ok_ConstraintShape", "ns_ok_LogicalConstraintShape"]);
  assert.ok(naarConstraint.every((p) => p.data.of));

  // De meest specifieke shape wint: odrl:Duty → DutyShape, niet RuleShape.
  const obligation = pijlen(els).find((p) => p.source === "ns_ok_PolicyShape" && p.data.rolnaam === "odrl:obligation");
  assert.equal(obligation.target, "ns_ok_DutyShape");

  // Klassen zonder shape worden een klasse-element.
  assert.deepEqual(Object.values(els).filter((e) => e.elementType === "klasse").map((e) => e.naam).sort(), ["odrl:LeftOperand", "odrl:Operator"]);

  // Node-niveau: sh:xone en sh:sparql als constraint met body en taal, met een annotatie-lijn.
  const xone = Object.values(els).find((e) => e.elementType === "constraint" && e.data.taal === "SHACL" && /odrl:rightOperand/.test(e.data.specificatie));
  assert.match(xone.data.specificatie, /^sh:xone \( \[ sh:path odrl:rightOperand ; sh:minCount 1 \]/);
  const sparql = Object.values(els).find((e) => e.elementType === "constraint" && e.data.taal === "SPARQL");
  assert.equal(sparql.data.specificatie, "SELECT $this WHERE {\n    $this odrl:inheritFrom+ $this .\n}");
  assert.ok(Object.values(els).some((e) => e.elementType === "notitielijn" && e.source === sparql.id && e.target === "ns_ok_PolicyShape"));

  // De shapes graph draagt titel, prefixen en sh:declare.
  const graaf = els.shapesgraaf;
  assert.equal(graaf.naam, "ODRL 2.2 — kern van het informatiemodel (testbestand)");
  assert.match(graaf.data.prefixen, /^sh: <http:\/\/www\.w3\.org\/ns\/shacl#>$/m);
  assert.match(graaf.data.declaraties, /sh:prefix "odrl"/);
  assert.equal(graaf.data.overig, undefined); // niets bleef over

  // Elk knoop-element staat op het diagram.
  const knopen = Object.values(els).filter((e) => !e.source);
  assert.equal(m.diagrams.shapes.nodes.length, knopen.length);
});

test("afleiding volgt een wijziging en is idempotent", () => {
  const m = vanTurtle(lees("odrl22-kern.shacl.ttl"));
  assert.equal(leidAf(m.elements), null);
  // Verander het doel van Permission.target van odrl:Asset naar odrl:Party.
  const els = structuredClone(m.elements);
  const regel = regels(els.ns_ok_PermissionShape).find((r) => r.naam === "odrl:target");
  regel.data.klasse = "odrl:Party";
  regel.data.maxCount = undefined;
  const na = leidAf(els);
  const pijl = pijlen(na).find((p) => p.source === "ns_ok_PermissionShape" && p.data.rolnaam === "odrl:target");
  assert.equal(pijl.target, "ns_ok_PartyShape");
  assert.equal(pijl.data.kardinaliteit, "1..*");
  assert.equal(regels(na.ns_ok_PermissionShape).find((r) => r.naam === "odrl:target").data.typeLabel, "odrl:Party [1..*]");
  assert.equal(leidAf(na), null);
  // Via de hook van het profiel.
  assert.equal(shaclDiagramType.hooks.migreerModel({ elements: na, diagrams: {}, meta: {} }), null);
});

test("lint: de valkuilen van §11", () => {
  const m = vanTurtle(`${KOP}
    ex:Seq a sh:NodeShape ; sh:targetClass ex:A ;
      sh:property [ sh:path ( ex:p ex:q ) ; sh:minCount 1 ] .
    ex:Of a sh:NodeShape ; sh:targetClass ex:B ;
      sh:or ( [ sh:path ex:x ] [ sh:path ex:y ] ) .
    ex:Sparql a sh:SPARQLConstraint ; sh:targetClass ex:C ;
      sh:select "SELECT $this WHERE { $this ex:p ?x . }" .
    ex:Kapot a sh:NodeShape ; sh:targetClass ex:D ;
      sh:sparql [ sh:select """SELECT $this WHERE { $this onbekend:p ?x . """ ] .
    ex:Typen a sh:NodeShape ; sh:targetClass ex:E ;
      sh:property [ sh:path rdf:type ; sh:in ( ex:Oud ) ] .
    ex:Tik a sh:NodeShape ; sh:targetClass ex:F ;
      sh:property [ sh:path ex:z ; sh:minCont 1 ] .
    ex:Wees a sh:NodeShape ; sh:property [ sh:path ex:w ; sh:minCount 1 ] .
    ex:Een a sh:NodeShape ; sh:targetNode ex:iemand .
    ex:ZonderPad a sh:NodeShape ; sh:targetClass ex:G ; sh:property [ sh:minCount 1 ] .
  `);
  assert.deepEqual(codes(m), [
    "geen-pad",
    "in-op-type",
    "lid-zonder-voorwaarde",
    "onbekend-predicaat",
    "reekspad",
    "shape-zonder-doel",
    "sparql-geen-shape",
    "sparql-prefix", // ex:Sparql: ex: niet gedeclareerd (geen sh:prefixes)
    "sparql-prefix", // ex:Kapot: onbekend:
    "sparql-syntax",
    "targetnode",
  ]);
  // Een melding hangt aan de shape, zodat de Studio ernaar kan wijzen.
  assert.equal(m.meldingen.find((x) => x.code === "reekspad").elementId, "ns_ex_Seq");
  assert.match(meldingenAlsTekst(m.meldingen), /^✖/);
  // Wat niet getekend kan worden blijft bewaard: de tikfout staat in "overig" van de regel.
  assert.match(regels(m.elements.ns_ex_Tik)[0].data.overig, /sh:minCont 1/);
});

test("een goed SPARQL-blok met prefixen uit sh:declare geeft geen melding", () => {
  const m = vanTurtle(`${KOP}
    ex: sh:declare [ sh:prefix "ex" ; sh:namespace "http://voorbeeld.org/ns#"^^xsd:anyURI ] .
    ex:S a sh:NodeShape ; sh:targetClass ex:A ;
      sh:sparql [ sh:prefixes ex: ; sh:select "SELECT $this WHERE { $this ex:p+ $this . FILTER (?x != \\"a:b\\") }" ] .
  `);
  assert.deepEqual(codes(m), []);
});

test("een bestand zonder shapes (OWL/SKOS) bewaart alles in de shapes graph", () => {
  const m = vanTurtle(lees("odrl22-kern.goed.ttl"));
  assert.ok(m.meldingen.some((x) => /Geen enkele shape/.test(x.bericht)));
  assert.match(m.elements.shapesgraaf.data.losseTriples, /odrl:Agreement/);
});

test("ontInspring haalt de gemeenschappelijke inspringing weg", () => {
  assert.equal(ontInspring("\n    SELECT\n      x\n    "), "SELECT\n  x");
});
