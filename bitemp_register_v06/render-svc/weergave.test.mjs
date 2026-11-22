// Het weergaveproject (plan 2026-11-21 Sidecar-project §7 stap 1): alle vormen van de tool als
// model in het profiel Weergave, en terug. Eigen proces (node --test): het register verandert.
import { test } from "node:test";
import assert from "node:assert/strict";
import { weergaveVanAlles, vormenVanDeTool, laadWeergavenInDeTool, descriptorVan, tekenDiagram, naarSvg } from "./dist/studio-profielen.mjs";

const perId = (lijst) => Object.fromEntries(lijst.map((st) => [st.id, st]));

test("elke vorm van de tool staat precies één keer in het project, in een map", () => {
  const project = weergaveVanAlles();
  const model = project.profielen.weergave05;
  const vormen = vormenVanDeTool();
  const namen = Object.values(model.elements).map((e) => e.naam);
  assert.equal(namen.length, vormen.length);
  assert.deepEqual([...namen].sort(), vormen.map((st) => st.id).sort());
  const { plaatsing, mappen } = project.structuur;
  for (const id of Object.keys(model.elements)) assert.ok(mappen[plaatsing[`el::weergave05::${id}`]], `${id} staat in een map`);
  // Een diagram per profiel, met de vormen die het gebruikt (ook gedeelde).
  const bpmn = Object.values(model.diagrams).find((d) => d.naam === "Vormen van BPMN");
  assert.ok(bpmn, "diagram van BPMN");
  assert.ok(bpmn.nodes.some((n) => model.elements[n.elementId].naam === "bpmn-taak"));
  assert.equal(project.profielVersies.weergave05, "0.1.0");
});

test("rondreis: de vormen uit het project zijn exact de vormen van de tool", () => {
  const voor = perId(vormenVanDeTool());
  const project = JSON.parse(JSON.stringify(weergaveVanAlles()));
  const { vervangen, nieuw, fouten } = laadWeergavenInDeTool(project);
  assert.deepEqual(fouten, []);
  assert.deepEqual(nieuw, []);
  assert.equal(vervangen.length, Object.keys(voor).length);
  assert.deepEqual(perId(vormenVanDeTool()), voor);
});

test("een gewijzigde vorm in het project verandert de tool; een onbekende renderer niet", () => {
  const project = JSON.parse(JSON.stringify(weergaveVanAlles()));
  const elements = project.profielen.weergave05.elements;
  const taak = Object.values(elements).find((e) => e.naam === "bpmn-taak");
  taak.data.minMaat = { w: 222, h: 99 };
  const stip = Object.values(elements).find((e) => e.naam === "act-begin");
  stip.data.renderer = "bestaat-niet";
  const { fouten } = laadWeergavenInDeTool(project);
  assert.deepEqual(fouten, ['vorm "act-begin": onbekende renderer "bestaat-niet"']);
  const vormen = perId(vormenVanDeTool());
  assert.deepEqual(vormen["bpmn-taak"].minMaat, { w: 222, h: 99 });
  assert.equal(vormen["act-begin"].renderer, "cirkel", "de oude vorm blijft");
});

test("een weergave tekent zichzelf: een icoon als tegel, een vorm in zijn eigen gedaante", () => {
  const descriptor = descriptorVan("weergave05");
  const elements = {
    i: { id: "i", naam: "vlag", elementType: "icoon", compartimenten: [], data: { svg: '<svg viewBox="0 0 24 24"><path d="M5 3v18" onclick="x()"/><script>alert(1)</script></svg>' } },
    v: { id: "v", naam: "bpmn-gateway", elementType: "vorm", compartimenten: [], data: { renderer: "bpmn-gateway", parameters: {} } },
    o: { id: "o", naam: "raar", elementType: "vorm", compartimenten: [], data: { renderer: "bestaat-niet" } },
  };
  const diagram = { id: "d", diagramType: "weergave", nodes: [{ elementId: "i", position: { x: 0, y: 0 } }, { elementId: "v", position: { x: 200, y: 0 } }, { elementId: "o", position: { x: 400, y: 0 } }], edges: [] };
  const { boom } = tekenDiagram({ diagram, elements, descriptor, controleer: true });
  const svg = naarSvg(boom);
  assert.match(svg, /dc-weergave-icoon/);
  assert.match(svg, /M5 3v18/);
  assert.doesNotMatch(svg, /onclick|script|alert/);
  assert.match(svg, /stroke-dasharray="5 4"/, "onbekende renderer: rood gestippeld");
});
