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
  assert.deepEqual(ctx.elementen[2].velden, [{ naam: "kanaal", compartiment: "velden", fieldType: "x", type: "String", beschrijving: "", data: { typeLabel: "String" } }]);
  assert.equal(ctx.elementen[0].toelichting, "Belt of mailt.");
  assert.equal(ctx.elementen[0].beschrijving, "Belt of mailt.", "de M3-beschrijving; toelichting is een alias");
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

test("markdown met afbeeldingen: inline svg wordt een link naar een los bestand, alt uit de kop", async () => {
  const { markdownMetAfbeeldingen } = await import("./markdownMetAfbeeldingen.js");
  const md = "# Doc\n\n## Diagram: Actor model\n\n<svg viewBox=\"0 0 1 1\"><rect/></svg>\n\ntekst\n\n<svg xmlns=\"http://www.w3.org/2000/svg\"><g/></svg>\n";
  const uit = markdownMetAfbeeldingen(md, "Mijn doc");
  assert.equal(uit.bestanden.length, 2);
  assert.deepEqual(uit.bestanden.map((b) => b.naam), ["Mijn_doc-d1.svg", "Mijn_doc-d2.svg"]);
  assert.match(uit.markdown, /!\[Actor model\]\(Mijn_doc-d1\.svg\)/);
  assert.match(uit.markdown, /!\[Actor model\]\(Mijn_doc-d2\.svg\)/, "dichtstbijzijnde kop erboven");
  assert.doesNotMatch(uit.markdown, /<svg/);
  assert.match(uit.bestanden[0].inhoud, /^<\?xml[^>]*>\n<svg xmlns="http:\/\/www\.w3\.org\/2000\/svg" viewBox/);
});

test("zip: geldig STORE-archief met UTF-8-namen en juiste CRC", async () => {
  const { maakZip, crc32 } = await import("./zip.js");
  assert.equal(crc32(new TextEncoder().encode("123456789")), 0xcbf43926);
  const zip = maakZip([{ naam: "a.md", inhoud: "# hoi" }, { naam: "één.svg", inhoud: "<svg/>" }], new Date(2026, 9, 10, 12, 0, 0));
  const dv = new DataView(zip.buffer);
  assert.equal(dv.getUint32(0, true), 0x04034b50);
  const eind = zip.length - 22;
  assert.equal(dv.getUint32(eind, true), 0x06054b50);
  assert.equal(dv.getUint16(eind + 10, true), 2);
  const cdStart = dv.getUint32(eind + 16, true);
  assert.equal(dv.getUint32(cdStart, true), 0x02014b50);
});

test("map- en diagrambeschrijving: context heeft beschrijving (omschrijving als alias), diagramtekst lekt niet", async () => {
  const { maakDocumentContext } = await import("./context.js");
  const { renderSjabloon } = await import("./renderer.js");
  const { DEEL_PROJECTMAP } = await import("./sjablonen.js");
  const dia = { d1: { id: "d1", naam: "Plaat", nodes: [], beschrijving: "Wat de plaat laat zien." }, d2: { id: "d2", naam: "Tweede", nodes: [] } };
  const ctx = maakDocumentContext({ naam: "Hoofdstuk", omschrijving: "Inleidende tekst.", profielen: [{ id: "p", label: "P", descriptor: { elementTypes: [] }, elements: {}, diagrams: dia }], svgVan: () => "<svg/>" });
  assert.equal(ctx.beschrijving, "Inleidende tekst.");
  assert.equal(ctx.map.omschrijving, "Inleidende tekst.");
  const { tekst } = renderSjabloon(DEEL_PROJECTMAP, ctx);
  assert.equal(tekst.split("Inleidende tekst.").length - 1, 1, "maptekst één keer, niet onder elk diagram");
  assert.match(tekst, /\*Plaat\*\n\nWat de plaat laat zien\./);
});

test("schetsMaat: ovaal en actor zonder opgeslagen maat rekenen zoals het canvas (13-10)", async () => {
  const { schetsMaat } = await import("./schets.js");
  const uc = { id: "usecase", shape: "uc-ellips" };
  // Gemeten canvasbreedtes (13-10): 150 / 173 / 193 / 216 / 280; ±4px marge.
  const meting = [["Behandel issue", 150], ["Zet issue door (na triage)", 173], ["Beheer gegevensvoorziening", 193], ["Sluit gemeente aan (onboarding)", 216], ["Zet issue door naar ketenpartner (bijv. leverancier)", 280]];
  for (const [naam, breed] of meting) {
    const { w, h } = schetsMaat(null, { naam }, uc);
    assert.ok(Math.abs(w - breed) <= 4, `${naam}: schets ${w}, canvas ${breed}`);
    assert.ok(h >= 60);
  }
  const act = schetsMaat(null, { naam: "Medewerker Service-organisatie" }, { id: "actor", shape: "uc-actor" });
  assert.deepEqual([act.w, act.h], [64, 84]);
  // Opgeslagen maat wint altijd.
  assert.deepEqual([schetsMaat({ size: { width: 333, height: 77 } }, { naam: "x" }, uc).w, schetsMaat({ size: { width: 333, height: 77 } }, { naam: "x" }, uc).h], [333, 77]);
});

test("schets (melding #8): naast elkaar = horizontale lijn, boven elkaar = verticale; kardinaliteit bij het uiteinde", () => {
  const descriptor = { id: "t", elementTypes: [
    { id: "klasse", shape: "class-box" },
    { id: "assoc", isConnector: true, hooks: { edgeLabels: (c) => ({ kaal: c.data?.doelKardinaliteit ? [{ zijde: "doel", delen: [{ tekst: c.data.doelKardinaliteit }] }] : [] }) } },
  ] };
  const elements = {
    a: { id: "a", naam: "pakket", elementType: "klasse", compartimenten: [{ velden: [{ naam: "x" }, { naam: "y" }, { naam: "z" }] }] },
    b: { id: "b", naam: "opties", elementType: "klasse", compartimenten: [] },
    c: { id: "c", naam: "onder", elementType: "klasse", compartimenten: [] },
    ab: { id: "ab", elementType: "assoc", source: "a", target: "b", data: { doelKardinaliteit: "0..*" } },
    ac: { id: "ac", elementType: "assoc", source: "a", target: "c" },
  };
  const diagram = { nodes: [
    { elementId: "a", position: { x: 0, y: 100 }, size: { width: 180, height: 106 } },
    { elementId: "b", position: { x: 300, y: 110 }, size: { width: 180, height: 88 } },
    { elementId: "c", position: { x: 20, y: 400 }, size: { width: 160, height: 70 } },
  ] };
  const svg = schetsDiagramSvg({ diagram, elements, descriptor });
  const lijnen = [...svg.matchAll(/<line x1="([\d.-]+)" y1="([\d.-]+)" x2="([\d.-]+)" y2="([\d.-]+)"/g)].map((m) => m.slice(1).map(Number));
  const horizontaal = lijnen.find(([x1, , x2]) => x1 === 180 && x2 === 300);
  assert.ok(horizontaal, "lijn van rechterrand pakket naar linkerrand opties");
  assert.equal(horizontaal[1], horizontaal[3], "horizontaal: y1 === y2");
  const verticaal = lijnen.find(([, y1, , y2]) => y1 === 206 && y2 === 400);
  assert.ok(verticaal && verticaal[0] === verticaal[2], "verticaal: x1 === x2");
  assert.match(svg, />0\.\.\*</, "kardinaliteit getekend");
});
