/**
 * Tests voor de use case-ShapeTypes (plan 2026-11-04 Eén tekenaar, stap 4).
 * Run: node --import ./test/register-aliases.mjs --test src/diagramprofielen/usecase/vormen.test.js
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { USECASE_SHAPETYPES } from "./vormen.js";
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
  return { box, ...uit, tekst: JSON.stringify(uit.inhoud) };
};

test("actor: strekfiguur, naam eronder binnen de doos; brede naam tot 120, lange naam breekt af", () => {
  for (const st of USECASE_SHAPETYPES) assert.ok(tekenbareVorm(st.id), st.id);
  const et = { id: "actor", shape: "uc-actor", resizebaar: false };
  const kort = teken("uc-actor", { id: "a", naam: "Burger", elementType: "actor", data: {}, compartimenten: [] }, et);
  assert.deepEqual([kort.box.w, kort.box.h], [64, 74], "64 breed, figuur 48 + één naamregel");
  const vak = kort.box.renderer.inhoudsvak(kort.box.ctx);
  assert.equal(vak.x, 0, "het inhoudsvak ligt binnen de doos");
  assert.equal(vak.w, 64);
  assert.match(kort.tekst, /"data-dc-naam":""/);
  const lang = teken("uc-actor", { id: "a", naam: "Zaakbehandelaar van de gemeente", elementType: "actor", data: {}, compartimenten: [] }, et);
  assert.equal(lang.box.w, 120, "niet breder dan 120");
  assert.ok(lang.box.h > 74, "meer regels, hoger");
});

test("use case: ellips met de naam gecentreerd; collaboratie gestippeld; bewaarde maat wint", () => {
  const et = { id: "usecase", shape: "uc-ellips", kleur: "#e0f2fe", omtrek: "ellips" };
  const el = { id: "u", naam: "Aanvraag indienen", elementType: "usecase", data: {}, compartimenten: [] };
  const a = teken("uc-ellips", el, et);
  assert.equal(a.omtrek.tag, "ellipse");
  assert.equal(a.omtrek.attrs.fill, "#e0f2fe");
  assert.ok(a.box.w >= 150 && a.box.w <= 280 && a.box.h >= 60, `${a.box.w}×${a.box.h}`);
  assert.match(a.tekst, /"text-anchor":"middle"/);
  const vak = a.box.renderer.inhoudsvak(a.box.ctx);
  assert.equal(Math.round(vak.w), Math.round(a.box.w * 0.76), "inhoudsvak volgt factorW");
  const collab = teken("uc-ellips", { ...el, elementType: "collaboratie" }, { ...et, id: "collaboratie", randStijl: "dashed", kleur: "#f8fafc" });
  assert.equal(collab.omtrek.attrs["stroke-dasharray"], "6 4");
  const bewaard = teken("uc-ellips", el, et, { ref: { size: { width: 220, height: 80 } } });
  assert.deepEqual([bewaard.box.w, bewaard.box.h], [220, 80]);
});

test("systeemkader: doorgetrokken rand, naamstrook met lijn, tint; eigen kleur kleurt de rand", () => {
  const et = { id: "systeem", shape: "uc-systeem", achtergrond: true, containerVoor: "bevat" };
  const a = teken("uc-systeem", { id: "s", naam: "Zaaksysteem", elementType: "systeem", data: {}, compartimenten: [] }, et);
  assert.deepEqual([a.box.w, a.box.h], [220, 160]);
  assert.equal(a.omtrek.tag, "g");
  assert.equal(a.omtrek.kinderen[0].attrs["stroke-dasharray"], undefined);
  assert.equal(a.omtrek.kinderen[0].attrs["fill-opacity"], 0.08);
  assert.equal(a.omtrek.kinderen[1].tag, "line");
  assert.match(a.tekst, /"text-anchor":"middle"/);
  assert.equal(a.box.renderer.kindervak(a.box.ctx).y, 26);
  const b = teken("uc-systeem", { id: "s", naam: "Zaaksysteem", elementType: "systeem", data: { kleur: "#0ea5e9" }, compartimenten: [] }, et);
  assert.equal(b.omtrek.kinderen[0].attrs.stroke, "#0ea5e9");
  assert.equal(b.omtrek.kinderen[0].attrs.fill, "#0ea5e9");
  assert.match(b.tekst, new RegExp(`"fill":"${basis.text}"`), "tekst blijft de thematekst, niet wit op een open kader");
});
