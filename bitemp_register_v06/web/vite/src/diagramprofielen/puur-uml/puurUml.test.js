// puurUml.test.js — fase 5-lakmoesproef: het tweede profiel moet zonder
// core-wijzigingen door de registry-validatie komen en de juiste
// verbindingsregels dragen.
// Run: node --import ./test/register-aliases.mjs --test src/diagramprofielen/puur-uml/puurUml.test.js

import test from "node:test";
import assert from "node:assert/strict";

import { registreerPuurUml, puurUmlDiagramType, maakElement, PUUR_UML_ID } from "./index.js";
import { getDiagramType } from "../../diagramcore/types/typeRegistry.js";

test("puur-uml: descriptor registreert zonder validatiefouten", () => {
  registreerPuurUml();
  assert.equal(getDiagramType(PUUR_UML_ID)?.id, PUUR_UML_ID);
});

test("puur-uml: connectoren hebben UML-verbindingsregels", () => {
  const et = Object.fromEntries(puurUmlDiagramType.elementTypes.map((e) => [e.id, e]));
  assert.ok(et.associatie.isConnector);
  assert.ok(et.associatie.bron.elementTypes.includes("klasse"));
  assert.ok(et.realisatie.doel.elementTypes.includes("interface"));
  assert.ok(!et.realisatie.doel.elementTypes.includes("klasse"), "realisatie eindigt op een interface");
  assert.equal(et.generalisatie.edgePresentatie.markerEnd, "driehoek");
  assert.equal(et.compositie.edgePresentatie.markerStart, "ruit");
  assert.equal(et.aggregatie.edgePresentatie.markerStart, "ruit-open");
  assert.equal(et.realisatie.edgePresentatie.lijn, "dash-6-3");
  // Richting: de edgePresentatie-hook zet de pijl alleen bij directioneel.
  assert.deepEqual(et.associatie.hooks.edgePresentatie({ data: {} }), {});
  assert.deepEqual(et.associatie.hooks.edgePresentatie({ data: { directioneel: true } }), {
    markerEnd: "pijl-open",
  });
});

test("puur-uml: associatie kan een associatieklasse worden (attributen-compartiment)", () => {
  const associatie = puurUmlDiagramType.elementTypes.find((e) => e.id === "associatie");
  assert.ok(
    associatie.compartments.some((c) => c.id === "attributen"),
    "associatie heeft een attributen-compartiment → ASOC-materialisatie"
  );
});

test("puur-uml: maakElement maakt klassifiers, geen connectoren", () => {
  const klasse = maakElement("klasse");
  assert.equal(klasse.elementType, "klasse");
  assert.ok(klasse.naam.startsWith("Nieuwe"));
  assert.equal(maakElement("associatie"), null, "connectoren ontstaan via edge-drag");
});

test("puur-uml: klassifier-resolver levert klassen, interfaces en enumeraties", () => {
  const elements = {
    a: { id: "a", naam: "Persoon", elementType: "klasse" },
    b: { id: "b", naam: "Serialiseerbaar", elementType: "interface" },
    c: { id: "c", naam: "Kleur", elementType: "enumeratie" },
    d: { id: "d", naam: "los", elementType: "notitie" },
  };
  const kandidaten = puurUmlDiagramType.referenceResolvers.klassifier({ elements });
  assert.deepEqual(kandidaten.map((k) => k.waarde), ["Kleur", "Persoon", "Serialiseerbaar"]);
  const primitieven = puurUmlDiagramType.referenceResolvers.primitief({});
  assert.ok(primitieven.some((k) => k.waarde === "String"));
});
