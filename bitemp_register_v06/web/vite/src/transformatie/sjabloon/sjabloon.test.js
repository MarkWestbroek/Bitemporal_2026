import test from "node:test";
import assert from "node:assert/strict";
import { maakDocumentContext } from "./context.js";
import { schetsDiagramSvg, vormFamilie } from "./schets.js";
import { markdownNaarHtml, htmlDocument } from "./markdownNaarHtml.js";
import { renderSjabloon } from "./renderer.js";
import { SJABLOON_USE_CASE_OVERZICHT } from "./sjablonen.js";

const descriptor = {
  elementTypes: [
    { id: "actor", label: "Actor", shape: "uc-actor" },
    { id: "usecase", label: "Use case", shape: "uc-ellips", kleur: "#e0f2fe" },
    { id: "boundary", label: "Kader", shape: "boundary", achtergrond: true },
    { id: "associatie", label: "Associatie", isConnector: true, edgePresentatie: { lijn: "solid" } },
    { id: "include", label: "Include", isConnector: true, edgePresentatie: { lijn: "dash-4-3", markerEnd: "pijl-open" } },
  ],
};
const elements = {
  a: { id: "a", naam: "Klant", elementType: "actor", data: { toelichting: "Belt of mailt." }, compartimenten: [] },
  u1: { id: "u1", naam: "Bel op", elementType: "usecase", data: {}, compartimenten: [] },
  u2: { id: "u2", naam: "Voer gesprek", elementType: "usecase", data: {}, compartimenten: [{ compartmentType: "velden", velden: [{ naam: "kanaal", fieldType: "x", data: { typeLabel: "String" } }] }] },
  k: { id: "k", naam: "Kader", elementType: "boundary", data: {}, compartimenten: [] },
  as: { id: "as", naam: "", elementType: "associatie", source: "a", target: "u1", data: {} },
  inc: { id: "inc", naam: "", elementType: "include", source: "u1", target: "u2", data: {} },
};
const diagrams = {
  d1: { id: "d1", naam: "Overzicht", diagramType: "usecase", nodes: [
    { elementId: "k", position: { x: 300, y: 50 }, size: { width: 300, height: 200 } },
    { elementId: "a", position: { x: 50, y: 100 } },
    { elementId: "u1", position: { x: 350, y: 80 } },
    { elementId: "u2", position: { x: 350, y: 180 } },
  ] },
};

test("context: elementen, velden, verbindingen in beide richtingen, diagrammen en lui svg", () => {
  let getekend = 0;
  const ctx = maakDocumentContext({
    naam: "Klant",
    profielen: [{ id: "usecase05", label: "Use case", descriptor, elements, diagrams }],
    svgVan: () => { getekend += 1; return "<svg/>"; },
  });
  assert.equal(ctx.map.naam, "Klant");
  assert.deepEqual(ctx.elementen.map((e) => e.naam), ["Klant", "Bel op", "Voer gesprek", "Kader"]);
  const bel = ctx.elementen.find((e) => e.naam === "Bel op");
  assert.deepEqual(bel.verbindingen.map((v) => [v.type.id, v.richting, v.ander.naam]), [["associatie", "in", "Klant"], ["include", "uit", "Voer gesprek"]]);
  assert.deepEqual(ctx.elementen[2].velden, [{ naam: "kanaal", compartiment: "velden", fieldType: "x", type: "String", data: { typeLabel: "String" } }]);
  assert.equal(ctx.elementen[0].toelichting, "Belt of mailt.");
  assert.deepEqual(bel.diagrammen, [{ id: "d1", naam: "Overzicht" }]);
  assert.equal(ctx.diagrammen[0].aantal, 4);
  assert.equal(getekend, 0, "svg is lui");
  assert.equal(ctx.diagrammen[0].svg(), "<svg/>");
  assert.equal(getekend, 1);
});

test("schets: vormfamilies, deterministische SVG met kader, actor, ellipsen en lijnen", () => {
  assert.equal(vormFamilie("uc-ellips"), "ellips");
  assert.equal(vormFamilie("uc-actor"), "actor");
  assert.equal(vormFamilie("boundary"), "kader");
  assert.equal(vormFamilie("class-box"), "vak");
  assert.equal(vormFamilie("bpmn-event"), "punt");
  const svg = schetsDiagramSvg({ diagram: diagrams.d1, elements, descriptor });
  assert.match(svg, /^<svg xmlns="http:\/\/www.w3.org\/2000\/svg" viewBox=/);
  assert.match(svg, /<ellipse /);
  assert.match(svg, /stroke-dasharray="6 4"/, "kader gestippeld");
  assert.match(svg, /stroke-dasharray="4 3"/, "include gestreept");
  assert.match(svg, /marker-end="url\(#s-pijl-open\)"/);
  assert.match(svg, /«include»/);
  assert.match(svg, /Voer gesprek/);
  assert.equal(svg, schetsDiagramSvg({ diagram: diagrams.d1, elements, descriptor }), "deterministisch");
  assert.equal(schetsDiagramSvg({ diagram: { nodes: [] }, elements, descriptor }), "");
});

test("markdown → html: koppen, lijsten, tabel, inline opmaak, rauwe svg, escaping", () => {
  const html = markdownNaarHtml(`# Kop\n\nTekst met **vet** en *cursief* en <b>.\n\n- een\n- twee\n\n| A | B |\n|---|---|\n| 1 | 2 |\n\n<svg xmlns="x"><rect/></svg>\n\n1. eerst`);
  assert.match(html, /<h1>Kop<\/h1>/);
  assert.match(html, /<strong>vet<\/strong> en <em>cursief<\/em> en &lt;b&gt;/);
  assert.match(html, /<ul><li>een<\/li><li>twee<\/li><\/ul>/);
  assert.match(html, /<table><thead><tr><th>A<\/th><th>B<\/th><\/tr><\/thead><tbody><tr><td>1<\/td><td>2<\/td><\/tr><\/tbody><\/table>/);
  assert.match(html, /<svg xmlns="x"><rect\/><\/svg>/);
  assert.match(html, /<ol><li>eerst<\/li><\/ol>/);
  assert.match(htmlDocument({ titel: "T <x>", fragment: "<p>f</p>" }), /<title>T &lt;x&gt;<\/title>[\s\S]*<p>f<\/p>/);
});

test("ingebouwd use case-overzicht rendert op de context", () => {
  const ctx = maakDocumentContext({ naam: "Klant", profielen: [{ id: "usecase05", label: "Use case", descriptor, elements, diagrams }], svgVan: () => "<svg/>" });
  const { tekst, meta } = renderSjabloon(SJABLOON_USE_CASE_OVERZICHT, ctx);
  assert.equal(meta.titel, "Use case-overzicht Klant");
  assert.match(tekst, /## Diagram: Overzicht\n\n<svg\/>/);
  assert.match(tekst, /# Actoren\n\n## Klant\n\nBelt of mailt\.\n\n- Bel op\n/);
  assert.match(tekst, /## Bel op\n\n\| \| \|\n\|---\|---\|\n\| Actoren \| Klant \|\n\| Bevat \(include\) \| Voer gesprek \|/);
  assert.match(tekst, /\| Op diagram \| Overzicht \|/);
});

test("diagramvolgorde volgt de boom over profielen heen; start-pijl in de schets", () => {
  const desc2 = { elementTypes: [{ id: "x", label: "X", shape: "rounded" }, { id: "rel", label: "Rel", isConnector: true, edgePresentatie: { lijn: "solid", markerStart: "pijl-open", markerEnd: null } }] };
  const ctx = maakDocumentContext({
    naam: "M",
    profielen: [
      { id: "usecase05", label: "UC", descriptor, elements, diagrams: { d1: { ...diagrams.d1, naam: "Actor model" } } },
      { id: "archimate05", label: "AM", descriptor: desc2, elements: {}, diagrams: { c: { id: "c", naam: "Context", nodes: [] } } },
    ],
    diagramVolgorde: { "archimate05::c": 0, "usecase05::d1": 1 },
  });
  assert.deepEqual(ctx.diagrammen.map((d) => d.naam), ["Context", "Actor model"]);
  const svg = schetsDiagramSvg({
    diagram: { nodes: [{ elementId: "a", position: { x: 0, y: 0 } }, { elementId: "b", position: { x: 0, y: 200 } }] },
    elements: { a: { id: "a", naam: "A", elementType: "x" }, b: { id: "b", naam: "B", elementType: "x" }, r: { id: "r", elementType: "rel", source: "b", target: "a" } },
    descriptor: desc2,
  });
  assert.match(svg, /marker-start="url\(#s-pijl-open-start\)"/);
  assert.match(svg, /orient="auto-start-reverse"/);
  assert.doesNotMatch(svg, /marker-end=/);
});
