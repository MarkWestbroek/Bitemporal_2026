/**
 * Tests voor de BPMN-ShapeTypes (plan 2026-11-04 Eén tekenaar, stap 4).
 * Run: node --import ./test/register-aliases.mjs --test src/diagramprofielen/bpmn/vormen.test.js
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { BPMN_SHAPETYPES } from "./vormen.js";
import { tekenbareVorm } from "../../diagramcore/types/shapeType.js";
import { bouwVoorkomen, tekenVoorkomen, basisVanPalet } from "../../diagramcore/tekenaar/voorkomen.js";
import { maakPalet } from "../../diagramsvg/thema.js";

const basis = basisVanPalet(maakPalet("light"));
const teken = (shapeId, element, elementType, extra = {}) => {
  const vormInfo = tekenbareVorm(shapeId);
  assert.ok(vormInfo, `${shapeId} is tekenbaar`);
  const box = bouwVoorkomen({ element, elementType, ...vormInfo, basis, idPrefix: "a", ...extra });
  const uit = tekenVoorkomen(box, { controleer: true });
  assert.deepEqual(uit.fouten, [], shapeId);
  return { box, ...uit, tekst: JSON.stringify([uit.omtrek, uit.inhoud, uit.ornament]) };
};
const el = (type, naam = "", data = {}) => ({ id: "x", naam, elementType: type, data, compartimenten: [] });

test("events: ring per type (dun, dubbel, dik), icoon per soort, gestippeld als niet-onderbrekend; maat 30 / boundary 26 / bewaard", () => {
  for (const st of BPMN_SHAPETYPES) assert.ok(tekenbareVorm(st.id), st.id);
  const start = teken("bpmn-event", el("start-event"), { id: "start-event", shape: "bpmn-event", naamLabel: "buiten", resizebaar: false });
  assert.deepEqual([start.box.w, start.box.h, start.inhoud], [30, 30, null]);
  assert.equal(start.omtrek.kinderen.length, 1);
  assert.match(start.omtrek.attrs.transform, /scale\(1\.5\)/, "viewBox 20 → 30px");
  const eind = teken("bpmn-event", el("eind-event", "", { soort: "terminate" }), { id: "eind-event", shape: "bpmn-event" });
  assert.equal(eind.omtrek.kinderen[0].attrs["stroke-width"], 2.6, "dikke ring");
  assert.equal(eind.omtrek.kinderen[1].tag, "circle", "terminate-stip");
  const boundary = teken("bpmn-event", el("boundary-event", "", { soort: "timer", onderbrekend: false }), { id: "boundary-event", shape: "bpmn-event" });
  assert.deepEqual([boundary.box.w, boundary.box.h], [26, 26]);
  assert.equal(boundary.omtrek.kinderen.length, 4, "ring, binnenring, timer (2)");
  assert.equal(boundary.omtrek.kinderen[1].attrs["stroke-dasharray"], "3 2.4");
  const ea = teken("bpmn-event", el("tussen-event"), { id: "tussen-event", shape: "bpmn-event" }, { ref: { size: { width: 45, height: 45 } } });
  assert.deepEqual([ea.box.w, ea.box.h], [45, 45], "EA-import vult de bewaarde maat");
});

test("gateways: ruit met het symbool van het type", () => {
  const sym = (type) => teken("bpmn-gateway", el(type), { id: type, shape: "bpmn-gateway", omtrek: "ruit" }).omtrek.kinderen;
  assert.equal(sym("exclusief").length, 2);
  assert.match(sym("exclusief")[1].attrs.d, /^M12\.5 12\.5/);
  assert.equal(sym("inclusief")[1].tag, "circle");
  assert.equal(sym("event-gateway").length, 3);
  const g = teken("bpmn-gateway", el("parallel"), { id: "parallel", shape: "bpmn-gateway" });
  assert.deepEqual([g.box.w, g.box.h], [34, 34]);
  assert.deepEqual(g.box.rand(0), { x: 34, y: 17 }, "aanhechting op de punt van de ruit");
});

test("taak en subproces: afgerond, taaktype-icoon linksboven, ⊞ onderaan; uitgeklapt links", () => {
  const taak = teken("bpmn-taak", el("taak", "Aanvraag beoordelen", { taakSoort: "user" }), { id: "taak", shape: "bpmn-taak", kleur: "#e0f2fe" });
  assert.deepEqual([taak.box.w, taak.box.h], [180, 48]);
  assert.equal(taak.omtrek.attrs.rx, 10);
  assert.equal(taak.omtrek.attrs.stroke, "#7dd3fc");
  assert.equal(taak.ornament.attrs.class, "dc-taak-icoon");
  assert.equal(taak.box.renderer.inhoudsvak(taak.box.ctx).y, 10, "ruimte voor het icoon");
  const kaal = teken("bpmn-taak", el("taak", "Taak"), { id: "taak", shape: "bpmn-taak" });
  assert.equal(kaal.ornament, null);
  const sub = teken("bpmn-subproces", el("subproces", "Beoordelen"), { id: "subproces", shape: "bpmn-subproces", kleur: "#e0f2fe" });
  assert.equal(sub.ornament.attrs.class, "dc-subproces-markering");
  assert.match(sub.tekst, /"text-anchor":"middle"/);
  const open = teken("bpmn-subproces", el("subproces", "Beoordelen", { uitgeklapt: true }), { id: "subproces", shape: "bpmn-subproces" }, { maat: { w: 400, h: 240 } });
  assert.match(JSON.stringify(open.inhoud), /"text-anchor":"start"/, "uitgeklapt: naam linksboven");
});

test("data-object en data store: figuur bovenaan, naam eronder binnen de doos; verzameling = streepjes", () => {
  const d = teken("bpmn-data", el("data-object", "Brondocument"), { id: "data-object", shape: "bpmn-data", resizebaar: false });
  assert.ok(d.box.w > 46 && d.box.w <= 120, `zo breed als de naam, tot 120 (${d.box.w})`);
  assert.equal(d.box.h, 60, "figuur 36 + naamregel");
  assert.equal(d.omtrek.kinderen.length, 2);
  assert.match(d.tekst, /"data-dc-naam":""/);
  const v = teken("bpmn-data", el("data-object", "Stukken", { verzameling: true }), { id: "data-object", shape: "bpmn-data" });
  assert.equal(v.omtrek.kinderen.length, 3);
  const s = teken("bpmn-datastore", el("data-store", "Register"), { id: "data-store", shape: "bpmn-datastore" });
  assert.equal(s.omtrek.kinderen[1].tag, "ellipse");
});

test("lane en pool: naamstrook boven resp. staande band links; leden ernaast", () => {
  const lane = teken("bpmn-lane", el("lane", "Balie"), { id: "lane", shape: "bpmn-lane", achtergrond: true });
  assert.deepEqual([lane.box.w, lane.box.h], [240, 100]);
  assert.equal(lane.omtrek.kinderen[1].tag, "line");
  const pool = teken("bpmn-pool", el("pool", "Gemeente"), { id: "pool", shape: "bpmn-pool", achtergrond: true });
  assert.deepEqual([pool.box.w, pool.box.h], [320, 160]);
  assert.equal(pool.omtrek.kinderen[1].attrs.x1, 30, "band van 30");
  assert.match(pool.inhoud.attrs.transform, /^rotate\(-90 15 80\)$/, "naam een kwartslag gedraaid om het midden van de band");
  assert.deepEqual(pool.box.renderer.kindervak(pool.box.ctx), { x: 30, y: 0, w: 290, h: 160 });
  const eigen = teken("bpmn-pool", el("pool", "Gemeente", { kleur: "#0ea5e9" }), { id: "pool", shape: "bpmn-pool" });
  assert.equal(eigen.omtrek.kinderen[0].attrs.stroke, "#0ea5e9");
  assert.equal(eigen.omtrek.kinderen[0].attrs["fill-opacity"], 0.1);
});
