/**
 * Tests voor de activity-ShapeTypes (plan 2026-11-04 Eén tekenaar, stap 4).
 * Run: node --import ./test/register-aliases.mjs --test src/diagramprofielen/activity/vormen.test.js
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { ACTIVITY_SHAPETYPES } from "./vormen.js";
import { tekenbareVorm } from "../../diagramcore/types/shapeType.js";
import { bouwVoorkomen, tekenVoorkomen, basisVanPalet } from "../../diagramcore/tekenaar/voorkomen.js";
import { maakPalet } from "../../diagramsvg/thema.js";

const basis = basisVanPalet(maakPalet("light"));
const teken = (shapeId, element, elementType = { id: element.elementType, shape: shapeId }, extra = {}) => {
  const vormInfo = tekenbareVorm(shapeId);
  assert.ok(vormInfo, `${shapeId} is tekenbaar`);
  const box = bouwVoorkomen({ element, elementType, ...vormInfo, basis, idPrefix: "a", ...extra });
  const uit = tekenVoorkomen(box, { controleer: true });
  assert.deepEqual(uit.fouten, [], shapeId);
  return { box, ...uit };
};
const leeg = (type) => ({ id: "x", naam: "", elementType: type, data: {}, compartimenten: [] });

test("alle activity-vormen zijn tekenbaar; knooppunten zonder inhoud op hun vaste maat", () => {
  for (const st of ACTIVITY_SHAPETYPES) assert.ok(tekenbareVorm(st.id), st.id);
  const begin = teken("act-begin", leeg("begin"));
  assert.deepEqual([begin.box.w, begin.box.h, begin.inhoud], [22, 22, null]);
  assert.equal(begin.omtrek.kinderen[0].attrs.fill, begin.omtrek.kinderen[0].attrs.stroke, "gevulde stip");
  const eind = teken("act-eind", leeg("eind"));
  assert.equal(eind.box.w, 24);
  assert.equal(eind.omtrek.kinderen.length, 2, "ring met kern");
  assert.equal(eind.omtrek.kinderen[1].attrs.r, 6);
  const flow = teken("act-flow-eind", leeg("flow-eind"));
  assert.equal(flow.omtrek.kinderen[1].tag, "path", "ring met X");
  const ruit = teken("act-beslissing", leeg("beslissing"));
  assert.equal(ruit.omtrek.tag, "polygon");
  assert.deepEqual([ruit.box.w, ruit.box.h], [28, 28]);
  const pin = teken("act-pin", leeg("pin"));
  assert.deepEqual([pin.box.w, pin.box.h], [12, 12]);
});

test("fork/join: liggend 140×10, staand 10×140 (data.verticaal); een bewaarde maat wint", () => {
  const et = { id: "fork", shape: "act-fork", resizebaar: false };
  const liggend = teken("act-fork", leeg("fork"), et);
  assert.deepEqual([liggend.box.w, liggend.box.h], [140, 10]);
  assert.equal(liggend.omtrek.attrs.fill, liggend.omtrek.attrs.stroke);
  const staand = teken("act-fork", { ...leeg("fork"), data: { verticaal: true } }, et);
  assert.deepEqual([staand.box.w, staand.box.h], [10, 140]);
  const bewaard = teken("act-fork", leeg("fork"), et, { ref: { size: { width: 200, height: 10 } } });
  assert.deepEqual([bewaard.box.w, bewaard.box.h], [200, 10]);
});

test("object en partitie: naam gecentreerd; de partitie met naamstrook, lijn en tint", () => {
  const obj = teken("act-object", { ...leeg("object"), naam: "Aanvraag" }, { id: "object", shape: "act-object", kleur: "#f1f5f9" });
  assert.equal(obj.omtrek.attrs.rx, 0, "strakke rechthoek");
  assert.equal(obj.omtrek.attrs.fill, "#f1f5f9");
  assert.deepEqual([obj.box.w, obj.box.h], [120, 44]);
  assert.match(JSON.stringify(obj.inhoud), /"text-anchor":"middle"/);
  const part = teken("act-partitie", { ...leeg("partitie"), naam: "Balie" }, { id: "partitie", shape: "act-partitie", achtergrond: true, kleur: "#dbeafe" });
  assert.equal(part.omtrek.tag, "g", "kader met lijn onder de kop");
  assert.equal(part.omtrek.kinderen[1].tag, "line");
  assert.equal(part.omtrek.kinderen[0].attrs["fill-opacity"], 0.08, "tint van de randkleur");
  assert.equal(part.omtrek.kinderen[0].attrs.stroke, part.box.ctx.thema.rand, "typekleur kleurt een kader niet");
  assert.deepEqual([part.box.w, part.box.h], [200, 280]);
  assert.equal(part.box.renderer.kindervak(part.box.ctx).y, 26);
});
