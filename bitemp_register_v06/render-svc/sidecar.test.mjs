// Het sidecar-project (PROF-1): alle profielen en regelsets als één werkbestand, en elk profiel
// komt eruit terug (op code na). node --test (na node bouw.mjs).
import { test } from "node:test";
import assert from "node:assert/strict";
import { sidecarVanAlles, sidecarVerschillen, profielIds } from "./dist/studio-profielen.mjs";

test("het sidecar-project draagt elk profiel en elke regelset volledig, code op id", () => {
  const project = sidecarVanAlles();
  const m3 = project.profielen.m3Profiel05;
  // Alle profielen behalve de twee talen zelf (de M3-taal en Transformatie).
  assert.equal(Object.keys(m3.diagrams).length, profielIds.length - 2);
  assert.ok(Object.keys(project.profielen.transformatie05.elements).some((id) => id.startsWith("tr_")));
  // Het past ruim in een project (localStorage-grens 5 MB).
  assert.ok(JSON.stringify(project).length < 2_500_000, `${JSON.stringify(project).length} tekens`);
  // Ook door JSON heen (opslaan, sync): elk profiel komt exact terug, met de code op id.
  const verschillen = sidecarVerschillen(JSON.parse(JSON.stringify(project)));
  for (const [pid, lijst] of Object.entries(verschillen)) assert.deepEqual(lijst, [], pid);
});
