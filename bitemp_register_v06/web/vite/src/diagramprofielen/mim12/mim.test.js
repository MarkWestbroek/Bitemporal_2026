// mim.test.js — MIM 1.2-profiel: contract en kernstructuur.
// Run: node --import ./test/register-aliases.mjs --test src/diagramprofielen/mim12/mim.test.js

import test from "node:test";
import assert from "node:assert/strict";

import { mim12DiagramType, maakElement } from "./index.js";
import { valideerDiagramType, verbindingsregelsVan } from "../../diagramcore/types/typeRegistry.js";

test("mim12 descriptor voldoet aan het DiagramType-contract", () => {
  assert.deepEqual(valideerDiagramType(mim12DiagramType), []);
});

test("relatiesoort draagt de MIM-rolmetagegevens en materialiseert met velden", () => {
  const rel = mim12DiagramType.elementTypes.find((et) => et.id === "relatiesoort");
  assert.ok(rel.isConnector);
  const sleutels = rel.properties.map((p) => p.key);
  for (const verwacht of [
    "bronRolNaam",
    "doelRolNaam",
    "bronKardinaliteit",
    "doelKardinaliteit",
    "unidirectioneel",
    "indicatieMaterieleHistorie",
    "indicatieFormeleHistorie",
  ]) {
    assert.ok(sleutels.includes(verwacht), verwacht);
  }
  // Compartiment aanwezig → velden erop = relatieklasse (ASOC-patroon).
  assert.ok(rel.compartments?.length);
  // Rolnamen/kardinaliteiten als edge-labels.
  const labels = rel.hooks.edgeLabels({
    data: { bronKardinaliteit: "1", doelKardinaliteit: "0..*", doelRolNaam: "heeft" },
  });
  assert.equal(labels.kaal.length, 3);
});

test("generalisatie geldt voor objecttypen én voor datatypen (2 regels)", () => {
  const gen = mim12DiagramType.elementTypes.find((et) => et.id === "generalisatie");
  const regels = verbindingsregelsVan(gen);
  assert.equal(regels.length, 2);
  assert.ok(regels[0].bron.includes("objecttype"));
  assert.ok(regels[1].bron.includes("primitiefDatatype"));
});

test("package is container met soort-property; boom volgt bevat + gegevensgroep", () => {
  const pkg = mim12DiagramType.elementTypes.find((et) => et.id === "package");
  assert.equal(pkg.containerVoor, "bevat");
  assert.equal(pkg.standaardDichtInBoom, true);
  assert.ok(pkg.properties.some((p) => p.key === "soort"));
  assert.deepEqual(mim12DiagramType.hierarchie, ["bevat", "gegevensgroep"]);
});

test("maakElement: package start als domein; connectoren niet plaatsbaar", () => {
  const p = maakElement("package");
  assert.equal(p.data.soort, "domein");
  assert.equal(maakElement("relatiesoort"), null);
});

test("attribuutsoort-veld draagt de MIM-metagegevens", () => {
  const ft = mim12DiagramType.fieldTypes.find((f) => f.id === "attribuutsoort");
  const sleutels = ft.properties.map((p) => p.key);
  for (const verwacht of [
    "kardinaliteit",
    "authentiek",
    "indicatieMaterieleHistorie",
    "indicatieFormeleHistorie",
    "mogelijkGeenWaarde",
    "identificerend",
  ]) {
    assert.ok(sleutels.includes(verwacht), verwacht);
  }
});
