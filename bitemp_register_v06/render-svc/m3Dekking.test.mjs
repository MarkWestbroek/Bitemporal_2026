// Het M3 dekt de echte profielen (plan 2026-11-15 §5): elke sleutel die een van de profielen in
// deze bundel gebruikt, is in web/vite/src/diagramcore/types/m3.js beschreven, en elke hook staat
// in de catalogus op de metaklasse waar het profiel hem zet. Hier in render-svc omdat alleen deze
// bundel alle profielen in Node laadt (JSX als stub). Faalt hij: beschrijf de sleutel in schema.js
// (typedef) én m3.js — de vite-test m3.test.js houdt die twee gelijk.
import { test } from "node:test";
import assert from "node:assert/strict";
import { profielIds, descriptorVan } from "./dist/studio-profielen.mjs";
import { m3Klasse, m3Enumeratie } from "../web/vite/src/diagramcore/types/m3.js";
import { handlersVan } from "../web/vite/src/diagramcore/types/handlerCatalogus.js";

/** Per metaklasse de objecten uit alle profielen waarin die metaklasse voorkomt. */
function voorkomens() {
  /** @type {Record<string, Array<[string, object]>>} */
  const uit = {};
  const voeg = (klasse, waar, obj) => {
    if (obj && typeof obj === "object" && !Array.isArray(obj)) (uit[klasse] ??= []).push([waar, obj]);
  };
  for (const pid of profielIds) {
    const d = descriptorVan(pid);
    voeg("DiagramType", pid, d);
    for (const ft of d.fieldTypes || []) {
      voeg("FieldType", `${pid}/${ft.id}`, ft);
      for (const p of ft.properties || []) voeg("PropertyType", `${pid}/${ft.id}.${p.key}`, p);
    }
    for (const rt of d.referenceTypes || []) voeg("ReferenceType", `${pid}/${rt.id}`, rt);
    for (const st of d.shapeTypes || []) voeg("ShapeType", `${pid}/${st.id}`, st);
    for (const ss of d.shapeSets || []) voeg("ShapeSet", `${pid}/${ss.id}`, ss);
    for (const l of d.layouts || []) voeg("LayoutStrategie", `${pid}/${l.id}`, l);
    for (const ls of d.layoutStijlen || []) {
      voeg("LayoutStijl", `${pid}/${ls.id}`, ls);
      for (const r of ls.regels || []) {
        voeg("LayoutRegel", `${pid}/${ls.id}`, r);
        voeg("LayoutSelector", `${pid}/${ls.id}`, r.selector);
        voeg("LayoutOpties", `${pid}/${ls.id}`, r.opties);
      }
      voeg("Afstanden", `${pid}/${ls.id}`, ls.afstanden);
    }
    for (const t of d.taakbalken || []) {
      voeg("TaskbarType", `${pid}/${t.id}`, t);
      if (Array.isArray(t.acties)) for (const a of t.acties) voeg("ActionType", `${pid}/${t.id}`, a);
    }
    for (const et of d.elementTypes || []) {
      const w = `${pid}/${et.id}`;
      voeg("ElementType", w, et);
      voeg("EdgePresentatie", w, et.edgePresentatie);
      voeg("RandElement", w, et.randElement);
      voeg("Samentrekking", w, et.samentrekking);
      voeg("Opname", w, et.opname);
      for (const p of et.properties || []) voeg("PropertyType", `${w}.${p.key}`, p);
      for (const c of et.compartments || []) voeg("CompartmentType", `${w}.${c.id}`, c);
      for (const ep of [et.bron, et.doel]) voeg("ConnectorEindpunt", w, ep);
      for (const r of et.verbindingsregels || []) voeg("Verbindingsregel", w, r);
    }
  }
  return uit;
}

test("elke sleutel van een profiel is in het M3 beschreven", () => {
  const ontbreekt = [];
  for (const [klasse, lijst] of Object.entries(voorkomens())) {
    const bekend = new Set(m3Klasse(klasse).eigenschappen.map((e) => e.naam));
    for (const [waar, obj] of lijst) {
      // `_…` = motor-intern (types/erfenis.js), nooit in een profiel-kern.
      for (const k of Object.keys(obj)) if (!k.startsWith("_") && !bekend.has(k)) ontbreekt.push(`${klasse}.${k} (${waar})`);
    }
  }
  assert.deepEqual([...new Set(ontbreekt.map((o) => o.replace(/ \(.*/, "")))], [], `niet in m3.js/schema.js:\n${ontbreekt.join("\n")}`);
  // De meetlat moet ook iets meten: alle profielen geladen, de hoofdklassen gevonden.
  const v = voorkomens();
  assert.equal(v.DiagramType.length, profielIds.length);
  for (const k of ["ElementType", "PropertyType", "CompartmentType", "FieldType", "EdgePresentatie"]) assert.ok(v[k]?.length > 0, k);
});

test("elke hook van een profiel staat in de catalogus, op de goede metaklasse", () => {
  const plek = new Map(handlersVan("hook").map((h) => [h.id, h.plek || "ElementType"]));
  const fout = [];
  for (const pid of profielIds) {
    const d = descriptorVan(pid);
    const check = (klasse, waar, hooks) => {
      for (const h of Object.keys(hooks || {})) {
        if (!plek.has(h)) fout.push(`${waar}: hook "${h}" niet in handlerCatalogus.js`);
        else if (plek.get(h) !== klasse) fout.push(`${waar}: hook "${h}" hoort op ${plek.get(h)}, niet op ${klasse}`);
      }
    };
    check("DiagramType", pid, d.hooks);
    for (const et of d.elementTypes || []) check("ElementType", `${pid}/${et.id}`, et.hooks);
  }
  assert.deepEqual(fout, []);
  assert.deepEqual(m3Enumeratie("HookSoort").waarden, [...plek.keys()]);
});

test("enumeraties: de waarden die profielen gebruiken, staan erin", () => {
  const aard = new Set(m3Enumeratie("Aard").waarden);
  const fout = [];
  for (const pid of profielIds) {
    for (const et of descriptorVan(pid).elementTypes || []) {
      if (et.aard && !aard.has(et.aard)) fout.push(`${pid}/${et.id}: aard "${et.aard}"`);
      for (const p of et.properties || []) if (p.aard && !aard.has(p.aard)) fout.push(`${pid}/${et.id}.${p.key}: aard "${p.aard}"`);
      if (et.shape && typeof et.shape !== "string") fout.push(`${pid}/${et.id}: shape is geen id`);
    }
    for (const ft of descriptorVan(pid).fieldTypes || []) {
      if (!m3Enumeratie("FieldTypeViewer").waarden.includes(ft.viewer)) fout.push(`${pid}/${ft.id}: viewer "${ft.viewer}"`);
    }
  }
  assert.deepEqual(fout, []);
});
