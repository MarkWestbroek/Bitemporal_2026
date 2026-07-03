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
  // Kortste-weg-handles (B ligt rechts van A)
  assert.equal(edges[0].sourceHandle, "source-right");
  assert.equal(edges[0].targetHandle, "target-left");
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
  // Anker rond het middelpunt (van de node-middens); box automatisch eronder
  const anker = extraNodes.find((n) => n.soort === "anker");
  assert.deepEqual(anker.position, { x: 293, y: 33 });
  assert.ok(extraNodes.some((n) => n.soort === "box" && n.id === "r1"));
  // Kortste-weg-handles richting het anker — óók aan de anker-zijde,
  // zodat de lijn recht door het anker loopt (geen "haakje").
  assert.equal(edges[0].sourceHandle, "source-right");
  assert.equal(edges[0].targetHandle, "target-left");
  assert.equal(edges[1].sourceHandle, "source-right");
  assert.equal(edges[1].targetHandle, "target-left");
  assert.equal(edges[2].sourceHandle, "source-bottom"); // link naar de box eronder
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

test("hooks.edgePresentatie: dynamische presentatie o.b.v. connector-data (richting)", () => {
  const types = {
    entiteit: { id: "entiteit", shape: "class-box" },
    associatie: {
      id: "associatie",
      shape: "class-box",
      isConnector: true,
      bron: { elementTypes: ["entiteit"] },
      doel: { elementTypes: ["entiteit"] },
      edgePresentatie: { lijn: "solid", markerStart: "ruit-open" },
      hooks: {
        edgePresentatie: (conn) => (conn.data?.directioneel ? { markerEnd: "pijl-open" } : {}),
      },
    },
  };
  const diagram = {
    id: "d",
    nodes: [
      { elementId: "A", position: { x: 0, y: 0 } },
      { elementId: "B", position: { x: 400, y: 0 } },
    ],
  };
  const maak = (data) => ({
    A: { id: "A", elementType: "entiteit" },
    B: { id: "B", elementType: "entiteit" },
    as1: { id: "as1", naam: "", elementType: "associatie", source: "A", target: "B", compartimenten: [], data },
  });

  // Kaal, niet gericht: statische presentatie (open ruit), geen pijl.
  let { edges } = materialiseerConnectoren(maak({}), diagram, types);
  assert.equal(edges[0].data.presentatie.markerStart, "ruit-open");
  assert.equal(edges[0].data.presentatie.markerEnd, undefined);

  // Kaal, gericht: hook voegt de pijl toe.
  ({ edges } = materialiseerConnectoren(maak({ directioneel: true }), diagram, types));
  assert.equal(edges[0].data.presentatie.markerEnd, "pijl-open");

  // ASOC-gedaante (met veld): markers verhuizen mee naar de bron-/doel-edge.
  const metVeld = maak({ directioneel: true });
  metVeld.as1.compartimenten = [
    { compartmentType: "attributen", velden: [{ naam: "sinds", fieldType: "attribuut" }] },
  ];
  ({ edges } = materialiseerConnectoren(metVeld, diagram, types));
  const bronEdge = edges.find((e) => e.id.endsWith(":bron"));
  const doelEdge = edges.find((e) => e.id.endsWith(":doel"));
  assert.equal(bronEdge.data.presentatie.markerStart, "ruit-open");
  assert.equal(doelEdge.data.presentatie.markerEnd, "pijl-open");
});

test("labelOffsets op de connector verschuiven de labels per zijde", () => {
  const elements = {
    A,
    B,
    r1: {
      id: "r1",
      naam: "kent",
      elementType: "relatie",
      source: "A",
      target: "B",
      compartimenten: [],
      data: { bronKardinaliteit: "1", labelOffsets: { bron: { x: 20, y: -10 }, midden: { x: 5, y: 5 } } },
    },
  };
  const diagram = {
    id: "d",
    nodes: [
      { elementId: "A", position: { x: 0, y: 0 } },
      { elementId: "B", position: { x: 400, y: 0 } },
    ],
  };
  // Kale gedaante: het naam-label (midden) krijgt zijn offset.
  let { edges } = materialiseerConnectoren(elements, diagram, elementTypesById);
  const naamLabel = edges[0].data.presentatie.labels.find((l) => l.zijde === "midden");
  assert.deepEqual(naamLabel.offset, { x: 5, y: 5 });

  // ASOC-gedaante: het bron-label (kardinaliteit) krijgt zijn offset.
  elements.r1.compartimenten = [
    { compartmentType: "velden", velden: [{ naam: "soort", fieldType: "attribuut" }] },
  ];
  ({ edges } = materialiseerConnectoren(elements, diagram, elementTypesById));
  const bronEdge = edges.find((e) => e.id.endsWith(":bron"));
  const bronLabel = bronEdge.data.presentatie.labels.find((l) => l.zijde === "bron");
  assert.deepEqual(bronLabel.offset, { x: 20, y: -10 });
});
