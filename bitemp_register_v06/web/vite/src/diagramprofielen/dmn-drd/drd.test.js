// drd.test.js — DMN DRD-profiel: contract, layout en omgekeerde hiërarchie.
// Run: node --import ./test/register-aliases.mjs --test src/diagramprofielen/dmn-drd/drd.test.js

import test from "node:test";
import assert from "node:assert/strict";

import { dmnDrdDiagramType, drdRijenPosities, maakElement } from "./index.js";
import { valideerDiagramType } from "../../diagramcore/types/typeRegistry.js";

test("dmn-drd descriptor voldoet aan het DiagramType-contract", () => {
  assert.deepEqual(valideerDiagramType(dmnDrdDiagramType), []);
});

test("hierarchie is omgekeerd: de requirement-pijl wijst naar de ouder", () => {
  for (const hier of dmnDrdDiagramType.hierarchie) {
    assert.equal(hier.omgekeerd, true);
    assert.ok(
      dmnDrdDiagramType.elementTypes.some((et) => et.id === hier.type && et.isConnector)
    );
  }
});

test("drdRijenPosities: eindbeslissing boven, vereisten in rijen eronder", () => {
  const elements = {
    eind: { id: "eind", elementType: "decision", naam: "Toekenning" },
    sub: { id: "sub", elementType: "decision", naam: "Leeftijdstoets" },
    inv: { id: "inv", elementType: "inputData", naam: "Aanvraag" },
    bron: { id: "bron", elementType: "knowledgeSource", naam: "Wet" },
  };
  const pos = drdRijenPosities({
    ids: Object.keys(elements),
    elements,
    edges: [
      { source: "sub", target: "eind" }, // subbeslissing voedt de eindbeslissing
      { source: "inv", target: "sub" }, // invoer voedt de subbeslissing
      { source: "bron", target: "eind" }, // kennisbron bij de eindbeslissing
    ],
  });
  assert.ok(pos.eind.y < pos.sub.y, "eindbeslissing staat bovenaan");
  assert.ok(pos.sub.y < pos.inv.y, "invoer staat onder de subbeslissing");
  assert.equal(pos.sub.y, pos.bron.y, "directe vereisten delen een rij");
});

test("maakElement geeft bruikbare elementen (en geen connectoren)", () => {
  const d = maakElement("decision");
  assert.equal(d.elementType, "decision");
  assert.ok(d.naam);
  assert.equal(maakElement("infoReq"), null);
});
