// opname.test.js — deel-voorkomens ín hun geheel (ENT ◆── GE als sub-vak).
// Run: npm test  (vanuit web/vite/; node --test)

import test from "node:test";
import assert from "node:assert/strict";

import { bepaalOpnames, opnameCompartiment } from "./opname.js";
import { materialiseerConnectoren } from "./materialiseerConnectoren.js";

const types = {
  entiteit: {
    id: "entiteit",
    shape: "class-box",
    compartments: [
      { id: "velden", fieldType: "attribuut" },
      { id: "gegevenselementen", fieldType: "ingebedDeel", alleenWeergave: true },
    ],
  },
  gegevenselement: {
    id: "gegevenselement",
    shape: "class-box",
    opname: { gedaante: "ingebed", relatieTypes: ["compositie"], compartiment: "gegevenselementen" },
    compartments: [
      { id: "velden", fieldType: "attribuut" },
      { id: "afgeleid", fieldType: "afgeleidVeld" },
    ],
  },
  gegevenstype: { id: "gegevenstype", shape: "class-box" },
  compositie: {
    id: "compositie",
    shape: "edge",
    isConnector: true,
    edgePresentatie: { markerStart: "ruit" },
    hooks: {
      edgeLabels: (conn) => {
        const d = conn.data || {};
        const delen = [];
        if (d.rolnaam) delen.push({ tekst: d.rolnaam, soort: "rolnaam" });
        if (d.kardinaliteit) delen.push({ tekst: d.kardinaliteit, soort: "kardinaliteit" });
        if (d.momentvoorkomen) delen.push({ tekst: `{${d.momentvoorkomen}}`, soort: "constraint" });
        const kaal = delen.length ? [{ zijde: "doel", delen }] : [];
        if (d.naamLabelTerug) kaal.push({ zijde: "doel", delen: [{ tekst: `◀ ${d.naamLabelTerug}`, soort: "naam" }] });
        return { kaal };
      },
    },
  },
  gebruik: { id: "gebruik", shape: "edge", isConnector: true, edgePresentatie: { lijn: "dash-6-3" } },
};

const elements = {
  P: { id: "P", naam: "Persoon", elementType: "entiteit", compartimenten: [] },
  N: {
    id: "N",
    naam: "Naam",
    elementType: "gegevenselement",
    data: { materieel: true },
    compartimenten: [
      { compartmentType: "afgeleid", velden: [{ naam: "volledig", fieldType: "afgeleidVeld" }] },
      { compartmentType: "velden", velden: [{ naam: "voornaam", fieldType: "attribuut" }] },
    ],
  },
  T: { id: "T", naam: "Tekst", elementType: "gegevenstype" },
  c1: {
    id: "c1",
    elementType: "compositie",
    source: "P",
    target: "N",
    data: { rolnaam: "naam", kardinaliteit: "1", momentvoorkomen: "enkelvoudig", naamLabelTerug: "van" },
  },
  u1: { id: "u1", elementType: "gebruik", source: "N", target: "T", data: {} },
};

const diagramMet = (geGedaante, metEntiteit = true) => ({
  nodes: [
    ...(metEntiteit ? [{ elementId: "P", position: { x: 0, y: 0 } }] : []),
    { elementId: "N", position: { x: 400, y: 0 }, ...(geGedaante ? { gedaante: geGedaante } : {}) },
    { elementId: "T", position: { x: 400, y: 300 } },
  ],
});

test("zonder gedaante: niets opgenomen, gewone lijnen", () => {
  const o = bepaalOpnames(elements, diagramMet(null), types);
  assert.equal(o.ingebedVoorkomens.size, 0);
  const { edges } = materialiseerConnectoren(elements, diagramMet(null), types);
  assert.deepEqual(edges.map((e) => [e.source, e.target]).sort(), [["N", "T"], ["P", "N"]]);
});

test("ingebed GE-voorkomen: geen node, compositie vervalt, «use» hangt aan de entiteit", () => {
  const diagram = diagramMet("ingebed");
  const o = bepaalOpnames(elements, diagram, types);
  assert.ok(o.ingebedVoorkomens.has("N"));
  assert.equal(o.geheelVan.get("N"), "P");
  assert.deepEqual(o.delenVan.get("P").map((x) => x.deel.id), ["N"]);

  const { edges } = materialiseerConnectoren(elements, diagram, types);
  assert.equal(edges.length, 1);
  assert.equal(edges[0].data.connectorId, "u1");
  assert.equal(edges[0].source, "P");
  assert.equal(edges[0].target, "T");
});

test("geheel niet op het diagram: het deel blijft gewoon zichtbaar", () => {
  const diagram = diagramMet("ingebed", false);
  const o = bepaalOpnames(elements, diagram, types);
  assert.equal(o.ingebedVoorkomens.size, 0);
  const { edges } = materialiseerConnectoren(elements, diagram, types);
  assert.deepEqual(edges.map((e) => [e.source, e.target]), [["N", "T"]]);
});

test("ander voorkomen van hetzelfde GE blijft een losse node met eigen lijnen", () => {
  const diagram = {
    nodes: [
      { elementId: "P", position: { x: 0, y: 0 } },
      { elementId: "N", nodeId: "N#1", position: { x: 400, y: 0 }, gedaante: "ingebed" },
      { elementId: "N", nodeId: "N#2", position: { x: 800, y: 0 } },
    ],
  };
  const o = bepaalOpnames(elements, diagram, types);
  assert.deepEqual([...o.ingebedVoorkomens], ["N#1"]);
  const { edges } = materialiseerConnectoren(elements, diagram, types);
  // De compositie gaat naar het zichtbare voorkomen.
  assert.deepEqual(edges.map((e) => [e.source, e.target]), [["P", "N#2"]]);
});

test("sub-vak: kopregel met naam, rolnaam/kardinaliteit/constraint (zonder leesrichting), badge en geordende inhoud", () => {
  const o = bepaalOpnames(elements, diagramMet("ingebed"), types);
  const comp = opnameCompartiment(elements.P, o.delenVan.get("P"), types);
  assert.equal(comp.compartmentType, "gegevenselementen");
  assert.equal(comp.velden.length, 1);
  const [veld] = comp.velden;
  assert.equal(veld.naam, "Naam");
  assert.equal(veld.fieldType, "ingebedDeel");
  assert.deepEqual(veld.data.kop.map((d) => d.tekst), ["naam", "1", "{enkelvoudig}"]);
  assert.equal(veld.data.materieel, true);
  // Descriptor-volgorde: velden vóór afgeleid.
  assert.deepEqual(veld.data.compartimenten.map((c) => c.compartmentType), ["velden", "afgeleid"]);
});
