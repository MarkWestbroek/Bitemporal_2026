import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { celPast, rekenTabelUit, rekenBeslissingUit, vindBeslissing, Onleesbaar } from "./beslistabel.js";

const CG = new URL("../diagramprofielen/canoniek-uml/fixtures/cg-test/", import.meta.url);
const lees = (naam) => JSON.parse(fs.readFileSync(new URL(naam, CG), "utf8"));

test("celPast: leeg, waarde, lijst, vergelijking, not", () => {
  assert.equal(celPast("", "x"), true);
  assert.equal(celPast("-", null), true);
  assert.equal(celPast('"bestuurder"', "bestuurder"), true);
  assert.equal(celPast('"bestuurder"', "passagier"), false);
  assert.equal(celPast('null, ""', null), true);
  assert.equal(celPast('null, ""', undefined), true);
  assert.equal(celPast('null, ""', ""), true);
  assert.equal(celPast('null, ""', "123"), false);
  assert.equal(celPast("true", true), true);
  assert.equal(celPast("false", true), false);
  assert.equal(celPast("> 5", 6), true);
  assert.equal(celPast("<= 5", 6), false);
  assert.equal(celPast("> 5", null), false);
  assert.equal(celPast('"a, b", "c"', "a, b"), true);
  assert.equal(celPast('not("a", "b")', "c"), true);
  assert.equal(celPast('not("a", "b")', "a"), false);
  assert.throws(() => celPast("[1..5]", 3), Onleesbaar);
});

const gpk = () => {
  const edienst = lees("gpk-edienst.json");
  return vindBeslissing([lees("gpk-beslissingen.dmn-model.json")], "aanvraag-ontvankelijk", edienst);
};

test("vindBeslissing: op de identifier van het dmn-artefact, of zonder e-dienst op de naam", () => {
  assert.equal(gpk().beslissing.naam, "Aanvraag ontvankelijk");
  assert.equal(vindBeslissing([lees("gpk-beslissingen.dmn-model.json")], "aanvraag-ontvankelijk").beslissing.naam, "Aanvraag ontvankelijk");
  assert.equal(vindBeslissing([lees("gpk-beslissingen.dmn-model.json")], "bestaat-niet"), null);
});

test("GPK-tabel aanvraag-ontvankelijk: de vijf regels (cg-stack-voor-simulatie §4)", () => {
  const pasfoto = [{ naam: "pasfoto" }];
  const reken = (object, bsn = "999990019") => {
    const uit = rekenBeslissingUit(gpk(), { object, variabelen: { bsn } });
    return [uit.regel, uit.uitkomst.ontvankelijk, uit.uitkomst.reden];
  };
  assert.deepEqual(reken({ bijlagen: pasfoto, soort: "passagier" }, null), ["r_bsn", false, "Aanvrager niet geïdentificeerd"]);
  assert.deepEqual(reken({ bijlagen: pasfoto, soort: "passagier" }, ""), ["r_bsn", false, "Aanvrager niet geïdentificeerd"]);
  assert.deepEqual(reken({ bijlagen: [], soort: "passagier" }), ["r_pasfoto", false, "Geen pasfoto bijgevoegd"]);
  assert.deepEqual(reken({ bijlagen: null, soort: "passagier" }), ["r_pasfoto", false, "Geen pasfoto bijgevoegd"]);
  assert.deepEqual(reken({ bijlagen: pasfoto, soort: "passagier", eerdereKaart: true }), ["r_kaartnummer", false, "Eerdere kaart zonder kaartnummer"]);
  assert.deepEqual(reken({ bijlagen: pasfoto, soort: "bestuurder" }), ["r_rijbewijs", false, "Bestuurderskaart zonder rijbewijsnummer"]);
  assert.deepEqual(reken({ bijlagen: pasfoto, soort: "bestuurder", rijbewijsnummer: "1234567890" }), ["r_ok", true, ""]);
  assert.deepEqual(reken({ bijlagen: pasfoto, soort: "passagier", eerdereKaart: true, eerderKaartnummer: "K-1" }), ["r_ok", true, ""]);
});

test("GPK-tabel: de invoer in het spoor draagt de labels van de kolommen", () => {
  const uit = rekenBeslissingUit(gpk(), { object: { bijlagen: [{ naam: "pasfoto" }], soort: "passagier" }, variabelen: { bsn: "999990019" } });
  assert.equal(uit.invoer["BSN aanvrager"], "999990019");
  assert.equal(uit.invoer["Pasfoto bijgevoegd"], true);
  assert.equal(uit.invoer["Soort kaart"], "passagier");
});

test("een invoerexpressie met een variabele die er niet is, is onleesbaar", () => {
  assert.throws(() => rekenBeslissingUit(gpk(), { object: { soort: "passagier" }, variabelen: { bsn: "999990019" } }), /bijlagen/);
});

const tabel = (hitPolicy, rules) => ({
  hitPolicy,
  inputs: [{ id: "i", naam: "leeftijd", type: "number" }],
  outputs: [{ id: "o", naam: "groep", type: "string" }],
  rules: rules.map(([cel, uit], n) => ({ id: `r${n + 1}`, inputEntries: { i: cel }, outputEntries: { o: uit } })),
});

test("hit policy: FIRST neemt de eerste, UNIQUE eist er precies één", () => {
  const regels = [["< 18", '"kind"'], ["< 65", '"volwassene"'], ["", '"senior"']];
  assert.equal(rekenTabelUit(tabel("FIRST", regels), { object: { leeftijd: 10 } }).uitkomst.groep, "kind");
  assert.equal(rekenTabelUit(tabel("FIRST", regels), { object: { leeftijd: 70 } }).uitkomst.groep, "senior");
  assert.throws(() => rekenTabelUit(tabel("UNIQUE", regels), { object: { leeftijd: 10 } }), /UNIQUE/);
  const uniek = [["< 18", '"kind"'], [">= 18", '"volwassene"']];
  assert.equal(rekenTabelUit(tabel("UNIQUE", uniek), { object: { leeftijd: 18 } }).uitkomst.groep, "volwassene");
  assert.equal(rekenTabelUit(tabel("UNIQUE", uniek), { object: {} }).uitkomst, null);
  assert.throws(() => rekenTabelUit(tabel("COLLECT", uniek), { object: {} }), Onleesbaar);
});

test("DRD als boom: een beslissing krijgt de uitvoer van de beslissing eronder", () => {
  const model = {
    elements: {
      groep: { id: "groep", naam: "Groep", elementType: "decision", data: { beslistabel: tabel("FIRST", [["< 18", '"kind"'], ["", '"volwassene"']]) } },
      tarief: {
        id: "tarief",
        naam: "Tarief",
        elementType: "decision",
        data: {
          beslistabel: {
            hitPolicy: "UNIQUE",
            inputs: [{ id: "g", naam: "groep" }],
            outputs: [{ id: "t", naam: "tarief", type: "number" }, { id: "k", naam: "korting", type: "boolean" }],
            rules: [
              { id: "a", inputEntries: { g: '"kind"' }, outputEntries: { t: "5", k: "true" } },
              { id: "b", inputEntries: { g: '"volwassene"' }, outputEntries: { t: "10", k: "leeftijd >= 65" } },
            ],
          },
        },
      },
      eis: { id: "eis", elementType: "infoReq", source: "groep", target: "tarief", data: {} },
    },
  };
  const reken = (leeftijd) => rekenBeslissingUit({ model, beslissing: model.elements.tarief }, { object: { leeftijd } });
  assert.deepEqual(reken(10).uitkomst, { tarief: 5, korting: true });
  assert.deepEqual(reken(70).uitkomst, { tarief: 10, korting: true });
  assert.deepEqual(reken(30).uitkomst, { tarief: 10, korting: false });
  assert.equal(reken(30).onderliggend[0].uitkomst.groep, "volwassene");
});
