import test from "node:test";
import assert from "node:assert/strict";
import { elementenNaHernoeming } from "./hernoemen.js";

const descriptor = {
  fieldTypes: [
    {
      id: "attribuut",
      properties: [
        { key: "naam", datatype: "string" },
        { key: "typeLabel", referenceTypes: ["gegevenstype", "enumeratie"] },
      ],
    },
    { id: "eigenschap", properties: [{ key: "typeLabel", datatype: "string" }] },
  ],
};

const elements = {
  d1: { id: "d1", naam: "NieuweDatatype", elementType: "gegevenstype", compartimenten: [] },
  k1: {
    id: "k1",
    naam: "Klasse",
    elementType: "klasse",
    compartimenten: [
      {
        compartmentType: "attributen",
        velden: [
          { naam: "a", fieldType: "attribuut", data: { typeLabel: "NieuweDatatype" } },
          { naam: "b", fieldType: "attribuut", data: { typeLabel: "NieuweDatatype {0..*}" } },
          { naam: "c", fieldType: "attribuut", data: { typeLabel: "String" } },
          // Geen verwijzende property (eigenschap.typeLabel is een gewone string).
          { naam: "e", fieldType: "eigenschap", data: { typeLabel: "NieuweDatatype" } },
        ],
      },
    ],
  },
  los: { id: "los", naam: "Los", elementType: "klasse" },
};

test("hernoemen trekt naam-verwijzingen in velden door, met behoud van suffix", () => {
  const uit = elementenNaHernoeming(elements, descriptor, "d1", "NieuwDatatype");
  assert.equal(uit.d1.naam, "NieuwDatatype");
  const velden = uit.k1.compartimenten[0].velden;
  assert.equal(velden[0].data.typeLabel, "NieuwDatatype");
  assert.equal(velden[1].data.typeLabel, "NieuwDatatype {0..*}");
  assert.equal(velden[2].data.typeLabel, "String");
  assert.equal(velden[3].data.typeLabel, "NieuweDatatype", "niet-verwijzende property blijft staan");
  // Onaangeraakte elementen behouden hun identiteit (goedkope rerender).
  assert.equal(uit.los, elements.los);
  // Invoer is niet gemuteerd.
  assert.equal(elements.k1.compartimenten[0].velden[0].data.typeLabel, "NieuweDatatype");
});

test("hernoemen: zelfde of lege naam doet niets", () => {
  assert.equal(elementenNaHernoeming(elements, descriptor, "d1", "NieuweDatatype"), elements);
  assert.equal(elementenNaHernoeming(elements, descriptor, "d1", "   "), elements);
  assert.equal(elementenNaHernoeming(elements, descriptor, "bestaat-niet", "X"), elements);
});

test("hernoemen zonder verwijzende fieldTypes wijzigt alleen de naam", () => {
  const uit = elementenNaHernoeming(elements, { fieldTypes: [] }, "d1", "Ander");
  assert.equal(uit.d1.naam, "Ander");
  assert.equal(uit.k1, elements.k1);
});
