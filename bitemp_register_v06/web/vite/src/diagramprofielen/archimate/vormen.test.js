/**
 * Tests voor de ArchiMate-ShapeTypes (plan 2026-11-04 Eén tekenaar, stap 4).
 * Run: node --import ./test/register-aliases.mjs --test src/diagramprofielen/archimate/vormen.test.js
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { ARCHIMATE_SHAPETYPES, FIGUREN } from "./vormen.js";
import { GLYPHS } from "./glyphs.js";
import { ELEMENTEN } from "./elementen.js";
import { VORM_SHAPE_IDS } from "./vormSet.js";
import { tekenbareVorm, valideerVormBoom } from "../../diagramcore/types/shapeType.js";
import { bouwVoorkomen, tekenVoorkomen, basisVanPalet } from "../../diagramcore/tekenaar/voorkomen.js";
import { maakPalet } from "../../diagramsvg/thema.js";
import { getGlyph, n3 } from "../../diagramcore/tekenaar/glyphs.js";

const basis = basisVanPalet(maakPalet("light"));
const teken = (shapeId, element, elementType, extra = {}) => {
  const vormInfo = tekenbareVorm(shapeId);
  assert.ok(vormInfo, `${shapeId} is tekenbaar`);
  const box = bouwVoorkomen({ element, elementType, ...vormInfo, basis, idPrefix: "a", ...extra });
  const uit = tekenVoorkomen(box, { controleer: true });
  assert.deepEqual(uit.fouten, [], shapeId);
  return { box, ...uit, svg: JSON.stringify([uit.omtrek, uit.inhoud, uit.ornament]) };
};

test("elke ArchiMate-vorm heeft een ShapeType met renderer; de figuren dekken de vormen-set", () => {
  const ids = ARCHIMATE_SHAPETYPES.map((s) => s.id);
  for (const id of ["archimate-box", "archimate-grouping", "archimate-junction", "am-blok", "am-blok-laag", ...VORM_SHAPE_IDS]) {
    assert.ok(ids.includes(id), id);
    assert.ok(tekenbareVorm(id), `${id} tekenbaar`);
  }
  assert.deepEqual(Object.keys(FIGUREN).sort(), [...VORM_SHAPE_IDS].sort());
  for (const [, , , icoon] of ELEMENTEN) assert.ok(GLYPHS[icoon] && getGlyph(icoon), `glyph ${icoon}`);
  for (const [id, kinderen] of Object.entries(GLYPHS)) for (const k of kinderen) assert.deepEqual(valideerVormBoom(k), [], id);
});

test("box: laagkleur, ronde hoeken voor gedrag, achthoek voor motivation, icoon rechtsboven", () => {
  const proces = { id: "business-proces", icoon: "am-proces", kleur: "#fff4b8", hoekRadius: 10, shape: "archimate-box" };
  const el = { id: "p1", naam: "Beoordelen", elementType: "business-proces", data: {}, compartimenten: [] };
  const a = teken("archimate-box", el, proces);
  assert.equal(a.omtrek.tag, "rect");
  assert.equal(a.omtrek.attrs.rx, 10, "gedrag: ronde hoeken uit elementType.hoekRadius");
  assert.equal(a.omtrek.attrs.fill, "#fff4b8");
  assert.equal(a.box.w, 140, "minimaal 140 breed");
  assert.equal(a.box.h, 48);
  assert.equal(a.ornament.attrs.class, "dc-glyph");
  assert.match(a.ornament.attrs.transform, /^translate\(123 3\)/, "icoon 13px, 4px uit de rechterbovenhoek");
  assert.match(a.svg, /"data-dc-naam":""/);
  assert.match(a.svg, /"fill":"#0f172a"/, "tekst op contrast met de laagkleur");

  const actor = { id: "business-actor", icoon: "am-actor", kleur: "#fff4b8", shape: "archimate-box" };
  assert.equal(teken("archimate-box", { ...el, elementType: "business-actor" }, actor).omtrek.attrs.rx, 2, "structuur: recht");

  const goal = { id: "goal", icoon: "am-goal", kleur: "#e8d9f5", hoekStijl: "afgeschuind", shape: "archimate-box" };
  const g = teken("archimate-box", { ...el, elementType: "goal" }, goal);
  assert.equal(g.omtrek.tag, "polygon", "motivation: achthoek");
  assert.equal(g.omtrek.attrs.points.split(" ").length, 8);
  assert.match(g.ornament.attrs.transform, /^translate\(120 5\)/, "icoon uit de schuine kant");

  // Een eigen kleur wint; een bewaarde maat wint van de gemeten.
  const eigen = teken("archimate-box", { ...el, data: { kleur: "#1e3a8a" } }, proces, { maat: { w: 200, h: 80 } });
  assert.equal(eigen.omtrek.attrs.fill, "#1e3a8a");
  assert.match(eigen.svg, /"fill":"#ffffff"/, "lichte tekst op donker");
  assert.deepEqual([eigen.box.w, eigen.box.h], [200, 80]);
});

test("grouping: gestippeld kader, naam links, groep-icoon; de typekleur kleurt niet, een eigen kleur wel de rand", () => {
  const grouping = { id: "grouping", icoon: "am-groep", kleur: "#f1f5f9", shape: "archimate-grouping", achtergrond: true };
  const el = { id: "g1", naam: "Domein", elementType: "grouping", data: {}, compartimenten: [] };
  const a = teken("archimate-grouping", el, grouping);
  assert.equal(a.omtrek.attrs["stroke-dasharray"], "6 4");
  assert.equal(a.omtrek.attrs.stroke, "#64748b", "niet de laagkleur van het type");
  assert.equal(a.omtrek.attrs.fill, "none");
  assert.match(a.svg, /"text-anchor":"start"/);
  assert.equal(a.ornament.attrs.class, "dc-glyph");
  assert.deepEqual([a.box.w, a.box.h], [200, 90]);
  const kind = a.box.renderer.kindervak(a.box.ctx);
  assert.equal(kind.y, 26, "leden onder de naamstrook");
  const b = teken("archimate-grouping", { ...el, data: { kleur: "#0ea5e9", achtergrondKleur: "#ecfeff" } }, grouping);
  assert.equal(b.omtrek.attrs.stroke, "#0ea5e9");
  assert.equal(b.omtrek.attrs.fill, "#ecfeff");
  assert.match(b.svg, new RegExp(`"fill":"${basis.text}"`), "tekst blijft de thematekst");
});

test("junction: dicht, of open bij soort 'of'; 16px zonder inhoud", () => {
  const et = { id: "junction", shape: "archimate-junction", resizebaar: false };
  const dicht = teken("archimate-junction", { id: "j", naam: "", elementType: "junction", data: {} }, et);
  assert.deepEqual([dicht.box.w, dicht.box.h], [16, 16]);
  assert.equal(dicht.inhoud, null);
  assert.equal(dicht.omtrek.attrs.fill, dicht.omtrek.attrs.stroke);
  const open = teken("archimate-junction", { id: "j", naam: "", elementType: "junction", data: { soort: "of" } }, et);
  assert.notEqual(open.omtrek.attrs.fill, open.omtrek.attrs.stroke);
});

test("figuren: het symbool als gegevens, passend geschaald en onderaan, naam als buitenlabel", () => {
  const et = { id: "business-actor", icoon: "am-actor", kleur: "#fff4b8", shape: "am-vorm-actor" };
  const el = { id: "a1", naam: "Burger", elementType: "business-actor", data: {}, compartimenten: [] };
  const a = teken("am-vorm-actor", el, et);
  assert.deepEqual([a.box.w, a.box.h], [51, 64], "natuurlijke maat: 64 hoog, breedte naar verhouding 48:60");
  assert.equal(a.inhoud, null, "geen inhoudsvak: de naam wordt een buitenlabel");
  assert.equal(a.omtrek.attrs.class, "dc-figuur");
  const s = Math.min(51 / 48, 64 / 60);
  assert.equal(a.omtrek.attrs.transform, `translate(0 ${n3(64 - 60 * s)}) scale(${n3(s)})`, "passend, gecentreerd, onderaan");
  assert.equal(a.omtrek.kinderen[0].attrs.fill, "#fff4b8", "$vulling → laagkleur");
  assert.equal(a.omtrek.kinderen[0].attrs["vector-effect"], "non-scaling-stroke");
  // Bewaarde maat uit de box-gedaante: het figuur past erin en zakt naar de onderkant.
  const b = teken("am-vorm-actor", el, et, { maat: { w: 140, h: 48 } });
  assert.equal(b.omtrek.attrs.transform, "translate(50.8 0) scale(0.8)");
  const goal = teken("am-vorm-goal", { ...el, elementType: "goal" }, { id: "goal", kleur: "#e8d9f5", shape: "am-vorm-goal" });
  assert.equal(goal.omtrek.kinderen[1].attrs.fill, basis.surface, "$open → paneelkleur");
  assert.equal(goal.omtrek.kinderen[2].attrs.fill, basis.border, "$kleur → lijnkleur");
});

test("blokken-set: effen blok zonder icoon, de laag als licht kader met de naam linksboven", () => {
  const et = { id: "app-component", icoon: "am-component", kleur: "#eef2ff", shape: "am-blok" };
  const a = teken("am-blok", { id: "c", naam: "Zaaksysteem", elementType: "app-component", data: {}, compartimenten: [] }, et);
  assert.equal(a.ornament, null);
  assert.equal(a.omtrek.attrs.rx, 10);
  assert.equal(a.omtrek.attrs.stroke, "#a5b4fc");
  const laag = teken("am-blok-laag", { id: "l", naam: "Applicatielaag", elementType: "grouping", data: {}, compartimenten: [] }, { id: "grouping", kleur: "#f1f5f9", shape: "am-blok-laag", achtergrond: true });
  assert.equal(laag.omtrek.attrs.stroke, "#cbd5e1");
  assert.equal(laag.omtrek.attrs.fill, "#f8fafc");
  assert.equal(laag.omtrek.attrs["stroke-dasharray"], undefined, "doorgetrokken");
  assert.equal(laag.ornament, null);
});
