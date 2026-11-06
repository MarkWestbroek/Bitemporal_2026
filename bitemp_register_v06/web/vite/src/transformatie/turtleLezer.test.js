// turtleLezer.test.js — de Turtle-lezer (RDF 1.1 Turtle) en de kleine RdfGraaf.
// De lezer is ook vergeleken met rdflib (isomorfe grafen) op de ODRL-testbestanden
// en de W3C-vocabulaire ODRL22.ttl (2157 triples); zie plan "Linked data als M2" §3.
// Run: node --import ./test/register-aliases.mjs --test src/transformatie/turtleLezer.test.js

import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

import { leesTurtle, RdfGraaf, TurtleFout, RDF, XSD } from "./turtleLezer.js";

const hier = path.dirname(fileURLToPath(import.meta.url));
const LD = path.resolve(hier, "../../../../model-exchange/linked-data");
const EX = "http://voorbeeld.org/ns#";

const iri = (w) => ({ type: "iri", waarde: w });
const tekstVan = (t) => (t.type === "literal" ? `"${t.waarde}"${t.taal ? `@${t.taal}` : `^^${t.datatype}`}` : t.waarde);

test("prefixen, a, ; en , geven de verwachte triples", () => {
  const { triples, prefixen } = leesTurtle(`
    @prefix ex: <${EX}> .
    PREFIX x: <http://x/>
    ex:a a ex:Ding ; ex:p ex:b , ex:c ;; .
  `);
  assert.deepEqual(prefixen, { ex: EX, x: "http://x/" });
  assert.deepEqual(
    triples.map((t) => [t.s.waarde, t.p.waarde, t.o.waarde]),
    [
      [`${EX}a`, `${RDF}type`, `${EX}Ding`],
      [`${EX}a`, `${EX}p`, `${EX}b`],
      [`${EX}a`, `${EX}p`, `${EX}c`],
    ]
  );
});

test("literals: strings, taal, datatype, getallen, booleans, escapes", () => {
  const { triples } = leesTurtle(`
    @prefix ex: <${EX}> .
    @prefix xsd: <${XSD}> .
    ex:s ex:p "a\\tb\\u00e9", 'en'@en-GB, """twee
regels "met" quotes""", "2026-11-07"^^xsd:date, 1, -2.5, 3e2, true .
  `);
  assert.deepEqual(triples.map((t) => tekstVan(t.o)), [
    `"a\tbé"^^${XSD}string`,
    `"en"@en-GB`,
    `"twee\nregels "met" quotes"^^${XSD}string`,
    `"2026-11-07"^^${XSD}date`,
    `"1"^^${XSD}integer`,
    `"-2.5"^^${XSD}decimal`,
    `"3e2"^^${XSD}double`,
    `"true"^^${XSD}boolean`,
  ]);
});

test("lege knopen en collecties", () => {
  const { triples } = leesTurtle(`
    @prefix ex: <${EX}> .
    ex:s ex:p [ ex:q 1 ] ; ex:lijst ( ex:a ex:b ) ; ex:leeg () .
    _:x ex:p _:x .
    [ ex:alleen 1 ] .
  `);
  const g = new RdfGraaf(triples, { ex: EX });
  const s = iri(`${EX}s`);
  const blank = g.object(s, `${EX}p`);
  assert.equal(blank.type, "blank");
  assert.equal(g.object(blank, `${EX}q`).waarde, "1");
  assert.deepEqual(g.lijst(g.object(s, `${EX}lijst`)).map((t) => t.waarde), [`${EX}a`, `${EX}b`]);
  assert.deepEqual(g.lijst(g.object(s, `${EX}leeg`)), []);
  assert.ok(triples.some((t) => t.s.waarde === "_:x" && t.o.waarde === "_:x"));
  assert.ok(triples.some((t) => t.p.waarde === `${EX}alleen`));
});

test("basis-IRI en relatieve IRI's", () => {
  const { triples } = leesTurtle(`@base <http://v.org/a/doc> . <x> <#f> <../y> . <> <#f> <> .`);
  assert.deepEqual(triples[0].s, iri("http://v.org/a/x"));
  assert.deepEqual(triples[0].p, iri("http://v.org/a/doc#f"));
  assert.deepEqual(triples[0].o, iri("http://v.org/y"));
  assert.deepEqual(triples[1].s, iri("http://v.org/a/doc"));
});

test("prefixnamen met punt, escape en %XX; punt als einde van de triple", () => {
  const { triples } = leesTurtle(`@prefix ex: <${EX}> . ex:a.b ex:p ex:met\\-streep , ex:%41 , ex:c.`);
  assert.deepEqual(triples.map((t) => t.o.waarde), [`${EX}met-streep`, `${EX}%41`, `${EX}c`]);
  assert.equal(triples[0].s.waarde, `${EX}a.b`);
});

test("fouten melden regel en kolom", () => {
  assert.throws(() => leesTurtle("ex:a ex:b ex:c ."), (e) => e instanceof TurtleFout && /onbekende prefix "ex:"/.test(e.message) && e.regel === 1);
  assert.throws(() => leesTurtle(`@prefix ex: <${EX}> .\nex:a ex:b "open`), (e) => e instanceof TurtleFout && /string zonder einde/.test(e.message) && e.regel === 2);
  assert.throws(() => leesTurtle(`@prefix ex: <${EX}> .\nex:a ex:b ex:c`), /"\." verwacht/);
});

test("RdfGraaf: compact en fragment", () => {
  const { triples, prefixen } = leesTurtle(`
    @prefix ex: <${EX}> .
    @prefix sh: <http://www.w3.org/ns/shacl#> .
    ex:s sh:xone ( [ sh:path ex:a ; sh:minCount 1 ] [ sh:path ex:b ; sh:minCount 1 ] ) .
  `);
  const g = new RdfGraaf(triples, prefixen);
  assert.equal(g.compact(`${EX}a`), "ex:a");
  assert.equal(g.compact("http://elders.org/x"), "<http://elders.org/x>");
  const xone = g.object(iri(`${EX}s`), "http://www.w3.org/ns/shacl#xone");
  assert.equal(g.fragment(xone), "( [ sh:path ex:a ; sh:minCount 1 ] [ sh:path ex:b ; sh:minCount 1 ] )");
});

test("de testbestanden in model-exchange/linked-data zijn te lezen (aantallen = rdflib)", () => {
  for (const [bestand, aantal] of [
    ["odrl22-kern.shacl.ttl", 303],
    ["odrl22-kern.goed.ttl", 73],
    ["odrl22-kern.fout.ttl", 72],
  ]) {
    const { triples } = leesTurtle(readFileSync(path.join(LD, bestand), "utf8"));
    assert.equal(triples.length, aantal, bestand);
  }
});
