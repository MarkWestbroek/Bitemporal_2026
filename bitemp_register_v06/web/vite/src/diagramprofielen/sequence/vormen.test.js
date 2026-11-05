/**
 * Tests voor de sequence-ShapeTypes (plan 2026-11-04 Eén tekenaar, stap 4).
 * Run: node --import ./test/register-aliases.mjs --test src/diagramprofielen/sequence/vormen.test.js
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { SEQUENCE_SHAPETYPES, kopIcoon } from "./vormen.js";
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
  return { box, ...uit };
};
const el = (type, naam = "", data = {}) => ({ id: "x", naam, elementType: type, data, compartimenten: [] });

test("punt onzichtbaar (opacity 0), activatie als balk, beide zonder inhoud", () => {
  for (const st of SEQUENCE_SHAPETYPES) assert.ok(tekenbareVorm(st.id), st.id);
  const p = teken("seq-punt", el("punt"), { id: "punt", shape: "seq-punt", resizebaar: false });
  assert.deepEqual([p.box.w, p.box.h, p.inhoud], [12, 12, null]);
  assert.equal(p.omtrek.attrs.opacity, 0);
  assert.equal(tekenbareVorm("seq-punt").shapeType.parameters.klasse, "dc-seq-punt");
  const a = teken("seq-activatie", el("activatie"), { id: "activatie", shape: "seq-activatie", minBreedte: 14, minHoogte: 44 });
  assert.deepEqual([a.box.w, a.box.h, a.inhoud], [14, 44, null]);
  assert.equal(a.omtrek.attrs.fill, "#e2e8f0");
  const lang = teken("seq-activatie", el("activatie"), { id: "activatie", shape: "seq-activatie" }, { ref: { size: { width: 14, height: 120 } } });
  assert.equal(lang.box.h, 120);
});

test("fragment: soort-chip linksboven, de naam ernaast, leden eronder", () => {
  const f = teken("seq-fragment", el("fragment", "betaling ok", { soort: "loop" }), { id: "fragment", shape: "seq-fragment", achtergrond: true });
  assert.deepEqual([f.box.w, f.box.h], [260, 160]);
  assert.equal(f.omtrek.kinderen[1].tag, "polygon", "chip");
  assert.deepEqual(f.omtrek.kinderen[2].kinderen, ["loop"]);
  const vak = f.box.renderer.inhoudsvak(f.box.ctx);
  assert.ok(vak.x > 30 && vak.x < 70, `naam rechts van de chip (${vak.x})`);
  assert.match(JSON.stringify(f.inhoud), /"text-anchor":"start"[^}]*"data-dc-naam":""/);
  assert.equal(f.box.renderer.kindervak(f.box.ctx).y, 18);
});

test("levenslijn (documenten): gestippelde lijn met de kop van 148 erbovenop; naam gecentreerd in de kop", () => {
  const l = teken("seq-levenslijn", el("levenslijn", "Zaaksysteem"), { id: "levenslijn", shape: "seq-levenslijn", minBreedte: 14, minHoogte: 200 });
  assert.deepEqual([l.box.w, l.box.h], [14, 200]);
  const [lijn, kop] = l.omtrek.kinderen;
  assert.equal(lijn.attrs["stroke-dasharray"], "6 4");
  assert.equal(kop.attrs.width, 148);
  assert.equal(kop.attrs.x, 7 - 74, "de kop steekt aan beide kanten uit de smalle node");
  assert.equal(lijn.attrs.y1, kop.attrs.height + 1.6, "de lijn begint onder de kop");
  assert.match(JSON.stringify(l.inhoud), /"x":7,[^}]*"text-anchor":"middle"/);
});

test("levenslijn met icoon-kop (actor): poppetje boven de naam, de lijn begint onder de naam", () => {
  const l = teken("seq-levenslijn", el("levenslijn", "Burger", { kop: "actor" }), { id: "levenslijn", shape: "seq-levenslijn", minBreedte: 14, minHoogte: 200 });
  const [lijn, kop] = l.omtrek.kinderen;
  assert.equal(kop.tag, "g");
  assert.equal(kop.attrs.transform, "translate(-17 0)", "icoon van 48 gecentreerd op de lijn (x 7)");
  assert.equal(kop.kinderen[0].kinderen[0].tag, "circle", "het hoofd");
  const vak = l.box.renderer.inhoudsvak(l.box.ctx);
  assert.equal(vak.y, 42, "naam onder het icoon van 40");
  assert.equal(lijn.attrs.y1, vak.y + vak.h, "de lijn begint onder de naam");
  assert.ok(kopIcoon("business-entity", { rand: "#000" }).kinderen[1].tag === "line", "business-variant: streep");
  assert.equal(kopIcoon("object", { rand: "#000" }), null, "object = de rechthoek-kop");
});

test("levenslijn (documenten) loopt tot onder het laagste element van het diagram", () => {
  const diagram = {
    nodes: [
      { elementId: "x", position: { x: 300, y: 100 } },
      { elementId: "f", position: { x: 440, y: 520 }, size: { width: 440, height: 160 } },
      { elementId: "p", parentId: "x", position: { x: 1, y: 300 }, size: { width: 12, height: 12 } },
    ],
  };
  const node = diagram.nodes[0];
  const l = teken("seq-levenslijn", el("levenslijn", "Portaal"), { id: "levenslijn", shape: "seq-levenslijn", minBreedte: 14, minHoogte: 200 }, { diagram, ref: node });
  assert.equal(l.box.h, 520 + 160 - 100 + 40, "fragment-onderkant (680) − eigen y (100) + marge");
  const kort = teken("seq-levenslijn", el("levenslijn", "Portaal"), { id: "levenslijn", shape: "seq-levenslijn", minBreedte: 14, minHoogte: 200 }, { diagram: { nodes: [node] }, ref: node });
  assert.equal(kort.box.h, 200, "alleen zichzelf: de minimumhoogte");
});
