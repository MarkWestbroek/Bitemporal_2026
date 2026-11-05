/**
 * Tests voor de Eriksson-Penker-ShapeTypes (plan 2026-11-04 Eén tekenaar, stap 4).
 * Run: node --import ./test/register-aliases.mjs --test src/diagramprofielen/business/vormen.test.js
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { BUSINESS_SHAPETYPES, resourceInhoud } from "./vormen.js";
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
  return { box, ...uit, teksten: (uit.inhoud?.kinderen || []).filter((k) => k.tag === "text").map((k) => k.kinderen[0]) };
};
const el = (type, naam = "", data = {}) => ({ id: "x", naam, elementType: type, data, compartimenten: [] });

test("proces (chevron), doel (ellips), gebeurtenis (plaat): icoon als ornament, naam ernaast; actor komt mee", () => {
  for (const st of BUSINESS_SHAPETYPES) assert.ok(tekenbareVorm(st.id), st.id);
  assert.ok(tekenbareVorm("uc-actor"));
  const p = teken("ep-proces", el("proces", "Aanvraag behandelen"), { id: "proces", shape: "ep-proces", kleur: "#dbeafe", containerVoor: "bevat", minBreedte: 180, minHoogte: 64 });
  assert.ok(p.box.w >= 180 && p.box.h === 64, `breed genoeg voor de naam naast punt en inkeping (${p.box.w}×${p.box.h})`);
  assert.equal(p.omtrek.tag, "polygon");
  const w = p.box.w;
  assert.equal(p.omtrek.attrs.points, `0.6,0.6 ${w - 24},0.6 ${w - 0.6},32 ${w - 24},63.4 0.6,63.4 24,32`, "punt rechts, inkeping links");
  assert.equal(p.ornament.attrs.class, "dc-ep-icoon");
  assert.deepEqual(p.teksten, ["Aanvraag behandelen"]);
  assert.deepEqual(p.box.renderer.kindervak(p.box.ctx), { x: 24, y: 0, w: w - 48, h: 64 });
  const vast = teken("ep-proces", el("proces", "Kort"), { id: "proces", shape: "ep-proces", minBreedte: 180, minHoogte: 64 }, { ref: { size: { width: 300, height: 90 } } });
  assert.deepEqual([vast.box.w, vast.box.h], [300, 90], "bewaarde maat wint");
  const d = teken("ep-doel", el("doel", "Tevreden klant"), { id: "doel", shape: "ep-doel", kleur: "#fef9c3" });
  assert.equal(d.omtrek.tag, "ellipse");
  assert.equal(d.ornament.kinderen.length, 3, "schietschijf");
  assert.deepEqual(d.box.rand(0), { x: d.box.w, y: d.box.h / 2 });
  const g = teken("ep-event", el("gebeurtenis", "Aanvraag ontvangen"), { id: "gebeurtenis", shape: "ep-event", kleur: "#fef3c7" });
  assert.equal(g.omtrek.tag, "polygon");
  assert.equal(g.ornament.kinderen[0].attrs.fill, "#f59e0b", "bliksem");
});

test("resource: groot soort-icoon links per type, stereotype + naam rechts, hoeveelheid eronder", () => {
  const et = (id, stereotype) => ({ id, shape: "ep-resource", stereotype, kleur: "#dcfce7", hooks: { inhoudsregels: resourceInhoud } });
  const m = teken("ep-resource", el("mensen", "Baliemedewerkers", { hoeveelheid: "3 fte" }), et("mensen", "«people»"));
  assert.ok(m.box.w >= 150 && m.box.h >= 48, `groeit vanaf 150×48 met de naam naast het icoon (${m.box.w}×${m.box.h})`);
  assert.equal(m.ornament.kinderen[0].tag, "circle", "poppetje");
  assert.deepEqual(m.teksten, ["«people»", "Baliemedewerkers", "3 fte"]);
  const hoeveelheid = m.inhoud.kinderen.find((k) => k.kinderen?.[0] === "3 fte");
  assert.equal(hoeveelheid.attrs["font-size"], 10);
  assert.ok(hoeveelheid.attrs.x > 54, `gecentreerd in het vak, niet aan de linkerkant (${hoeveelheid.attrs.x})`);
  const i = teken("ep-resource", el("informatie", "Dossier"), et("informatie", "«information»"));
  assert.equal(i.ornament.kinderen.length, 3, "document met i");
  assert.deepEqual(resourceInhoud({ data: {} }), []);
});
