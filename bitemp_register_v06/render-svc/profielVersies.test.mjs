// Bewaking van de profielversies (M2): node --test render-svc/ (na node bouw.mjs).
import { test } from "node:test";
import assert from "node:assert/strict";
import { leesVast, vergelijk } from "./profielVersies.mjs";
import { profielVersieOverzicht, profielIds } from "./dist/studio-profielen.mjs";

test("elk profiel heeft een versie, en vast.json klopt met de profielen", () => {
  const nu = profielVersieOverzicht();
  assert.deepEqual(Object.keys(nu), [...profielIds].sort());
  for (const [pid, n] of Object.entries(nu)) {
    assert.match(n.versie, /^\d+\.\d+\.\d+$/, pid);
    assert.match(n.vingerafdruk, /^[0-9a-f]{16}$/, pid);
  }
  const { fouten, bijTeWerken } = vergelijk(nu, leesVast());
  assert.deepEqual(fouten, [], "structuur veranderd zonder versieverhoging");
  assert.deepEqual(bijTeWerken, [], "draai `npm run profielversies` in render-svc");
});

test("vergelijk: structuurwijziging zonder versieverhoging is een fout", () => {
  const vast = { a: { versie: "1.0.0", vingerafdruk: "x" }, b: { versie: "1.0.0", vingerafdruk: "y" } };
  assert.deepEqual(vergelijk(vast, vast), { fouten: [], bijTeWerken: [] });
  // Structuur anders, versie gelijk: eerst de versie omhoog.
  const r1 = vergelijk({ ...vast, a: { versie: "1.0.0", vingerafdruk: "z" } }, vast);
  assert.equal(r1.fouten.length, 1);
  assert.match(r1.fouten[0], /^a: de structuur is veranderd/);
  // Structuur anders én versie omhoog: alleen vast.json bijwerken.
  const r2 = vergelijk({ ...vast, a: { versie: "1.1.0", vingerafdruk: "z" } }, vast);
  assert.deepEqual(r2, { fouten: [], bijTeWerken: ["a: 1.0.0 → 1.1.0"] });
  // Versie omlaag mag niet; een nieuw of verdwenen profiel is bijwerken.
  assert.equal(vergelijk({ ...vast, a: { versie: "0.9.0", vingerafdruk: "x" } }, vast).fouten.length, 1);
  assert.deepEqual(vergelijk({ ...vast, c: { versie: "1.0.0", vingerafdruk: "q" } }, vast).bijTeWerken, ["c: nieuw profiel (1.0.0)"]);
  assert.deepEqual(vergelijk({ a: vast.a }, vast).bijTeWerken, ["b: profiel bestaat niet meer"]);
});
