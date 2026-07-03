// oas31.test.js — fase 5-vuurproef: het derde profiel (geen UML) moet zonder
// core-wijzigingen door de registry-validatie komen.
// Run: node --import ./test/register-aliases.mjs --test src/diagramprofielen/oas31/oas31.test.js

import test from "node:test";
import assert from "node:assert/strict";

import { registreerOas31, oas31DiagramType, maakElement, OAS31_ID } from "./index.js";
import { getDiagramType } from "../../diagramcore/types/typeRegistry.js";

test("oas31: descriptor registreert zonder validatiefouten", () => {
  registreerOas31();
  assert.equal(getDiagramType(OAS31_ID)?.id, OAS31_ID);
});

test("oas31: $ref/allOf/items dragen OAS-verbindingsregels", () => {
  const et = Object.fromEntries(oas31DiagramType.elementTypes.map((e) => [e.id, e]));
  assert.ok(et.ref.isConnector);
  assert.ok(et.ref.bron.elementTypes.includes("operatie"), "ook een operatie kan $ref'en");
  assert.ok(et.ref.doel.elementTypes.includes("enum"));
  assert.ok(!et.ref.doel.elementTypes.includes("operatie"), "$ref eindigt op een schema");
  assert.deepEqual(et.allOf.bron.elementTypes, ["schema"]);
  assert.equal(et.allOf.edgePresentatie.markerEnd, "driehoek");
  assert.equal(et.items.edgePresentatie.lijn, "dash-4-3");
});

test("oas31: $ref toont de property-naam als rolnaam", () => {
  const ref = oas31DiagramType.elementTypes.find((e) => e.id === "ref");
  const labels = ref.hooks.edgeLabels({ data: { rolnaam: "adres" } });
  assert.ok(labels.kaal.some((l) => l.delen.some((d) => d.tekst === "adres")));
  assert.ok(labels.kaal.some((l) => l.delen.some((d) => d.tekst === "«$ref»")));
});

test("oas31: operatie heeft alleen properties + een live signatuur-weergave", () => {
  const op = oas31DiagramType.elementTypes.find((e) => e.id === "operatie");
  assert.ok(op.compartments.every((c) => c.alleenWeergave), "geen bewerkbare compartimenten");
  const extra = op.hooks.extraCompartimenten({ data: { method: "GET", pad: "/personen/{id}" } });
  assert.equal(extra[0].velden[0].naam, "GET /personen/{id}");
  const nieuw = maakElement("operatie");
  assert.equal(nieuw.data.method, "GET");
  assert.equal(nieuw.data.pad, "/");
});

test("oas31: property-typen zijn JSON-typen of schema-$refs", () => {
  const jsonTypen = oas31DiagramType.referenceResolvers["json-type"]({});
  assert.ok(jsonTypen.some((k) => k.waarde === "string «date-time»"));
  const elements = {
    a: { id: "a", naam: "Persoon", elementType: "schema" },
    b: { id: "b", naam: "Kleur", elementType: "enum" },
    c: { id: "c", naam: "getPersoon", elementType: "operatie" },
  };
  const refs = oas31DiagramType.referenceResolvers["schema-ref"]({ elements });
  assert.deepEqual(refs.map((k) => k.waarde), ["Kleur", "Persoon"], "operaties zijn geen type");
});
