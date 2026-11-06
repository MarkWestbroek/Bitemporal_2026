/**
 * Tests voor plaatsUitPlan: een sequence-diagram uit een plan (✨ assistent, MCP) krijgt
 * levenslijnen op één rij en bij elk bericht zijn punten, zodat de activaties ontstaan.
 * Run: node --import ./test/register-aliases.mjs --test src/diagramprofielen/sequence/plaatsUitPlan.test.js
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { plaatsSequenceUitPlan, LIJN_AFSTAND, BERICHT_STAP, EERSTE_BERICHT } from "./plaatsUitPlan.js";
import { HAAK } from "./zelfbericht.js";
import { activatiesVan } from "./vormen.js";
import { maakWijziging, naarOps } from "../../studio/assistent/wijziging.js";
import { controleerPlan } from "../../studio/assistent/assistentKern.js";

const lijn = (id, naam) => ({ id, naam, elementType: "levenslijn", compartimenten: [], data: {} });
const bericht = (id, type, source, target, naam = "") => ({ id, naam, elementType: type, source, target, compartimenten: [], data: {} });
const maakPuntId = (berichtId, rol) => `${berichtId}_${rol}`;

/** Zoals wijziging.js de knopen eerst neerzet: dozen van 160 × 70, door de algemene opstelling verspreid. */
const kaal = () => ({
  elements: {
    a: lijn("a", "Gebruiker"),
    b: lijn("b", "Studio"),
    c: lijn("c", "API"),
    m1: bericht("m1", "synchroon", "a", "b", "bewaar"),
    m2: bericht("m2", "synchroon", "b", "c", "POST ops"),
    m3: bericht("m3", "retour", "c", "b", "201"),
    m4: bericht("m4", "synchroon", "b", "b", "teken opnieuw"),
    m5: bericht("m5", "retour", "b", "a", "klaar"),
  },
  diagram: {
    id: "d",
    naam: "Bewaren",
    nodes: [
      { elementId: "a", position: { x: 40, y: 40 }, size: { width: 160, height: 70 } },
      { elementId: "b", position: { x: 300, y: 180 }, size: { width: 160, height: 70 } },
      { elementId: "c", position: { x: 560, y: 320 }, size: { width: 160, height: 70 } },
    ],
    edges: [],
  },
});

test("nieuwe levenslijnen op één rij zonder bewaarde maat; elk bericht zijn punten, onder elkaar in planvolgorde", () => {
  const { elements, diagram } = kaal();
  const uit = plaatsSequenceUitPlan({ diagram, elements, nieuweKnopen: ["a", "b", "c"], nieuweRelaties: ["m1", "m2", "m3", "m4", "m5"], maakPuntId });
  const node = (id) => uit.nodes.find((n) => n.elementId === id);
  assert.deepEqual(["a", "b", "c"].map((id) => [node(id).position.x, node(id).position.y, node(id).size]), [[40, 40, undefined], [40 + LIJN_AFSTAND, 40, undefined], [40 + 2 * LIJN_AFSTAND, 40, undefined]]);
  // Tien punten: twee per bericht, elk op zijn levenslijn (randVan), 1 px uit de linkerrand van de lijn van 14.
  assert.equal(uit.punten.length, 10);
  const yVan = (id) => node(id).position.y + 6 + 40;
  const eerste = 40 + EERSTE_BERICHT;
  assert.deepEqual(["m1", "m2", "m3", "m4", "m5"].map((id) => [uit.elements[id].source, uit.elements[id].target]), [["m1_zend", "m1_ontvang"], ["m2_zend", "m2_ontvang"], ["m3_zend", "m3_ontvang"], ["m4_zend", "m4_ontvang"], ["m5_zend", "m5_ontvang"]]);
  assert.deepEqual([uit.elements.m1_zend.data.randVan, uit.elements.m1_ontvang.data.randVan], ["a", "b"]);
  assert.equal(node("m1_zend").position.x, 1);
  assert.deepEqual(["m1", "m2", "m3", "m4"].map((id) => yVan(`${id}_zend`)), [eerste, eerste + BERICHT_STAP, eerste + 2 * BERICHT_STAP, eerste + 3 * BERICHT_STAP]);
  assert.equal(yVan("m1_ontvang"), yVan("m1_zend"), "een bericht loopt horizontaal");
  assert.equal(yVan("m4_ontvang"), yVan("m4_zend") + HAAK, "een zelf-bericht komt een haakje lager aan");
  assert.equal(yVan("m5_zend"), eerste + 4 * BERICHT_STAP + HAAK, "en het volgende bericht schuift dat haakje op");
  // De invoer is niet aangeraakt.
  assert.equal(elements.m1.source, "a");
  assert.equal(diagram.nodes.length, 3);
});

test("met de punten ontstaan de activaties: het boxje op de levenslijn waar een bericht aankomt", () => {
  const { elements, diagram } = kaal();
  const uit = plaatsSequenceUitPlan({ diagram, elements, nieuweKnopen: ["a", "b", "c"], nieuweRelaties: ["m1", "m2", "m3", "m4", "m5"], maakPuntId });
  const na = { ...elements, ...uit.elements };
  const d = { ...diagram, nodes: uit.nodes };
  const balken = (id) => activatiesVan({ element: na[id], diagram: d, elementen: na });
  assert.deepEqual(activatiesVan({ element: elements.b, diagram, elementen: elements }), [], "zonder punten geen activaties (zo kwam het uit de MCP)");
  assert.ok(balken("b").length >= 1, "Studio: een activatie vanaf het ontvangen van 'bewaar'");
  assert.ok(balken("c").length >= 1, "API: een activatie van de aanroep tot de retour");
  const wortel = balken("b").find((x) => x.diepte === 0);
  assert.equal(wortel.top, EERSTE_BERICHT, "vanaf het ontvangen van 'bewaar' (hoogte binnen de lijn)");
  assert.ok(wortel.hoogte > 3 * BERICHT_STAP, "de activatie van Studio omvat de aanroep naar de API en de zelf-aanroep");
  assert.deepEqual(balken("c").map((x) => [x.top, x.hoogte]), [[EERSTE_BERICHT + BERICHT_STAP, BERICHT_STAP]], "API: precies van de aanroep tot de retour");
  assert.ok(balken("b").some((x) => x.diepte === 1), "de zelf-aanroep is een rugzak op de activatie");
});

test("berichten erbij op een bestaand diagram: onder het laagste punt; bestaande lijnen blijven staan", () => {
  const { elements, diagram } = kaal();
  const eerst = plaatsSequenceUitPlan({ diagram, elements, nieuweKnopen: ["a", "b", "c"], nieuweRelaties: ["m1", "m2"], maakPuntId });
  const na = { ...elements, ...eerst.elements, d: lijn("d", "Database"), m6: bericht("m6", "synchroon", "c", "d", "insert") };
  const d2 = { ...diagram, nodes: [...eerst.nodes, { elementId: "d", position: { x: 900, y: 400 }, size: { width: 160, height: 70 } }] };
  const uit = plaatsSequenceUitPlan({ diagram: d2, elements: na, nieuweKnopen: ["d"], nieuweRelaties: ["m6"], maakPuntId });
  const node = (id) => uit.nodes.find((n) => n.elementId === id);
  assert.deepEqual([node("d").position, node("d").size], [{ x: 40 + 3 * LIJN_AFSTAND, y: 40 }, undefined], "rechts van de laatste lijn, op dezelfde rij");
  assert.deepEqual(node("a").position, { x: 40, y: 40 });
  assert.equal(node("m6_zend").position.y + 6 + 40, 40 + EERSTE_BERICHT + 2 * BERICHT_STAP, "onder de twee berichten die er al stonden");
  assert.deepEqual(Object.keys(uit.elements).sort(), ["m6", "m6_ontvang", "m6_zend"], "alleen wat veranderde komt terug");
});

test("niets te doen: geen nieuwe levenslijnen en geen berichten van lijn naar lijn", () => {
  const { elements, diagram } = kaal();
  assert.equal(plaatsSequenceUitPlan({ diagram, elements, nieuweKnopen: [], nieuweRelaties: [], maakPuntId }), null);
  // Een bericht dat al op punten staat blijft zoals het is.
  const eerst = plaatsSequenceUitPlan({ diagram, elements, nieuweKnopen: ["a", "b", "c"], nieuweRelaties: ["m1"], maakPuntId });
  const na = { ...elements, ...eerst.elements };
  assert.equal(plaatsSequenceUitPlan({ diagram: { ...diagram, nodes: eerst.nodes }, elements: na, nieuweKnopen: [], nieuweRelaties: ["m1"], maakPuntId }), null);
});

// ── via de gedeelde wijzigingscode van de ✨ assistent en de MCP ──

const sequence = {
  id: "sequence05",
  naam: "Sequence",
  diagramTypeId: "sequence",
  elementen: [{ id: "levenslijn", label: "Levenslijn" }, { id: "punt", label: "Punt", vast: true }],
  connectoren: [
    { id: "synchroon", label: "Synchroon bericht", regels: [{ bron: ["levenslijn", "punt"], doel: ["levenslijn", "punt"] }] },
    { id: "retour", label: "Retourbericht", regels: [{ bron: ["levenslijn", "punt"], doel: ["levenslijn", "punt"] }] },
  ],
};

test("maakWijziging: een sequence-plan levert levenslijnen op een rij, punten met plaatsing, en operaties die ze meedragen", () => {
  const plan = controleerPlan(
    {
      uitleg: "",
      diagrammen: [{ sleutel: "d1", taal: "sequence05", naam: "Bewaren" }],
      elementen: [
        { sleutel: "a", type: "levenslijn", naam: "Gebruiker", diagram: "d1" },
        { sleutel: "b", type: "levenslijn", naam: "Studio", diagram: "d1" },
      ],
      connectoren: [
        { type: "synchroon", bron: "a", doel: "b", naam: "bewaar" },
        { type: "retour", bron: "b", doel: "a", naam: "klaar" },
      ],
    },
    [sequence],
    []
  );
  assert.deepEqual(plan.problemen || [], []);
  const w = maakWijziging(plan, { profielen: { sequence05: { elements: {}, diagrams: {} } } }, { mapId: "m1", samenvattingen: [sequence], prefix: "mcp", nu: 1 });
  const p = w.profielen.sequence05;
  const [diagram] = Object.values(p.diagrams);
  const lijnen = diagram.nodes.filter((n) => p.elements[n.elementId].elementType === "levenslijn");
  assert.deepEqual(lijnen.map((n) => [p.elements[n.elementId].naam, n.position.y, n.size]), [["Gebruiker", lijnen[0].position.y, undefined], ["Studio", lijnen[0].position.y, undefined]]);
  assert.equal(lijnen[1].position.x - lijnen[0].position.x, LIJN_AFSTAND);
  const punten = Object.values(p.elements).filter((e) => e.elementType === "punt");
  assert.equal(punten.length, 4);
  const berichten = Object.values(p.elements).filter((e) => e.source);
  assert.ok(berichten.every((b) => p.elements[b.source].elementType === "punt" && p.elements[b.target].elementType === "punt"), "elk bericht loopt van punt naar punt");
  assert.ok(punten.every((e) => w.plaatsing[`el::sequence05::${e.id}`] === "m1"), "de punten volgen hun diagram in de boom");
  assert.ok(punten.every((e) => diagram.nodes.some((n) => n.elementId === e.id && !n.size)), "en staan op het diagram, zonder maat");
  const ops = naarOps(w);
  const zet = ops.find((o) => o.op === "patchElementen").args[0].zet;
  assert.equal(Object.values(zet).filter((e) => e.elementType === "punt").length, 4, "de operaties dragen de punten mee");
  // De activatie op Studio: van het ontvangen van 'bewaar' tot de retour.
  const studio = Object.values(p.elements).find((e) => e.naam === "Studio");
  assert.equal(activatiesVan({ element: studio, diagram, elementen: p.elements }).length, 1);
});
