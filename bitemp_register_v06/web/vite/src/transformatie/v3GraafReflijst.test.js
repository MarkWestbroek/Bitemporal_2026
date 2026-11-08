// De referentielijst als veldtype (studio 0.34.0): een `$ref` naar de
// items-relatie, ingebed als {code, omschrijving}; en `verplicht` uit goType
// als de V3.1-sleutel ontbreekt (V3 uit een opgeslagen Studio-project, 08-11).
import test from "node:test";
import assert from "node:assert/strict";
import { v3Graaf } from "./v3Graaf.js";
import { formulierGraaf } from "./formulierGraaf.js";

const model = {
  entiteiten: [
    {
      typenaam: "Aanvraag",
      gegevenselementen: [
        { naam: "AanvraagIdentificatie", momentvoorkomen: "enkelvoudig", velden: [{ naam: "aanvraagnummer", goType: "string", uniek: "entiteit" }, { naam: "kenmerk", goType: "*string" }] },
        { naam: "Aanvraagtype", momentvoorkomen: "enkelvoudig", velden: [{ naam: "type", goType: "int", type: "integer", verplicht: true, $ref: "Aanvraagtype" }] },
      ],
    },
    {
      typenaam: "AanvraagtypeDefinitie",
      entiteitSubtype: "referentielijst_item",
      gegevenselementen: [{ naam: "AanvraagtypeGegevens", momentvoorkomen: "enkelvoudig", velden: [{ naam: "code", goType: "string", uniek: "entiteit" }, { naam: "omschrijving", goType: "string" }] }],
      relaties: [{ naam: "Aanvraagtype", doelEntiteit: "Referentielijst", relatieSubtype: "referentielijst_items", momentvoorkomen: "meervoudig" }],
    },
    { typenaam: "Referentielijst", entiteitSubtype: "referentielijst", gegevenselementen: [] },
  ],
};
const P = "Aanvraag.Aanvraagtype.type";
const CODE = `${P}.AanvraagtypeDefinitie.AanvraagtypeGegevens.code`;
const OMS = `${P}.AanvraagtypeDefinitie.AanvraagtypeGegevens.omschrijving`;

test("verplicht: V3.1-sleutel wint, anders goType zonder * = verplicht", () => {
  const g = v3Graaf({ model, keuzes: { bron: "Aanvraag", velden: [] } });
  const v = (pad) => g.knopen.find((k) => k.id === pad).eigenschappen.verplicht;
  assert.equal(v("Aanvraag.AanvraagIdentificatie.aanvraagnummer"), true);
  assert.equal(v("Aanvraag.AanvraagIdentificatie.kenmerk"), false);
});

test("$ref naar de items-relatie: als code wijst hij naar het item", () => {
  const g = v3Graaf({ model, keuzes: { bron: "Aanvraag", velden: [P], projectie: { referentielijsten: { Aanvraagtype: { als: "code" } } } } });
  const k = g.knopen.find((x) => x.id === P);
  assert.equal(k.eigenschappen.refNaar, "AanvraagtypeDefinitie");
  assert.equal(k.eigenschappen.refAls, "code");
  assert.deepEqual(g.waarschuwingen, []);
});

test("$ref ingebed: een object met de gekozen velden van het item, onder de naam uit de projectie", () => {
  const g = v3Graaf({ model, keuzes: { bron: "Aanvraag", velden: [CODE, OMS], projectie: { referentielijsten: { Aanvraagtype: { als: "ingebed", naam: "aanvraagtype" } } } } });
  const rel = g.groepen.find((x) => x.id === P);
  assert.equal(rel.aard, "relatie-ingebed");
  assert.equal(rel.tekst, "aanvraagtype");
  assert.equal(rel.eigenschappen.verplicht, true);
  assert.equal(g.groepen.find((x) => x.id === `${P}.AanvraagtypeDefinitie`).aard, "doel");
  assert.ok(g.knopen.find((x) => x.id === CODE).eigenschappen.referentielijst);
  assert.deepEqual(g.waarschuwingen, []);
  // Velden onder het veld kiezen is ook inbedden (zo leest het formulier).
  const zonder = v3Graaf({ model, keuzes: { bron: "Aanvraag", velden: [CODE] } });
  assert.equal(zonder.groepen.find((x) => x.id === P)?.aard, "relatie-ingebed");
});

test("formulier: de code achter de items-relatie is een keuzelijst met de items van de lijst", () => {
  const keuzes = { identifier: "f", bron: "Aanvraag", stappen: [{ slug: "s", naam: "S", velden: [{ veld: CODE, key: "aanvraagtype" }] }] };
  const items = [{ code: "gpk", omschrijving: "Gehandicaptenparkeerkaart" }];
  const g = formulierGraaf({ model, keuzes, referentielijsten: { Aanvraagtype: items } });
  const k = g.knopen.find((x) => x.id === CODE);
  assert.equal(k.refAls, "code");
  assert.deepEqual(k.eigenschappen.waarden, [{ label: "Gehandicaptenparkeerkaart", value: "gpk" }]);
  assert.deepEqual(g.waarschuwingen, []);
});
