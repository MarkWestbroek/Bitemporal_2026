import test from "node:test";
import assert from "node:assert/strict";
import { skinElementType, vindShapeSet, descriptorMetShapeSet } from "./shapeSet.js";
import { BLOK_SET } from "../../diagramprofielen/archimate/blokSet.js";

test("skin op node- en connectortypen, incl. achtergrond", () => {
  const node = skinElementType({ id: "a", shape: "x", kleur: "#fff" }, { shape: "am-blok", kleur: "#eef2ff" });
  assert.deepEqual([node.shape, node.kleur], ["am-blok", "#eef2ff"]);
  assert.equal(skinElementType({ id: "g", shape: "x" }, { shape: "am-blok-laag", achtergrond: true }).achtergrond, true);
  assert.equal(skinElementType({ id: "a", shape: "x" }, "y").shape, "y");
  const con = skinElementType({ id: "c", isConnector: true, edgePresentatie: { lijn: "solid", markerEnd: "pijl" } }, { lijn: "dash-4-3", markerEnd: null });
  assert.deepEqual(con.edgePresentatie, { lijn: "dash-4-3", markerEnd: null });
});

test("set vinden in descriptor of diagram; descriptor met set; blokken-set dekt grouping als laag", () => {
  const desc = { shapeSets: [BLOK_SET], elementTypes: [{ id: "app-component", shape: "archimate-box" }, { id: "grouping", shape: "archimate-box" }] };
  assert.equal(vindShapeSet(desc, ""), null);
  assert.equal(vindShapeSet(desc, "blokken"), BLOK_SET.shapes);
  assert.deepEqual(vindShapeSet(desc, "eigen", { shapeSets: [{ id: "eigen", shapes: { a: "b" } }] }), { a: "b" });
  const metSet = descriptorMetShapeSet(desc, BLOK_SET.shapes);
  assert.equal(metSet.elementTypes[0].shape, "am-blok");
  assert.deepEqual([metSet.elementTypes[1].shape, metSet.elementTypes[1].achtergrond], ["am-blok-laag", true]);
  assert.equal(desc.elementTypes[0].shape, "archimate-box", "invoer ongemoeid");
});
