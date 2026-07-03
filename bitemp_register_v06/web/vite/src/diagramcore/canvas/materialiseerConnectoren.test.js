// materialiseerConnectoren.test.js — verbindingsregels + edge-afleiding.
// Run: npm test  (vanuit web/vite/; node --test)

import test from "node:test";
import assert from "node:assert/strict";

import { materialiseerConnectoren, vindConnectorType } from "./materialiseerConnectoren.js";

const diagramType = {
  id: "test",
  elementTypes: [
    { id: "entiteit", label: "Entiteit", shape: "class-box" },
    { id: "gegevenselement", label: "GE", shape: "class-box" },
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

test("vindConnectorType: automatisch afleiden uit de regels", () => {
  assert.equal(vindConnectorType(diagramType, A, G).id, "compositie");
  assert.equal(vindConnectorType(diagramType, A, B).id, "generalisatie");
  assert.equal(vindConnectorType(diagramType, G, A), null, "GE→entiteit is nergens toegestaan");
});

test("vindConnectorType: expliciete voorkeur is leidend (geen fallback)", () => {
  assert.equal(vindConnectorType(diagramType, A, B, "generalisatie").id, "generalisatie");
  assert.equal(
    vindConnectorType(diagramType, A, G, "generalisatie"),
    null,
    "gekozen type past niet → weigeren, niet terugvallen"
  );
});

test("materialiseerConnectoren: alleen connectoren met beide uiteinden op het diagram", () => {
  const elements = {
    A,
    B,
    G,
    c1: { id: "c1", naam: "", elementType: "compositie", source: "A", target: "G", data: { sourceHandle: "source-bottom" } },
    c2: { id: "c2", naam: "erft", elementType: "generalisatie", source: "B", target: "A", data: {} },
  };
  const diagram = {
    id: "d",
    nodes: [
      { elementId: "A", position: { x: 0, y: 0 } },
      { elementId: "G", position: { x: 0, y: 200 } },
      // B staat NIET op dit diagram → c2 hoort niet te verschijnen
    ],
  };
  const edges = materialiseerConnectoren(elements, diagram, elementTypesById);
  assert.equal(edges.length, 1);
  assert.equal(edges[0].id, "conn:c1");
  assert.equal(edges[0].sourceHandle, "source-bottom");
  assert.equal(edges[0].data.presentatie.markerStart, "ruit");
});

test("materialiseerConnectoren: connector-naam wordt midden-label", () => {
  const elements = {
    A,
    B,
    c2: { id: "c2", naam: "erft", elementType: "generalisatie", source: "B", target: "A", data: {} },
  };
  const diagram = {
    id: "d",
    nodes: [
      { elementId: "A", position: { x: 0, y: 0 } },
      { elementId: "B", position: { x: 200, y: 0 } },
    ],
  };
  const [edge] = materialiseerConnectoren(elements, diagram, elementTypesById);
  const naamLabel = edge.data.presentatie.labels.find((l) => l.delen.some((d) => d.tekst === "erft"));
  assert.ok(naamLabel, "connector-naam hoort als label te verschijnen");
});
