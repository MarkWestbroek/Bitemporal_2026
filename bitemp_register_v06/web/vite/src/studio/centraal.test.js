// centraal.test.js — de Studio-kant van de centrale plek (stap 5, Mark 22-11).
import test from "node:test";
import assert from "node:assert/strict";
import { vastgepind, volgendeVersies, vergelijkVersie, hoogsteVan, modelUitWerkbestand, versieRegel } from "./centraal.js";

test("vastgepind: per soort een versie of null (nu: de code)", () => {
  assert.deepEqual(Object.keys(vastgepind()).sort(), ["profielen", "weergaven"]);
});

test("volgende versies; zonder eerdere versie 1.0.0 (of 0.1.0)", () => {
  assert.deepEqual(volgendeVersies(""), { patch: "1.0.0", minor: "1.0.0", major: "1.0.0", eerste: ["1.0.0", "0.1.0"] });
  assert.deepEqual(volgendeVersies("0.9.3"), { patch: "0.9.4", minor: "0.10.0", major: "1.0.0" });
});

test("vergelijken is numeriek; de hoogste per soort", () => {
  assert.ok(vergelijkVersie("0.10.0", "0.9.0") > 0);
  const lijst = [{ soort: "profielen", versie: "0.2.0" }, { soort: "profielen", versie: "0.10.0" }, { soort: "weergaven", versie: "3.0.0" }];
  assert.equal(hoogsteVan(lijst, "profielen"), "0.10.0");
  assert.equal(hoogsteVan(lijst, "onbekend"), "");
});

test("het model uit een werkbestand: de inhoud van het dragende profiel", () => {
  const wb = { profielen: { m3Profiel05: { elements: { a: {} }, diagrams: { d: {} } }, weergave05: { elements: { w: {} } } } };
  assert.deepEqual(modelUitWerkbestand("profielen", wb), { elements: { a: {} }, diagrams: { d: {} } });
  assert.deepEqual(modelUitWerkbestand("weergaven", wb), { elements: { w: {} }, diagrams: {} });
  assert.throws(() => modelUitWerkbestand("profielen", { profielen: {} }), /geen profielen/);
});

test("een regel per versie: ouders, pin en of hij er al is", () => {
  const r = versieRegel({ versie: "0.2.0", ouders: [{ versie: "0.1.0" }], uitgebracht: "2026-11-23T01:00:00Z", uitgebrachtDoor: "mark", hier: false, notitie: "BPMN 1.2" }, "0.2.0");
  assert.match(r, /^0\.2\.0  ← deze Studio · na 0\.1\.0 · 2026-11-23 door mark · \(nog niet opgehaald\) · — BPMN 1\.2$/);
  assert.match(versieRegel({ versie: "0.1.0", ouders: [] }, null), /eerste/);
});
