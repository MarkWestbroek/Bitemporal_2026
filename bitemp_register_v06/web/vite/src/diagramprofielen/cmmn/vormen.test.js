/**
 * Tests voor de CMMN-ShapeTypes (plan 2026-11-04 Eén tekenaar, stap 4).
 * Run: node --import ./test/register-aliases.mjs --test src/diagramprofielen/cmmn/vormen.test.js
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { CMMN_SHAPETYPES, markeringen } from "./vormen.js";
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

test("alle CMMN-vormen zijn tekenbaar; case plan = mapvorm met tab, stage = achthoek (gestreept als discretionair)", () => {
  for (const st of CMMN_SHAPETYPES) assert.ok(tekenbareVorm(st.id), st.id);
  const cp = teken("cmmn-caseplan", el("case-plan", "Vergunning"), { id: "case-plan", shape: "cmmn-caseplan", achtergrond: true, minBreedte: 320, minHoogte: 220 });
  assert.deepEqual([cp.box.w, cp.box.h], [320, 220]);
  assert.equal(cp.omtrek.kinderen.length, 2, "romp en tab");
  assert.deepEqual(cp.box.renderer.kindervak(cp.box.ctx), { x: 0, y: 24, w: 320, h: 196 });
  assert.match(cp.tekst, /"text-anchor":"start"/, "naam in de tab, links");
  const st = teken("cmmn-stage", el("stage", "Beoordelen", { discretionair: true, verplicht: true, herhaling: true }), { id: "stage", shape: "cmmn-stage", achtergrond: true, minBreedte: 220, minHoogte: 130 });
  assert.equal(st.omtrek.tag, "path");
  assert.equal(st.omtrek.attrs["stroke-dasharray"], "6 4", "discretionair = gestreept");
  assert.match(st.omtrek.attrs.d, /^M 13 1 H 207 L 219 13/, "afschuining 12 op de echte maat");
  assert.equal(st.ornament.kinderen[0], "!#", "markeringen onderaan");
  const vast = teken("cmmn-stage", el("stage", "Beoordelen"), { id: "stage", shape: "cmmn-stage", achtergrond: true });
  assert.equal(vast.omtrek.attrs["stroke-dasharray"], undefined);
  assert.equal(vast.ornament, null);
});

test("task: afgerond, soort-icoon linksboven, markeringen onder; milestone = stadium", () => {
  const t = teken("cmmn-taak", el("taak", "Aanvraag beoordelen", { soort: "human", handmatig: true }), { id: "taak", shape: "cmmn-taak", kleur: "#e0f2fe" });
  assert.deepEqual([t.box.w, t.box.h], [180, 56]);
  assert.equal(t.omtrek.attrs.rx, 12);
  assert.equal(t.omtrek.attrs.fill, "#e0f2fe");
  assert.equal(t.omtrek.attrs.stroke, "#7dd3fc");
  assert.equal(t.ornament.kinderen[0].attrs.class, "dc-taak-icoon");
  assert.equal(t.ornament.kinderen[1].kinderen[0], "▷");
  assert.deepEqual(markeringen({ verplicht: true, herhaling: false, handmatig: true }), ["!", "▷"]);
  const kaal = teken("cmmn-taak", el("taak", "Taak", { discretionair: true }), { id: "taak", shape: "cmmn-taak" });
  assert.equal(kaal.ornament, null);
  assert.equal(kaal.omtrek.attrs["stroke-dasharray"], "6 4");
  const m = teken("cmmn-mijlpaal", el("mijlpaal", "Besluit genomen"), { id: "mijlpaal", shape: "cmmn-mijlpaal", kleur: "#f3e8ff" });
  assert.equal(m.omtrek.attrs.rx, (m.box.h - 2) / 2, "halfronde uiteinden");
  assert.equal(m.omtrek.attrs.stroke, "#a78bfa");
  assert.equal(m.omtrek.attrs.fill, "#f3e8ff");
});

test("event listener (dubbele cirkel + timer/user), case file item (dokje) en sentry (open/gevuld) zonder inhoud", () => {
  const ev = teken("cmmn-event", el("event-listener", "Termijn", { soort: "timer" }), { id: "event-listener", shape: "cmmn-event", resizebaar: false, naamLabel: "buiten" });
  assert.deepEqual([ev.box.w, ev.box.h, ev.inhoud], [32, 32, null]);
  assert.equal(ev.omtrek.kinderen.length, 4, "twee ringen + klok (2)");
  assert.match(ev.omtrek.attrs.transform, /scale\(1\.6\)/);
  assert.deepEqual(ev.box.rand(0), { x: 32, y: 16 });
  const cf = teken("cmmn-casefile", el("case-file-item", "Dossier"), { id: "case-file-item", shape: "cmmn-casefile", resizebaar: false, naamLabel: "buiten" });
  assert.deepEqual([cf.box.w, cf.box.h], [46, 38]);
  assert.match(cf.omtrek.attrs.transform, /^translate\(8 0\) scale\(1\)$/, "dokje 30 breed gecentreerd in 46");
  const entry = teken("cmmn-sentry", el("sentry", "", { soort: "entry" }), { id: "sentry", shape: "cmmn-sentry", resizebaar: false, naamLabel: "buiten" });
  assert.deepEqual([entry.box.w, entry.box.h], [18, 24]);
  assert.equal(entry.omtrek.attrs.fill, basis.surface, "entry = open (canvaskleur)");
  const exit = teken("cmmn-sentry", el("sentry", "", { soort: "exit" }), { id: "sentry", shape: "cmmn-sentry" });
  assert.equal(exit.omtrek.attrs.fill, exit.omtrek.attrs.stroke, "exit = gevuld");
  assert.deepEqual(exit.box.rand(90), { x: 9, y: 24 }, "aanhechting op de punt van de ruit");
});
