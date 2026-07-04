// profielOntwerp.test.js — trede 2: getekend ontwerp ⇄ descriptor-kern.
// Run: node --import ./test/register-aliases.mjs --test src/studio/activities/profielOntwerp.test.js

import test from "node:test";
import assert from "node:assert/strict";

import {
  profielOntwerpKern,
  bouwProfielUitOntwerp,
  ontwerpUitProfiel,
  voorbeeldOntwerpMetRegel,
} from "./profielOntwerp.js";
import { vertaalHooks } from "./profielGereedschap.js";
import { valideerDiagramType } from "../../diagramcore/types/typeRegistry.js";

test("het ontwerp-profiel zelf is een geldige descriptor", () => {
  assert.deepEqual(valideerDiagramType(vertaalHooks(profielOntwerpKern)), []);
});

/** Getekend ontwerp conform het metamodel: ET ◆ CT ◆ VT + regel. */
function maakOntwerp() {
  return {
    elements: {
      E1: {
        id: "E1",
        naam: "Ster",
        elementType: "elementDef",
        compartimenten: [
          {
            compartmentType: "eigenschappen",
            velden: [{ naam: "helderheid", fieldType: "eigenschapDef", data: { typeLabel: "string" } }],
          },
        ],
        data: { kort: "ST", shape: "bol", doelKleur: "#fde68a" },
      },
      E2: { id: "E2", naam: "Planeet", elementType: "elementDef", compartimenten: [], data: { shape: "raar" } },
      CT1: { id: "CT1", naam: "Metingen", elementType: "compartimentDef", compartimenten: [], data: {} },
      VT1: {
        id: "VT1",
        naam: "meting",
        elementType: "fieldDef",
        compartimenten: [
          {
            compartmentType: "eigenschappen",
            velden: [
              { naam: "eenheid", fieldType: "eigenschapDef", data: { typeLabel: "string" } },
              { naam: "verplicht", fieldType: "eigenschapDef", data: { typeLabel: "boolean" } },
            ],
          },
        ],
        data: {},
      },
      C1: { id: "C1", naam: "", elementType: "compositie", source: "E1", target: "CT1", compartimenten: [], data: {} },
      C2: { id: "C2", naam: "", elementType: "compositie", source: "CT1", target: "VT1", compartimenten: [], data: {} },
      R1: {
        id: "R1",
        naam: "draait om",
        elementType: "verbindingsregel",
        source: "E2",
        target: "E1",
        compartimenten: [],
        data: { vorm: "recht", markerEnd: "pijl-open", metKardinaliteiten: true, richtingOptie: true },
      },
    },
  };
}

test("bouwProfielUitOntwerp: ET ◆ CT ◆ VT wordt elementType + compartment + fieldType", () => {
  const kern = bouwProfielUitOntwerp(maakOntwerp(), { id: "zonnestelsel" });

  // FieldType uit de VT-node, mét eigen properties (naast de intrinsieke naam)
  const meting = kern.fieldTypes.find((ft) => ft.id === "meting");
  assert.ok(meting, "veldtype-node wordt fieldType");
  assert.deepEqual(meting.properties.map((p) => p.key), ["naam", "eenheid", "verplicht"]);
  assert.equal(meting.properties[2].datatype, "boolean");

  // CompartmentType hangt aan het ET en verwijst naar dat fieldType
  const ster = kern.elementTypes.find((et) => et.id === "ster");
  assert.deepEqual(ster.compartments, [{ id: "metingen", label: "Metingen", fieldType: "meting" }]);
  assert.equal(ster.shape, "bol");
  assert.deepEqual(ster.properties.map((p) => p.key), ["kleur", "helderheid"]);

  // ET zonder compartiment-koppelingen heeft er geen; rare shape valt terug
  const planeet = kern.elementTypes.find((et) => et.id === "planeet");
  assert.deepEqual(planeet.compartments, []);
  assert.equal(planeet.shape, "class-box");

  // Verbindingsregel → connector met hooks op id
  const regel = kern.elementTypes.find((et) => et.id === "draait-om");
  assert.deepEqual(regel.bron.elementTypes, ["planeet"]);
  assert.equal(regel.hooks.edgeLabels, "kardinaliteiten");
  assert.equal(regel.hooks.edgePresentatie, "directioneel-pijl");
});

test("bouwProfielUitOntwerp: resultaat is registreerbaar", () => {
  const kern = bouwProfielUitOntwerp(maakOntwerp(), { id: "zonnestelsel" });
  assert.deepEqual(valideerDiagramType(vertaalHooks(kern)), []);
});

test("ontwerpUitProfiel ⇄ bouwProfielUitOntwerp: round-trip behoudt de structuur", () => {
  const ontwerp = voorbeeldOntwerpMetRegel();
  // Het voorbeeld is zelf al een geldig ontwerp…
  const kern = bouwProfielUitOntwerp({ elements: ontwerp.elements }, { id: "rt" });
  assert.deepEqual(valideerDiagramType(vertaalHooks(kern)), []);

  const ster = kern.elementTypes.find((et) => et.label === "Ster");
  assert.equal(ster.shape, "bol");
  assert.deepEqual(ster.compartments.map((c) => c.id), ["metingen"]);
  const meting = kern.fieldTypes.find((ft) => ft.id === "meting");
  assert.ok(meting.properties.some((p) => p.key === "eenheid"));
  const regel = kern.elementTypes.find((et) => et.isConnector);
  assert.equal(regel.hooks.edgeLabels, "kardinaliteiten");

  // …en een bestaand profiel is als ontwerp in te lezen (descriptor → diagram)
  const terug = ontwerpUitProfiel(kern);
  const soorten = Object.values(terug.elements).reduce((acc, el) => {
    acc[el.elementType] = (acc[el.elementType] || 0) + 1;
    return acc;
  }, {});
  assert.equal(soorten.elementDef, 2);
  assert.equal(soorten.compartimentDef, 2, "Metingen + Kenmerken");
  assert.equal(soorten.fieldDef, 1, "gedeeld veldtype maar één node");
  assert.equal(soorten.verbindingsregel, 1);
  assert.equal(soorten.compositie, 4, "2× ET◆CT + 2× CT◆VT");
});

test("bouwProfielUitOntwerp: leeg ontwerp geeft een nette fout", () => {
  assert.throws(() => bouwProfielUitOntwerp({ elements: {} }, { id: "x" }), /geen Elementtype/);
});
