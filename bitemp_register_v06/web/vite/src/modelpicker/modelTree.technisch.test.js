import { test } from "node:test";
import assert from "node:assert/strict";
import { isTechnischVeldnaam, bouwModelTree } from "./modelTree.js";

test("isTechnischVeldnaam: id/rel_id/versie/FK", () => {
  assert.equal(isTechnischVeldnaam("id"), true);
  assert.equal(isTechnischVeldnaam("rel_id"), true);
  assert.equal(isTechnischVeldnaam("versie"), true);
  assert.equal(isTechnischVeldnaam("initiatief_id"), true);
  assert.equal(isTechnischVeldnaam("naam"), false);
  assert.equal(isTechnischVeldnaam("omschrijving"), false);
});

const types = [{
  typenaam: "E", metatype: "entiteit", domein: "D", onderliggende: [],
  velden: [{ naam: "id" }, { naam: "naam" }, { naam: "x_id" }, { naam: "versie" }],
}];

test("bouwModelTree verbergt technische velden standaard", () => {
  const boom = bouwModelTree(types); // includeTechnisch default false
  const velden = boom[0].entiteiten[0].velden.map((k) => k.ref.veldnaam);
  assert.deepEqual(velden, ["naam"]);
});

test("bouwModelTree toont technische velden met includeTechnisch", () => {
  const boom = bouwModelTree(types, { includeTechnisch: true });
  const velden = boom[0].entiteiten[0].velden.map((k) => k.ref.veldnaam).sort();
  assert.deepEqual(velden, ["id", "naam", "versie", "x_id"]);
});
