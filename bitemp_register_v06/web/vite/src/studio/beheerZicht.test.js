// beheerZicht.test.js — klassieke editors alleen voor een beheerder (Mark 16-11).
import test from "node:test";
import assert from "node:assert/strict";
import { zichtbareProfielen, zetBeheerZicht, heeftBeheerZicht } from "./beheerZichtRegels.js";

const P = [{ id: "diagram05" }, { id: "act-uml", klassiek: true }, { id: "bpmnMotor05" }];

test("zichtbareProfielen: zonder beheer geen klassieke editors, met beheer alles", () => {
  assert.deepEqual(zichtbareProfielen(P, false).map((p) => p.id), ["diagram05", "bpmnMotor05"]);
  assert.deepEqual(zichtbareProfielen(P, true).map((p) => p.id), ["diagram05", "act-uml", "bpmnMotor05"]);
});

test("zichtbareProfielen: zonder argument telt de stand van de zijbalk", () => {
  zetBeheerZicht(false);
  assert.equal(heeftBeheerZicht(), false);
  assert.equal(zichtbareProfielen(P).length, 2);
  zetBeheerZicht(true);
  assert.equal(zichtbareProfielen(P).length, 3);
  zetBeheerZicht(false);
});
