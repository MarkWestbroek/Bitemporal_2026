/**
 * Tests voor de sequence-ShapeTypes (plan 2026-11-04 Eén tekenaar, stap 4).
 * Run: node --import ./test/register-aliases.mjs --test src/diagramprofielen/sequence/vormen.test.js
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { SEQUENCE_SHAPETYPES, kopIcoon, activatiesVan, levenslijnNaam } from "./vormen.js";
import { zetHost, _resetHostVoorTests } from "../../diagramcore/tekenaar/host.js";
import { tekenbareVorm } from "../../diagramcore/types/shapeType.js";
import { bouwVoorkomen, tekenVoorkomen, basisVanPalet } from "../../diagramcore/tekenaar/voorkomen.js";
import { maakPalet } from "../../diagramsvg/thema.js";
import { tekenDiagram } from "../../diagramcore/tekenaar/index.js";

const basis = basisVanPalet(maakPalet("light"));
const teken = (shapeId, element, elementType, extra = {}) => {
  const vormInfo = tekenbareVorm(shapeId);
  assert.ok(vormInfo, `${shapeId} is tekenbaar`);
  const box = bouwVoorkomen({ element, elementType, ...vormInfo, basis, idPrefix: "a", ...extra });
  const uit = tekenVoorkomen(box, { controleer: true });
  assert.deepEqual(uit.fouten, [], shapeId);
  const teksten = (uit.inhoud?.kinderen || []).filter((k) => k.tag === "text").map((k) => k.kinderen[0]);
  return { box, ...uit, teksten };
};
const LIJN = { id: "levenslijn", shape: "seq-levenslijn", minBreedte: 14, minHoogte: 200, hooks: { naamWeergave: levenslijnNaam } };
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

test("levenslijn: gestippelde lijn (500, zoals EA) met de kop van 148 erbovenop; naam gecentreerd in de kop", () => {
  const l = teken("seq-levenslijn", el("levenslijn", "Zaaksysteem"), LIJN);
  assert.deepEqual([l.box.w, l.box.h], [14, 500]);
  const [lijn, kop] = l.omtrek.kinderen;
  assert.equal(lijn.attrs["stroke-dasharray"], "6 4");
  assert.equal(kop.attrs.width, 148);
  assert.equal(kop.attrs.x, 7 - 74, "de kop steekt aan beide kanten uit de smalle node");
  assert.equal(lijn.attrs.y1, kop.attrs.height + 1.6, "de lijn begint onder de kop");
  assert.match(JSON.stringify(l.inhoud), /"x":7,[^}]*"text-anchor":"middle"/);
  assert.equal(tekenbareVorm("seq-levenslijn").renderer.leestDiagram, true, "het canvas geeft deze renderer het levende diagram");
  assert.deepEqual(teken("seq-levenslijn", el("levenslijn", ""), LIJN).teksten, ["(levenslijn)"]);
});

test("levenslijn met icoon-kop (actor): poppetje boven de naam, de lijn begint onder de naam", () => {
  const l = teken("seq-levenslijn", el("levenslijn", "Burger", { kop: "actor" }), LIJN);
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

// Een klein sequence-model: A roept B aan (150), B roept zichzelf aan (200 → 215), B antwoordt (300).
const punt = (id, lijn) => ({ id, naam: "", elementType: "punt", data: { randVan: lijn }, compartimenten: [] });
const bericht = (id, type, source, target) => ({ id, naam: "", elementType: type, data: {}, compartimenten: [], source, target });
const MODEL = {
  A: { ...el("levenslijn", "A"), id: "A" },
  B: { ...el("levenslijn", "B"), id: "B" },
  p1: punt("p1", "A"),
  p2: punt("p2", "B"),
  p3: punt("p3", "B"),
  p4: punt("p4", "B"),
  p5: punt("p5", "B"),
  p6: punt("p6", "A"),
  m1: bericht("m1", "synchroon", "p1", "p2"),
  m2: bericht("m2", "synchroon", "p3", "p4"),
  m3: bericht("m3", "retour", "p5", "p6"),
};
const DIAGRAM = {
  id: "d",
  nodes: [
    { elementId: "A", position: { x: 100, y: 50 } },
    { elementId: "B", position: { x: 400, y: 50 } },
    { elementId: "p1", position: { x: 1, y: 150 } },
    { elementId: "p2", position: { x: 1, y: 150 } },
    { elementId: "p3", position: { x: 1, y: 200 } },
    { elementId: "p4", position: { x: 1, y: 215 } },
    { elementId: "p5", position: { x: 1, y: 300 } },
    { elementId: "p6", position: { x: 1, y: 300 } },
  ],
};
const balkenVan = (l) => l.omtrek.kinderen.filter((k) => k.attrs.class === "dc-seq-activatie");

test("levenslijn: activaties afgeleid uit de berichten (diagram + elementen), genest 5 px naar rechts", () => {
  assert.deepEqual(activatiesVan({ element: MODEL.A, diagram: null, elementen: MODEL }), [], "zonder diagram geen balken");
  const b = activatiesVan({ element: MODEL.B, diagram: DIAGRAM, elementen: MODEL });
  assert.deepEqual(b.map((a) => a.diepte).sort(), [0, 1], "de aanroep en de rugzak van het zelf-bericht");
  const wortel = b.find((a) => a.diepte === 0);
  const rugzak = b.find((a) => a.diepte === 1);
  assert.deepEqual([wortel.top, wortel.top + wortel.hoogte], [156, 306], "de aanroep: van het ontvangpunt (150 + 6) tot de retour (300 + 6), relatief aan de lijn");
  assert.deepEqual([rugzak.top, rugzak.top + rugzak.hoogte], [221, 239], "de rugzak: kort, vanaf het zelf-bericht (215 + 6), binnen de aanroep");
  const l = teken("seq-levenslijn", MODEL.B, LIJN, { diagram: DIAGRAM, elements: MODEL });
  assert.deepEqual(balkenVan(l).map((k) => [k.attrs["data-diepte"], k.attrs.x]).sort(), [[0, 0.75], [1, 5.75]]);
  assert.equal(l.omtrek.kinderen.at(-1).tag, "rect", "de kop ligt bovenop");
  assert.equal(balkenVan(teken("seq-levenslijn", MODEL.A, LIJN, { diagram: DIAGRAM, elements: MODEL })).length, 1, "A: de wortel-episode");
  assert.equal(balkenVan(teken("seq-levenslijn", MODEL.B, LIJN)).length, 0, "buiten een diagram (vormvoorbeeld) geen balken");
});

test("levenslijn groeit mee met haar laagste punt, ook bovenop een bewaarde maat", () => {
  const diep = { ...DIAGRAM, nodes: [...DIAGRAM.nodes, { elementId: "p7", position: { x: 1, y: 640 } }] };
  const model = { ...MODEL, p7: punt("p7", "B") };
  const b = teken("seq-levenslijn", MODEL.B, LIJN, { diagram: diep, elements: model });
  assert.equal(b.box.h, 640 + 12 + 120, "laagste punt (640 + 12) + marge 120");
  assert.equal(teken("seq-levenslijn", MODEL.A, LIJN, { diagram: diep, elements: model }).box.h, 500, "alleen de eigen punten tellen");
  const bewaard = teken("seq-levenslijn", MODEL.B, LIJN, { diagram: diep, elements: model, maat: { w: 14, h: 300 } });
  assert.equal(bewaard.box.h, 772, "een bewaarde maat van 300 houdt de lijn niet kort");
  assert.deepEqual(bewaard.box.ondergrens, { h: 772 }, "het canvas zet dit als minimum voor de resizer");
  const lang = teken("seq-levenslijn", MODEL.B, LIJN, { diagram: diep, elements: model, maat: { w: 14, h: 900 } });
  assert.equal(lang.box.h, 900, "langer mag");
});

test("levenslijn met type (instantieVan): naam:Type onderstreept via de host; onvindbaar met waarschuwing; zonder host alleen de naam", () => {
  const typed = el("levenslijn", "jan", { instantieVan: { profielId: "p", elementId: "e" } });
  try {
    assert.deepEqual(levenslijnNaam(typed, {}), { tekst: "jan", onderstreept: true }, "server: geen host");
    assert.deepEqual(levenslijnNaam(typed, { verwijzingLabel: () => "Persoon" }), { tekst: "jan:Persoon", onderstreept: true });
    assert.deepEqual(levenslijnNaam({ ...typed, naam: "" }, { verwijzingLabel: () => "Persoon" }), { tekst: ":Persoon", onderstreept: true }, "anonieme instantie");
    assert.deepEqual(levenslijnNaam(typed, { verwijzingLabel: () => null }), { tekst: "jan ⚠", onderstreept: true });
    zetHost({ verwijzingLabel: () => "Persoon" });
    const l = teken("seq-levenslijn", typed, LIJN);
    assert.deepEqual(l.teksten, ["jan:Persoon"]);
    assert.equal(l.inhoud.kinderen.find((k) => k.tag === "text").attrs["text-decoration"], "underline");
    assert.equal(levenslijnNaam(el("levenslijn", "los"), {}), undefined, "zonder type de gewone naam");
  } finally {
    _resetHostVoorTests();
  }
});

test("levenslijn als instantie van een element uit een ander profiel: de kop is de vorm van dat type", () => {
  const typed = el("levenslijn", "zs", { instantieVan: { profielId: "archimate", elementId: "c1" } });
  const vreemd = {
    element: { id: "c1", naam: "Zaaksysteem", elementType: "component", data: {}, compartimenten: [{ compartmentType: "x", velden: [] }] },
    elementType: { id: "component", shape: "seq-fragment", kleur: "#bfdbfe" },
  };
  try {
    zetHost({ verwijzingLabel: () => "Zaaksysteem", verwijzingVorm: () => vreemd });
    assert.equal(levenslijnNaam(typed, { verwijzingLabel: () => "Zaaksysteem" }), "", "de vorm van het type draagt naam:Type zelf");
    const l = teken("seq-levenslijn", typed, LIJN);
    const kop = l.omtrek.kinderen.at(-1);
    assert.equal(kop.attrs.transform, "translate(-67 0)", "148 breed, gecentreerd op de lijn");
    assert.match(JSON.stringify(kop), /"zs:Zaaksysteem"/);
    assert.equal(l.omtrek.kinderen[0].attrs.y1, 52, "de lijn begint onder de type-kop van 52");
    assert.ok(l.vak, "een vak, zodat er geen buitenlabel komt");
    assert.deepEqual(l.teksten, [], "geen eigen naamregel");
    // Een gekozen kop wint; een klasse-box als type voegt niets toe: rechthoek met naam:Type.
    assert.deepEqual(levenslijnNaam({ ...typed, data: { ...typed.data, kop: "actor" } }, { verwijzingLabel: () => "Zaaksysteem" }), { tekst: "zs:Zaaksysteem", onderstreept: true });
    zetHost({ verwijzingVorm: () => ({ ...vreemd, elementType: { id: "klasse", shape: "class-box" } }) });
    assert.deepEqual(levenslijnNaam(typed, { verwijzingLabel: () => "Zaaksysteem" }), { tekst: "zs:Zaaksysteem", onderstreept: true });
  } finally {
    _resetHostVoorTests();
  }
});

test("het beeld van een diagram omvat de koppen van de buitenste levenslijnen (de kop steekt 67 uit de node)", () => {
  const elements = {
    a: { id: "a", naam: "Gebruiker", elementType: "levenslijn", data: {}, compartimenten: [] },
    b: { id: "b", naam: "Zaaksysteem", elementType: "levenslijn", data: {}, compartimenten: [] },
  };
  const descriptor = { id: "sequence", elementTypes: [LIJN] };
  const beeld = (nodes) => tekenDiagram({ diagram: { id: "d", naam: "D", nodes, edges: [] }, elements, descriptor, idPrefix: "t" }).viewBox;
  // Getekend op het canvas: de node is 14 breed, de kop loopt van x - 67 tot x + 81.
  const smal = beeld([
    { elementId: "a", position: { x: 100, y: 40 }, size: { width: 14, height: 500 } },
    { elementId: "b", position: { x: 400, y: 40 }, size: { width: 14, height: 500 } },
  ]);
  assert.ok(smal.x <= 100 - 67, `de linkerkop valt binnen het beeld (viewBox begint op ${smal.x})`);
  assert.ok(smal.x + smal.w >= 400 + 81, `de rechterkop valt binnen het beeld (viewBox eindigt op ${smal.x + smal.w})`);
  // Een bewaarde doos van 160 x 70 (de MCP schreef die tot 06-11): ook dan de linkerkop in beeld.
  const breed = beeld([
    { elementId: "a", position: { x: 40, y: 40 }, size: { width: 160, height: 70 } },
    { elementId: "b", position: { x: 300, y: 40 }, size: { width: 160, height: 70 } },
  ]);
  assert.ok(breed.x <= 40 - 67, `de linkerkop valt binnen het beeld (viewBox begint op ${breed.x})`);
});

test("levenslijn is nooit breder dan 14: een bewaarde breedte (MCP, import) wordt afgeknipt, de hoogte niet", () => {
  const l = teken("seq-levenslijn", el("levenslijn", "Zaaksysteem"), LIJN, { ref: { size: { width: 160, height: 70 } } });
  assert.deepEqual([l.box.w, l.box.h], [14, 500], "14 breed, en tot de ondergrens van 500 hoog");
  assert.deepEqual(l.box.bovengrens, { w: 14 });
  const lang = teken("seq-levenslijn", el("levenslijn", "Zaaksysteem"), LIJN, { ref: { size: { width: 14, height: 900 } } });
  assert.deepEqual([lang.box.w, lang.box.h], [14, 900], "een langere lijn blijft lang");
  // Berichten lopen daardoor van lijn tot lijn, niet van de rand van een onzichtbaar kader.
  const elements = {
    a: { id: "a", naam: "A", elementType: "levenslijn", data: {}, compartimenten: [] },
    b: { id: "b", naam: "B", elementType: "levenslijn", data: {}, compartimenten: [] },
    m: { id: "m", naam: "vraag", elementType: "bericht", source: "a", target: "b", data: {} },
  };
  const descriptor = { id: "sequence", elementTypes: [LIJN, { id: "bericht", isConnector: true, bron: { elementTypes: ["levenslijn"] }, doel: { elementTypes: ["levenslijn"] }, edgePresentatie: { vorm: "recht", markerEnd: "pijl-dicht" } }] };
  const nodes = [
    { elementId: "a", position: { x: 40, y: 40 }, size: { width: 160, height: 70 } },
    { elementId: "b", position: { x: 300, y: 40 }, size: { width: 160, height: 70 } },
  ];
  const { boom } = tekenDiagram({ diagram: { id: "d", naam: "D", nodes, edges: [] }, elements, descriptor, idPrefix: "t" });
  const pad = JSON.stringify(boom).match(/"data-connector-id":"m","d":"([^"]+)"/)[1];
  assert.equal(pad, "M 59,290L 295,290", "van 5 voorbij de lijn van A (40 + 14) tot 5 voor de lijn van B (300)");
});
