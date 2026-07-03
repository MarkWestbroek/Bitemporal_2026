// materialiseerConnectoren.test.js — verbindingsregels + kale én ASOC-gedaante.
// Run: npm test  (vanuit web/vite/; node --test)

import test from "node:test";
import assert from "node:assert/strict";

import { materialiseerConnectoren, vindConnectorType, ANKER_PREFIX } from "./materialiseerConnectoren.js";

const diagramType = {
  id: "test",
  elementTypes: [
    { id: "entiteit", label: "Entiteit", shape: "class-box" },
    { id: "gegevenselement", label: "GE", shape: "class-box" },
    {
      id: "relatie",
      label: "Relatie",
      shape: "class-box",
      isConnector: true,
      bron: { elementTypes: ["entiteit"] },
      doel: { elementTypes: ["entiteit"] },
      hooks: {
        edgeLabels: (conn) => ({
          bron: conn.data?.bronKardinaliteit
            ? [{ zijde: "bron", delen: [{ tekst: conn.data.bronKardinaliteit, soort: "kardinaliteit" }] }]
            : [],
          doel: [],
          kaal: [],
        }),
      },
    },
    {
      id: "compositie",
      label: "Compositie",
      shape: "edge",
      isConnector: true,
      bron: { elementTypes: ["entiteit"] },
      doel: { elementTypes: ["gegevenselement"] },
      edgePresentatie: { lijn: "solid", markerStart: "ruit" },
    },
    {
      id: "generalisatie",
      label: "Generalisatie",
      shape: "edge",
      isConnector: true,
      bron: { elementTypes: ["entiteit"] },
      doel: { elementTypes: ["entiteit"] },
      edgePresentatie: { markerEnd: "driehoek" },
    },
  ],
};
const elementTypesById = Object.fromEntries(diagramType.elementTypes.map((et) => [et.id, et]));

const A = { id: "A", elementType: "entiteit" };
const B = { id: "B", elementType: "entiteit" };
const G = { id: "G", elementType: "gegevenselement" };

test("vindConnectorType: descriptor-volgorde wint bij automatisch afleiden", () => {
  assert.equal(vindConnectorType(diagramType, A, G).id, "compositie");
  // ENT→ENT matcht relatie én generalisatie; relatie staat eerder → wint
  assert.equal(vindConnectorType(diagramType, A, B).id, "relatie");
  assert.equal(vindConnectorType(diagramType, A, B, "generalisatie").id, "generalisatie");
  assert.equal(vindConnectorType(diagramType, G, A), null);
});

test("kale connector (geen velden) → één edge", () => {
  const elements = {
    A,
    B,
    r1: { id: "r1", naam: "", elementType: "relatie", source: "A", target: "B", compartimenten: [], data: {} },
  };
  const diagram = {
    id: "d",
    nodes: [
      { elementId: "A", position: { x: 0, y: 0 } },
      { elementId: "B", position: { x: 400, y: 0 } },
    ],
  };
  const { edges, extraNodes } = materialiseerConnectoren(elements, diagram, elementTypesById);
  assert.equal(edges.length, 1);
  assert.equal(edges[0].source, "A");
  assert.equal(edges[0].target, "B");
  assert.equal(extraNodes.length, 0);
});

test("connector mét velden → ASOC: anker + 3 edges (+ auto-box zonder lidmaatschap)", () => {
  const elements = {
    A,
    B,
    r1: {
      id: "r1",
      naam: "Bereikbaarheid",
      elementType: "relatie",
      source: "A",
      target: "B",
      compartimenten: [{ compartmentType: "velden", velden: [{ naam: "soort", fieldType: "attribuut" }] }],
      data: { bronKardinaliteit: "0..1", directioneel: true },
    },
  };
  const diagram = {
    id: "d",
    nodes: [
      { elementId: "A", position: { x: 0, y: 0 } },
      { elementId: "B", position: { x: 400, y: 0 } },
    ],
  };
  const { edges, extraNodes } = materialiseerConnectoren(elements, diagram, elementTypesById);
  assert.equal(edges.length, 3);
  const ankerId = `${ANKER_PREFIX}r1`;
  assert.deepEqual(
    edges.map((e) => [e.source, e.target]),
    [["A", ankerId], [ankerId, "B"], [ankerId, "r1"]]
  );
  // Anker op het middelpunt; box automatisch eronder geplaatst
  const anker = extraNodes.find((n) => n.soort === "anker");
  assert.deepEqual(anker.position, { x: 200, y: 0 });
  assert.ok(extraNodes.some((n) => n.soort === "box" && n.id === "r1"));
  // Labels-hook + directionele pijl
  assert.equal(edges[0].data.presentatie.labels[0].delen[0].tekst, "0..1");
  assert.equal(edges[1].data.presentatie.markerEnd, "pijl-open");
  assert.equal(edges[2].data.presentatie.lijn, "dash-4-3");
});

test("ASOC respecteert opgeslagen anker- en boxposities", () => {
  const elements = {
    A,
    B,
    r1: {
      id: "r1",
      naam: "R",
      elementType: "relatie",
      source: "A",
      target: "B",
      compartimenten: [{ compartmentType: "velden", velden: [{ naam: "x", fieldType: "attribuut" }] }],
      data: {},
    },
  };
  const diagram = {
    id: "d",
    nodes: [
      { elementId: "A", position: { x: 0, y: 0 } },
      { elementId: "B", position: { x: 400, y: 0 } },
      { elementId: "r1", position: { x: 111, y: 222 }, ankerPosition: { x: 150, y: 30 } },
    ],
  };
  const { extraNodes } = materialiseerConnectoren(elements, diagram, elementTypesById);
  const anker = extraNodes.find((n) => n.soort === "anker");
  assert.deepEqual(anker.position, { x: 150, y: 30 });
  // Box heeft al een lidmaatschap → geen auto-box
  assert.ok(!extraNodes.some((n) => n.soort === "box"));
});

test("connector met ontbrekend uiteinde op het diagram → niets", () => {
  const elements = {
    A,
    r1: { id: "r1", naam: "", elementType: "relatie", source: "A", target: "B", compartimenten: [], data: {} },
  };
  const diagram = { id: "d", nodes: [{ elementId: "A", position: { x: 0, y: 0 } }] };
  const { edges, extraNodes } = materialiseerConnectoren(elements, diagram, elementTypesById);
  assert.equal(edges.length, 0);
  assert.equal(extraNodes.length, 0);
});
