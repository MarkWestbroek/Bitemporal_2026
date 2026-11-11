import { test, beforeEach } from "node:test";
import assert from "node:assert/strict";
import {
  zetKlembord,
  leesKlembord,
  zetKlembordProject,
  uitAnderProject,
  _wisKlembord,
  vervangIds,
  verzamelInhoud,
  zonderUuids,
  bereidPlakVoor,
  plakSamenvatting,
} from "./klembord.js";

/** Een localStorage die twee "tabs" delen. */
function nepOpslag() {
  const m = new Map();
  return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => void m.set(k, String(v)), removeItem: (k) => void m.delete(k), _m: m };
}

beforeEach(() => {
  _wisKlembord();
  globalThis.localStorage = nepOpslag();
});

const ent = (id, uuid, extra = {}) => ({ id, naam: id, elementType: "entiteit", data: uuid ? { uuid } : {}, ...extra });
const rel = (id, source, target) => ({ id, elementType: "relatie", source, target, data: {} });

test("klembord: gedeeld via localStorage, met het project van de tab erbij", () => {
  zetKlembordProject({ id: "p1", naam: "Project 1" });
  const kb = zetKlembord("elementen", { profielId: "diagram05", diagramId: "d", elementIds: ["A"], posities: {}, inhoud: { elements: { A: ent("A") } } });
  assert.equal(kb.projectId, "p1");
  assert.equal(uitAnderProject(leesKlembord("elementen")), false);
  assert.equal(leesKlembord("diagram"), null);

  // "Andere tab": zelfde opslag, ander project, leeg geheugen.
  const opslag = globalThis.localStorage;
  _wisKlembord();
  globalThis.localStorage = opslag;
  zetKlembordProject({ id: "p2", naam: "Project 2" });
  const daar = leesKlembord("elementen");
  assert.equal(daar.projectNaam, "Project 1");
  assert.deepEqual(Object.keys(daar.inhoud.elements), ["A"]);
  assert.equal(uitAnderProject(daar), true);
});

test("klembord: het nieuwste wint; zonder opslag werkt het binnen de tab", () => {
  const oud = { soort: "elementen", profielId: "x", diagramId: "d", inhoud: { elements: {} }, projectId: null, projectNaam: "", tijd: 1 };
  globalThis.localStorage.setItem("studio-klembord:elementen", JSON.stringify(oud));
  assert.equal(leesKlembord("elementen").profielId, "x");
  zetKlembord("elementen", { profielId: "y", diagramId: "d", inhoud: { elements: {} } });
  assert.equal(leesKlembord("elementen").profielId, "y");

  globalThis.localStorage = { getItem: () => { throw new Error("dicht"); }, setItem: () => { throw new Error("vol"); }, removeItem: () => {} };
  zetKlembord("elementen", { profielId: "z", diagramId: "d", inhoud: { elements: {} } });
  assert.equal(leesKlembord("elementen").profielId, "z");
  // Rommel in de opslag telt niet.
  globalThis.localStorage = nepOpslag();
  globalThis.localStorage.setItem("studio-klembord:elementen", "{geen json");
  assert.equal(leesKlembord("elementen").profielId, "z");
});

test("vervangIds: hele woorden, ook in verwijzingen", () => {
  const uit = vervangIds({ id: "A", source: "A", tekst: "AA en A-b", lijst: ["A", "B"] }, new Map([["A", "X"], ["B", "B"]]));
  assert.deepEqual(uit, { id: "X", source: "X", tekst: "AA en A-b", lijst: ["X", "B"] });
});

test("verzamelInhoud: selectie, kinderen in de boom en de connectoren ertussen", () => {
  const elements = {
    A: ent("A"),
    A1: { id: "A1", naam: "veld", elementType: "gegevenselement" },
    B: ent("B"),
    C: ent("C"),
    ab: rel("ab", "A", "B"),
    ac: rel("ac", "A", "C"),
    bevat: rel("bevat", "A", "A1"),
  };
  const uit = verzamelInhoud(elements, ["A", "B", "ab", "weg"], new Map([["A", ["A1"]]]));
  assert.deepEqual(Object.keys(uit).sort(), ["A", "A1", "B", "ab", "bevat"]);
  uit.A.naam = "anders";
  assert.equal(elements.A.naam, "A");
});

test("zonderUuids: ook de uuid's van de velden", () => {
  const el = ent("A", "u1", { compartimenten: [{ compartmentType: "velden", velden: [{ naam: "v", data: { uuid: "u2", x: 1 } }] }] });
  const uit = zonderUuids(el);
  assert.deepEqual(uit.data, {});
  assert.deepEqual(uit.compartimenten[0].velden[0].data, { x: 1 });
  assert.equal(el.data.uuid, "u1");
});

test("plakken als hetzelfde element: id en uuid blijven, bestaande worden hergebruikt", () => {
  const inhoud = { A: ent("A", "uA"), B: ent("B", "uB"), C: ent("C", "uC"), ab: rel("ab", "A", "B"), bc: rel("bc", "B", "C") };
  // Doel: A staat er al (zelfde uuid); B staat er onder een ander id; C is nieuw.
  const doelElements = { A: ent("A", "uA", { naam: "A hier" }), Bhier: ent("Bhier", "uB") };
  const plan = bereidPlakVoor({ inhoud, doelElements, wijze: "zelfde", maakId: () => "nvt" });
  assert.deepEqual(plan.toevoegen.map((e) => e.id), ["C", "ab", "bc"]);
  assert.deepEqual(plan.hergebruikt.sort(), ["A", "Bhier"]);
  assert.deepEqual(plan.conflicten, []);
  // De connectoren wijzen naar het element zoals het hier heet.
  assert.deepEqual(plan.toevoegen.find((e) => e.id === "ab"), { ...rel("ab", "A", "Bhier") });
  assert.equal(plan.toevoegen.find((e) => e.id === "bc").source, "Bhier");
  assert.equal(plan.toevoegen.find((e) => e.id === "C").data.uuid, "uC");
  assert.equal(plan.idMap.get("B"), "Bhier");
  assert.match(plakSamenvatting(plan), /^2 elementen stonden al in dit project/);
});

test("plakken als hetzelfde element: zelfde id met een andere uuid is een conflict", () => {
  const inhoud = { A: ent("A", "uA"), B: ent("B", "uB"), ab: rel("ab", "A", "B") };
  const doelElements = { A: ent("A", "heel-anders"), Z: ent("Z") };
  const plan = bereidPlakVoor({ inhoud, doelElements, wijze: "zelfde", maakId: () => "nvt" });
  assert.deepEqual(plan.conflicten, [{ id: "A", naam: "A" }]);
  // De connector naar het conflict reist niet mee; B wel.
  assert.deepEqual(plan.toevoegen.map((e) => e.id), ["B"]);
  assert.ok(!plan.idMap.has("A"));
  assert.match(plakSamenvatting(plan), /Niet geplakt.*: A\. Plak dat als kopie\./);
  // Zonder uuid aan een van beide kanten geldt het id.
  const p2 = bereidPlakVoor({ inhoud: { A: ent("A") }, doelElements, wijze: "zelfde", maakId: () => "nvt" });
  assert.deepEqual([p2.hergebruikt, p2.conflicten, p2.toevoegen], [["A"], [], []]);
  assert.equal(plakSamenvatting(bereidPlakVoor({ inhoud: { Q: ent("Q") }, doelElements, wijze: "zelfde", maakId: () => "nvt" })), "");
});

test("plakken als kopie: nieuwe id's, geen uuid's, verbindingen tussen de kopieën", () => {
  const inhoud = { A: ent("A", "uA"), B: ent("B", "uB"), ab: rel("ab", "A", "B") };
  const plan = bereidPlakVoor({ inhoud, doelElements: { A: ent("A", "uA") }, wijze: "kopie", maakId: (el, i) => `n${i}` });
  assert.deepEqual(plan.toevoegen.map((e) => [e.id, e.source, e.target, e.data.uuid]), [
    ["n0", undefined, undefined, undefined],
    ["n1", undefined, undefined, undefined],
    ["n2", "n0", "n1", undefined],
  ]);
  assert.deepEqual([plan.hergebruikt, plan.conflicten], [[], []]);
  assert.equal(inhoud.A.data.uuid, "uA");
  // De naam blijft, ook als hij gelijk is aan het id (ook van een veld).
  const metVeld = { A: ent("A", "uA", { compartimenten: [{ compartmentType: "velden", velden: [{ naam: "B", type: "B" }] }] }), B: ent("B") };
  const p3 = bereidPlakVoor({ inhoud: metVeld, doelElements: {}, wijze: "kopie", maakId: (el, i) => `n${i}` });
  assert.deepEqual(p3.toevoegen.map((e) => [e.id, e.naam]), [["n0", "A"], ["n1", "B"]]);
  assert.deepEqual(p3.toevoegen[0].compartimenten[0].velden[0], { naam: "B", type: "n1" });
  // maakId geeft twee keer hetzelfde, of een id dat hier al bestaat: toch unieke id's.
  const p2 = bereidPlakVoor({ inhoud, doelElements: { x: ent("x") }, wijze: "kopie", maakId: () => "x" });
  assert.deepEqual(p2.toevoegen.map((e) => e.id), ["x_2", "x_3", "x_4"]);
});
