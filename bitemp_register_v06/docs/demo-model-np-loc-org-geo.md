# Demo-model np-loc-org+geo

Het gegevensmodel achter de FTV-demo van Toegangsspraak (di 15 september 2026).
Opdracht: `docs/plans/2026-09-10 Opdracht demo-model np-loc-org-geo en
OAS-naar-canoniek.md`, deel A. Draaiboek van de demo: `docs/plans/2026-09-15
FTV-demo Toegangsspraak — draaiboek.md`.

Doel: de beleidstekst van de demo moet in de toegang-activity parseren **zonder
controle-meldingen** — elke gegevens-keten resolvet eenduidig tegen het echte
canonieke model, en de enum- en typebewaking klaagt niet.

## Wat is er toegevoegd

### np-loc (uitgebreid)

| Onder | Nieuw | Rol (JSON) | Inhoud |
|---|---|---|---|
| `NatuurlijkPersoon` | GE `Geslacht` | `geslacht` | `geslacht` (enum `Geslachtsaanduiding`: man/vrouw/X) |
| `NatuurlijkPersoon` | GE `Aanspraak` | `aanspraak` | `aanspreektitel` (enum `Aanspreektitel`: meneer/mevrouw/hen, **optioneel**), `formeelAanspreken` (boolean, **optioneel**) |
| `NatuurlijkPersoon` | relatie `Woonlocatie` → `Locatie` | `woonlocatie` | geen eigen velden; materieel |
| `Locatie` | relatie `Gebiedsligging` → `Gemeentedeel` | `gebiedsligging` | geen eigen velden; materieel |

`Aanspraak` is de illustratie van **driewaardige optionaliteit**: per veld
onbekend of bekend-met-waarde, en géén instantie betekent "niet geregistreerd in
de bitemporele db". Toegangsspraak heeft daar niets nieuws voor nodig: `is
bekend` / `is onbekend` zijn kern-operatoren.

`Woonlocatie` staat bewust naast de bestaande, algemenere relatie
`Bereikbaarheid` (met `soort` = woonadres/briefadres/…). Voor de demo is één
expliciet benoemde woonlocatie nodig, zodat "de wijk van de **woonlocatie** van
de betrokkene" eenduidig is; `Bereikbaarheid` blijft ongewijzigd.

### org-geo (nieuw domein, prefix `org_geo`)

| Entiteit | Onderdelen |
|---|---|
| `Afdeling` | GE `Afdelingsnaam` (`afdelingsnaam`: `naam`); relatie `Afdelingsorganisatie` → `Organisatie` (rol `organisatie`) |
| `Medewerker` | GE `Medewerkernaam` (`medewerkernaam`: `naam`), GE `Aanstelling` (`aanstelling`: `functie`, `rol` — enum `Medewerkerrol`), GE `Contactkanaal` (`kanalen`, meervoudig: `kanaal` — enum `Kanaalsoort`); relatie `Medewerkerafdeling` → `Afdeling` (rol `afdeling`) |
| `Gemeentedeel` | GE `Wijkaanduiding` (`wijkaanduiding`: `wijk`, `soort` — enum `Gemeentedeelsoort`); relatie `Gemeentedeelgemeente` → `Gemeente` (rol `gemeente`) |

Enums: `Medewerkerrol` (medewerker/behandelaar/leidinggevende), `Kanaalsoort`
(balie/telefoon/email/post), `Gemeentedeelsoort` (Stadsdeel/Wijk/Buurt).

## Ontwerpkeuzes (en waarom)

**`Organisatie` en `Gemeente` zijn hergebruikt, niet nagemaakt.** Beide bestaan
al in het CG-domein (`Organisatie` met `Organisatienaam`/`Contactpersoon`,
`Gemeente` als referentielijst-item met `naam`/`code`). Een tweede entiteit met
dezelfde typenaam kán niet: de MetaRegistry is één map op typenaam, de laatste
init zou de eerste overschrijven. Het nieuwe domein hangt zich er dus aan vast.

**De relaties lopen "omhoog", vanaf de nieuwe kant.** `Afdeling → Organisatie`
in plaats van `Organisatie → Afdeling`, en `Gemeentedeel → Gemeente` in plaats
van andersom. Reden: een relatie hoort in dit model bij haar *bron*-entiteit, en
CG omgekeerd laten wijzen zou een codegen-run over het hele CG-domein vragen.
De associatie is dezelfde; `naamLabelHeen`/`naamLabelTerug` ("hoort bij" /
"kent afdeling") houden de leesrichting in de editor kloppend.

**Rolnamen in het enkelvoud waar de taal dat vraagt.** De modelboom vormt
veldpaden als `Entiteit.rol.veld`, waarbij de rol de `meervoud`-waarde van het
GE is. Toegangsspraak vergelijkt ketensegmenten letterlijk (genormaliseerd),
niet op stam: "de aanspreektitel van de **aanspraak** van …" resolvet alleen
als de rol `aanspraak` heet, niet `aanspraken`. Voor enkelvoudige GE's in dit
demo-model is de rol daarom enkelvoud (`geslacht`, `aanspraak`, `woonlocatie`,
`gebiedsligging`, `wijkaanduiding`, `aanstelling`, `afdeling`). Meervoudige GE's
houden het meervoud (`kanalen`).

**De brug naar het geo-deel ligt bij `Locatie`, niet bij `Gemeentedeel`.** De
opdracht beschrijft de keten Gemeente — Gemeentedeel — Locatie; die staat er ook
(via `Gemeentedeelgemeente`). Maar de demo-zin loopt de andere kant op, van de
persoon naar de wijk. Daarom hoort de relatie `Gebiedsligging` bij `Locatie`:
zo is `NatuurlijkPersoon → Woonlocatie → Locatie → Gebiedsligging →
Gemeentedeel` één doorlopende keten.

## Doorkijk over relaties in de modelboom

De modelboom (`web/vite/src/modelpicker/modelTree.js`) stopte bij een relatie:
je zag alleen de eigen velden van de relatie, niet die van de doel-entiteit.
Voor Toegangsspraak is dat te weinig — beleidsketens lopen over registergrenzen
heen. `bouwModelTree` heeft daarom een optie **`relatieDiepte`**: hoeveel
relatie-hops naar een andere entiteit meegenomen worden. De GE's/relaties van de
doel-entiteit komen dan als extra takken onder dezelfde entiteit te hangen, met
een samengesteld rolpad:

```
NatuurlijkPersoon.woonlocatie.gebiedsligging.wijkaanduiding.wijk
```

Daarmee wordt "de wijk van de woonlocatie van een natuurlijk persoon" één veld;
de keten-verkorting in `toegangsspraak/metamodel.js` mag de tussenstappen
overslaan zolang het eenduidig blijft. Cycli (A → B → A) worden afgekapt met een
bezocht-set per pad.

- Default is **0** — het historische gedrag. Andere activiteiten (DMN, BPMN,
  formulieren, bericht) merken niets.
- De toegang-activity zet **2** (`RELATIE_DIEPTE` in `toegangActivity.jsx`) en
  geeft die ook door aan de `ModelPicker` (prop `relatieDiepte`), zodat de
  modelboom dezelfde takken toont als de veldindex kent. Doorkijk-takken zijn
  gemarkeerd met `↗`.
- `modelpicker/veldenlijst.js` (`verzamelVelden`) is uit `toegangActivity.jsx`
  gelicht, zodat activity en test dezelfde platte veldenlijst bouwen.

Kosten: over het hele model gaat het van 229 naar 329 velden (diepte 2). Het
neveneffect is dat korte ketens eerder dubbelzinnig worden — "de wijk van een
natuurlijk persoon" kan nu via `bereikbaarheden` én via `woonlocatie` lopen en
levert een controle-melding die om de volledige keten vraagt. Dat is het
bedoelde gedrag (en meteen goed demomateriaal).

## Tests

| Test | Bewaakt |
|---|---|
| `model/demo_model_test.go` | Go-kant: rolnamen (JSON), veldnamen, relatie-doelen, enum-waarden in de MetaRegistry |
| `web/vite/src/studio/activities/toegangDemoModel.test.js` | De draaiboek-beleidstekst parseert en resolvet met **nul** controle-meldingen; 3 permissions + 1 prohibition in ODRL; de geo- en org-ketens resolven |
| `web/vite/src/modelpicker/modelTree.test.js` | `relatieDiepte`: default 0, rolpad-stapeling, doorkijk-markering, cyclusbewaking |

De twee eerste tests bewaken dezelfde afspraken aan weerszijden: de JS-test
gebruikt een handgeschreven `types`-fixture, de Go-test dezelfde rollen en
velden in de echte MetaRegistry. Loopt het model uiteen, dan valt er één om.

Draaien:

```sh
cd bitemp_register_v06
go test ./model/ -run TestDemoModel
cd web/vite && npm test
```

## Regenereren

Het V3-modelbestand staat in `model/json/model v3/demo np-loc-org+geo v1.0 —
v3-model.json`. Het bevat de np-loc- en org-geo-entiteiten plus de overige
domeinen als *context* (codegen slaat die over; ze staan erin omdat de
preflight-validatie eist dat elke `doelEntiteit` in het model voorkomt).

```sh
cd bitemp_register_v06
go run ./cmd/codegen --input "model/json/model v3/demo np-loc-org+geo v1.0 — v3-model.json" \
  --mode additive --domein np-loc  --prefix np_loc  --output model
go run ./cmd/codegen --input "model/json/model v3/demo np-loc-org+geo v1.0 — v3-model.json" \
  --mode additive --domein org-geo --prefix org_geo --output model
go build ./... && go test ./...
```

Let op de twee voetangels die in `docs/CODEGEN.md` §7 staan beschreven: de
`datatypes`-lijst in dit modelbestand is bewust *ingekort* (de handmatig
onderhouden aliassen uit `datatype_aliases_extra.go` staan er niet in, anders
schrijft codegen dubbele Go-type-declaraties), en de gegenereerde
`*_modellen_input.go` moeten na afloop hun handmatige delta's terugkrijgen.

Databasetabellen hoeven niet met de hand: `dbsetup/createmodeltables.go` maakt
ze generiek uit de MetaRegistry. Routes, handlers, GraphQL en OpenAPI evenmin.
