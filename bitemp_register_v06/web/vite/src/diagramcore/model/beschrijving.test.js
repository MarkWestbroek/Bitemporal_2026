// beschrijving.test.js — de vaste M3-beschrijving: tonen, opzoeken, migreren.
// Run: node --import ./test/register-aliases.mjs --test src/diagramcore/model/beschrijving.test.js

import test from "node:test";
import assert from "node:assert/strict";

import { BESCHRIJVING, heeftBeschrijving, metBeschrijving, beschrijvingVan, migreerBeschrijving } from "./beschrijving.js";

test("de motor zet de beschrijving vooraan, behalve bij notities of een eigen beschrijving", () => {
  assert.deepEqual(metBeschrijving([{ key: "kleur" }], { shape: "class-box" }).map((p) => p.key), ["beschrijving", "kleur"]);
  assert.deepEqual(metBeschrijving([{ key: "tekst" }], { shape: "note" }).map((p) => p.key), ["tekst"]);
  assert.deepEqual(metBeschrijving([], { beschrijving: false }), []);
  // MIM: definitie is de beschrijving.
  const mim = [{ key: "definitie", betekenis: "beschrijving" }];
  assert.equal(metBeschrijving(mim, {}), mim);
  assert.equal(heeftBeschrijving(null), true, "velden zonder type hebben er ook een");
  assert.equal(BESCHRIJVING.datatype, "tekst");
});

test("beschrijvingVan vindt hem onder zijn eigen naam of via betekenis", () => {
  assert.equal(beschrijvingVan({ beschrijving: "Een persoon." }), "Een persoon.");
  assert.equal(beschrijvingVan({ definitie: "Mens" }, { properties: [{ key: "definitie", betekenis: "beschrijving" }] }), "Mens");
  assert.equal(beschrijvingVan({ definitie: "Mens" }), "");
  assert.equal(beschrijvingVan(null), "");
});

test("migratie: oude sleutels → beschrijving, op elementen en velden; notities en nieuwe waarden blijven", () => {
  const typen = { notitie: { shape: "note" }, klasse: { shape: "class-box" } };
  const uit = migreerBeschrijving(
    {
      a: { id: "a", elementType: "klasse", data: { toelichting: "uit use case" }, compartimenten: [{ velden: [{ naam: "x", data: { notes: "veld-notes" } }] }] },
      b: { id: "b", elementType: "klasse", data: { beschrijving: "nieuw", toelichting: "oud" } },
      n: { id: "n", elementType: "notitie", data: { tekst: "plakker", toelichting: "blijft" } },
      c: { id: "c", elementType: "klasse", data: { kleur: "#fff" } },
    },
    ["toelichting", "notes"],
    (t) => typen[t]
  );
  assert.deepEqual(uit.a.data, { beschrijving: "uit use case" });
  assert.deepEqual(uit.a.compartimenten[0].velden[0].data, { beschrijving: "veld-notes" });
  assert.deepEqual(uit.b.data, { beschrijving: "nieuw" }, "een bestaande beschrijving wint");
  assert.deepEqual(uit.n.data, { tekst: "plakker", toelichting: "blijft" }, "een notitie migreert niet");
  assert.equal(migreerBeschrijving({ c: { id: "c", data: { kleur: "#fff" } } }, ["toelichting"]), null, "niets te doen → null");
});
