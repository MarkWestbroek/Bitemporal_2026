// taal=studio met een eigen descriptor; de echte profielen test render-svc/server.test.mjs.
import test from "node:test";
import assert from "node:assert/strict";
import { renderStudioSvg, studioViews } from "./studio.js";
import { tekenDiagram, naarSvg } from "../diagramcore/tekenaar/index.js";

const descriptor = {
  elementTypes: [
    { id: "actor", shape: "actor" },
    { id: "uc", shape: "ellips", kleur: "#1e3a8a" },
    { id: "assoc", isConnector: true, edgePresentatie: { markerEnd: "pijl-open" } },
  ],
};
const bundel = { descriptorVan: (id) => (id === "p1" ? descriptor : undefined), tekenDiagram, naarSvg };

const inhoud = {
  diagramTypeId: "p1",
  elements: {
    a: { id: "a", naam: "Klant", elementType: "actor" },
    u: { id: "u", naam: "Bestel <nu>", elementType: "uc" },
    r: { id: "r", elementType: "assoc", source: "a", target: "u" },
  },
  diagrams: {
    d1: { id: "d1", naam: "Eerste", nodes: [{ elementId: "a", position: { x: 0, y: 0 } }, { elementId: "u", position: { x: 200, y: 0 } }] },
    d2: { id: "d2", naam: "Tweede", nodes: [{ elementId: "a", position: { x: 0, y: 0 } }] },
    leeg: { id: "leeg", naam: "Leeg", nodes: [] },
  },
};
const invoer = (extra = {}) => ({ taal: "studio", model: inhoud, diagram: "Eerste", ...extra });

const faalt = (fn, status, tekst) =>
  assert.throws(fn, (e) => {
    assert.equal(e.status, status);
    if (tekst) assert.match(e.detail, tekst);
    return true;
  });

test("voldoet aan de SVG-eisen", () => {
  const svg = renderStudioSvg(invoer(), bundel);
  const wortel = /^<svg[^>]*>/.exec(svg)[0];
  assert.match(wortel, /viewBox="/);
  assert.doesNotMatch(wortel, /\b(width|height)="/);
  assert.match(wortel, /role="img"/);
  assert.match(wortel, /aria-label="Model — Eerste: 2 elementen \(Klant, Bestel &lt;nu&gt;\)"/);
  assert.match(svg, /<title id="[^"]+">Model — Eerste<\/title>/);
  assert.match(svg, /var\(--diagram-surface, #ffffff\)/);
  assert.doesNotMatch(svg, /<(script|style|foreignObject|image)\b|\son[a-z]+=|href=/i);
});

test("byte-gelijk, en stabiele id's met idPrefix", () => {
  assert.equal(renderStudioSvg(invoer(), bundel), renderStudioSvg(invoer(), bundel));
  const svg = renderStudioSvg(invoer({ idPrefix: "fig" }), bundel);
  assert.match(svg, /<title id="fig-titel">/);
  const marker = /<marker id="(fig-pijl-open[^"]*)"/.exec(svg)[1];
  assert.ok(svg.includes(`marker-end="url(#${marker})"`));
});

test("tekst op een gekleurd element kiest op contrast, ook als het thema donker is", () => {
  const svg = renderStudioSvg(invoer({ theme: "dark" }), bundel);
  assert.match(svg, /<text [^>]*fill="#ffffff"[^>]*>Bestel &lt;nu&gt;/);
  assert.doesNotMatch(svg, /var\(--diagram-/);
});

test("een kleur uit het model die geen #hex is, komt er niet door", () => {
  const model = structuredClone(inhoud);
  model.elements.u.data = { kleur: "url(https://example.org/x.svg#a)" };
  const svg = renderStudioSvg(invoer({ model }), bundel);
  assert.doesNotMatch(svg, /url\(https/);
});

test("de witte lijst geldt ook voor wat een ShapeRenderer zelf kiest", () => {
  const boom = { tag: "svg", attrs: { xmlns: "x", viewBox: "0 0 1 1", role: "img" }, kinderen: [{ tag: "g", attrs: {}, kinderen: [{ tag: "rect", attrs: { fill: "url(https://example.org/x.svg#a)", stroke: "#abc" }, kinderen: [] }] }] };
  const vals = { ...bundel, tekenDiagram: () => ({ boom, viewBox: { x: 0, y: 0, w: 1, h: 1 }, terugval: [] }) };
  const svg = renderStudioSvg(invoer(), vals);
  assert.doesNotMatch(svg, /url\(https/);
  assert.match(svg, /<rect fill="var\(--diagram-surface, #ffffff\)" stroke="#abc"/);
});

test("een ShapeRenderer die de SVG-eisen breekt, wordt niet uitgeleverd", () => {
  // De tekenaar toetst met controleer; hier: de vlag staat aan.
  let vlag;
  renderStudioSvg(invoer(), { ...bundel, tekenDiagram: (i) => ((vlag = i.controleer), tekenDiagram(i)) });
  assert.equal(vlag, true);
});

test("tekent met de tekenaar, niet met de schets", () => {
  assert.match(renderStudioSvg(invoer(), bundel), /data-tekenaar="vol"/);
});

test("kiest op id of naam; fouten noemen de keuzes", () => {
  assert.match(renderStudioSvg(invoer({ diagram: "d2" }), bundel), /Tweede/);
  assert.throws(() => renderStudioSvg(invoer({ diagram: undefined }), bundel), (e) => e.status === 400 && e.extra.diagrammen.length === 3);
  assert.throws(() => renderStudioSvg(invoer({ diagram: "Niets" }), bundel), (e) => e.status === 404 && e.extra.diagrammen.length === 3);
  faalt(() => renderStudioSvg(invoer({ diagram: "Leeg" }), bundel), 422, /geen elementen/);
});

test("project met meer profielen; dezelfde naam vraagt om 'profiel'", () => {
  const model = { formaat: "studio-project", project: { naam: "Proj" }, profielen: { p1: inhoud, p2: inhoud } };
  assert.equal(studioViews({ taal: "studio", model }).weergaven.length, 6);
  faalt(() => renderStudioSvg({ taal: "studio", model, diagram: "d1" }, bundel), 400, /Meer diagrammen/);
  assert.match(renderStudioSvg({ taal: "studio", model, profiel: "p1", diagram: "Eerste" }, bundel), /<title[^>]*>Proj — Eerste/);
  faalt(() => renderStudioSvg({ taal: "studio", model, profiel: "p9", diagram: "d1" }, bundel), 404, /p9/);
});

test("422 noemt het element; onbekend profiel en geen Studio-model", () => {
  const onbekendType = structuredClone(inhoud);
  onbekendType.elements.a.elementType = "weg";
  assert.throws(() => renderStudioSvg(invoer({ model: onbekendType }), bundel), (e) => e.status === 422 && e.extra.element === "Klant");
  const raarPunt = structuredClone(inhoud);
  raarPunt.diagrams.d1.nodes[0].position.x = "links";
  assert.throws(() => renderStudioSvg(invoer({ model: raarPunt }), bundel), (e) => e.status === 422 && e.extra.element === "Klant");
  faalt(() => renderStudioSvg(invoer({ model: { ...inhoud, diagramTypeId: "eigen" } }), bundel), 422, /niet bekend/);
  faalt(() => renderStudioSvg(invoer({ model: { iets: 1 } }), bundel), 422, /Geen Studio-model/);
  for (const nodes of [{}, [null]]) {
    const raar = structuredClone(inhoud);
    raar.diagrams.d1.nodes = nodes;
    faalt(() => renderStudioSvg(invoer({ model: raar }), bundel), 422, /ongeldige lijst/);
  }
});
