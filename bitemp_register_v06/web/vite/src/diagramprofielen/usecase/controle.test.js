// controle.test.js — use case: waarschuwing zonder primaire actor én trigger; EA-condities.
// Run: node --import ./test/register-aliases.mjs --test src/diagramprofielen/usecase/controle.test.js

import test from "node:test";
import assert from "node:assert/strict";

import { controleerUseCase, heeftPrimaireActor } from "./controle.js";
import { conditiesVan } from "../ea/qeaNaarUsecase.js";

const model = (primair, trigger = "") => ({
  a: { id: "a", elementType: "actor" },
  u: { id: "u", elementType: "usecase", data: trigger ? { trigger } : {} },
  k: { id: "k", elementType: "klasse" },
  r1: { id: "r1", elementType: "associatie", source: "u", target: "a", data: primair ? { primair: true } : {} },
  r2: { id: "r2", elementType: "associatie", source: "u", target: "k", data: { primair: true } },
});

test("primaire actor: een associatie met primair naar een actor (in beide richtingen getekend)", () => {
  assert.equal(heeftPrimaireActor("u", model(true)), true);
  assert.equal(heeftPrimaireActor("u", model(false)), false, "primair naar een klasse telt niet");
});

test("waarschuwing alleen zonder primaire actor én zonder trigger", () => {
  assert.equal(controleerUseCase(model(false).u, { elements: model(false) }).length, 1);
  assert.deepEqual(controleerUseCase(model(true).u, { elements: model(true) }), []);
  const batch = model(false, "elke nacht om 02:00");
  assert.deepEqual(controleerUseCase(batch.u, { elements: batch }), [], "batch: trigger is genoeg");
  assert.deepEqual(controleerUseCase(model(false).a, { elements: model(false) }), [], "alleen use cases");
});

test("EA: Pre-/Post-condition-constraints → preconditie/postconditie, één regel per constraint", () => {
  const bron = { t_objectconstraint: [
    { Object_ID: 7, Naam: "Gebruiker is ingelogd", ConstraintType: "Pre-condition", Notes: "" },
    { Object_ID: 7, Naam: "Adres bestaat", ConstraintType: "Pre-condition", Notes: "in de BAG" },
    { Object_ID: 7, Naam: "Locatie vastgelegd", ConstraintType: "Post-condition", Notes: null },
    { Object_ID: 7, Naam: "x", ConstraintType: "Invariant" },
    { Object_ID: 8, Naam: "ander", ConstraintType: "Pre-condition" },
  ] };
  assert.deepEqual(conditiesVan(bron, 7), { preconditie: "Gebruiker is ingelogd\nAdres bestaat: in de BAG", postconditie: "Locatie vastgelegd" });
  assert.deepEqual(conditiesVan({}, 7), {});
});
