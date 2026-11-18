// m3.test.js — het M3 als gegevens (m3.js) loopt gelijk met de code (plan 2026-11-15 §5).
// Faalt deze test, dan is er een eigenschap aan een typedef in schema.js toegevoegd of
// weggehaald zonder m3.js bij te werken (of omgekeerd). Werk m3.js bij: pakket, type, kardinaliteit.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { fileURLToPath } from "node:url";

import { leesTypedefs, letterlijkeWaarden } from "./leesTypedefs.js";
import { M3_KLASSEN, M3_ENUMERATIES, M3_PAKKETTEN, PRIMITIEVEN, m3Klasse, m3Enumeratie } from "./m3.js";
import { handlersVan } from "./handlerCatalogus.js";

const SCHEMA = fs.readFileSync(fileURLToPath(new URL("./schema.js", import.meta.url)), "utf8");
const typedefs = leesTypedefs(SCHEMA);
const ondergrens = (kard) => (kard === "1" || kard.startsWith("1..") ? 1 : 0);

test("leesTypedefs: naam, optioneel, letterlijke waarden en vervolgregels", () => {
  const [t] = leesTypedefs(`/**
 * Iets — uitleg.
 *
 * @typedef {Object} Iets
 * @property {string} id
 * @property {"a"|"b"} [soort] - de soort,
 *   over twee regels
 * @property {{x: number}} [punt]
 */`);
  assert.equal(t.naam, "Iets");
  assert.equal(t.uitleg, "Iets — uitleg.");
  assert.deepEqual(t.eigenschappen.map((e) => [e.naam, e.optioneel]), [["id", false], ["soort", true], ["punt", true]]);
  assert.deepEqual(t.eigenschappen[1].letterlijk, ["a", "b"]);
  assert.equal(t.eigenschappen[1].uitleg, "de soort, over twee regels");
  assert.equal(t.eigenschappen[2].type, "{x: number}");
  assert.equal(letterlijkeWaarden(`"a"|string`), null);
});

test("elke typedef in schema.js is een metaklasse in m3.js, en omgekeerd", () => {
  const inSchema = typedefs.map((t) => t.naam).sort();
  const inM3 = M3_KLASSEN.filter((k) => k.typedef).map((k) => k.naam).sort();
  assert.deepEqual(inM3, inSchema);
  for (const t of typedefs) {
    const k = m3Klasse(t.naam);
    assert.equal(k.typedef === "functie", t.type !== "Object", `${t.naam}: functie-typedef ↔ typedef: "functie"`);
  }
});

test("per typedef: precies dezelfde eigenschappen, en optioneel ↔ ondergrens 0", () => {
  for (const t of typedefs.filter((t) => t.type === "Object")) {
    const k = m3Klasse(t.naam);
    const m3Namen = k.eigenschappen.map((e) => e.naam);
    const schemaNamen = t.eigenschappen.map((e) => e.naam);
    assert.equal(new Set(schemaNamen).size, schemaNamen.length, `${t.naam}: een eigenschap staat dubbel in schema.js`);
    assert.equal(new Set(m3Namen).size, m3Namen.length, `${t.naam}: een eigenschap staat dubbel in m3.js`);
    assert.deepEqual([...m3Namen].sort(), t.eigenschappen.map((e) => e.naam).sort(), `${t.naam}: eigenschappen schema.js ↔ m3.js`);
    for (const te of t.eigenschappen) {
      const me = k.eigenschappen.find((e) => e.naam === te.naam);
      if (me.operatie) assert.equal(!!me.optioneel, te.optioneel, `${t.naam}.${te.naam}: [optioneel] in schema.js ↔ optioneel op de operatie`);
      else assert.equal(ondergrens(me.kard), te.optioneel ? 0 : 1, `${t.naam}.${te.naam}: [optioneel] in schema.js ↔ kardinaliteit ${me.kard}`);
    }
  }
});

test("een type \"a\"|\"b\" in schema.js is een enumeratie met die waarden", () => {
  for (const t of typedefs) {
    for (const te of t.eigenschappen.filter((e) => e.letterlijk)) {
      const me = m3Klasse(t.naam).eigenschappen.find((e) => e.naam === te.naam);
      const en = m3Enumeratie(me.type);
      assert.ok(en, `${t.naam}.${te.naam}: type ${me.type} moet een enumeratie zijn`);
      assert.deepEqual([...en.waarden].sort(), [...te.letterlijk].sort(), `${t.naam}.${te.naam}: waarden van ${en.naam}`);
    }
  }
});

test("elk type bestaat, namen zijn uniek, elke metaklasse zit in een pakket", () => {
  const pakketten = new Set(M3_PAKKETTEN.map((p) => p.naam));
  const namen = [...M3_KLASSEN, ...M3_ENUMERATIES].map((k) => k.naam);
  assert.equal(new Set(namen).size, namen.length, "dubbele namen");
  for (const k of [...M3_KLASSEN, ...M3_ENUMERATIES]) assert.ok(pakketten.has(k.pakket), `${k.naam}: pakket ${k.pakket}`);
  for (const k of M3_KLASSEN) {
    if (!k.typedef) assert.ok(k.uitleg, `${k.naam}: zonder typedef is uitleg nodig`);
    for (const e of k.eigenschappen) {
      assert.ok(PRIMITIEVEN.includes(e.type) || m3Klasse(e.type) || m3Enumeratie(e.type), `${k.naam}.${e.naam}: onbekend type ${e.type}`);
      assert.match(e.kard, /^(1|0\.\.1|\*|1\.\.\*|0\.\.\d+)$/, `${k.naam}.${e.naam}: kardinaliteit`);
    }
  }
  for (const en of M3_ENUMERATIES) assert.ok(en.waarden.length, `${en.naam}: geen waarden`);
});

test("HookSoort = de hooks in de catalogus, met uitleg en een plek", () => {
  const hooks = handlersVan("hook");
  const soort = m3Enumeratie("HookSoort");
  assert.deepEqual(soort.waarden, hooks.map((h) => h.id));
  for (const h of hooks) {
    assert.ok(h.beschrijving, `hook ${h.id}: beschrijving`);
    assert.ok(!h.plek || ["DiagramType", "ElementType"].includes(h.plek), `hook ${h.id}: plek`);
  }
  // Beide metaklassen met hooks hebben de associatie naar Hook.
  for (const naam of ["DiagramType", "ElementType"]) assert.equal(m3Klasse(naam).eigenschappen.find((e) => e.naam === "hooks").type, "Hook");
});
