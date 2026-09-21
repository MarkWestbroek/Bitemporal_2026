// toegangDemoModel.test.js — regressietest voor de FTV-demo (15 september 2026).
//
// Acceptatiecriterium uit `docs/plans/2026-09-10 Opdracht demo-model
// np-loc-org-geo en OAS-naar-canoniek.md`: de beleidstekst uit het draaiboek
// (inclusief de bonus-regel over de optionele Aanspraak) moet in de
// toegang-activity parseren **zonder controle-meldingen** — alle ketens
// resolven eenduidig tegen het model, de enum- en typebewaking klaagt niet.
//
// De test doet dat zonder UI: hij bouwt dezelfde veldenlijst als de activity
// (`verzamelVelden` met `relatieDiepte: 2`) en haalt die door
// `maakVeldIndex`/`resolveerBeleid` uit toegangsspraak/metamodel.js.
//
// De `types`-fixture hieronder spiegelt het demo-model zoals de schema-API het
// levert (/api/schema/model/code → "types"), beperkt tot de types die de
// beleidstekst raakt. De Go-kant bewaakt dat dit blijft kloppen:
// model/demo_model_test.go controleert dezelfde rollen en velden in de
// MetaRegistry. Wijkt het model af, dan valt één van beide tests om.
//
// Run met: npm test   (vanuit web/vite/)

import test from "node:test";
import assert from "node:assert/strict";

import { verzamelVelden } from "../../modelpicker/veldenlijst.js";
import { parseBeleid } from "../../toegangsspraak/parser.js";
import { maakVeldIndex, resolveerBeleid, resolveerVerwijzing } from "../../toegangsspraak/metamodel.js";
import { padNaarVerwijzing } from "../../toegangsspraak/parser.js";
import { naarOdrl } from "../../toegangsspraak/odrl.js";

// Zelfde doorkijk-diepte als toegangActivity.jsx.
const RELATIE_DIEPTE = 2;

// Plumbing-velden (natuurlijkpersoon_id, rel_id, versie) laat de fixture weg;
// bouwModelTree filtert die toch als technische velden.
const TYPES = [
  {
    typenaam: "NatuurlijkPersoon",
    metatype: "entiteit",
    domein: "np-loc",
    isMaterieel: true,
    velden: [],
    onderliggende: [
      { rolnaam: "Namen", jsonRolnaam: "namen", doeltype: "NatuurlijkPersoon_Naam", momentvoorkomen: "enkelvoudig" },
      { rolnaam: "Geslacht", jsonRolnaam: "geslacht", doeltype: "NatuurlijkPersoon_Geslacht", momentvoorkomen: "enkelvoudig" },
      { rolnaam: "Aanspraak", jsonRolnaam: "aanspraak", doeltype: "NatuurlijkPersoon_Aanspraak", momentvoorkomen: "enkelvoudig" },
      { rolnaam: "Woonlocatie", jsonRolnaam: "woonlocatie", doeltype: "Woonlocatie", momentvoorkomen: "enkelvoudig" },
    ],
  },
  {
    typenaam: "NatuurlijkPersoon_Naam",
    metatype: "gegevenselement",
    domein: "np-loc",
    velden: [
      { naam: "voorletters", type: "string", verplicht: true },
      { naam: "achternaam", type: "string", verplicht: true },
    ],
  },
  {
    typenaam: "NatuurlijkPersoon_Geslacht",
    metatype: "gegevenselement",
    domein: "np-loc",
    velden: [{ naam: "geslacht", type: "string", verplicht: true, enum: ["man", "vrouw", "X"] }],
  },
  {
    typenaam: "NatuurlijkPersoon_Aanspraak",
    metatype: "gegevenselement",
    domein: "np-loc",
    // Beide velden optioneel — dat is de pointe van de bonus-regel.
    velden: [
      { naam: "aanspreektitel", type: "string", enum: ["meneer", "mevrouw", "hen"] },
      { naam: "formeelAanspreken", type: "boolean" },
    ],
  },
  { typenaam: "Woonlocatie", metatype: "relatie", domein: "np-loc", isMaterieel: true, doelEntiteit: "Locatie", velden: [] },
  {
    typenaam: "Locatie",
    metatype: "entiteit",
    domein: "np-loc",
    isMaterieel: true,
    velden: [],
    onderliggende: [
      { rolnaam: "Adressen", jsonRolnaam: "adressen", doeltype: "Locatie_Adres", momentvoorkomen: "meervoudig" },
      { rolnaam: "Gebiedsligging", jsonRolnaam: "gebiedsligging", doeltype: "Gebiedsligging", momentvoorkomen: "enkelvoudig" },
    ],
  },
  {
    typenaam: "Locatie_Adres",
    metatype: "gegevenselement",
    domein: "np-loc",
    velden: [
      { naam: "straatnaam", type: "string", verplicht: true },
      { naam: "huisnummer", type: "string", verplicht: true },
    ],
  },
  { typenaam: "Gebiedsligging", metatype: "relatie", domein: "np-loc", isMaterieel: true, doelEntiteit: "Gemeentedeel", velden: [] },
  {
    typenaam: "Gemeentedeel",
    metatype: "entiteit",
    domein: "org-geo",
    isMaterieel: true,
    velden: [],
    onderliggende: [
      { rolnaam: "Wijkaanduiding", jsonRolnaam: "wijkaanduiding", doeltype: "Gemeentedeel_Wijkaanduiding", momentvoorkomen: "enkelvoudig" },
    ],
  },
  {
    typenaam: "Gemeentedeel_Wijkaanduiding",
    metatype: "gegevenselement",
    domein: "org-geo",
    velden: [
      { naam: "wijk", type: "string", verplicht: true },
      { naam: "soort", type: "string", verplicht: true, enum: ["Stadsdeel", "Wijk", "Buurt"] },
    ],
  },
  {
    typenaam: "Medewerker",
    metatype: "entiteit",
    domein: "org-geo",
    isMaterieel: true,
    velden: [],
    onderliggende: [
      { rolnaam: "Aanstelling", jsonRolnaam: "aanstelling", doeltype: "Medewerker_Aanstelling", momentvoorkomen: "enkelvoudig" },
      { rolnaam: "Kanalen", jsonRolnaam: "kanalen", doeltype: "Medewerker_Contactkanaal", momentvoorkomen: "meervoudig" },
      { rolnaam: "Afdeling", jsonRolnaam: "afdeling", doeltype: "Medewerkerafdeling", momentvoorkomen: "enkelvoudig" },
    ],
  },
  {
    typenaam: "Medewerker_Aanstelling",
    metatype: "gegevenselement",
    domein: "org-geo",
    velden: [
      { naam: "functie", type: "string", verplicht: true },
      { naam: "rol", type: "string", verplicht: true, enum: ["medewerker", "behandelaar", "leidinggevende"] },
    ],
  },
  {
    typenaam: "Medewerker_Contactkanaal",
    metatype: "gegevenselement",
    domein: "org-geo",
    velden: [{ naam: "kanaal", type: "string", verplicht: true, enum: ["balie", "telefoon", "email", "post"] }],
  },
  { typenaam: "Medewerkerafdeling", metatype: "relatie", domein: "org-geo", isMaterieel: true, doelEntiteit: "Afdeling", velden: [] },
  {
    typenaam: "Afdeling",
    metatype: "entiteit",
    domein: "org-geo",
    isMaterieel: true,
    velden: [],
    onderliggende: [
      { rolnaam: "Afdelingsnaam", jsonRolnaam: "afdelingsnaam", doeltype: "Afdeling_Afdelingsnaam", momentvoorkomen: "enkelvoudig" },
    ],
  },
  {
    typenaam: "Afdeling_Afdelingsnaam",
    metatype: "gegevenselement",
    domein: "org-geo",
    velden: [{ naam: "naam", type: "string", verplicht: true }],
  },
];

const INDEX = maakVeldIndex(verzamelVelden(TYPES, { relatieDiepte: RELATIE_DIEPTE }));

// De beleidstekst uit `docs/plans/2026-09-15 FTV-demo Toegangsspraak —
// draaiboek.md`, inclusief de bonus-regel. Wijzigt het draaiboek, wijzig dit mee.
const DEMO_BELEID = `Beleid "Persoonsgegevens np-loc demo".
  Geldig vanaf 15 september 2026.
  Grondslag: de Gemeentewet.
  Doel: "dienstverlening".

  Begrippen.
    Een medewerker is: iemand met rol "medewerker".
    Een medewerker West is: iemand met rol "medewerker" en afdeling "West".
    Een telefoonmedewerker is: iemand met rol "medewerker" en kanaal "telefoon".
    De persoonsgegevens zijn: alle gegevens van een natuurlijk persoon.

  Regel "inzage eigen stadsdeel".
    Een medewerker West mag de persoonsgegevens bekijken
    als de wijk van de woonlocatie van de betrokkene "Stadsdeel West" is.

  Regel "avonddienst gemeentebreed".
    Een medewerker mag de persoonsgegevens bekijken
    als de dienst van de aanvrager "avond" is.

  Regel "geen geslacht aan de telefoon".
    Een telefoonmedewerker mag het geslacht van een natuurlijk persoon niet bekijken.

  Regel "aanspreken zonder geslacht".
    Een telefoonmedewerker mag de aanspreektitel van de aanspraak van een natuurlijk persoon bekijken
    als de aanspreektitel van de aanspraak van de betrokkene bekend is.
`;

test("demo-beleid parseert en resolvet zonder controle-meldingen", () => {
  const { ok, beleid } = parseBeleid(DEMO_BELEID);
  assert.ok(ok, "de beleidstekst moet parseren");

  const { fouten } = resolveerBeleid(beleid, INDEX);
  assert.deepEqual(
    fouten.map((f) => f.bericht),
    [],
    "geen controle-meldingen tegen het demo-model"
  );
});

test("demo-beleid levert 3 permissions en 1 prohibition in ODRL", () => {
  const { beleid } = parseBeleid(DEMO_BELEID);
  const { beleid: geresolved } = resolveerBeleid(beleid, INDEX);
  const odrl = naarOdrl(geresolved);
  assert.equal(odrl.permission.length, 3);
  assert.equal(odrl.prohibition.length, 1);
});

test("de verbods- en aanspraak-regel wijzen naar echte registerpaden", () => {
  const { beleid } = parseBeleid(DEMO_BELEID);
  const { beleid: geresolved } = resolveerBeleid(beleid, INDEX);
  const paden = Object.fromEntries(geresolved.regels.map((r) => [r.naam, r.wat.pad]));
  assert.equal(paden["geen geslacht aan de telefoon"], "NatuurlijkPersoon.geslacht.geslacht");
  assert.equal(paden["aanspreken zonder geslacht"], "NatuurlijkPersoon.aanspraak.aanspreektitel");
});

test("de geo-keten is resolvebaar vanaf NatuurlijkPersoon (doorkijk over relaties)", () => {
  // "de wijk van de woonlocatie van een natuurlijk persoon" — de keten mag de
  // tussenstappen gebiedsligging/wijkaanduiding overslaan zolang hij eenduidig is.
  const res = resolveerVerwijzing(padNaarVerwijzing("NatuurlijkPersoon.woonlocatie.wijk"), INDEX);
  assert.equal(res.fout, undefined);
  assert.equal(res.pad, "NatuurlijkPersoon.woonlocatie.gebiedsligging.wijkaanduiding.wijk");
});

test("de org-keten is resolvebaar vanaf Medewerker", () => {
  const res = resolveerVerwijzing(padNaarVerwijzing("Medewerker.afdeling.afdelingsnaam.naam"), INDEX);
  assert.equal(res.fout, undefined);
  assert.equal(res.pad, "Medewerker.afdeling.afdelingsnaam.naam");
});

test("enum-bewaking pakt een onbekende geslachtswaarde", () => {
  const tekst = `Beleid "Enumtest".

  Regel "fout".
    Een beheerder mag de achternaam van een natuurlijk persoon bekijken
    als het geslacht van een natuurlijk persoon "onbekend" is.
`;
  const { ok, beleid } = parseBeleid(tekst);
  assert.ok(ok);
  const { fouten } = resolveerBeleid(beleid, INDEX);
  assert.equal(fouten.length, 1);
  assert.match(fouten[0].bericht, /geen toegestane waarde/);
  assert.match(fouten[0].bericht, /"man", "vrouw", "X"/);
});
