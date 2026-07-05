// profielOntwerp.test.js — trede 2: getekend ontwerp ⇄ descriptor-kern.
// Run: node --import ./test/register-aliases.mjs --test src/studio/activities/profielOntwerp.test.js

import test from "node:test";
import assert from "node:assert/strict";

import {
  profielOntwerpKern,
  bouwProfielUitOntwerp,
  ontwerpUitProfiel,
  ontwerpUitAlleProfielen,
  layoutSleutels,
  voorbeeldOntwerpMetRegel,
  elementenVanDiagram,
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

test("verbindingsregel-lijnen met dezelfde naam bundelen tot één connectortype (1..*)", () => {
  const ontwerp = maakOntwerp();
  // Tweede lijn met dezelfde naam "draait om": Ster → Planeet
  ontwerp.elements.R2 = {
    id: "R2",
    naam: "draait om",
    elementType: "verbindingsregel",
    source: "E1",
    target: "E2",
    compartimenten: [],
    data: {},
  };
  const kern = bouwProfielUitOntwerp(ontwerp, { id: "zonnestelsel" });
  const regel = kern.elementTypes.find((et) => et.id === "draait-om");
  assert.ok(Array.isArray(regel.verbindingsregels), "gebundeld tot verbindingsregels 1..*");
  assert.equal(regel.verbindingsregels.length, 2);
  assert.deepEqual(regel.verbindingsregels[0], { bron: ["planeet"], doel: ["ster"] });
  assert.deepEqual(regel.verbindingsregels[1], { bron: ["ster"], doel: ["planeet"] });
  // en het geheel blijft registreerbaar
  assert.deepEqual(valideerDiagramType(vertaalHooks(kern)), []);

  // De inverse tekent per paar weer een lijn met dezelfde naam
  const terug = ontwerpUitProfiel(kern);
  const lijnen = Object.values(terug.elements).filter((el) => el.elementType === "verbindingsregel");
  assert.equal(lijnen.filter((l) => l.naam === "draait om").length, 2);
});

test("elementenVanDiagram: alleen nodes van het diagram + connectoren met beide uiteinden erop", () => {
  const state = {
    elements: {
      A: { id: "A", elementType: "elementDef" },
      B: { id: "B", elementType: "elementDef" },
      C: { id: "C", elementType: "elementDef" },
      R1: { id: "R1", elementType: "verbindingsregel", source: "A", target: "B" },
      R2: { id: "R2", elementType: "verbindingsregel", source: "A", target: "C" },
    },
    diagrams: {
      d1: { id: "d1", nodes: [{ elementId: "A" }, { elementId: "B" }] },
      d2: { id: "d2", nodes: [{ elementId: "C" }] },
    },
  };
  const d1 = elementenVanDiagram(state, "d1");
  assert.deepEqual(Object.keys(d1).sort(), ["A", "B", "R1"], "R2 hangt half buiten d1");
  const d2 = elementenVanDiagram(state, "d2");
  assert.deepEqual(Object.keys(d2), ["C"]);
});

test("hiërarchie (P02): bevat-vinkje op een regel-lijn wordt kern.hierarchie en terug", () => {
  const ontwerp = maakOntwerp();
  ontwerp.elements.R1.data.isHierarchie = true;
  const kern = bouwProfielUitOntwerp(ontwerp, { id: "zonnestelsel" });
  assert.equal(kern.hierarchie, "draait-om");
  assert.deepEqual(valideerDiagramType(vertaalHooks(kern)), []);

  const terug = ontwerpUitProfiel(kern);
  const lijn = Object.values(terug.elements).find((el) => el.elementType === "verbindingsregel");
  assert.equal(lijn.data.isHierarchie, true);
});

test("ontwerpUitAlleProfielen: diagram per profiel + bewaarde layout wint", () => {
  const profielA = {
    id: "prof-a",
    label: "Profiel A",
    fieldTypes: [],
    elementTypes: [{ id: "ding", label: "Ding", shape: "class-box", properties: [] }],
  };
  const profielB = {
    id: "prof-b",
    label: "Profiel B",
    fieldTypes: [],
    elementTypes: [{ id: "zaak", label: "Zaak", shape: "class-box", properties: [] }],
  };
  const layouts = { "prof-a": { "elementDef:Ding#1": { x: 555, y: 66 } } };
  const { elements, diagrams } = ontwerpUitAlleProfielen([profielA, profielB], (pid) => layouts[pid]);
  assert.deepEqual(Object.keys(diagrams).sort(), ["ontw_prof-a", "ontw_prof-b"]);
  const nodeA = diagrams["ontw_prof-a"].nodes.find(
    (n) => elements[n.elementId]?.naam === "Ding"
  );
  assert.deepEqual(nodeA.position, { x: 555, y: 66 }, "bewaarde standaard-layout wint");
  const nodeB = diagrams["ontw_prof-b"].nodes.find(
    (n) => elements[n.elementId]?.naam === "Zaak"
  );
  assert.ok(nodeB, "tweede profiel heeft zijn eigen diagram met nodes");
});

test("layoutSleutels: naamgenoten krijgen stabiele volgnummers", () => {
  const elements = {
    a: { id: "a", naam: "velden", elementType: "compartimentDef" },
    b: { id: "b", naam: "velden", elementType: "compartimentDef" },
  };
  const nodes = [{ elementId: "a" }, { elementId: "b" }];
  const sleutels = layoutSleutels(elements, nodes).map((x) => x.sleutel);
  assert.deepEqual(sleutels, ["compartimentDef:velden#1", "compartimentDef:velden#2"]);
});

test("container-vinkje en standaard-dicht reizen mee door ontwerp en bouw", () => {
  const ontwerp = ontwerpUitProfiel({
    id: "pkg-test",
    label: "Pkg",
    fieldTypes: [],
    elementTypes: [
      {
        id: "map",
        label: "Map",
        shape: "class-box",
        containerVoor: "in",
        standaardDichtInBoom: true,
        properties: [],
      },
      { id: "blad", label: "Blad", shape: "class-box", properties: [] },
      {
        id: "in",
        label: "In",
        shape: "edge",
        isConnector: true,
        bron: { elementTypes: ["map"] },
        doel: { elementTypes: ["blad"] },
      },
    ],
    hierarchie: "in",
  });
  const mapDef = Object.values(ontwerp.elements).find((el) => el.naam === "Map");
  assert.equal(mapDef.data.container, true, "containerVoor wordt het container-vinkje");
  assert.equal(mapDef.data.standaardDichtInBoom, true);

  const kern = bouwProfielUitOntwerp({ elements: ontwerp.elements }, { id: "pkg-test", label: "Pkg" });
  const mapEt = kern.elementTypes.find((et) => et.label === "Map");
  const inCt = kern.elementTypes.find((et) => et.isConnector);
  assert.equal(mapEt.standaardDichtInBoom, true);
  assert.equal(mapEt.containerVoor, inCt.id, "containerVoor wijst naar de hiërarchie-connector");
  assert.ok(!("_containerWens" in mapEt), "werk-vlag blijft niet achter");
});
