// Run: node --import ./test/register-aliases.mjs --test src/studio/sync/onverzonden.test.js
import test from "node:test";
import assert from "node:assert/strict";
import { diagramHeeftOnverzonden } from "./onverzonden.js";

const diagram = { id: "d1", nodes: [{ id: "n1", elementId: "Partij" }], edges: [{ id: "e1", elementId: "heeft" }] };

test("onverzonden: diagram-id, element op het diagram, of niets", () => {
  assert.equal(diagramHeeftOnverzonden([], "diagram05", diagram), false);
  assert.equal(diagramHeeftOnverzonden([{ store: "model:diagram05", op: "updateNodePosition", args: ["d1", "n1", { x: 1, y: 2 }] }], "diagram05", diagram), true);
  assert.equal(diagramHeeftOnverzonden([{ store: "model:diagram05", op: "updateElement", args: ["Partij", { naam: "P" }] }], "diagram05", diagram), true);
  assert.equal(diagramHeeftOnverzonden([{ store: "model:diagram05", op: "patchElementen", args: [{ zet: { heeft: {} }, wis: [] }] }], "diagram05", diagram), true);
  // Een ander element, een ander diagram, een andere taal: niet cursief.
  assert.equal(diagramHeeftOnverzonden([{ store: "model:diagram05", op: "updateElement", args: ["Zaak", { naam: "Z" }] }], "diagram05", diagram), false);
  assert.equal(diagramHeeftOnverzonden([{ store: "model:bpmn", op: "updateElement", args: ["Partij", {}] }], "diagram05", diagram), false);
  assert.equal(diagramHeeftOnverzonden([{ store: "structuur", op: "patchStructuur", args: [{ d1: 1 }] }], "diagram05", diagram), false);
});

test("onverzonden: een grote outbox van deze taal maakt elke tab cursief", () => {
  const ops = Array.from({ length: 201 }, (_, i) => ({ store: "model:diagram05", op: "addElement", args: [{ id: `x${i}` }] }));
  assert.equal(diagramHeeftOnverzonden(ops, "diagram05", diagram), true);
});
