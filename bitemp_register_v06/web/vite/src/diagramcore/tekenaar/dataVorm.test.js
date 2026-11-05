/**
 * Tests voor eigen vormen als ShapeType (plan 2026-11-04 Eén tekenaar, opruimstap).
 * Run: node --import ./test/register-aliases.mjs --test src/diagramcore/tekenaar/dataVorm.test.js
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { registreerDataVorm, dataVormInfo, dataVormShapeType, polygonPunten, leesSilhouet, isDataVorm, DATA_VORM } from "./dataVorm.js";
import { tekenbareVorm, alleShapeTypeIds, registreerShapeType } from "../types/shapeType.js";
import { bouwVoorkomen, tekenVoorkomen, basisVanPalet } from "./voorkomen.js";
import { maakPalet } from "../../diagramsvg/thema.js";
import "./basisVormen.js";

const basis = basisVanPalet(maakPalet("light"));
const teken = (vormInfo, extra = {}) => {
  const box = bouwVoorkomen({
    element: { id: "x", naam: "Voorbeeld", elementType: "t", data: {}, compartimenten: [] },
    elementType: { id: "t", shape: vormInfo.shapeType.id, compartments: [] },
    ...vormInfo,
    basis,
    idPrefix: "a",
    ...extra,
  });
  const uit = tekenVoorkomen(box, { controleer: true });
  assert.deepEqual(uit.fouten, [], vormInfo.shapeType.id);
  return { box, ...uit };
};

test("polygon(…) uit CSS: procenten, px en calc(100% - Npx); iets anders dan een polygoon is geen vorm", () => {
  assert.deepEqual(polygonPunten("polygon(50% 0%, 100% 50%, 50% 100%, 0% 50%)", 200, 100), [{ x: 100, y: 0 }, { x: 200, y: 50 }, { x: 100, y: 100 }, { x: 0, y: 50 }]);
  assert.deepEqual(polygonPunten("polygon(12px 0, 100% 0, 100% calc(100% - 12px), calc(100% - 12px) 100%, 0 100%, 0 12px)", 100, 60), [
    { x: 12, y: 0 }, { x: 100, y: 0 }, { x: 100, y: 48 }, { x: 88, y: 60 }, { x: 0, y: 60 }, { x: 0, y: 12 },
  ]);
  assert.equal(polygonPunten("inset(10px)", 100, 60), null);
  assert.equal(polygonPunten("polygon(10% 10%, 20%)", 100, 60), null, "een half punt");
  assert.equal(polygonPunten("", 100, 60), null);
});

test("silhouet: rauwe SVG wordt een VormBoom; style, id en handlers vervallen, onbekende elementen ook", () => {
  const knopen = leesSilhouet('<g xmlns="http://www.w3.org/2000/svg" id="laag">\n <title>x</title>\n <path d="m50,0l11,35z" style="fill:red" onclick="x()" fill-rule="evenodd"/>\n <script>alert(1)</script>\n <g transform="translate(2 3)"><circle cx="5" cy="5" r="2"/></g>\n</g>');
  assert.equal(knopen.length, 1);
  const [g] = knopen;
  assert.deepEqual([g.tag, g.attrs], ["g", {}], "xmlns en id weg");
  assert.deepEqual(g.kinderen.map((k) => k.tag), ["path", "g"], "title en script vervallen");
  assert.deepEqual(g.kinderen[0].attrs, { d: "m50,0l11,35z", "fill-rule": "evenodd", "vector-effect": "non-scaling-stroke" });
  assert.deepEqual(g.kinderen[1].attrs, { transform: "translate(2 3)" });
  assert.equal(g.kinderen[1].kinderen[0].tag, "circle");
  assert.deepEqual(leesSilhouet(""), []);
});

test("grondvormen: doos met hoekradius, stadium, zeshoek en afgeknipt; gestippeld en randdikte uit de definitie", () => {
  const doos = teken(dataVormInfo({ grondvorm: "afgerond", vulling: "#e2e8f0" }));
  assert.deepEqual([doos.omtrek.tag, doos.omtrek.attrs.rx, doos.omtrek.attrs.fill], ["rect", 14, "#e2e8f0"]);
  assert.deepEqual([doos.box.w >= 180, doos.box.h], [true, 56], "de maat van een gewone doos");
  assert.match(JSON.stringify(doos.inhoud), /"Voorbeeld"/, "de motor tekent de naam");
  const stadium = teken(dataVormInfo({ grondvorm: "stadium" }));
  assert.equal(stadium.omtrek.attrs.rx, (stadium.box.h - 2) / 2, "999 afgekapt op de halve hoogte");
  const zes = teken(dataVormInfo({ grondvorm: "zeshoek", randStijl: "dashed", randDikte: 3 }));
  assert.equal(zes.omtrek.tag, "polygon");
  assert.equal(zes.omtrek.attrs.points.split(" ").length, 6);
  assert.deepEqual([zes.omtrek.attrs["stroke-dasharray"], zes.omtrek.attrs["stroke-width"]], ["6 4", 3]);
  assert.equal(teken(dataVormInfo({ grondvorm: "afgeknipt" })).omtrek.attrs.points.split(" ").length, 6);
  assert.equal(teken(dataVormInfo({ clipPath: "circle(40%)" })).omtrek.tag, "rect", "geen polygoon: de doos");
});

test("silhouet ligt in de maat: verhouding behouden en gecentreerd, of uitgerekt met passen: false", () => {
  const ster = { silhouet: { inner: '<g><path d="m50,0l11,35l37,0z"/></g>', box: [2, 0, 96, 91] } };
  const s = teken(dataVormInfo(ster), { maat: { w: 200, h: 91 } });
  assert.equal(s.omtrek.tag, "g");
  assert.equal(s.omtrek.attrs.transform, "translate(50 0) scale(1 1)", "schaal 1 (91/91), gecentreerd: (200 − 96)/2 − 2");
  assert.equal(s.omtrek.kinderen[0].kinderen[0].attrs.d, "m50,0l11,35l37,0z");
  const vrij = teken(dataVormInfo({ silhouet: { ...ster.silhouet, passen: false } }), { maat: { w: 192, h: 182 } });
  assert.equal(vrij.omtrek.attrs.transform, "translate(-4 0) scale(2 2)");
  assert.equal(dataVormShapeType({ id: "s", silhouet: { inner: "", box: [0, 0, 1, 1] } }).parameters.silhouet, undefined, "een leeg silhouet telt niet");
});

test("registreren: een eigen vorm is een tekenbaar ShapeType; een ingebouwde vorm wordt nooit overschreven", () => {
  assert.equal(registreerDataVorm({ id: "proef-ster", label: "Ster", grondvorm: "zeshoek", vulling: "#fde68a" }), true);
  const info = tekenbareVorm("proef-ster");
  assert.equal(info.shapeType.renderer, DATA_VORM);
  assert.equal(info.shapeType.parameters.vulling, "#fde68a");
  assert.ok(isDataVorm("proef-ster") && !isDataVorm("class-box"));
  assert.ok(alleShapeTypeIds().includes("proef-ster") && alleShapeTypeIds().includes("class-box"));
  assert.equal(registreerDataVorm({ id: "proef-ster", grondvorm: "afgerond" }), true, "opnieuw registreren vervangt");
  assert.equal(tekenbareVorm("proef-ster").shapeType.parameters.grondvorm, "afgerond");
  assert.equal(registreerDataVorm({ id: "class-box", grondvorm: "zeshoek" }), false);
  assert.equal(tekenbareVorm("class-box").shapeType.renderer, "rechthoek", "de ingebouwde vorm blijft");
  assert.equal(registreerDataVorm({}), false);
  // Een ShapeType zonder renderer staat niet in de lijst van tekenbare vormen.
  registreerShapeType({ id: "proef-zonder-renderer", renderer: "bestaat-niet" });
  assert.ok(!alleShapeTypeIds().includes("proef-zonder-renderer"));
});

test("de meegeleverde eigen vormen (web/vite/vormen/*.json) tekenen zonder contractfouten", () => {
  const map = join(dirname(fileURLToPath(import.meta.url)), "../../../vormen");
  const bestanden = readdirSync(map).filter((f) => f.endsWith(".json"));
  assert.ok(bestanden.length >= 3);
  for (const f of bestanden) {
    const def = JSON.parse(readFileSync(join(map, f), "utf8"));
    const uit = teken(dataVormInfo(def));
    assert.ok(uit.box.w >= 150 && uit.box.h >= 48, f);
    if (def.silhouet?.inner) assert.equal(uit.omtrek.tag, "g", `${f}: silhouet`);
    else if (def.clipPath || def.grondvorm === "zeshoek") assert.equal(uit.omtrek.tag, "polygon", `${f}: polygoon`);
  }
});
