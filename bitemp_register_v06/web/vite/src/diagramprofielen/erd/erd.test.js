// erd.test.js — ERD-profiel: contract, kraaienpoot-vertaling en lijnstijl.
// Run: node --import ./test/register-aliases.mjs --test src/diagramprofielen/erd/erd.test.js

import test from "node:test";
import assert from "node:assert/strict";

import { erdDiagramType, kardinaliteitMarker, KARDINALITEIT_OPTIES, maakElement } from "./index.js";
import { valideerDiagramType } from "../../diagramcore/types/typeRegistry.js";

const relatie = erdDiagramType.elementTypes.find((et) => et.id === "relatie");
const presentatie = (data) => relatie.hooks.edgePresentatie({ data });

test("erd descriptor voldoet aan het DiagramType-contract", () => {
  assert.deepEqual(valideerDiagramType(erdDiagramType), []);
});

test("elke kardinaliteit-optie heeft een bijbehorende kraaienpoot-marker", () => {
  for (const optie of KARDINALITEIT_OPTIES) {
    assert.equal(kardinaliteitMarker(optie.waarde), `kraai-${optie.waarde}`);
  }
});

test("onbekende of lege kardinaliteit levert géén marker op", () => {
  // Liever een kale lijn dan een verkeerde kardinaliteit suggereren.
  assert.equal(kardinaliteitMarker(""), null);
  assert.equal(kardinaliteitMarker(undefined), null);
  assert.equal(kardinaliteitMarker("een-of-twee"), null);
});

test("kardinaliteit staat per uiteinde: bron → markerStart, doel → markerEnd", () => {
  const p = presentatie({ bronKardinaliteit: "een", doelKardinaliteit: "nul-of-meer" });
  assert.equal(p.markerStart, "kraai-een");
  assert.equal(p.markerEnd, "kraai-nul-of-meer");
});

test("half ingevulde relatie krijgt alleen de ingevulde kant", () => {
  const p = presentatie({ doelKardinaliteit: "een-of-meer" });
  assert.equal(p.markerEnd, "kraai-een-of-meer");
  assert.ok(!("markerStart" in p));
});

test("alleen een niet-identificerende relatie wordt gestreept", () => {
  assert.equal(presentatie({ soort: "niet-identificerend" }).lijn, "dash-6-3");
  assert.ok(!("lijn" in presentatie({ soort: "identificerend" })));
  assert.ok(!("lijn" in presentatie({})));
});

test("rolnamen komen als kaal label op de juiste zijde", () => {
  const labels = relatie.hooks.edgeLabels({ data: { bronRol: "hoort bij", doelRol: "bevat" } });
  assert.deepEqual(
    labels.kaal.map((l) => [l.zijde, l.delen[0].tekst]),
    [["bron", "hoort bij"], ["doel", "bevat"]]
  );
});

test("de entiteit heeft sleutel- én kolommen-compartiment, in die volgorde", () => {
  const ent = erdDiagramType.elementTypes.find((et) => et.id === "entiteit");
  assert.deepEqual(ent.compartments.map((c) => c.id), ["sleutel", "kolommen"]);
});

test("maakElement geeft een entiteit met lege compartimenten en een naam", () => {
  const el = maakElement("entiteit");
  assert.equal(el.elementType, "entiteit");
  assert.equal(el.naam, "Entiteit");
  assert.deepEqual(el.compartimenten, []);
  assert.equal(maakElement("relatie"), null); // connectors maak je met de verbinding-taakbalk
});
