/**
 * Tests voor de state machine-ShapeTypes (plan 2026-11-04 Eén tekenaar, stap 4).
 * Run: node --import ./test/register-aliases.mjs --test src/diagramprofielen/statemachine/vormen.test.js
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { STATEMACHINE_SHAPETYPES } from "./vormen.js";
import { tekenbareVorm } from "../../diagramcore/types/shapeType.js";
import { bouwVoorkomen, tekenVoorkomen, basisVanPalet } from "../../diagramcore/tekenaar/voorkomen.js";
import { maakPalet } from "../../diagramsvg/thema.js";

const basis = basisVanPalet(maakPalet("light"));
const teken = (shapeId, element, elementType = { id: element.elementType, shape: shapeId }) => {
  const vormInfo = tekenbareVorm(shapeId);
  assert.ok(vormInfo, `${shapeId} is tekenbaar`);
  const box = bouwVoorkomen({ element, elementType, ...vormInfo, basis, idPrefix: "a" });
  const uit = tekenVoorkomen(box, { controleer: true });
  assert.deepEqual(uit.fouten, [], shapeId);
  return { box, ...uit };
};
const el = (type, naam = "", data = {}) => ({ id: "x", naam, elementType: type, data, compartimenten: [] });

test("pseudotoestanden: vaste maten zonder inhoud; historie met H of H*", () => {
  for (const st of STATEMACHINE_SHAPETYPES) assert.ok(tekenbareVorm(st.id), st.id);
  const maat = (id, type) => { const t = teken(id, el(type)); return [t.box.w, t.box.h, t.inhoud]; };
  assert.deepEqual(maat("sm-begin", "begin"), [22, 22, null]);
  assert.deepEqual(maat("sm-eind", "eind"), [24, 24, null]);
  assert.deepEqual(maat("sm-keuze", "keuze"), [28, 28, null]);
  assert.deepEqual(maat("sm-junction", "junction"), [16, 16, null]);
  assert.deepEqual(maat("sm-entry", "entry"), [16, 16, null]);
  const exit = teken("sm-exit", el("exit"));
  assert.equal(exit.omtrek.kinderen[1].tag, "path", "kruis");
  const h = teken("sm-historie", el("historie"));
  assert.deepEqual(h.omtrek.kinderen[1].kinderen, ["H"]);
  assert.deepEqual(teken("sm-historie", el("historie", "", { diep: true })).omtrek.kinderen[1].kinderen, ["H*"]);
});

test("samengestelde toestand: afgerond kader met naamstrook, lichte gele tint; eigen kleur kleurt de rand", () => {
  const c = teken("sm-composiet", el("composiet", "Actief"), { id: "composiet", shape: "sm-composiet", achtergrond: true, containerVoor: "bevat" });
  assert.deepEqual([c.box.w, c.box.h], [180, 120]);
  const rect = c.omtrek.kinderen[0];
  assert.equal(rect.attrs.rx, 14);
  assert.equal(rect.attrs.fill, "#fef9c3");
  assert.equal(rect.attrs["fill-opacity"], 0.18);
  assert.equal(c.omtrek.kinderen[1].tag, "line");
  assert.equal(c.box.renderer.kindervak(c.box.ctx).y, 26);
  const eigen = teken("sm-composiet", el("composiet", "Actief", { kleur: "#0ea5e9" }), { id: "composiet", shape: "sm-composiet" });
  assert.equal(eigen.omtrek.kinderen[0].attrs.stroke, "#0ea5e9");
});
