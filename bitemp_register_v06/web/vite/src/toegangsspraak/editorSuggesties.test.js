import test from "node:test";
import assert from "node:assert/strict";

import { bepaalSuggesties } from "./editorSuggesties.js";
import { maakVeldIndex } from "./metamodel.js";
import { parseBeleid } from "./parser.js";

const INDEX = maakVeldIndex([
  { veldpad: "NatuurlijkPersoon.naam.achternaam", type: "string" },
  { veldpad: "NatuurlijkPersoon.naam.voorletters", type: "string" },
  { veldpad: "NatuurlijkPersoon.inkomen.bedrag", type: "number" },
]);

test("vooruit: een al getypt lidwoord wordt meevervangen (geen dubbele 'de')", () => {
  const tekst = 'Beleid "T".\n\n  Regel "r".\n    Een beheerder mag de achterna';
  const suggesties = bepaalSuggesties({ tekst, caret: tekst.length, veldIndex: INDEX });
  assert.ok(suggesties.length >= 1);
  const s = suggesties[0];
  assert.equal(s.kort, "de achternaam van een natuurlijk persoon");
  // Vervangt "de achterna" (inclusief het lidwoord), niet alleen "achterna".
  assert.equal(s.vervang, "de achterna".length);
  const nieuw = tekst.slice(0, tekst.length - s.vervang) + s.kort;
  assert.match(nieuw, /mag de achternaam van een natuurlijk persoon$/);
  assert.doesNotMatch(nieuw, /de de/);
});

test("vooruit zonder lidwoord: alleen het woord wordt vervangen", () => {
  const tekst = "    Een beheerder mag mail bek";
  const suggesties = bepaalSuggesties({ tekst, caret: tekst.length, veldIndex: null, begrippen: [] });
  const bekijken = suggesties.find((s) => s.kort === "bekijken");
  assert.ok(bekijken);
  assert.equal(bekijken.vervang, "bek".length);
});

test("binnen een gegevens-keten: suggesties vervangen de hele span (bereik)", () => {
  const tekst = `Beleid "T".

  Regel "r".
    Een beheerder mag de achternaam van de naam van een natuurlijk persoon bekijken.
`;
  const { ok, spans } = parseBeleid(tekst);
  assert.ok(ok);
  const span = spans.find((s) => s.soort === "gegevens" && s.verwijzing);
  // Caret midden in de keten (op "naam").
  const caret = span.van + Math.floor((span.tot - span.van) / 2);
  const suggesties = bepaalSuggesties({ tekst, caret, spans, veldIndex: INDEX });
  assert.ok(suggesties.length >= 1);
  for (const s of suggesties) {
    assert.deepEqual(s.bereik, { van: span.van, tot: span.tot });
    assert.equal(s.vervang, undefined);
  }
  // Toepassen vervangt de keten netjes in zijn geheel.
  const s = suggesties[0];
  const nieuw = tekst.slice(0, s.bereik.van) + s.kort + tekst.slice(s.bereik.tot);
  assert.ok(parseBeleid(nieuw).ok);
});

test("binnen een keten zonder metamodel: geen suggesties (nooit er middenin invoegen)", () => {
  const tekst = `Beleid "T".

  Regel "r".
    Een beheerder mag de achternaam van de naam van een natuurlijk persoon bekijken.
`;
  const { spans } = parseBeleid(tekst);
  const span = spans.find((s) => s.soort === "gegevens" && s.verwijzing);
  const caret = span.van + 5;
  assert.deepEqual(bepaalSuggesties({ tekst, caret, spans, veldIndex: null }), []);
});
