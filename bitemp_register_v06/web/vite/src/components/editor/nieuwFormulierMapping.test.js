import { test } from "node:test";
import assert from "node:assert/strict";
import {
  bouwNieuwWijzigingen, verzamelVasteWaarden, vasteWaardenVanLijst, lijstenPerBron,
  rijPastBijLijst, bouwLijstItems, volPadVan,
} from "./nieuwFormulierMapping.js";

// Een uitgeklede Initiatief-meta zoals bouwCustomVeldMapping hem oplevert.
const product = { typenaam: "Initiatief_Product", veldnaam: "product", entiteitIDKolom: "initiatief_id" };
const productVelden = [{ naam: "naam", verplicht: true }, { naam: "omschrijving" }, { naam: "type", enum: ["Component", "Toepassing"] }];
const status = { typenaam: "Initiatief_Aanmeldstatus", veldnaam: "aanmeldstatus", entiteitIDKolom: "initiatief_id" };
const statusVelden = [{ naam: "status", verplicht: true }, { naam: "toelichting" }];
const bijdrage = { typenaam: "Initiatief_Bijdrage", veldnaam: "bijdrage", entiteitIDKolom: "initiatief_id" };
const bijdrageVelden = [{ naam: "type_bijdrage", verplicht: true }, { naam: "schaal" }, { naam: "toelichting" }];
const betrokken = { typenaam: "Initiatief_BetrokkenOrganisatie", veldnaam: "betrokkenorganisatie", entiteitIDKolom: "initiatief_id" };
const betrokkenVelden = [{ naam: "type", verplicht: true }];
const gemeente = { typenaam: "InitiatiefGemeente", veldnaam: "initiatiefgemeente", entiteitIDKolom: "initiatief_id" };
const gemeenteVelden = [{ naam: "gemeente_id", type: "integer" }, { naam: "rol" }];

const ge = (childMeta, bronVelden, rol, extra = {}) => ({ childMeta, bronVelden, entTypenaam: "Initiatief", rol, ...extra });
const veldNaarGE = {
  "Initiatief.producten.naam": ge(product, productVelden, "producten"),
  "Initiatief.producten.omschrijving": ge(product, productVelden, "producten"),
  "Initiatief.producten.type": ge(product, productVelden, "producten"),
  "Initiatief.aanmeldstatussen.status": ge(status, statusVelden, "aanmeldstatussen"),
  "Initiatief.bijdragen": ge(bijdrage, bijdrageVelden, "bijdragen", { isMeervoudig: true }),
  "Initiatief.betrokken_organisatie": ge(betrokken, betrokkenVelden, "betrokken_organisatie", { isMeervoudig: true }),
  "Initiatief.initiatief_gemeenten": ge(gemeente, gemeenteVelden, "initiatief_gemeenten", { isMeervoudig: true }),
};
const typeMeta = { typenaam: "Initiatief", veldnaam: "initiatief" };

const lijstBijdrage = (type) => ({
  type: "lijst", bron: "Initiatief.bijdragen", label: type, min: 1, max: 1,
  elementen: [
    { type: "veld", veld: "type_bijdrage", vasteWaarde: type },
    { type: "veld", veld: "schaal", widget: "radio" },
    { type: "veld", veld: "toelichting" },
  ],
});
const layout = {
  type: "formulier",
  elementen: [
    { type: "veld", veld: "Initiatief.producten.naam" },
    { type: "veld", veld: "Initiatief.producten.type", widget: "radio" },
    { type: "veld", veld: "Initiatief.aanmeldstatussen.status", vasteWaarde: "nieuwe_aanmelding" },
    { type: "veld", veld: "Initiatief.planningen.startdatum", kopieerNaar: "Initiatief.aanvang.datum" },
    { type: "groep", label: "Bijdragen", elementen: [lijstBijdrage("Wendbaarheid"), lijstBijdrage("Regie")] },
    { type: "lijst", bron: "Initiatief.betrokken_organisatie", widget: "meerkeuze", elementen: [{ type: "veld", veld: "type" }] },
    {
      type: "lijst", bron: "Initiatief.initiatief_gemeenten", label: "Realiserende gemeenten",
      elementen: [{ type: "veld", veld: "rol", vasteWaarde: "Realiseert" }, { type: "veld", veld: "gemeente_id" }],
    },
    {
      type: "lijst", bron: "Initiatief.initiatief_gemeenten", label: "Gebruikende gemeenten",
      elementen: [{ type: "veld", veld: "rol", vasteWaarde: "Maakt gebruik van" }, { type: "veld", veld: "gemeente_id" }],
    },
  ],
};

test("volPadVan: relatief binnen een lijst, anders het pad zelf", () => {
  assert.equal(volPadVan({ veld: "schaal" }, "Initiatief.bijdragen"), "Initiatief.bijdragen.schaal");
  assert.equal(volPadVan({ veld: "Initiatief.producten.naam" }, null), "Initiatief.producten.naam");
});

test("verzamelVasteWaarden: alleen buiten lijsten", () => {
  assert.deepEqual(verzamelVasteWaarden(layout), { "Initiatief.aanmeldstatussen.status": "nieuwe_aanmelding" });
});

test("lijstenPerBron en vasteWaardenVanLijst: twee lijsten op één bron met elk hun filter", () => {
  const per = lijstenPerBron(layout);
  assert.equal(per["Initiatief.bijdragen"].length, 2);
  assert.equal(per["Initiatief.initiatief_gemeenten"].length, 2);
  assert.deepEqual(vasteWaardenVanLijst(per["Initiatief.bijdragen"][1]), { type_bijdrage: "Regie" });
  assert.ok(rijPastBijLijst({ type_bijdrage: "Regie", schaal: "Schaal 2" }, { type_bijdrage: "Regie" }));
  assert.ok(!rijPastBijLijst({ type_bijdrage: "Wendbaarheid" }, { type_bijdrage: "Regie" }));
});

test("bouwLijstItems: rijen met alleen vaste waarden (of interne _velden) tellen niet mee", () => {
  const lijsten = lijstenPerBron(layout)["Initiatief.bijdragen"];
  assert.deepEqual(
    bouwLijstItems(lijsten, [{ type_bijdrage: "Wendbaarheid", schaal: "Schaal 3" }, { type_bijdrage: "Regie", _virtueel: true }]),
    [{ type_bijdrage: "Wendbaarheid", schaal: "Schaal 3" }],
  );
});

test("bouwNieuwWijzigingen: entiteit, aanvang, enkelvoudige GE's, vaste waarden en lijsten", () => {
  const values = {
    "Initiatief.producten.naam": "Bitemporeel register",
    "Initiatief.producten.type": "Component",
    "Initiatief.planningen.startdatum": "2026-01-01",
    "Initiatief.aanvang.datum": "2026-01-01", // door kopieerNaar gezet in de renderer
    "Initiatief.bijdragen": [{ type_bijdrage: "Wendbaarheid", schaal: "Schaal 4", toelichting: "MDA" }, { type_bijdrage: "Regie" }],
    "Initiatief.betrokken_organisatie": [{ type: "VNG" }, { type: "Gemeenten" }],
    "Initiatief.initiatief_gemeenten": [{ rol: "Realiseert", gemeente_id: "363" }, { rol: "Maakt gebruik van", gemeente_id: "599" }],
  };
  const { wijzigingen, ontbrekend } = bouwNieuwWijzigingen({
    layout, values, veldNaarGE, typeMeta, id: 144,
    coerce: (raw, veld) => (veld.type === "integer" ? Number(raw) : raw),
    materieel: { aanvangVeldnaam: "initiatief_aanvang", entiteitIDKolom: "initiatief_id" },
  });
  assert.deepEqual(ontbrekend, []);
  assert.deepEqual(wijzigingen[0], { opvoer: { initiatief: { id: 144 } } });
  assert.deepEqual(wijzigingen[1], { opvoer: { initiatief_aanvang: { initiatief_id: 144, datum: "2026-01-01" } } });
  const per = (k) => wijzigingen.filter((w) => w.opvoer[k]).map((w) => w.opvoer[k]);
  assert.deepEqual(per("product"), [{ initiatief_id: 144, naam: "Bitemporeel register", type: "Component" }]);
  assert.deepEqual(per("aanmeldstatus"), [{ initiatief_id: 144, status: "nieuwe_aanmelding" }]);
  assert.deepEqual(per("bijdrage"), [{ initiatief_id: 144, type_bijdrage: "Wendbaarheid", schaal: "Schaal 4", toelichting: "MDA" }]);
  assert.deepEqual(per("betrokkenorganisatie"), [{ initiatief_id: 144, type: "VNG" }, { initiatief_id: 144, type: "Gemeenten" }]);
  assert.deepEqual(per("initiatiefgemeente"), [
    { initiatief_id: 144, gemeente_id: 363, rol: "Realiseert" },
    { initiatief_id: 144, gemeente_id: 599, rol: "Maakt gebruik van" },
  ]);
  // planningen staat niet in veldNaarGE (bewust): geen opvoer, geen fout.
  assert.equal(per("planning").length, 0);
});

test("bouwNieuwWijzigingen: verplicht veld leeg in een deels ingevuld GE → ontbrekend", () => {
  const { wijzigingen, ontbrekend } = bouwNieuwWijzigingen({
    layout, values: { "Initiatief.producten.omschrijving": "alleen omschrijving" }, veldNaarGE, typeMeta, id: 1,
  });
  assert.deepEqual(ontbrekend, ["Initiatief.producten.naam"]);
  assert.equal(wijzigingen.filter((w) => w.opvoer.product).length, 1);
});

test("bouwNieuwWijzigingen: een GE zonder enige waarde wordt niet opgevoerd", () => {
  const { wijzigingen } = bouwNieuwWijzigingen({ layout: { type: "formulier", elementen: [] }, values: {}, veldNaarGE, typeMeta, id: 1 });
  assert.equal(wijzigingen.length, 1);
});
