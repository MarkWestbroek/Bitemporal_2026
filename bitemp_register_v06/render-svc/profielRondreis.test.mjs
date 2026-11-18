// Bewaking van de rondreis profiel → ontwerp-model → profiel (PROF-1): node --test (na node bouw.mjs).
import { test } from "node:test";
import assert from "node:assert/strict";
import { leesVast, vergelijk } from "./profielRondreis.mjs";
import { profielRondreisStand } from "./dist/studio-profielen.mjs";

test("de rondreis van de profielen verliest niet meer dan vastgelegd, en vast.json is bij", () => {
  const { slechter, beter } = vergelijk(profielRondreisStand(), leesVast());
  assert.deepEqual(slechter, [], "het ontwerp verliest meer dan voorheen (zie profielRondreis.mjs)");
  assert.deepEqual(beter, [], "beter geworden: draai `npm run profielrondreis` in render-svc");
});

test("vergelijk: erbij of vaker is slechter, weg of minder is beter", () => {
  const vast = { "ElementType.kleur — weg": 3, "FieldType.viewer — anders": 1 };
  assert.deepEqual(vergelijk(vast, vast), { slechter: [], beter: [] });
  assert.deepEqual(vergelijk({ ...vast, "ElementType.kleur — weg": 4 }, vast).slechter, ["ElementType.kleur — weg: 3 → 4"]);
  assert.deepEqual(vergelijk({ ...vast, "DiagramType.versie — weg": 1 }, vast).slechter, ["DiagramType.versie — weg: 0 → 1"]);
  assert.deepEqual(vergelijk({ "ElementType.kleur — weg": 2 }, vast), { slechter: [], beter: ["ElementType.kleur — weg: 3 → 2", "FieldType.viewer — anders: 1 → 0"] });
});
