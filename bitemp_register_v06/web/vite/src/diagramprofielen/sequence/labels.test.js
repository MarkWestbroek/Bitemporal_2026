// labels.test.js — sequence: label van een bericht ([guard] naam: retour) en koppen.
// Run: node --import ./test/register-aliases.mjs --test src/diagramprofielen/sequence/labels.test.js

import test from "node:test";
import assert from "node:assert/strict";

import { berichtLabels, KOPPEN } from "./labels.js";

const tekst = (delen) => delen.map((d) => d.tekst).join("");

test("haakjes al in de naam, geen guard of retour: niets extra (de motor toont de naam)", () => {
  assert.deepEqual(berichtLabels({ naam: "Verzend()", data: {} }), {});
  assert.deepEqual(berichtLabels({ naam: "x()", data: { retourtype: "void" } }), {}, "void telt niet");
  assert.deepEqual(berichtLabels({ naam: "", data: {} }), {}, "naamloos: geen label");
});

test("een benoemd bericht is een aanroep: naam(argumenten), ook leeg (EA: Verzend())", () => {
  assert.equal(tekst(berichtLabels({ naam: "Verzend", data: {} }).rondNaam.na), "()");
  assert.equal(tekst(berichtLabels({ naam: "Maak aanvraag", data: { argumenten: "formulier, aanvraagtype", retourtype: "aanvraagnummer" } }).rondNaam.na), "(formulier, aanvraagtype): aanvraagnummer");
});

test("guard vóór en retourwaarde na de naam", () => {
  const { rondNaam } = berichtLabels({ naam: "Ontvang verzoek(Verzoek)", data: { guard: "is verzoek", retourtype: "Verzoeknummer" } });
  assert.equal(tekst(rondNaam.voor), "[is verzoek] ");
  assert.equal(tekst(rondNaam.na), ": Verzoeknummer");
  assert.equal(tekst(berichtLabels({ naam: "x()", data: { guard: "[al haken]" } }).rondNaam.voor), "[al haken] ");
});

test("retour staat al in de naam (Marks stijl): niet dubbel", () => {
  const uit = berichtLabels({ naam: "Maak aanvraag(formulier, aanvraagtype): aanvraagnummer", data: { retourtype: "aanvraagnummer" } });
  assert.deepEqual(uit, {});
});

test("met gekozen operatie: één label met guard, signatuur en retour", () => {
  const uit = berichtLabels({ naam: "", data: { operatie: { naam: "valideer" }, argumenten: "a", retourtype: "Boolean", guard: "g" } });
  assert.equal(tekst(uit.kaal[0].delen), "[g] valideer(a): Boolean");
  const sig = berichtLabels({ data: { operatie: { naam: "doe(x): Y" }, retourtype: "Y" } });
  assert.equal(tekst(sig.kaal[0].delen), "doe(x): Y");
});

test("koppen: object, actor en de drie robustness-stereotypes", () => {
  assert.deepEqual(KOPPEN.map((k) => k.waarde), ["object", "actor", "boundary", "control", "entity", "business-boundary", "business-control", "business-entity"]);
});
