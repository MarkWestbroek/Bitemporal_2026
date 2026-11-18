// metamodellen.test.js — de alleen-lezen metamodellen (plan 2026-11-15, stap 3).
// Faalt "actueel": draai `npm run metamodellen` (web/vite) en commit docs/metamodel/.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { fileURLToPath } from "node:url";

import { metamodelWerkbestand, elementId, PROFIEL_ID } from "./metamodelWerkbestand.js";
import { genereerMetamodellen, METAMODEL_BESTANDEN, tekenaarMaat } from "./genereer.js";
import { M3_KLASSEN } from "../../diagramcore/types/m3.js";
import { normaliseerProjectData } from "../activities/projectSync.js";

const SCHEMA = fs.readFileSync(fileURLToPath(new URL("../../diagramcore/types/schema.js", import.meta.url)), "utf8");
const bestand = (naam) => fileURLToPath(new URL(`../../../../../docs/metamodel/${naam}`, import.meta.url));

/** Een klein metamodel: twee pakketten, een klasse met een deel, een datatype, een enumeratie. */
const KLEIN = {
  id: "klein",
  naam: "Klein",
  pakketten: [{ naam: "A" }, { naam: "B" }],
  klassen: [
    {
      naam: "Geheel",
      pakket: "A",
      soort: "klasse",
      uitleg: "het geheel",
      eigenschappen: [
        { naam: "id", type: "string", kard: "1" },
        { naam: "delen", type: "Deel", kard: "*", samenstelling: true, uitleg: "de delen" },
        { naam: "ander", type: "Ander", kard: "0..1" },
        { naam: "maat", type: "Maat", kard: "0..1" },
        { naam: "soort", type: "Soort", kard: "1" },
        { naam: "teken", type: "any", kard: "1", operatie: true, params: "ctx", optioneel: true },
      ],
    },
    { naam: "Deel", pakket: "A", soort: "klasse", eigenschappen: [{ naam: "namen", type: "string", kard: "*", sleutel: "id" }] },
    { naam: "Ander", pakket: "B", soort: "klasse", eigenschappen: [] },
    { naam: "Maat", pakket: "A", soort: "datatype", eigenschappen: [{ naam: "w", type: "number", kard: "1" }] },
  ],
  enumeraties: [{ naam: "Soort", pakket: "B", waarden: ["x", "y"], uitlegPerWaarde: { x: "de x" } }],
};

test("afbeelding: klasse-naar-klasse wordt een associatie, de rest een attribuut", () => {
  const p = metamodelWerkbestand(KLEIN).profielen[PROFIEL_ID];
  const geheel = p.elements[elementId("Geheel")];
  const attr = geheel.compartimenten.find((c) => c.compartmentType === "attributen").velden;
  assert.deepEqual(attr.map((v) => [v.naam, v.data.typeLabel, v.data.kardinaliteit]), [
    ["id", "string", undefined],
    ["maat", "Maat", "0..1"],
    ["soort", "Soort", undefined],
  ]);
  const ops = geheel.compartimenten.find((c) => c.compartmentType === "operaties").velden;
  assert.deepEqual(ops.map((v) => [v.naam, v.data.typeLabel, v.data.beschrijving]), [["teken(ctx)", "any", "(optioneel)"]]);
  const lijnen = Object.values(p.elements).filter((e) => e.source && e.elementType !== "bevat");
  assert.deepEqual(lijnen.map((e) => [e.elementType, e.source, e.target, e.data.doelRolNaam, e.data.doelKardinaliteit]), [
    ["compositie", elementId("Geheel"), elementId("Deel"), "delen", "*"],
    ["associatie", elementId("Geheel"), elementId("Ander"), "ander", "0..1"],
  ]);
  assert.equal(lijnen[0].data.beschrijving, "de delen");
  // Map: sleutel → type; datatype en enumeratie; uitleg per literal.
  assert.equal(p.elements[elementId("Deel")].compartimenten[0].velden[0].data.typeLabel, "id → string");
  assert.equal(p.elements[elementId("Maat")].elementType, "datatype");
  assert.deepEqual(p.elements[elementId("Soort")].compartimenten[0].velden.map((v) => [v.naam, v.data.beschrijving]), [["x", "de x"], ["y", undefined]]);
  assert.equal(geheel.data.beschrijving, "het geheel");
});

test("structuur: pakket met bevat en een diagram eronder; vreemde uiteinden als kop, hun lijnen verborgen", () => {
  const w = metamodelWerkbestand(KLEIN);
  const p = w.profielen[PROFIEL_ID];
  assert.equal(w.versie, 4);
  assert.equal(w.structuur.plaatsing[`${PROFIEL_ID}::dg__A`], `el::${PROFIEL_ID}::pkg__A`);
  const bevat = Object.values(p.elements).filter((e) => e.elementType === "bevat").map((e) => [e.source, e.target]);
  assert.deepEqual(bevat, [["pkg__A", elementId("Geheel")], ["pkg__A", elementId("Deel")], ["pkg__A", elementId("Maat")], ["pkg__B", elementId("Ander")], ["pkg__B", elementId("Soort")]]);
  const a = p.diagrams.dg__A;
  assert.deepEqual(a.nodes.map((n) => [n.elementId, n.gedaante]), [[elementId("Geheel"), undefined], [elementId("Deel"), undefined], [elementId("Maat"), undefined], [elementId("Ander"), "kop"]]);
  assert.deepEqual(a.verborgenConnectoren, []);
  const b = p.diagrams.dg__B;
  assert.deepEqual(b.nodes.map((n) => [n.elementId, n.gedaante]), [[elementId("Ander"), undefined], [elementId("Soort"), undefined], [elementId("Geheel"), "kop"]]);
  // Gelaagd: het geheel boven zijn deel.
  const pos = Object.fromEntries(a.nodes.map((n) => [n.elementId, n.position]));
  assert.ok(pos[elementId("Geheel")].y < pos[elementId("Deel")].y);
  // Het werkbestand is een geldig project voor de Studio.
  assert.equal(normaliseerProjectData(w).data.versie, 4);
});

test("de layout van Mark blijft staan; alleen nieuwe voorkomens krijgen een plek", () => {
  const eerst = metamodelWerkbestand(KLEIN);
  const d = eerst.profielen[PROFIEL_ID].diagrams.dg__A;
  d.nodes[0].position = { x: 900, y: 700 };
  d.nodes[0].size.width = 400;
  d.verborgenConnectoren = ["as__Geheel__delen"];
  const meer = structuredClone(KLEIN);
  meer.klassen.push({ naam: "Nieuw", pakket: "A", soort: "klasse", eigenschappen: [] });
  const daarna = metamodelWerkbestand(meer, { vorige: eerst }).profielen[PROFIEL_ID].diagrams.dg__A;
  const n = (naam) => daarna.nodes.find((x) => x.elementId === elementId(naam));
  assert.deepEqual(n("Geheel").position, { x: 900, y: 700 });
  assert.equal(n("Geheel").size.width, 400);
  assert.deepEqual(n("Deel").position, d.nodes[1].position);
  // Nieuw: onder alles wat er stond.
  const onder = Math.max(...d.nodes.map((x) => x.position.y + x.size.height));
  assert.ok(n("Nieuw").position.y > onder);
  assert.deepEqual(daarna.verborgenConnectoren, ["as__Geheel__delen"]);
  // Zelfde invoer, zelfde uitvoer.
  assert.deepEqual(metamodelWerkbestand(meer, { vorige: eerst }), metamodelWerkbestand(meer, { vorige: eerst }));
});

test("tekenaarMaat: een doos is minstens zo breed als zijn langste regel", () => {
  const el = metamodelWerkbestand(KLEIN).profielen[PROFIEL_ID].elements[elementId("Geheel")];
  const vol = tekenaarMaat(el);
  const kop = tekenaarMaat(el, "kop");
  assert.ok(vol.w >= 180 && vol.h > kop.h);
});

test("het M3-model: elke metaklasse en enumeratie staat erin, in zijn pakket", () => {
  const w = JSON.parse(genereerMetamodellen({ schemaBron: SCHEMA }).m3);
  const p = w.profielen[PROFIEL_ID];
  for (const k of M3_KLASSEN) {
    const el = p.elements[elementId(k.naam)];
    assert.ok(el, k.naam);
    assert.ok(Object.values(p.elements).some((e) => e.elementType === "bevat" && e.target === el.id && e.source === `pkg__${k.pakket}`), `${k.naam} in ${k.pakket}`);
  }
  // Uitleg uit schema.js, bv. bij ElementType.erft.
  const erft = p.elements.as__ElementType__erft;
  assert.match(erft.data.beschrijving, /ouder-ElementType/);
});

test("actueel: docs/metamodel/ is gelijk aan wat de generator nu maakt (anders: npm run metamodellen)", () => {
  for (const [sleutel, naam] of Object.entries(METAMODEL_BESTANDEN)) {
    const tekst = fs.readFileSync(bestand(naam), "utf8");
    const nu = genereerMetamodellen({ schemaBron: SCHEMA, vorigen: { [sleutel]: JSON.parse(tekst) } })[sleutel];
    assert.equal(nu, tekst, `${naam} loopt achter: draai \`npm run metamodellen\` in web/vite`);
  }
});
