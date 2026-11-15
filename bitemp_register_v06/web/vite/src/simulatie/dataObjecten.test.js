/**
 * Run: node --import ./test/register-aliases.mjs --test src/simulatie/dataObjecten.test.js
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { typeNamen, objectenBijDataObjecten } from "./dataObjecten.js";
import { toestandUit } from "./store.js";

const cm = {
  e_aanvraag: { id: "e_aanvraag", naam: "Aanvraag", elementType: "entiteit" },
  e_gpk: { id: "e_gpk", naam: "GehandicaptenparkeerkaartAanvraag", elementType: "entiteit" },
  e_gpk2: { id: "e_gpk2", naam: "GpkVerlenging", elementType: "entiteit" },
  e_zaak: { id: "e_zaak", naam: "Zaak", elementType: "entiteit" },
  g1: { id: "g1", elementType: "generalisatie", source: "e_gpk", target: "e_aanvraag" },
  g2: { id: "g2", elementType: "generalisatie", source: "e_gpk2", target: "e_gpk" },
};

test("typeNamen: het element en al zijn subtypen, ook over meer stappen", () => {
  assert.deepEqual([...typeNamen("e_aanvraag", cm)].sort(), ["aanvraag", "gehandicaptenparkeerkaartaanvraag", "gpkverlenging"]);
  assert.deepEqual([...typeNamen("e_zaak", cm)], ["zaak"]);
});

test("objectenBijDataObjecten: het object van het subtype hoort bij het data-object Aanvraag, met versie, wijziging en toets op de toestand", () => {
  const log = [
    { nr: 1, wat: "Start", wijzigingen: [{ soort: "maak", id: "a1", type: "GehandicaptenparkeerkaartAanvraag", data: { status: "ingediend" } }] },
    { nr: 2, wat: "Zaak aanmaken", wijzigingen: [{ soort: "maak", id: "z1", type: "Zaak", data: {} }, { soort: "maak", id: "pi", type: "Procesinstantie", data: {} }] },
    { nr: 3, wat: "Beoordelen", wijzigingen: [{ soort: "overgang", id: "a1", veld: "status", naar: "beoordeeld" }] },
  ];
  const bpmnElementen = {
    d1: { id: "d1", elementType: "data-object", naam: "Aanvraag", data: { type: { profielId: "diagram05", elementId: "e_aanvraag" }, toestand: "ingediend" } },
    d2: { id: "d2", elementType: "data-store", naam: "Zaken", data: { type: { profielId: "diagram05", elementId: "e_zaak" } } },
    d3: { id: "d3", elementType: "data-object", naam: "Zonder type", data: {} },
  };
  const elementenVan = (pid) => (pid === "diagram05" ? cm : null);
  const na = (n) => objectenBijDataObjecten({ bpmnElementen, elementenVan, toestand: toestandUit(log, n), log: log.slice(0, n) });

  const na1 = na(1);
  assert.deepEqual(Object.keys(na1).sort(), ["d1", "d2"], "alleen data-objecten met een type");
  assert.deepEqual(na1.d1.objecten, [{ id: "a1", type: "GehandicaptenparkeerkaartAanvraag", versie: 1, gewijzigd: true, toestand: "ingediend", klopt: true }]);
  assert.deepEqual(na1.d2.objecten, [], "nog geen zaak");

  const na3 = na(3);
  assert.deepEqual(na3.d1.objecten[0], { id: "a1", type: "GehandicaptenparkeerkaartAanvraag", versie: 2, gewijzigd: true, toestand: "beoordeeld", klopt: false });
  assert.deepEqual(na3.d2.objecten.map((o) => [o.id, o.gewijzigd, o.klopt]), [["z1", false, null]], "procesinstanties tellen niet; geen modeltoestand = niets te toetsen");
});
