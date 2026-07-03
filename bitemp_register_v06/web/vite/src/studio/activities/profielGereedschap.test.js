// profielGereedschap.test.js — het pure deel van de meta-editor (plan §8.9).
// Run: node --import ./test/register-aliases.mjs --test src/studio/activities/profielGereedschap.test.js

import test from "node:test";
import assert from "node:assert/strict";

import {
  HOOK_CATALOGUS,
  vertaalHooks,
  maakGeneriekeMaakElement,
  LEEG_SJABLOON,
  GRAAF_DEMO,
} from "./profielGereedschap.js";
import { valideerDiagramType } from "../../diagramcore/types/typeRegistry.js";

test("sjablonen zijn geldige descriptors (na hook-vertaling)", () => {
  assert.deepEqual(valideerDiagramType(vertaalHooks(LEEG_SJABLOON)), []);
  assert.deepEqual(valideerDiagramType(vertaalHooks(GRAAF_DEMO)), []);
});

test("vertaalHooks: catalogus-id's worden functies; onbekende id's geven een nette fout", () => {
  const descriptor = vertaalHooks(GRAAF_DEMO);
  const kant = descriptor.elementTypes.find((et) => et.id === "kant");
  assert.equal(typeof kant.hooks.edgeLabels, "function");
  assert.equal(typeof kant.hooks.edgePresentatie, "function");
  // De vertaalde hook gedraagt zich als de catalogus-functie
  assert.deepEqual(kant.hooks.edgePresentatie({ data: { directioneel: true } }), {
    markerEnd: "pijl-open",
  });
  const labels = kant.hooks.edgeLabels({ naam: "kent", data: { bronKardinaliteit: "1" } });
  assert.ok(labels.kaal.some((l) => l.delen.some((d) => d.tekst === "1")));
  // Géén naam-label uit de hook: de core voegt de connector-naam zelf toe
  // (anders verschijnt hij dubbel — gemeld bij het label-slepen).
  assert.ok(!labels.kaal.some((l) => l.delen.some((d) => d.tekst === "kent")));

  assert.throws(
    () =>
      vertaalHooks({
        ...GRAAF_DEMO,
        elementTypes: [{ id: "x", hooks: { edgeLabels: "bestaat-niet" } }],
      }),
    /onbekende edgeLabels-hook "bestaat-niet"/
  );
});

test("maakGeneriekeMaakElement: elementen voor niet-connectoren, null voor connectoren", () => {
  const maak = maakGeneriekeMaakElement(GRAAF_DEMO);
  const knoop = maak("knoop");
  assert.equal(knoop.elementType, "knoop");
  assert.ok(knoop.naam.startsWith("Nieuw"));
  assert.ok(knoop.id.startsWith("graaf-demo_"));
  assert.equal(maak("kant"), null);
  assert.equal(maak("bestaat-niet"), null);
});

test("graaf-demo gebruikt de bol-shape en de hook-catalogus dekt zijn verwijzingen", () => {
  const knoop = GRAAF_DEMO.elementTypes.find((et) => et.id === "knoop");
  assert.equal(knoop.shape, "bol");
  const kant = GRAAF_DEMO.elementTypes.find((et) => et.id === "kant");
  for (const [soort, id] of Object.entries(kant.hooks)) {
    assert.ok(HOOK_CATALOGUS[soort]?.[id], `${soort}:${id} zit in de catalogus`);
  }
});
