// De tool uit het sidecar-project opbouwen (PROF-1 stap d): alle profielen uit het project laden,
// op hun plek, en de tool is daarna dezelfde. Eigen proces (node --test): het register verandert.
import { test } from "node:test";
import assert from "node:assert/strict";
import { sidecarVanAlles, laadSidecarInDeTool, profielVersieOverzicht, profielRondreisStand, descriptorVan, profielIds } from "./dist/studio-profielen.mjs";

test("alle profielen uit het sidecar-project laden: dezelfde tool, dezelfde objecten", () => {
  const voor = profielVersieOverzicht();
  const objecten = new Map(profielIds.map((pid) => [pid, descriptorVan(pid)]));
  // Door JSON heen, zoals een project van de server of uit een bestand komt.
  const project = JSON.parse(JSON.stringify(sidecarVanAlles()));
  const { vervangen, nieuw, fouten } = laadSidecarInDeTool(project);
  assert.deepEqual(fouten, []);
  assert.deepEqual(nieuw, []);
  assert.equal(vervangen.length, profielIds.length - 2, "alle profielen behalve de twee talen zelf");
  // Dezelfde structuur en versie (de vingerafdruk), en nog steeds exact te ontwerpen.
  assert.deepEqual(profielVersieOverzicht(), voor);
  assert.deepEqual(profielRondreisStand(), {});
  // Op hun plek: de activiteiten houden deze objecten vast.
  for (const [pid, obj] of objecten) assert.equal(descriptorVan(pid), obj, pid);
});

test("een gewijzigd profiel in het project verandert de tool", () => {
  const project = JSON.parse(JSON.stringify(sidecarVanAlles()));
  const m3 = project.profielen.m3Profiel05;
  const entiteit = Object.values(m3.elements).find((e) => e.elementType === "elementDef" && e.data["m3:id"] === "entiteit" && e.id.startsWith("p_erd_"));
  entiteit.data["m3:kleur"] = "#123456";
  const erd = descriptorVan("erd05");
  const { fouten } = laadSidecarInDeTool(project);
  assert.deepEqual(fouten, []);
  assert.equal(descriptorVan("erd05"), erd, "hetzelfde object");
  assert.equal(erd.elementTypes.find((e) => e.id === "entiteit").kleur, "#123456");
});
