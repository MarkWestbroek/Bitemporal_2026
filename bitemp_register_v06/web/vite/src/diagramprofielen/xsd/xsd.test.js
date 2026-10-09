// xsd.test.js — XSD-profiel: descriptor geldig, xsdType als bereik, EA-tabel sluitend.
// Run: node --import ./test/register-aliases.mjs --test src/diagramprofielen/xsd/xsd.test.js

import test from "node:test";
import assert from "node:assert/strict";

import { valideerDiagramType } from "../../diagramcore/types/typeRegistry.js";
import { normaliseerErfenis, kopieVoorNormalisatie } from "../../diagramcore/types/erfenis.js";
import { xsdDiagramType, elementTypes } from "./descriptor.js";
import { OBJECTEN, CONNECTOREN } from "./eaMapping.js";

test("descriptor is geldig", () => {
  assert.deepEqual(valideerDiagramType(xsdDiagramType), []);
});

test("xsdType → complexType, simpleType, enumeration; enumeration erft facets én krijgt waarden", () => {
  const dt = kopieVoorNormalisatie(xsdDiagramType);
  assert.deepEqual(normaliseerErfenis(dt), []);
  assert.deepEqual(dt.elementTypes.find((t) => t.id === "extension").bron.elementTypes, ["complexType", "simpleType", "enumeration"]);
  const en = dt.elementTypes.find((t) => t.id === "enumeration");
  assert.deepEqual(en.compartments.map((c) => c.id), ["facets", "waarden"]);
  assert.ok(en.properties.some((p) => p.key === "base"));
  assert.equal(en.stereotype, "«XSDenumeration»");
});

test("vanType labelt rolnaam en occurs aan de doelzijde", () => {
  const vt = elementTypes.find((t) => t.id === "vanType");
  const labels = vt.hooks.edgeLabels({ data: { rolnaam: "adres", minOccurs: "0", maxOccurs: "unbounded" } }).kaal;
  assert.equal(labels[0].delen[0].tekst, "adres");
  assert.equal(labels[1].delen[0].tekst, "0..unbounded");
  assert.deepEqual(vt.hooks.edgeLabels({ data: {} }).kaal, []);
});

test("EA-tabel sluit op de descriptor; alle XSD-stereotypen uit de opdracht zijn gedekt", () => {
  const perId = new Map(elementTypes.map((t) => [t.id, t]));
  for (const r of OBJECTEN) {
    const t = perId.get(r.elementType);
    assert.ok(t && !t.isConnector && !t.isAbstract, r.elementType);
  }
  for (const r of CONNECTOREN) assert.ok(perId.get(r.elementType)?.isConnector, r.elementType);
  for (const st of ["xsdschema", "xsdcomplextype", "xsdsimpletype", "xsdelement", "xsdattribute", "xsdgroup", "xsdenumeration"]) {
    assert.ok(OBJECTEN.some((r) => r.stereotype === st), st);
  }
});
