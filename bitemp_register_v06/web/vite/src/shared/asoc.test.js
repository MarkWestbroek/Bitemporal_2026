// asoc.test.js — tests voor de centrale ASOC-beslissing.
// Run met: node --test src/shared/asoc.test.js  (vanuit web/vite/)

import test from "node:test";
import assert from "node:assert/strict";

import {
  relatieVorm,
  isAsoc,
  asocAnkerId,
  isAsocAnkerElementId,
  asocEdgeIds,
  collapsedEdgeIds,
} from "./asoc.js";

test("relatieVorm: collapsed bij geen velden en geen afgeleide velden", () => {
  assert.equal(relatieVorm({ naam: "R", velden: [], afgeleideVelden: [] }), "collapsed");
  assert.equal(relatieVorm({ naam: "R" }), "collapsed");
  assert.equal(relatieVorm(null), "collapsed");
});

test("relatieVorm: asoc bij minstens één eigen veld", () => {
  assert.equal(relatieVorm({ naam: "R", velden: [{ naam: "rol" }] }), "asoc");
});

test("relatieVorm: asoc bij alleen afgeleide velden (zoals weergavenaam)", () => {
  assert.equal(
    relatieVorm({
      naam: "R",
      velden: [],
      afgeleideVelden: [{ naam: "weergavenaam", expressie: "rol + ' x'" }],
    }),
    "asoc",
  );
});

test("relatieVorm: ondersteunt zowel rel.velden als rel.data.velden", () => {
  assert.equal(relatieVorm({ naam: "R", data: { velden: [{ naam: "rol" }] } }), "asoc");
  assert.equal(relatieVorm({ naam: "R", data: { afgeleideVelden: [{ naam: "x" }] } }), "asoc");
});

test("isAsoc: convenience-wrapper voor relatieVorm", () => {
  assert.equal(isAsoc({ naam: "R", velden: [{ naam: "rol" }] }), true);
  assert.equal(isAsoc({ naam: "R" }), false);
});

test("asocAnkerId: consistent format", () => {
  assert.equal(asocAnkerId("MijnRelatie"), "anker_MijnRelatie");
});

test("isAsocAnkerElementId: herkent anker-ids", () => {
  assert.equal(isAsocAnkerElementId("anker_x"), true);
  assert.equal(isAsocAnkerElementId("MijnRelatie"), false);
  assert.equal(isAsocAnkerElementId(undefined), false);
});

test("asocEdgeIds: genereert de drie verwachte edge-ids", () => {
  const rel = { naam: "MijnRel", doelEntiteit: "DoelEnt" };
  const ids = asocEdgeIds(rel, "BronEnt");
  assert.equal(ids.ankerId, "anker_MijnRel");
  assert.equal(ids.bronAssoc, "BronEnt->anker_MijnRel");
  assert.equal(ids.doelAssoc, "anker_MijnRel->DoelEnt");
  assert.equal(ids.classLink, "anker_MijnRel-->MijnRel");
});

test("asocEdgeIds: respecteert door V3 meegegeven IDs", () => {
  const rel = {
    naam: "R",
    doelEntiteit: "D",
    id: "edge-1",
    doelId: "edge-2",
    classLinkId: "edge-3",
  };
  const ids = asocEdgeIds(rel, "B");
  assert.equal(ids.bronAssoc, "edge-1");
  assert.equal(ids.doelAssoc, "edge-2");
  assert.equal(ids.classLink, "edge-3");
});

test("collapsedEdgeIds: genereert de twee verwachte edge-ids", () => {
  const rel = { naam: "R", doelEntiteit: "D" };
  const ids = collapsedEdgeIds(rel, "B");
  assert.equal(ids.bronEdge, "B->R");
  assert.equal(ids.doelEdge, "R->D");
});
