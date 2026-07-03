// createDiagramStore.test.js — mutatie- en undo-tests voor de store-factory.
// Run: npm test  (vanuit web/vite/; node --test)

import test from "node:test";
import assert from "node:assert/strict";

import { createDiagramStore } from "./createDiagramStore.js";

function maakStoreMetModel() {
  const store = createDiagramStore(); // zonder persist (node-omgeving)
  store.getState().laadModel({
    diagramTypeId: "test",
    elements: {
      A: { id: "A", naam: "A", elementType: "entiteit", compartimenten: [], data: {} },
      B: { id: "B", naam: "B", elementType: "gegevenselement", compartimenten: [], data: {} },
    },
    diagrams: {
      d1: { id: "d1", naam: "Eén", diagramType: "test", nodes: [{ elementId: "A", position: { x: 0, y: 0 } }], edges: [] },
    },
  });
  return store;
}

test("laadModel kiest actief diagram en reset isDirty", () => {
  const store = maakStoreMetModel();
  assert.equal(store.getState().actiefDiagramId, "d1");
  assert.equal(store.getState().isDirty, false);
});

test("addElement + addElementToDiagram + updateNodePosition", () => {
  const store = maakStoreMetModel();
  const s = store.getState();
  s.addElement({ id: "C", naam: "C", elementType: "entiteit", compartimenten: [], data: {} });
  s.addElementToDiagram("d1", "C", { x: 10, y: 20 });
  s.addElementToDiagram("d1", "C", { x: 99, y: 99 }); // duplicaat → genegeerd
  store.getState().updateNodePosition("d1", "C", { x: 40, y: 50 });
  const d1 = store.getState().diagrams.d1;
  assert.equal(d1.nodes.filter((n) => n.elementId === "C").length, 1);
  assert.deepEqual(d1.nodes.find((n) => n.elementId === "C").position, { x: 40, y: 50 });
  assert.equal(store.getState().isDirty, true);
});

test("updateElement: top-level, compartimenten (vervang) en data (merge)", () => {
  const store = maakStoreMetModel();
  store.getState().updateElement("A", { naam: "Anders", data: { kleur: "#fff" } });
  store.getState().updateElement("A", {
    data: { abstract: true },
    compartimenten: [{ compartmentType: "velden", velden: [{ naam: "x", fieldType: "attribuut" }] }],
  });
  const a = store.getState().elements.A;
  assert.equal(a.naam, "Anders");
  assert.equal(a.data.kleur, "#fff"); // merge behouden
  assert.equal(a.data.abstract, true);
  assert.equal(a.compartimenten[0].velden[0].naam, "x");
});

test("deleteElement verwijdert ook aanhangende connectoren en diagram-verwijzingen", () => {
  const store = maakStoreMetModel();
  const s = store.getState();
  s.addElementToDiagram("d1", "B", { x: 0, y: 100 });
  s.addElement({ id: "c1", naam: "", elementType: "compositie", source: "A", target: "B", data: {} });
  store.getState().deleteElement("B");
  const na = store.getState();
  assert.equal(na.elements.B, undefined);
  assert.equal(na.elements.c1, undefined, "connector naar verwijderd element moet mee-verdwijnen");
  assert.ok(!na.diagrams.d1.nodes.some((n) => n.elementId === "B"));
});

test("diagrammen: add/rename/delete met actief-diagram-correctie", () => {
  const store = maakStoreMetModel();
  store.getState().addDiagram({ id: "d2", naam: "Twee", diagramType: "test" });
  assert.equal(store.getState().actiefDiagramId, "d2");
  store.getState().renameDiagram("d2", "Twee-b");
  assert.equal(store.getState().diagrams.d2.naam, "Twee-b");
  store.getState().deleteDiagram("d2");
  assert.equal(store.getState().actiefDiagramId, "d1");
});

test("undo/redo via zundo; viewport genereert geen undo-entry", () => {
  const store = maakStoreMetModel();
  store.temporal.getState().clear();
  store.getState().addElement({ id: "C", naam: "C", elementType: "entiteit", data: {} });
  store.getState().updateDiagramViewport("d1", { x: 1, y: 2, zoom: 1.5 }); // geen entry
  assert.equal(store.temporal.getState().pastStates.length, 1);
  store.temporal.getState().undo();
  assert.equal(store.getState().elements.C, undefined);
  store.temporal.getState().redo();
  assert.equal(store.getState().elements.C.naam, "C");
});

test("viewports leven buiten de diagrammen én buiten de undo-history", () => {
  const store = createDiagramStore();
  store.getState().laadModel({
    diagramTypeId: "test",
    elements: {},
    diagrams: { d1: { id: "d1", naam: "Eén", nodes: [], edges: [], viewport: { x: 5, y: 6, zoom: 2 } } },
  });
  // laadModel splitst de viewport uit het diagram
  assert.equal(store.getState().diagrams.d1.viewport, undefined);
  assert.deepEqual(store.getState().viewports.d1, { x: 5, y: 6, zoom: 2 });
  // undo van een modelwijziging laat de viewport met rust
  store.temporal.getState().clear();
  store.getState().addElement({ id: "X", naam: "X", elementType: "entiteit", data: {} });
  store.getState().updateDiagramViewport("d1", { x: 9, y: 9, zoom: 0.5 });
  store.temporal.getState().undo();
  assert.deepEqual(store.getState().viewports.d1, { x: 9, y: 9, zoom: 0.5 });
  // en undo wisselt niet van actief diagram
  assert.equal(store.getState().actiefDiagramId, "d1");
});

test("updateNodeSize bewaart de grootte per diagram-lidmaatschap", () => {
  const store = maakStoreMetModel();
  store.getState().updateNodeSize("d1", "A", { width: 240, height: 130 });
  assert.deepEqual(
    store.getState().diagrams.d1.nodes.find((n) => n.elementId === "A").size,
    { width: 240, height: 130 }
  );
});
