import { test } from "node:test";
import assert from "node:assert/strict";
import { pasMaskerToe, maskerWaarde, maskerPlaceholder } from "./masker.js";
import { leesDatumIncompleet, schrijfDatumIncompleet, datumIncompleetTekst, dagenInMaand } from "./datumIncompleet.js";
import { leesDuur, schrijfDuur, duurTekstNL } from "./duur.js";
import { VORMEN, vormPastBij, INVOERSOORT, valideerVormConfig, vormUitDatatype } from "./vormen.js";

test("masker: postcode — letterlijke spatie ingevoegd, letters hoofdletter, opslag zonder spatie", () => {
  assert.deepEqual(pasMaskerToe("1234ab", "0000 AA"), { weergave: "1234 AB", ruw: "1234AB", compleet: true });
  assert.equal(pasMaskerToe("1234", "0000 AA").weergave, "1234"); // geen spatie vóór er iets volgt
  assert.equal(pasMaskerToe("12x34 a", "0000 AA").weergave, "1234 A"); // x overgeslagen, eigen spatie gebruikt
  assert.equal(maskerWaarde("1234 ab", "0000 AA"), "1234AB");
  assert.equal(maskerWaarde("1234 ab", "0000 AA", true), "1234 AB");
  assert.equal(maskerPlaceholder("0000 AA"), "____ __");
});

test("masker: IBAN, BSN, te lang, escape", () => {
  assert.equal(pasMaskerToe("nl91abna0417164300", "AA00 AAAA 0000 0000 00").weergave, "NL91 ABNA 0417 1643 00");
  assert.equal(pasMaskerToe("1234567890", "000000000").ruw, "123456789");
  assert.equal(pasMaskerToe("12345", "000000000").compleet, false);
  assert.equal(pasMaskerToe("5", "\\00").weergave, "05");
});

test("partial-date: lezen en schrijven in beide stijlen", () => {
  assert.deepEqual(leesDatumIncompleet("1975-06-00"), { jaar: "1975", maand: "06", dag: "" });
  assert.deepEqual(leesDatumIncompleet("1975"), { jaar: "1975", maand: "", dag: "" });
  assert.deepEqual(leesDatumIncompleet("1975-00-15"), { jaar: "1975", maand: "", dag: "" }); // dag zonder maand bestaat niet
  assert.equal(schrijfDatumIncompleet({ jaar: "1975", maand: "6" }), "1975-06");
  assert.equal(schrijfDatumIncompleet({ jaar: "1975", maand: "6" }, "nullen"), "1975-06-00");
  assert.equal(schrijfDatumIncompleet({ jaar: "1975" }, "nullen"), "1975-00-00");
  assert.equal(schrijfDatumIncompleet({ jaar: "1975", dag: "15" }), "1975"); // dag zonder maand vervalt
  assert.equal(schrijfDatumIncompleet({ jaar: "2023", maand: "02", dag: "31" }), "2023-02-28"); // afgekapt
  assert.equal(schrijfDatumIncompleet({ jaar: "75" }), "");
  assert.equal(dagenInMaand("2024", "02"), 29);
});

test("partial-date: leesbaar", () => {
  assert.equal(datumIncompleetTekst("1975-06-15"), "15 juni 1975");
  assert.equal(datumIncompleetTekst("1975-06-00"), "juni 1975");
  assert.equal(datumIncompleetTekst("1975-00-00"), "1975");
  assert.equal(datumIncompleetTekst(""), "");
});

test("duration: ISO 8601 heen en terug", () => {
  assert.deepEqual(leesDuur("P1Y2M3DT4H5M6S"), { jaren: 1, maanden: 2, dagen: 3, uren: 4, minuten: 5, seconden: 6 });
  assert.deepEqual(leesDuur("PT30M"), { minuten: 30 });
  assert.deepEqual(leesDuur("P2W"), { weken: 2 });
  assert.equal(leesDuur("P"), null);
  assert.equal(leesDuur("PT"), null);
  assert.equal(leesDuur("1 jaar"), null);
  assert.deepEqual(leesDuur(""), {});
  assert.equal(schrijfDuur({ jaren: 1, minuten: 30 }), "P1YT30M");
  assert.equal(schrijfDuur({ maanden: 0, dagen: "" }), "");
  assert.equal(schrijfDuur(leesDuur("P1DT2H")), "P1DT2H");
});

test("duration: leesbaar", () => {
  assert.equal(duurTekstNL("P1Y2MT30M"), "1 jaar, 2 maanden en 30 minuten");
  assert.equal(duurTekstNL("P1D"), "1 dag");
  assert.equal(duurTekstNL("PT1H"), "1 uur");
  assert.equal(duurTekstNL("onzin"), "onzin");
});

test("register: de vier nieuwe vormen, met passende invoersoort en geldige voorbeeldconfig", () => {
  for (const n of ["masked", "partial-date", "duration", "number-stepper"]) assert.ok(VORMEN[n], n);
  assert.ok(vormPastBij("masked", INVOERSOORT.TEKST));
  assert.ok(vormPastBij("partial-date", INVOERSOORT.TEKST));
  assert.ok(vormPastBij("duration", INVOERSOORT.TEKST));
  assert.ok(vormPastBij("number-stepper", INVOERSOORT.GETAL));
  assert.ok(!vormPastBij("number-stepper", INVOERSOORT.TEKST));
  assert.deepEqual(valideerVormConfig("masked", { mask: "0000 AA", keepLiterals: true }), []);
  assert.deepEqual(valideerVormConfig("partial-date", { unknownStyle: "nullen", minYear: 1900 }), []);
  assert.deepEqual(valideerVormConfig("duration", { units: ["jaren", "maanden"] }), []);
  assert.notDeepEqual(valideerVormConfig("duration", { units: ["eeuwen"] }), []);
  assert.deepEqual(valideerVormConfig("number-stepper", { min: 0, max: 10, step: 1, unit: "personen" }), []);
});

test("vorm uit het datatype: DatumIncompleet en Duur krijgen hun vorm vanzelf; een masker niet", () => {
  assert.equal(vormUitDatatype({ naam: "DatumIncompleet", format: "date-incomplete" }), "partial-date");
  assert.equal(vormUitDatatype({ naam: "Duur", format: "duration" }), "duration");
  assert.equal(vormUitDatatype({ naam: "NLPostcode", weergave: { inputMask: "0000 AA" } }), null);
  assert.equal(vormUitDatatype({ naam: "X", weergave: { widget: "color" } }), "color");
  assert.equal(vormUitDatatype(null), null);
});

test("color, tag-input, code en markdown: register en config", async () => {
  const { naarNativeKleur } = await import("./kleur.js");
  assert.equal(naarNativeKleur("#abc"), "#aabbcc");
  assert.equal(naarNativeKleur("#11223344"), "#112233");
  assert.equal(naarNativeKleur("rood"), null);
  assert.ok(vormPastBij("color", INVOERSOORT.TEKST));
  assert.ok(vormPastBij("tag-input", INVOERSOORT.MEER_UIT_LIJST));
  assert.ok(vormPastBij("tag-input", INVOERSOORT.TEKST));
  assert.ok(vormPastBij("code", INVOERSOORT.TEKST));
  assert.deepEqual(valideerVormConfig("color", { swatches: ["#60a5fa", "#6366f1", "#22d3ee"] }), []);
  assert.notDeepEqual(valideerVormConfig("color", { swatches: ["blauw"] }), []);
  assert.deepEqual(valideerVormConfig("tag-input", { max: 5, separator: ";" }), []);
  assert.deepEqual(valideerVormConfig("code", { language: "yaml" }), []);
  assert.notDeepEqual(valideerVormConfig("code", { language: "cobol" }), []);
  assert.deepEqual(valideerVormConfig("markdown", { preview: "naast" }), []);
  assert.equal(vormUitDatatype({ naam: "Kleur", weergave: { widget: "color" } }), "color");
});

test("ranking bewaart de volgorde in één veld; colour is een alias van color", async () => {
  const { voegLijstSamen, normaliseerVorm } = await import("./vormen.js");
  assert.ok(vormPastBij("ranking", INVOERSOORT.MEER_UIT_LIJST));
  assert.equal(voegLijstSamen(["Regie", "Wendbaarheid"], ";", []), "Regie;Wendbaarheid"); // rangorde: volgorde blijft
  assert.equal(voegLijstSamen(["Regie", "Wendbaarheid"], ";", ["Wendbaarheid", "Regie"]), "Wendbaarheid;Regie"); // gewoon: enumvolgorde
  assert.equal(normaliseerVorm("colour"), "color");
  assert.ok(vormPastBij("colour", INVOERSOORT.TEKST));
  assert.deepEqual(valideerVormConfig("ranking", { max: 3 }), []);
});
