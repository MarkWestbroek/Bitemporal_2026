/**
 * Tests voor de tekenaar (plan 2026-11-04 Eén tekenaar, stap 2).
 * Golden file bijwerken: UPDATE_GOLDEN=1 node --import ./test/register-aliases.mjs --test src/diagramcore/tekenaar/tekenaar.test.js
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { fileURLToPath } from "node:url";
import { tekenDiagram, diagramSvg, naarSvg, vormVoor, vakOmvang } from "./index.js";
import { BASIS_SHAPETYPES } from "./basisVormen.js";
import { tekenbareVorm, valideerVormBoom, valideerVak, losStijlOp } from "../types/shapeType.js";
import { planInhoud } from "./inhoud.js";

const hier = (p) => fileURLToPath(new URL(p, import.meta.url));

const descriptor = {
  id: "proef",
  elementTypes: [
    { id: "klasse", label: "Klasse", shape: "class-box", stereotype: "«klasse»", compartments: [{ id: "attributen" }], hooks: { inhoudsregels: (el) => (el.data?.reqId ? [{ delen: [{ tekst: el.data.reqId, soort: "id", veld: "reqId" }, { tekst: el.data.status || "", soort: "status" }] }] : []) } },
    { id: "notitie", label: "Notitie", shape: "note", beschrijving: false },
    { id: "kader", label: "Kader", shape: "boundary", achtergrond: true, containerVoor: "bevat", minBreedte: 240, minHoogte: 160 },
    { id: "usecase", label: "Use case", shape: "ellips" },
    { id: "actor", label: "Actor", shape: "actor" },
    { id: "event", label: "Event", shape: "bpmn-event", naamLabel: "buiten", minBreedte: 36, minHoogte: 36 },
    { id: "associatie", label: "Associatie", isConnector: true, bron: { elementTypes: ["klasse", "usecase", "actor"] }, doel: { elementTypes: ["klasse", "usecase", "actor"] }, edgePresentatie: { lijn: "solid", markerEnd: "pijl-open", vorm: "recht" }, hooks: { edgeLabels: (c) => ({ kaal: [{ zijde: "bron", delen: [{ tekst: c.data?.bronKard || "", soort: "kardinaliteit" }] }, { zijde: "doel", delen: [{ tekst: c.data?.doelKard || "", soort: "kardinaliteit" }] }] }) } },
    { id: "generalisatie", label: "Generalisatie", isConnector: true, bron: { elementTypes: ["klasse"] }, doel: { elementTypes: ["klasse"] }, edgePresentatie: { lijn: "solid", markerEnd: "driehoek", vorm: "hoekig", kleur: "#475569" } },
    { id: "bevat", label: "Bevat", isConnector: true, bron: { elementTypes: ["kader"] }, doel: { elementTypes: ["klasse"] }, edgePresentatie: { lijn: "dash-4-3", verbergBijNesting: true } },
    { id: "afhankelijkheid", label: "Afhankelijkheid", isConnector: true, bron: { elementTypes: ["klasse"] }, doel: { elementTypes: ["klasse", "notitie"] }, edgePresentatie: { lijn: "dash-6-3", markerEnd: "pijl-open", markerStart: "ruit" } },
  ],
  fieldTypes: [{ id: "attribuut", viewer: "naam-type" }],
  compartmentTypes: [{ id: "attributen", label: "attributen" }],
};

const elements = {
  k1: { id: "k1", naam: "Klant", elementType: "klasse", data: { reqId: "R-1", status: "open" }, compartimenten: [{ compartmentType: "attributen", velden: [{ naam: "naam", fieldType: "attribuut", data: { typeLabel: "string", verplicht: true } }, { naam: "email", fieldType: "attribuut", data: { typeLabel: "string" } }] }] },
  k2: { id: "k2", naam: "Persoon met een behoorlijk lange naam", elementType: "klasse", data: { abstract: true, kleur: "#bfdbfe" }, compartimenten: [] },
  k3: { id: "k3", naam: "Lid", elementType: "klasse", data: {}, compartimenten: [] },
  n1: { id: "n1", naam: "", elementType: "notitie", data: { tekst: "Een notitie met wat tekst die over meerdere regels mag lopen." } },
  kd: { id: "kd", naam: "Systeem", elementType: "kader", data: { kleur: "#0ea5e9" } },
  u1: { id: "u1", naam: "Bestellen", elementType: "usecase", data: {} },
  a1: { id: "a1", naam: "Koper", elementType: "actor", data: {} },
  e1: { id: "e1", naam: "Bericht ontvangen", elementType: "event", data: {} },
  c1: { id: "c1", naam: "heeft", elementType: "associatie", source: "k1", target: "k2", data: { bronKard: "1", doelKard: "0..*" } },
  c2: { id: "c2", naam: "", elementType: "generalisatie", source: "k3", target: "k2", data: {} },
  c3: { id: "c3", naam: "", elementType: "bevat", source: "kd", target: "k3", data: {} },
  c4: { id: "c4", naam: "ziet", elementType: "afhankelijkheid", source: "k1", target: "n1", data: { knikken: [{ x: 60, y: 300 }] } },
  c5: { id: "c5", naam: "zelf", elementType: "associatie", source: "k1", target: "k1", data: {} },
  c6: { id: "c6", naam: "", elementType: "associatie", source: "a1", target: "u1", data: {} },
  c7: { id: "c7", naam: "verborgen", elementType: "associatie", source: "k2", target: "k3", data: {} },
};

const diagram = {
  id: "d1",
  naam: "Proef",
  nodes: [
    { elementId: "kd", position: { x: 300, y: 0 }, size: { width: 300, height: 220 } },
    { elementId: "k3", position: { x: 340, y: 60 } },
    { elementId: "k1", position: { x: 0, y: 0 } },
    { elementId: "k2", position: { x: 0, y: 160 }, size: { width: 200, height: 80 } },
    { elementId: "n1", position: { x: 0, y: 340 }, size: { width: 160, height: 80 } },
    { elementId: "u1", position: { x: 700, y: 40 } },
    { elementId: "a1", position: { x: 560, y: 320 } },
    { elementId: "e1", position: { x: 720, y: 320 } },
  ],
  verborgenConnectoren: ["c7"],
};

const invoer = { diagram, elements, descriptor, idPrefix: "p", controleer: true };

test("tekent een diagram volgens het vormcontract, met terugval voor vormen zonder ShapeType", () => {
  const { boom, viewBox, terugval } = tekenDiagram(invoer);
  assert.equal(boom.tag, "svg");
  assert.ok(viewBox.w > 700 && viewBox.h > 300);
  assert.deepEqual(terugval, ["actor", "bpmn-event", "ellips"]);
});

test("is deterministisch", () => {
  assert.equal(diagramSvg(invoer), diagramSvg(invoer));
});

test("inhoud is van de motor: velden, naam en inhoudsregels dragen de sleutels voor inline bewerken", () => {
  const svg = diagramSvg(invoer);
  assert.match(svg, /data-dc-veld="attributen:0"/);
  assert.match(svg, /data-dc-veld="reqId"/);
  assert.match(svg, /data-dc-naam=""[^>]*>Klant</);
  assert.match(svg, /«klasse»/);
  assert.match(svg, /font-weight="700"[^>]*>naam</, "verplicht veld is vet");
  assert.match(svg, /text-anchor="end"[^>]*>string</, "type rechts");
  // Abstracte klasse: naam cursief, eigen kleur letterlijk, tekst op contrast.
  assert.match(svg, /fill="#bfdbfe"/);
  assert.match(svg, /font-style="italic" fill="#0f172a" data-dc-naam=""/);
});

test("lijnen: markers in defs, verborgen en genest-verborgen lijnen weg, knikken, zelf-lus, labels", () => {
  const svg = diagramSvg(invoer);
  assert.match(svg, /<marker id="p-pijl-open-[a-z0-9]+" /);
  assert.match(svg, /<marker id="p-driehoek-[a-z0-9]+" /);
  assert.match(svg, /<marker id="p-pijl-open-[a-z0-9]+" markerWidth="12" markerHeight="10" refX="9" refY="5" orient="auto" markerUnits="strokeWidth"/, "maten en eenheden als het canvas");
  assert.match(svg, /data-connector-id="c4"[^>]*marker-end="url\(#p-pijl-open-[a-z0-9]+\)"[^>]*\/><polygon points="[^"]+" fill="[^"]+" stroke=/, "de ruit als polygon op het begin van de lijn, zoals het canvas");
  assert.doesNotMatch(svg, /data-connector-id="c7"/, "verborgen connector");
  assert.doesNotMatch(svg, /data-connector-id="c3"/, "lid ín zijn kader: lidmaatschapslijn weg");
  assert.match(svg, /data-connector-id="c4" d="M [\d.-]+ [\d.-]+ L 60 300 L /, "knik");
  assert.match(svg, /data-connector-id="c5" d="M [\d.-]+ [\d.-]+ L [\d.-]+ [\d.-]+ L [\d.-]+ [\d.-]+ L [\d.-]+ [\d.-]+ L /, "zelf-lus als hoekig oortje boven → rechts (ConnectorEdge.lusPad)");
  assert.match(svg, />0\.\.\*</, "kardinaliteit bij het doel");
  assert.match(svg, /data-dc-veld="connector:c1:naam"[^>]*>heeft</);
  assert.match(svg, /data-connector-id="c2" d="M[\d.-]+ [\d.-]+L[^"]*Q[^"]*"/, "hoekig = React Flow smoothstep met ronde hoeken, zoals het canvas");
  assert.match(svg, /<rect [^>]*rx="4" fill="var\(--diagram-surface, #ffffff\)" fill-opacity="0.9"[^>]*\/><text [^>]*data-dc-veld="connector:c1:naam"/, "label als chip");
});

test("buitenlabel onder een vorm zonder inhoudsvak; kader met eigen kleur; thema-tokens voor de rest", () => {
  const svg = diagramSvg(invoer);
  assert.match(svg, /class="dc-buitenlabel"[^>]*>Bericht ontvangen</);
  assert.match(svg, /stroke="#0ea5e9"/, "kaderrand in de elementkleur");
  assert.match(svg, /var\(--diagram-surface, #ffffff\)/);
  assert.match(svg, /var\(--diagram-border, #64748b\)/);
  const licht = diagramSvg({ ...invoer, thema: "light" });
  assert.doesNotMatch(licht, /var\(--diagram/);
});

test("golden: klein proefdiagram", () => {
  const svg = diagramSvg(invoer);
  const pad = hier("./fixtures/proef.svg");
  if (process.env.UPDATE_GOLDEN || !fs.existsSync(pad)) {
    fs.mkdirSync(hier("./fixtures"), { recursive: true });
    fs.writeFileSync(pad, svg);
  }
  assert.equal(svg, fs.readFileSync(pad, "utf8"));
});

test("detail schets geeft de lichte stand; een leeg diagram geeft niets", () => {
  const schets = diagramSvg({ ...invoer, detail: "schets" });
  assert.match(schets, /^<svg /);
  assert.doesNotMatch(schets, /data-tekenaar/);
  assert.equal(diagramSvg({ ...invoer, diagram: { id: "x", nodes: [] } }), "");
  assert.match(diagramSvg(invoer), /data-tekenaar="vol"/);
});

test("alle basis-ShapeTypes zijn tekenbaar en geven geldige VormBomen", () => {
  const element = { id: "e", naam: "Proef", elementType: "x", data: { tekst: "t", specificatie: "a > b" }, compartimenten: [{ compartmentType: "c", velden: [{ naam: "v", data: {} }] }] };
  for (const st of BASIS_SHAPETYPES) {
    assert.ok(tekenbareVorm(st.id), st.id);
    const { shapeType, renderer, terugval } = vormVoor(st.id);
    assert.equal(terugval, false, st.id);
    const ctx = { element, elementType: {}, shapeType, parameters: shapeType.parameters || {}, maat: { w: 200, h: 90 }, stijl: losStijlOp(element, {}), node: null, diagram: {}, thema: { surface: "#fff", border: "#000", text: "#000", muted: "#666", accent: "#00f", vulling: "#fff", rand: "#000", inkt: "#000", gedempt: "#666" }, idPrefix: "q" };
    assert.deepEqual(valideerVormBoom(renderer.omtrek(ctx), { idPrefix: "q" }), [], st.id);
    const vak = renderer.inhoudsvak(ctx);
    if (vak) assert.deepEqual(valideerVak(vak), [], st.id);
    if (renderer.ornament) assert.deepEqual(valideerVormBoom(renderer.ornament(ctx), { idPrefix: "q" }), [], st.id);
    if (renderer.rand) {
      const p = renderer.rand(ctx, 0);
      assert.ok(Number.isFinite(p.x) && Number.isFinite(p.y), st.id);
    }
  }
});

test("planInhoud meet natuurlijke breedte en hoogte; naam breekt af binnen een smal vak", () => {
  const el = { naam: "Een behoorlijk lange elementnaam", data: {}, compartimenten: [] };
  const breed = planInhoud({ element: el, elementType: { stereotype: "«t»" }, breedte: Infinity });
  const smal = planInhoud({ element: el, elementType: { stereotype: "«t»" }, breedte: 120 });
  assert.ok(breed.minW > 120);
  assert.ok(smal.h > breed.h);
  assert.equal(breed.blokken.find((b) => b.soort === "naam").regels.length, 1);
});

test("naarSvg escapet tekst en schrijft attributen in volgorde", () => {
  assert.equal(naarSvg({ tag: "text", attrs: { x: 1.26, y: 2 }, kinderen: ["a < b"] }), '<text x="1.3" y="2">a &lt; b</text>');
});

test("vakOmvang: een gedraaid inhoudsvak telt na het draaien om zijn midden (pool: de staande band)", () => {
  assert.deepEqual(vakOmvang({ x: -67, y: 0, w: 148, h: 30 }), { x0: -67, y0: 0, x1: 81, y1: 30 });
  // Pool van 320 x 160 met een band van 30: het vak ligt ervoor (x -65), gedraaid valt het op de band.
  const o = vakOmvang({ x: 15 - 80, y: 80 - 15, w: 160, h: 30, rotatie: -90 });
  assert.deepEqual([o.x0, o.y0, o.x1, o.y1].map((v) => Math.round(v * 1000) / 1000 + 0), [0, 0, 30, 160]);
});
