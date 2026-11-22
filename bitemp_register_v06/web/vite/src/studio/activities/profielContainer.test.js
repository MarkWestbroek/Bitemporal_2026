// profielContainer.test.js — het profiel als container in de M3-taal (Mark 22-11, plan Sidecar §9).
import test from "node:test";
import assert from "node:assert/strict";
import { registreerDiagramType, getDiagramType } from "../../diagramcore/types/typeRegistry.js";
import { ontwerpUitProfiel, bouwProfielUitOntwerp, profielJsonRegels, profielOntwerpKern } from "./profielOntwerp.js";
import { metProfielContainer, ledenVan, ontwerpStaatVan, profielenIn, PROFIEL_TYPE, BEVAT_TYPE } from "./profielContainer.js";
import { kernenUitProject } from "../profielenUitProject.js";

const TYPEN = [
  { id: "ding", label: "Ding", shape: "class-box", kleur: "#eeeeee", properties: [], compartments: [] },
  { id: "zaak", label: "Zaak", shape: "class-box", kleur: "#dddddd", properties: [], compartments: [] },
  { id: "kent", label: "kent", shape: "edge", isConnector: true, bron: { elementTypes: ["ding"] }, doel: { elementTypes: ["zaak"] } },
];
registreerDiagramType({
  id: "containerproef",
  label: "Containerproef",
  style: "uml-klassiek",
  fieldTypes: [],
  elementTypes: JSON.parse(JSON.stringify(TYPEN)),
});
const descriptor = () => getDiagramType("containerproef");
const inContainer = () => {
  const ontwerp = ontwerpUitProfiel(descriptor(), { prefix: "p_cp" });
  return metProfielContainer({ elements: ontwerp.elements, diagrams: { dg_cp: { ...ontwerp.diagrams.ontwerp, id: "dg_cp" } } }, { prefix: "p_cp", naam: "Containerproef" });
};

test("de M3-taal kent Profiel als container met bevat, ook in de boom", () => {
  const profiel = profielOntwerpKern.elementTypes.find((e) => e.id === PROFIEL_TYPE);
  assert.equal(profiel.containerVoor, BEVAT_TYPE);
  assert.equal(profiel.uitwerking, true);
  assert.equal(profiel.shape, "package");
  assert.ok([].concat(profielOntwerpKern.hierarchie).includes(BEVAT_TYPE));
});

test("metProfielContainer: de kop van het diagram naar het Profiel, het diagram een view", () => {
  const { elements, diagrams, profielId } = inContainer();
  const profiel = elements[profielId];
  assert.equal(profiel.elementType, PROFIEL_TYPE);
  assert.equal(profiel.data["m3:id"], "containerproef");
  assert.equal(diagrams.dg_cp.profiel, profielId);
  assert.equal(diagrams.dg_cp.m3Profiel, undefined);
  // Elk elementtype hangt direct in het Profiel; de lijnen niet.
  const bevat = Object.values(elements).filter((e) => e.elementType === BEVAT_TYPE).map((e) => elements[e.target].elementType);
  assert.deepEqual([...new Set(bevat)], ["elementDef"]);
});

test("de rondreis via de container is exact", () => {
  const inhoud = inContainer();
  const [profiel] = profielenIn(inhoud.elements);
  const kern = bouwProfielUitOntwerp(ontwerpStaatVan(profiel, inhoud), { id: "containerproef", label: "Containerproef" });
  assert.deepEqual(JSON.parse(JSON.stringify(kern.elementTypes)), TYPEN);
});

test("meerdere views op één profiel: het model is één (Mark 22-11)", () => {
  const inhoud = inContainer();
  const [profiel] = profielenIn(inhoud.elements);
  // Een tweede view met alleen Zaak; Ding staat alleen op de eerste.
  const zaak = Object.values(inhoud.elements).find((e) => e.data?.["m3:id"] === "zaak");
  inhoud.diagrams.dg_cp2 = { id: "dg_cp2", naam: "Alleen zaak", diagramType: "profiel-ontwerp", profiel: profiel.id, nodes: [{ elementId: zaak.id, position: { x: 0, y: 0 } }], edges: [] };
  const kernen = kernenUitProject(inhoud);
  assert.equal(kernen.length, 1, "één profiel, niet één per diagram");
  assert.deepEqual(kernen[0].kern.elementTypes.map((e) => e.id), ["ding", "zaak", "kent"]);
});

test("lidmaatschap: bevat, ◆ en de knopen op een view tellen mee", () => {
  const inhoud = inContainer();
  const [profiel] = profielenIn(inhoud.elements);
  // Nieuw getekend op de view, (nog) niet in het Profiel gehangen: hoort er toch bij.
  inhoud.elements.nieuw = { id: "nieuw", naam: "Nieuw", elementType: "elementDef", compartimenten: [], data: {} };
  inhoud.diagrams.dg_cp.nodes.push({ elementId: "nieuw", position: { x: 0, y: 0 } });
  assert.ok(ledenVan(profiel, inhoud).nieuw);
  // Zonder view en zonder bevat hoort het er niet bij.
  inhoud.diagrams.dg_cp.nodes.pop();
  assert.equal(ledenVan(profiel, inhoud).nieuw, undefined);
  // De bevat-lijnen zelf zijn geen deel van het profiel.
  assert.ok(Object.values(ledenVan(profiel, inhoud)).every((e) => e.elementType !== BEVAT_TYPE));
});

test("de JSON is een afgeleide, alleen-lezen eigenschap van het Profiel", () => {
  const inhoud = inContainer();
  const [profiel] = profielenIn(inhoud.elements);
  const [regel] = profielJsonRegels(profiel, inhoud);
  assert.equal(regel.key, "json");
  assert.equal(regel.blok, true);
  const json = JSON.parse(regel.waarde);
  assert.equal(json.id, "containerproef");
  assert.deepEqual(json.elementTypes.map((e) => e.id), ["ding", "zaak", "kent"]);
  // Een leeg Profiel: de waarde zegt waarom, geen fout.
  const leeg = { id: "leeg", naam: "Leeg", elementType: PROFIEL_TYPE, data: {} };
  assert.match(profielJsonRegels(leeg, { elements: { leeg } })[0].waarde, /nog geen geldig profiel/);
});

test("een oud project (profiel op het diagram) laadt nog", () => {
  const ontwerp = ontwerpUitProfiel(descriptor(), { prefix: "oud" });
  const kernen = kernenUitProject(ontwerp);
  assert.equal(kernen.length, 1);
  assert.equal(kernen[0].kern.id, "containerproef");
});
