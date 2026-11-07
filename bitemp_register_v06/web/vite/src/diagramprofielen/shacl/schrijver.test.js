// schrijver.test.js — fase 2 van "Linked data als M2": het SHACL-model terug naar Turtle. De
// rondreis is semantisch (dezelfde graaf); hier vergeleken met een vingerafdruk per triple waarin
// lege knopen hun inhoud dragen. Buiten de tests is ze ook met rdflib gecontroleerd (isomorf voor
// de drie testbestanden, ODRL22.ttl en het oude collega-bestand).
// Run: node --import ./test/register-aliases.mjs --test src/diagramprofielen/shacl/schrijver.test.js

import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

import { vanTurtle, lintTurtle } from "./adapter.js";
import { naarTurtle, splitsBovenaan, leesPrefixen } from "./schrijver.js";
import { padNaarTurtle, padNaarTekst, PadFout } from "./pad.js";
import { maakElement } from "./index.js";
import { leesTurtle, RdfGraaf, termSleutel } from "../../transformatie/turtleLezer.js";

const hier = path.dirname(fileURLToPath(import.meta.url));
const LD = path.resolve(hier, "../../../../../model-exchange/linked-data");
const lees = (b) => readFileSync(path.join(LD, b), "utf8");

/** Vingerafdruk van een graaf: elke triple met een niet-lege subject, lege knopen uitgeschreven. */
function vingerafdruk(tekst) {
  const { triples } = leesTurtle(tekst);
  const g = new RdfGraaf(triples);
  const sig = (t, pad = new Set()) => {
    if (t.type !== "blank") return termSleutel(t);
    if (pad.has(t.waarde)) return "↺";
    const binnen = new Set(pad).add(t.waarde);
    return `[${g.van(t).map((tr) => `${tr.p.waarde} ${sig(tr.o, binnen)}`).sort().join("; ")}]`;
  };
  const uit = [];
  for (const tr of triples) {
    if (tr.s.type !== "blank") uit.push(`${termSleutel(tr.s)} ${tr.p.waarde} ${sig(tr.o)}`);
    else if (g.verwijzingen(tr.s) === 0) uit.push(sig(tr.s));
  }
  return [...new Set(uit)].sort();
}

const rondreis = (tekst) => naarTurtle(vanTurtle(tekst));

test("pad-tekst → sh:path en terug", () => {
  assert.equal(padNaarTurtle("ex:a"), "ex:a");
  assert.equal(padNaarTurtle("ex:a/ex:b"), "( ex:a ex:b )");
  assert.equal(padNaarTurtle("ex:a|ex:b|ex:c"), "[ sh:alternativePath ( ex:a ex:b ex:c ) ]");
  assert.equal(padNaarTurtle("^ex:a"), "[ sh:inversePath ex:a ]");
  assert.equal(padNaarTurtle("(ex:a/ex:b)*"), "[ sh:zeroOrMorePath ( ex:a ex:b ) ]");
  assert.equal(padNaarTurtle("(^ex:a)+"), "[ sh:oneOrMorePath [ sh:inversePath ex:a ] ]");
  assert.equal(padNaarTurtle("a"), "<http://www.w3.org/1999/02/22-rdf-syntax-ns#type>");
  assert.throws(() => padNaarTurtle("ex:a|"), PadFout);
  assert.throws(() => padNaarTurtle("(ex:a"), PadFout);
  // Tekst → Turtle → tekst is gelijk (ook de haakjes rond (^a)+).
  for (const pad of ["ex:a", "ex:a/ex:b", "ex:a|^ex:b", "(ex:a/ex:b)*", "(^ex:a)+", "^ex:a*", "(ex:a|ex:b)/ex:c"]) {
    const { triples, prefixen } = leesTurtle(`@prefix sh: <http://www.w3.org/ns/shacl#> . @prefix ex: <urn:ex:> . <urn:s> sh:path ${padNaarTurtle(pad)} .`);
    const g = new RdfGraaf(triples, prefixen);
    assert.equal(padNaarTekst(g, g.object({ type: "iri", waarde: "urn:s" }, "http://www.w3.org/ns/shacl#path")).tekst, pad);
  }
});

test("rondreis: de ODRL-testbestanden geven dezelfde graaf", () => {
  for (const b of ["odrl22-kern.shacl.ttl", "odrl22-kern.goed.ttl", "odrl22-kern.fout.ttl"]) {
    const { tekst, meldingen } = rondreis(lees(b));
    assert.deepEqual(meldingen, [], b);
    assert.deepEqual(vingerafdruk(tekst), vingerafdruk(lees(b)), b);
  }
});

test("rondreis: taal, rdfs:label, klasse-shape, losse triples en een kring van lege knopen", () => {
  const bron = `
    @prefix sh: <http://www.w3.org/ns/shacl#> .
    @prefix rdfs: <http://www.w3.org/2000/01/rdf-schema#> .
    @prefix ex: <http://voorbeeld.org/ns#> .
    ex:Persoon a sh:NodeShape, rdfs:Class ; rdfs:label "Persoon"@nl ; rdfs:comment "Een mens."@nl ;
      sh:closed true ; sh:ignoredProperties ( rdfs:label ) ;
      sh:property [ sh:path ex:naam ; sh:name "naam"@nl ; sh:datatype <http://www.w3.org/2001/XMLSchema#string> ;
                    sh:minCount 1 ; sh:pattern "^[A-Z]" ; sh:in ( "A" "B" ) ; sh:order 1.5 ] ;
      sh:property ex:LeeftijdShape .
    ex:LeeftijdShape a sh:PropertyShape ; sh:path ex:leeftijd ; sh:minInclusive 0 ; sh:hasValue "x"@en .
    ex:Los sh:targetClass ex:Persoon ; sh:path ex:email ; sh:maxCount 1 .
    _:x ex:p _:y . _:y ex:p _:x .
    ex:iets ex:heeft [ ex:diep ( 1 2 ) ] .
  `;
  const { tekst, meldingen } = rondreis(bron);
  assert.deepEqual(meldingen, []);
  assert.deepEqual(vingerafdruk(tekst), vingerafdruk(bron));
});

test("bewerken in de Studio: hernoemen houdt de IRI, een nieuwe shape krijgt er een", () => {
  const m = vanTurtle(lees("odrl22-kern.shacl.ttl"));
  const els = structuredClone(m.elements);
  els.ns_ok_PartyShape.naam = "Partij";
  const nieuw = maakElement("nodeshape");
  nieuw.naam = "Verzoek";
  nieuw.data.doelklassen = "odrl:Request";
  nieuw.compartimenten = [{ compartmentType: "eigenschappen", velden: [{ naam: "odrl:assignee", fieldType: "eigenschap", data: { klasse: "odrl:Party", minCount: 1 } }] }];
  els[nieuw.id] = nieuw;
  const { tekst, meldingen } = naarTurtle({ elements: els });
  assert.deepEqual(meldingen, []);
  assert.match(tekst, /ok:PartyShape\n {4}a sh:NodeShape ;\n {4}rdfs:label "Partij" ;/);
  assert.match(tekst, /ok:Verzoek\n {4}a sh:NodeShape ;\n {4}sh:targetClass odrl:Request ;\n {4}sh:property \[\n {8}sh:path odrl:assignee ;\n {8}sh:class odrl:Party ;\n {8}sh:minCount 1\n {4}\] \./);
  // Weer inlezen: de nieuwe shape is er, met een pijl naar Party.
  const terug = vanTurtle(tekst);
  assert.ok(Object.values(terug.elements).some((e) => e.elementType === "verwijzing" && e.source === "ns_ok_Verzoek" && e.target === "ns_ok_PartyShape"));
});

test("wat niet te schrijven is geeft een melding met de plek; de uitvoer blijft geldig", () => {
  const m = vanTurtle(lees("odrl22-kern.shacl.ttl"));
  const els = structuredClone(m.elements);
  const regel = els.ns_ok_ConstraintShape.compartimenten[0].velden[0];
  regel.data.overig = "sh:kapot (";
  els.ns_ok_RuleShape.compartimenten[0].velden[0].naam = "odrl:uid|";
  els.los = { id: "los", naam: "", elementType: "constraint", compartimenten: [], data: { specificatie: "iets", taal: "" } };
  const xone = Object.values(els).find((e) => e.elementType === "constraint" && e.data.taal === "SHACL");
  xone.data.taal = "";
  const { tekst, meldingen } = naarTurtle({ elements: els });
  assert.doesNotThrow(() => leesTurtle(tekst));
  const berichten = meldingen.map((x) => x.bericht).join("\n");
  assert.match(berichten, /Node shape Constraint → odrl:leftOperand \(overig\): niet te lezen als Turtle/);
  assert.match(berichten, /Node shape Rule → odrl:uid\|: pad "odrl:uid\|"/);
  assert.match(berichten, /in natuurlijke taal; niet als SHACL te schrijven/);
  assert.match(berichten, /hangt aan geen shape/);
});

test("sh:or van klassen gaat terug als sh:or; de lint draait ook op de uitvoer", () => {
  const { tekst } = rondreis(lees("odrl22-kern.shacl.ttl"));
  assert.match(tekst, /sh:or \( \[ sh:class odrl:Constraint \] \[ sh:class odrl:LogicalConstraint \] \)/);
  assert.deepEqual(lintTurtle(tekst), []);
});

test("hulpjes: komma's op het hoogste niveau en prefixen uit de shapes graph", () => {
  assert.deepEqual(splitsBovenaan('ex:a, [ ex:p "x, y" ], ( ex:b, ex:c )'), ["ex:a", '[ ex:p "x, y" ]', "( ex:b, ex:c )"]);
  assert.deepEqual(leesPrefixen("sh: <http://www.w3.org/ns/shacl#>\n: <urn:leeg#>\n@prefix ex: <urn:ex#> ."), {
    sh: "http://www.w3.org/ns/shacl#",
    "": "urn:leeg#",
    ex: "urn:ex#",
  });
});
