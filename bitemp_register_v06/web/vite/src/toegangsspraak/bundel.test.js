/**
 * bundel.test.js — Toegangsspraak → beleidsbundel, tegen de gedeelde testdata in
 * testdata/toegang/ (ook gebruikt door de Go-PDP, toegang/pdp_test.go).
 *
 * De bundels in testdata/toegang/*.bundel.json zijn het contract tussen de PAP (deze compiler)
 * en de PDP (Go). Bijwerken na een bewuste wijziging:
 *   BIJWERKEN=1 node --import ./test/register-aliases.mjs --test src/toegangsspraak/bundel.test.js
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { parseBeleid } from "./parser.js";
import { maakVeldIndex, resolveerBeleid } from "./metamodel.js";
import { compileerBundel, BUNDEL_FORMAAT } from "./bundel.js";
import { naarOdrl } from "./odrl.js";
import { renderBeleid } from "./renderer.js";

const MAP = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../../../testdata/toegang");
const velden = JSON.parse(readFileSync(path.join(MAP, "np-loc-velden.json"), "utf8"));
const index = maakVeldIndex(velden);

function compileer(naam) {
  const p = parseBeleid(readFileSync(path.join(MAP, `${naam}.toegangsspraak`), "utf8"));
  assert.ok(p.ok, JSON.stringify(p.fouten));
  const r = resolveerBeleid(p.beleid, index);
  assert.deepEqual(r.fouten, [], "resolutiefouten");
  return { ...compileerBundel(r.beleid, { index }), beleid: r.beleid };
}

for (const naam of ["np-loc-demo", "openbaar", "open-tenzij", "toestemming-wint"]) {
  test(`bundel ${naam} = testdata/toegang/${naam}.bundel.json`, () => {
    const { bundel, meldingen } = compileer(naam);
    assert.deepEqual(meldingen, []);
    assert.equal(bundel.formaat, BUNDEL_FORMAAT);
    const bestand = path.join(MAP, `${naam}.bundel.json`);
    if (process.env.BIJWERKEN || !existsSync(bestand)) {
      writeFileSync(bestand, JSON.stringify(bundel, null, 2) + "\n");
    }
    assert.deepEqual(bundel, JSON.parse(readFileSync(bestand, "utf8")));
  });
}

test("betrokkene-paden worden volledig opgelost binnen de entiteit van de regel", () => {
  const { bundel } = compileer("np-loc-demo");
  const regel = bundel.regels.find((r) => r.id === "inzage-eigen-stadsdeel");
  assert.deepEqual(regel.voorwaarden.links, {
    anker: "betrokkene",
    pad: "NatuurlijkPersoon.woonlocatie.gebiedsligging.wijkaanduiding.wijk",
  });
});

test("Iedereen: subject null in de bundel, geen assignee in ODRL, round-trip in de renderer", () => {
  const { bundel, beleid } = compileer("openbaar");
  const open = bundel.regels.find((r) => r.id === "namen-openbaar");
  assert.equal(open.subject, null);
  assert.deepEqual(open.gegevens, [{ pad: "NatuurlijkPersoon.namen" }]);

  const odrl = naarOdrl(beleid);
  const perm = odrl.permission.find((p) => p["nlgov:regelnaam"] === "namen openbaar");
  assert.equal(perm.assignee, undefined);

  const tekst = renderBeleid(beleid);
  assert.match(tekst, /Iedereen mag alle gegevens van de namen van een natuurlijk persoon bekijken\./);
  const opnieuw = parseBeleid(tekst);
  assert.ok(opnieuw.ok, JSON.stringify(opnieuw.fouten));
  assert.equal(opnieuw.beleid.regels[0].wie.soort, "iedereen");
});

test("verbod en niet-gedefinieerd begrip", () => {
  const { bundel } = compileer("openbaar");
  const verbod = bundel.regels.find((r) => r.id === "bsn-niet-voor-medewerkers");
  assert.equal(verbod.effect, "verbieden");
  assert.deepEqual(verbod.gegevens, [{ pad: "NatuurlijkPersoon.persoonsidentificaties.bsn" }]);

  const p = parseBeleid('Beleid "x".\n  Regel "r".\n    Een kassier mag de achternaam van de namen van een natuurlijk persoon bekijken.\n');
  const { bundel: b, meldingen } = compileerBundel(resolveerBeleid(p.beleid, index).beleid, { index });
  assert.deepEqual(b.regels[0].subject, { kenmerken: [{ kenmerk: "rol", waarde: "kassier" }] });
  assert.equal(meldingen.length, 1);
});

test("superpolicy: Standaard en Bij conflict — bundel, ODRL en round-trip", () => {
  const { bundel, beleid } = compileer("open-tenzij");
  assert.equal(bundel.standaard, "toestaan");
  assert.equal(bundel.conflict, "eerste-geldt");
  const odrl = naarOdrl(beleid);
  assert.equal(odrl.conflict, "nlgov:eersteRegel");
  assert.equal(odrl["nlgov:standaard"], "toestaan");
  assert.equal(naarOdrl(compileer("toestemming-wint").beleid).conflict, "perm");
  assert.equal(naarOdrl(compileer("openbaar").beleid).conflict, "prohibit");

  const tekst = renderBeleid(beleid);
  assert.match(tekst, /Standaard: toestaan\./);
  assert.match(tekst, /Bij conflict: de eerste regel geldt\./);
  const opnieuw = parseBeleid(tekst);
  assert.ok(opnieuw.ok, JSON.stringify(opnieuw.fouten));
  assert.equal(opnieuw.beleid.conflict, "eerste-geldt");

  const fout = parseBeleid('Beleid "x".\n  Bij conflict: wie het eerst komt.\n');
  assert.equal(fout.ok, false);
  assert.match(fout.fouten[0].bericht, /Onbekende conflictregel/);
});
