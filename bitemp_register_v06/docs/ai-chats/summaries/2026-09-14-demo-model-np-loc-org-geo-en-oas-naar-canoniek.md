# Chat Samenvatting

## Metadata

- Datum: 2026-09-14
- Titel: Demo-model np-loc-org+geo en OAS → canoniek model
- Bestandstamnaam: 2026-09-14-demo-model-np-loc-org-geo-en-oas-naar-canoniek
- Gerelateerde export: `../exports/2026-09-14-demo-model-np-loc-org-geo-en-oas-naar-canoniek.md` (nog te exporteren)
- Gerelateerde branch/commit: `feat/archimate-exchange`, nog niet gecommit
- AI: **Claude** (Claude Code)

## Doel

Uitvoeren van `docs/plans/2026-09-10 Opdracht demo-model np-loc-org-geo en
OAS-naar-canoniek.md`: (A) het gegevensmodel voor de FTV-demo van Toegangsspraak
op 15 september 2026, zó dat de beleidstekst uit het draaiboek zonder
controle-meldingen parseert, en (B) een eerste transformatie van een
OAS-document naar het canonieke model.

## Beslissingen

- **`Organisatie` en `Gemeente` hergebruikt uit het CG-domein** in plaats van
  nagemaakt: de MetaRegistry is één map op typenaam, dus een tweede `Organisatie`
  zou de eerste overschrijven.
- **Relaties lopen vanaf de nieuwe kant omhoog** (`Afdeling → Organisatie`,
  `Gemeentedeel → Gemeente`), zodat het CG-domein niet geregenereerd hoefde te
  worden. De leesrichting is gered met `naamLabelHeen`/`naamLabelTerug`.
- **Rolnamen in het enkelvoud** voor enkelvoudige GE's (`aanspraak`, `geslacht`,
  `woonlocatie`, …). Toegangsspraak vergelijkt ketensegmenten letterlijk, niet op
  stam: met rol `aanspraken` zou "de aanspreektitel van de **aanspraak** van …"
  niet resolven — en dat is precies de bonus-regel van de demo.
- **Doorkijk over relaties in de modelboom** (`bouwModelTree`-optie
  `relatieDiepte`, default 0, toegang-activity 2) in plaats van de wijk
  gedenormaliseerd op `Locatie` te zetten. Beleidsketens lopen nu eenmaal over
  registergrenzen heen.
- **`Woonlocatie` naast de bestaande `Bereikbaarheid`**: de demo-zin vraagt om één
  expliciet benoemde woonlocatie; `Bereikbaarheid` (met `soort`) blijft ongemoeid.
- **Deel B via V3 als tussenformaat**: OAS → `oasNaarV3` → `importeerV3` →
  canoniek core-model. Dat hergebruikt de hele bestaande keten in plaats van een
  tweede pad naar het core-model te bouwen.
- **Eerlijk boven mooi** bij de OAS-import: `allOf` op schema-niveau platslaan,
  technische velden weglaten (optioneel houden), en alles wat niet past als
  *diagnostic* melden in plaats van stil laten verdwijnen. Normaliseren doet de
  modelleur met de hand.
- **Verpakte verwijzingen afpellen.** De casus OpenOrganisatie liet zien dat
  generatoren een `$ref` in `allOf` stoppen (om er een beschrijving bij te
  zetten) en een optionele enum als `oneOf: [Enum, BlankEnum]` schrijven. Beide
  werden eerst genegeerd — zes relaties werden tekstvelden en de enum bleef
  onverbonden. Afpellen is nu onderdeel van de mapper.

## Waarom deze keuze

De acceptatie-eis was scherp: de draaiboek-tekst moet parseren zonder
controle-meldingen. Dat dwong twee dingen af die niet uit het model zelf volgen —
enkelvoudige rolnamen en de doorkijk over relaties. De doorkijk is bewust
*opt-in* gemaakt (default 0): zo verandert er niets voor de DMN-, BPMN-,
formulier- en bericht-activiteiten, en draagt alleen de toegang-activity de
kosten (229 → 329 velden, en korte ketens worden eerder dubbelzinnig — wat op
zichzelf correct gedrag is en goed demomateriaal).

Voor deel B was de verleiding om rechtstreeks canoniek-uml-elementen te bouwen;
via V3 is het minder code én komt alles mee wat de bestaande V3-route al kan
(domein-packages, enum-elementen, layout, terugreis).

## Gewijzigde onderdelen

- **Model (Go)**: `np_loc_*` opnieuw gegenereerd (GE `Geslacht`, GE `Aanspraak`,
  relaties `Woonlocatie` en `Gebiedsligging`, enums `Geslachtsaanduiding` en
  `Aanspreektitel`); nieuw domein `org_geo_*` (`Afdeling`, `Medewerker`,
  `Gemeentedeel` + 3 enums); `metaregistry_plumbing.go` init-volgorde;
  `model/demo_model_test.go`; `model/json/model v3/demo np-loc-org+geo v1.0 — v3-model.json`.
- **Frontend**: `modelpicker/modelTree.js` (`relatieDiepte`),
  `modelpicker/veldenlijst.js` (nieuw, uit `toegangActivity.jsx` gelicht),
  `ModelPicker.jsx` (prop + `↗`-markering), `modelpicker.config.js`,
  `toegangActivity.jsx` (RELATIE_DIEPTE = 2);
  `diagramprofielen/canoniek-uml/oasNaarV3.js` + `oasCanoniekImport.js` (nieuw),
  `studio/activities/oasCanoniekTransformatie.js` (nieuw), `activities/index.jsx`.
- **Tests**: `toegangDemoModel.test.js`, `oasNaarV3.test.js`,
  `oasCanoniekImport.test.js`, uitbreiding `modelTree.test.js`,
  `model/demo_model_test.go`. Frontend 510/510 groen; Go groen op twee
  vóórbestaande failures na (`dynql` C_sub, `handlers` page-size cap).
- **API routes / DB/SQL**: geen handwerk — routes, handlers, GraphQL, OpenAPI en
  tabellen komen generiek uit de MetaRegistry.
- **Docs**: nieuw `docs/demo-model-np-loc-org-geo.md`; bijgewerkt
  `docs/CODEGEN.md` (§2 domeinen, §7.4 voetangels), `docs/TOEGANGSSPRAAK.md`,
  `docs/STUDIO.md` (OAS → canoniek), `docs/BACKLOG.md` §29, draaiboek-checklist.

## Open punten

- **Codegen-hygiëne** (backlog 29.3/29.4): elke regeneratie herintroduceert
  `Aanvang`/`Einde` in de `_Input`-structs en probeert de handmatige
  datatype-aliassen te dubbelen. Nu met de hand rechtgezet; structureel op te
  lossen in `cmd/codegen`.
- De **REST-schil** komt bij een gegenereerde OAS gewoon mee:
  `Paginated…List`, `Patched…` en `Nested…` worden entiteiten. Opzet (de import
  verzint niets), maar het vraagt handwerk achteraf — backlog 29.8 oppert een
  optionele filterstap.
- De twee vóórbestaande Go-testfouten staan los van dit werk.

## Volgende stap

Op de demo-machine de Go-backend herbouwen (anders levert de schema-API het oude
model) en de resterende punten van de draaiboek-checklist afwerken: fallback-tekst
klaarzetten, de round-trip publiceer → canvas-edit → teruglezen één keer
doorlopen, en de info-paper klaarzetten.
