// dmnModel.test.js — tests voor de pure DMN-beslistabel-helpers.
// Run met: node --test src/dmn/dmnModel.test.js  (vanuit web/vite/)

import test from "node:test";
import assert from "node:assert/strict";

import {
  nieuweBeslistabel,
  bindInput,
  bindOutput,
  maakOutputAdhoc,
  voegInputToe,
  voegRegelToe,
  zetCel,
  valideerTabel,
  adhocNaarAfgeleidVeldVoorstel,
} from "./dmnModel.js";

const bsnRef = {
  typenaam: "NP_Naam_Data",
  veldnaam: "bsn",
  veldpad: "NatuurlijkPersoon.namen.bsn",
  datatype: "BSN",
  type: "string",
  enum: [],
  afgeleid: false,
  tDimensie: "formeel",
};

const soortRef = {
  typenaam: "Bereikbaarheid",
  veldnaam: "soort",
  veldpad: "NatuurlijkPersoon.bereikbaarheden.soort",
  type: "string",
  enum: ["Woonadres", "Briefadres"],
  afgeleid: false,
  tDimensie: "formeel",
};

test("nieuweBeslistabel heeft 1 input, 1 output, 1 regel", () => {
  const t = nieuweBeslistabel("Test");
  assert.equal(t.inputs.length, 1);
  assert.equal(t.outputs.length, 1);
  assert.equal(t.rules.length, 1);
});

test("bindInput neemt datatype/type/enum over uit FieldRef", () => {
  const t0 = nieuweBeslistabel();
  const t1 = bindInput(t0, t0.inputs[0].id, bsnRef);
  assert.equal(t1.inputs[0].datatype, "BSN");
  assert.equal(t1.inputs[0].type, "string");
  assert.equal(t1.inputs[0].label, "NatuurlijkPersoon.namen.bsn");
  assert.deepEqual(t1.inputs[0].fieldRef, bsnRef);
});

test("bindInput met enum-veld vult enum-lijst", () => {
  const t0 = nieuweBeslistabel();
  const t1 = bindInput(t0, t0.inputs[0].id, soortRef);
  assert.deepEqual(t1.inputs[0].enum, ["Woonadres", "Briefadres"]);
});

test("bindOutput zet adhoc op false en neemt veldnaam over", () => {
  const t0 = nieuweBeslistabel();
  const t1 = bindOutput(t0, t0.outputs[0].id, bsnRef);
  assert.equal(t1.outputs[0].adhoc, false);
  assert.equal(t1.outputs[0].naam, "bsn");
});

test("maakOutputAdhoc markeert kolom als ad-hoc", () => {
  const t0 = nieuweBeslistabel();
  const t1 = maakOutputAdhoc(t0, t0.outputs[0].id, "score", "integer");
  assert.equal(t1.outputs[0].adhoc, true);
  assert.equal(t1.outputs[0].naam, "score");
  assert.equal(t1.outputs[0].fieldRef, null);
});

test("voegInputToe voegt kolom toe en breidt alle regels uit", () => {
  const t0 = nieuweBeslistabel();
  const t1 = voegInputToe(t0);
  assert.equal(t1.inputs.length, 2);
  const nieuweId = t1.inputs[1].id;
  assert.ok(t1.rules.every((r) => nieuweId in r.inputEntries));
});

test("zetCel schrijft waarde in de juiste regel/kolom", () => {
  const t0 = nieuweBeslistabel();
  const ruleId = t0.rules[0].id;
  const clauseId = t0.inputs[0].id;
  const t1 = zetCel(t0, ruleId, clauseId, "input", "> 18");
  assert.equal(t1.rules[0].inputEntries[clauseId], "> 18");
});

test("valideerTabel meldt ongebonden kolommen", () => {
  const t0 = nieuweBeslistabel();
  const meldingen = valideerTabel(t0);
  // 1 input + 1 output ongebonden = 2 fouten
  assert.equal(meldingen.filter((m) => m.niveau === "fout").length, 2);
});

test("valideerTabel is schoon na binden, info bij ad-hoc", () => {
  let t = nieuweBeslistabel();
  t = bindInput(t, t.inputs[0].id, bsnRef);
  t = maakOutputAdhoc(t, t.outputs[0].id, "score", "integer");
  const meldingen = valideerTabel(t);
  assert.equal(meldingen.filter((m) => m.niveau === "fout").length, 0);
  assert.equal(meldingen.filter((m) => m.niveau === "info").length, 1);
});

test("adhocNaarAfgeleidVeldVoorstel bouwt een afgeleid-veld-spec", () => {
  let t = nieuweBeslistabel("Risicobepaling");
  t = maakOutputAdhoc(t, t.outputs[0].id, "risicoscore", "integer");
  const voorstel = adhocNaarAfgeleidVeldVoorstel(t, t.outputs[0].id, "NatuurlijkPersoon");
  assert.equal(voorstel.naam, "risicoscore");
  assert.equal(voorstel.goType, "integer");
  assert.equal(voorstel.afleidingsregelTaal, "dmn");
  assert.equal(voorstel.typenaam, "NatuurlijkPersoon");
  assert.match(voorstel.afleidingsregel, /Risicobepaling/);
});
