// projectMetamodel.test.js — het projectmetamodel (projectMetamodel.js) loopt gelijk met de code en
// met echte werkbestanden (plan 2026-11-15 §5, stap 2). Faalt hij: beschrijf de sleutel in
// projectMetamodel.js (en draai `npm run metamodellen`).
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { PROJECT_KLASSEN, PROJECT_ENUMERATIES, PROJECT_PAKKETTEN } from "./projectMetamodel.js";
import { PROJECT_FORMAAT, PROJECT_FORMAAT_VERSIE } from "./activities/projectSync.js";
import { UUID_SOORTEN } from "../diagramprofielen/canoniek-uml/uuids.js";

const SRC = fileURLToPath(new URL("..", import.meta.url));
const REPO = fileURLToPath(new URL("../../../../", import.meta.url));
const klasse = (naam) => PROJECT_KLASSEN.find((k) => k.naam === naam);
const namen = (naam) => new Set(klasse(naam).eigenschappen.map((e) => e.naam));

/** Echte werkbestanden: het voorbeeld van formaat 4 (OMNIUM-UI), de architectuur, de metamodellen. */
const WERKBESTANDEN = [
  path.join(SRC, "studio/metamodellen/fixtures/werkbestand-formaat-4.json"),
  path.join(REPO, "docs/architectuur/omnium-architectuur.studio-project.json"),
  path.join(REPO, "docs/metamodel/omnium-m3.studio-project.json"),
  path.join(REPO, "docs/metamodel/omnium-projectmetamodel.studio-project.json"),
];

/** Per metaklasse de objecten uit een werkbestand die er een voorkomen van zijn. */
function voorkomens(w) {
  const uit = {};
  const voeg = (k, o) => o && typeof o === "object" && !Array.isArray(o) && (uit[k] ||= []).push(o);
  voeg("Werkbestand", w);
  voeg("Project", w.project);
  voeg("Structuur", w.structuur);
  for (const m of Object.values(w.structuur?.mappen || {})) voeg("Map", m);
  for (const b of Object.values(w.structuur?.bundels || {})) {
    voeg("Bundel", b);
    for (const t of b.tabs || []) voeg("DiagramRef", t);
  }
  for (const k of w.kruisverbanden || []) {
    voeg("Kruisverband", k);
    voeg("ElementRef", k.rij);
    voeg("ElementRef", k.kolom);
  }
  for (const s of w.koppelsoorten || []) voeg("Koppelsoort", s);
  for (const p of Object.values(w.profielen || {})) {
    voeg("ProfielInhoud", p);
    for (const el of Object.values(p.elements || {})) {
      voeg("Element", el);
      for (const c of el.compartimenten || []) {
        voeg("Compartiment", c);
        for (const v of c.velden || []) voeg("Veld", v);
      }
    }
    for (const d of Object.values(p.diagrams || {})) {
      voeg("Diagram", d);
      for (const n of d.nodes || []) {
        voeg("DiagramNode", n);
        voeg("Punt", n.position);
        voeg("Maat", n.size);
      }
      for (const e of d.edges || []) voeg("DiagramEdge", e);
      for (const l of Object.values(d.lijnen || {})) voeg("Lijn", l);
      for (const c of Object.values(d.connectorVoorkomens || {})) voeg("VoorkomenPaar", c);
    }
  }
  return uit;
}

test("de formaatversie en het formaat zijn die van de code", () => {
  const w = klasse("Werkbestand").eigenschappen;
  assert.equal(w.find((e) => e.naam === "versie").standaard, String(PROJECT_FORMAAT_VERSIE));
  assert.equal(w.find((e) => e.naam === "formaat").standaard, PROJECT_FORMAAT);
});

test("elke sleutel in echte werkbestanden is beschreven", () => {
  const ontbreekt = new Set();
  for (const f of WERKBESTANDEN) {
    const w = JSON.parse(fs.readFileSync(f, "utf8"));
    for (const [k, lijst] of Object.entries(voorkomens(w))) {
      const bekend = namen(k);
      for (const o of lijst) for (const s of Object.keys(o)) if (!bekend.has(s)) ontbreekt.add(`${k}.${s} (${path.basename(f)})`);
    }
  }
  assert.deepEqual([...ontbreekt], []);
});

test("elke beschreven sleutel komt in de code voor (niets verzonnen of vergeten)", () => {
  const code = [];
  const lees = (map) => {
    for (const f of fs.readdirSync(map, { withFileTypes: true })) {
      const p = path.join(map, f.name);
      if (f.isDirectory()) lees(p);
      else if (/\.(js|jsx)$/.test(f.name) && !/\.test\.js$/.test(f.name) && !p.endsWith("projectMetamodel.js")) code.push(fs.readFileSync(p, "utf8"));
    }
  };
  lees(SRC);
  const alles = code.join("\n");
  const nergens = PROJECT_KLASSEN.flatMap((k) => k.eigenschappen.map((e) => e.naam).filter((n) => !new RegExp(`\\b${n}\\b`).test(alles)).map((n) => `${k.naam}.${n}`));
  assert.deepEqual(nergens, []);
});

test("vorm: typen bestaan, namen uniek, elke klasse in een pakket", () => {
  const pakketten = new Set(PROJECT_PAKKETTEN.map((p) => p.naam));
  const alle = [...PROJECT_KLASSEN, ...PROJECT_ENUMERATIES];
  assert.equal(new Set(alle.map((k) => k.naam)).size, alle.length);
  for (const k of alle) assert.ok(pakketten.has(k.pakket), k.naam);
  for (const k of PROJECT_KLASSEN) {
    assert.equal(new Set(k.eigenschappen.map((e) => e.naam)).size, k.eigenschappen.length, `${k.naam}: dubbel`);
    for (const e of k.eigenschappen) {
      assert.ok(["string", "boolean", "number", "any"].includes(e.type) || alle.some((x) => x.naam === e.type), `${k.naam}.${e.naam}: ${e.type}`);
    }
  }
});

test("formaat 4: UuidSoort = UUID_SOORTEN, en het voorbeeldbestand houdt zich aan de eis", () => {
  assert.deepEqual(PROJECT_ENUMERATIES.find((e) => e.naam === "UuidSoort").waarden, [...UUID_SOORTEN]);
  const w = JSON.parse(fs.readFileSync(WERKBESTANDEN[0], "utf8"));
  assert.equal(w.versie, 4);
  const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-5[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
  let geteld = 0;
  for (const p of Object.values(w.profielen)) {
    if (p.diagramTypeId !== "canoniek-uml") continue;
    for (const el of Object.values(p.elements)) {
      if (UUID_SOORTEN.has(el.elementType)) {
        assert.match(el.data?.uuid || "", UUID, `${el.id}: uuid`);
        geteld++;
      }
      for (const c of el.compartimenten || []) {
        if (c.compartmentType !== "velden") continue;
        for (const v of c.velden || []) if (v.naam) { assert.match(v.data?.uuid || "", UUID, `${el.id}.${v.naam}: uuid`); geteld++; }
      }
    }
  }
  assert.ok(geteld >= 4, "het voorbeeld heeft uuid's om te toetsen");
});
