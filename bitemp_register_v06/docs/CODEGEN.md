# Codegen — Handleiding & Workflow

**Datum:** 2026-03-31  
**Status:** Roundtrip volledig gevalideerd (14/14 bestanden identiek)

Dit document beschrijft de volledige werkwijze voor het genereren, exporteren en verifiëren van modelcode in het bitemporele register.

## Inhoudsopgave

1. [Architectuuroverzicht](#1-architectuuroverzicht)
2. [Domeinen](#2-domeinen)
3. [Export: code → V3 JSON](#3-export-code--v3-json)
4. [Codegen: V3 JSON → code](#4-codegen-v3-json--code)
5. [Roundtrip-verificatie](#5-roundtrip-verificatie)
6. [Nieuw domein toevoegen](#6-nieuw-domein-toevoegen)
7. [Bestaand model wijzigen](#7-bestaand-model-wijzigen)
8. [Cross-domein relaties](#8-cross-domein-relaties)
9. [Bestandsoverzicht](#9-bestandsoverzicht)
10. [Veelgestelde vragen](#10-veelgestelde-vragen)
11. [Greenfield test — domeinonafhankelijkheid bewezen](#11-greenfield-test--domeinonafhankelijkheid-bewezen)
12. [Een backend met alleen bepaalde domeinen bouwen](#12-een-backend-met-alleen-bepaalde-domeinen-bouwen)

---

## 1. Architectuuroverzicht

```
┌─────────────────┐      export_v3      ┌──────────────┐       codegen        ┌─────────────────┐
│   Go code       │ ──────────────────► │   V3 JSON    │ ───────────────────► │   Go code       │
│   (model/*.go)  │                     │   (.json)    │                      │   (model/*.go)  │
└─────────────────┘                     └──────────────┘                      └─────────────────┘
        │                                     │                                       │
        ▼                                     ▼                                       ▼
  MetaRegistry                          UML editor                              MetaRegistry
  (runtime)                             (bewerken)                              (runtime)
```

De drie representaties van het model:

| Laag | Formaat | Bron |
|------|---------|------|
| **Code** | Go structs + MetaRegistry | `model/*.go` bestanden |
| **V3 JSON** | Platform-onafhankelijk JSON schema | `cmd/export_v3` of `GET /api/schema/model/code` |
| **Editor** | Visueel UML-achtig | React frontend (leest/schrijft V3 JSON) |

De **roundtrip** is: code → V3 JSON → code, en moet identieke output opleveren.

---

## 2. Domeinen

Het model is opgedeeld in **domeinen**. Elk domein heeft een eigen set gegenereerde bestanden.

| Domein | Prefix | Beschrijving |
|--------|--------|-------------|
| `register` | `register_` | Basisregistratie: Referentielijst, Land, etc. |
| `np-loc` | `np_loc_` | Natuurlijke personen en locaties |
| `org-geo` | `org_geo_` | Afdeling, Medewerker, Gemeentedeel (demo-model, zie `docs/demo-model-np-loc-org-geo.md`) |
| `beheer` | `beheer_` | Gebruiker (identiteit, status, roltoewijzing) — gebruikersbeheer; alleen voor admins, niet in GraphQL. Model: `docs/plans/gebruikersbeheer/` |
| `meldingen` | `meldingen_` | Melding (inhoud, context, bijlage, status, prioriteit, reactie; melder en behandelaar → Gebruiker) — bugs en wensen melden; via de generieke routes alleen voor beheerders, niet in GraphQL; melders via `/api/meldingen` (package meldingen). Model: `docs/plans/meldingen/` |

(Plus de domeinen die los van dit document zijn gegroeid: `abuvwxy`, `CG`,
`configuratie`, `financieel`, `ide-bestanden`, `kennis2`, `gegevenstypen`. De
init-volgorde staat in `model/metaregistry_plumbing.go`.)

### Register is altijd nodig

Het register-domein bevat de kern-entiteiten (Referentielijst, Land) waar andere domeinen afhankelijkheden op hebben. Let op: de entiteit `AdellijkeTitel` wordt (stand oktober 2026) in **np-loc** gegenereerd, terwijl de referentielijst-relatie `AdellijkeTitelsTitel` in register ernaar wijst; zie §12. Plumbing-types (interfaces, MetaRegistryType, constanten) staan in `metaregistry_plumbing.go` en zijn domein-onafhankelijk.

### Init-volgorde

De init-volgorde is vastgelegd in `metaregistry_plumbing.go`:

```go
func init() {
    initRegisterMetaRegistry()     // register eerst
    initRegisterDatatypeRegistry()
    initRegisterEnumRegistry()
    initNpLocMetaRegistry()        // daarna domein-specifiek
}
```

Register-entries moeten eerst bestaan, zodat andere domeinen via `VoegOnderliggendGEToe()` verwijzingen kunnen toevoegen aan register-scope entiteiten.

---

## 3. Export: code → V3 JSON

### CLI

```sh
# Exporteer register-domein (inclusief entities van andere domeinen die register nodig hebben)
go run ./cmd/export_v3 --domein register > export_register.json

# Exporteer np-loc domein (bevat ook register-entiteiten, nodig als context)
go run ./cmd/export_v3 --domein np-loc > export_np_loc.json

# Strict export: alleen het opgegeven domein (geen register-context)
go run ./cmd/export_v3 --domein np-loc --strict > export_np_loc_strict.json
```

### Flags

| Flag | Beschrijving |
|------|-------------|
| `--domein` | Filtert op domein. Register-entiteiten worden altijd mee-geëxporteerd (behalve met `--strict`). |
| `--strict` | Exporteer *alleen* het opgegeven domein. Nuttig voor analyse, niet voor codegen. |

### PowerShell BOM-workaround

PowerShell's `>` redirect schrijft een BOM. Gebruik:

```powershell
$output = go run ./cmd/export_v3 --domein register 2>&1
[System.IO.File]::WriteAllText("$PWD\export.json", ($output -join "`n"), [System.Text.UTF8Encoding]::new($false))
```

---

## 4. Codegen: V3 JSON → code

### CLI

```sh
# Vanuit bestand (aanbevolen voor reproduceerbare roundtrips)
go run ./cmd/codegen --input export_register.json \
  --mode additive --domein register --prefix register --output model/

# Vanuit draaiende API
go run ./cmd/codegen --from-url http://localhost:8082/api/schema/model/code \
  --mode additive --domein np-loc --prefix np_loc --output model/

# Vanuit specifiek DB-model (op ID)
go run ./cmd/codegen --from-url http://localhost:8082/api/schema/model/42 \
  --mode additive --domein np-loc --prefix np_loc --output model/
```

### Flags

| Flag | Default | Beschrijving |
|------|---------|-------------|
| `--input` | — | Pad naar V3 JSON bestand |
| `--from-url` | — | URL van draaiend register |
| `--output` | `model/` | Doeldirectory |
| `--mode` | `standalone` | `standalone` (overschrijft alles) of `additive` (voegt toe via init-functie) |
| `--domein` | — | Domeinnaam: filtert entiteiten, zet `TypeMeta.Domein` |
| `--prefix` | — | Bestandsnaam-prefix (bijv. `register` → `register_metaregistry.go`) |

### Modus: standalone vs. additive

| | Standalone | Additive |
|---|---|---|
| **Gebruik** | Volledig nieuw model | Toevoegen aan bestaand register |
| **MetaRegistry** | `var MetaRegistry = MetaRegistryType{...}` | `func initXxxMetaRegistry() { MetaRegistry["..."] = TypeMeta{...} }` |
| **Geschikt voor** | Eenmalige/test-generatie | **Productie** (register + np-loc naast elkaar) |

> **In productie gebruiken we altijd `additive` mode** voor beide domeinen.

### Gegenereerde bestanden (7 per domein)

| Bestand | Inhoud |
|---------|--------|
| `{prefix}_modellen_entiteiten.go` | Entiteit-structs + materiële plumbing (Aanvang/Einde) |
| `{prefix}_modellen_ge_rel.go` | GE hub-structs, _Data structs, relatie-structs, enum type-declaraties |
| `{prefix}_modellen_methods.go` | Interface-methoden (GetID, Metatype, etc.) + GeefOnderliggendeGE's |
| `{prefix}_modellen_input.go` | Platte _Input structs voor registratie-API |
| `{prefix}_metaregistry.go` | TypeMeta entries + ReferentielijstInstanties + VoegOnderliggendGEToe |
| `{prefix}_datatype_registry.go` | Custom datatypes (BSN, NLPostcode, etc.) |
| `{prefix}_enum_registry.go` | EnumWaarden + EnumEditorLayouts |

> Ook als een domein geen eigen datatypes of enums heeft, genereert additive mode bewust een **lege `initXxx...()` functie**. Zo blijft de centrale init-volgorde compileerbaar tijdens devloop rebuilds.

### Domeinfiltering

Bij `--domein register`:
- Entiteiten met `domein: "register"` of leeg domein worden gegenereerd
- Entiteiten met een ander domein (bijv. `"np-loc"`) worden overgeslagen

Bij `--domein np-loc`:
- Idem, maar dan voor `"np-loc"`
- Register-entiteiten (Land, Referentielijst) worden overgeslagen — die zitten al in het register-domein
- Enums die niet meer gerefereerd worden na filtering, worden ook verwijderd

### Validatieregels

De codegen valideert het V3 model voordat er code wordt gegenereerd. Bij fouten stopt het proces met een duidelijke foutmelding en exit code 1. Dit voorkomt dat ongeldige Go-code wordt gegenereerd die later pas bij compilatie faalt.

#### Entiteiten, GE's en relaties

| Veld | Regel | Voorbeeld goed | Voorbeeld fout |
|------|-------|----------------|----------------|
| `typenaam` | PascalCase, geen spaties | `ApiStandaard` | `Api Standaard` |
| `meervoud` | lowercase/snake_case | `api_standaarden` | `ApiStandaarden` |
| `momentvoorkomen` | `enkelvoudig` of `meervoudig` | `enkelvoudig` | `enkel` |
| `velden[].naam` | letters/cijfers/underscore | `CG_laag` | `CG laag` |
| `relaties[].doelEntiteit` | moet bestaan in `entiteiten` | `Gemeente` | `Onbekend` |
| `velden[].goType` | optioneel sinds 23-10-2026: ontbreekt het, dan afgeleid uit `type`/`format`/`verplicht`/`enum` (string → `string`, niet verplicht → `*string`, `date` → `Date`, `date-time` → `time.Time`, `integer` → `int`, `number` → `float64`, `boolean` → `bool`, enum → het enum-type) | `"type": "string"` zonder `goType` | — |
| `velden[].datatype` | moet bestaan: in `model.datatypes` of in het register (`KorteTekst`, `LangeTekst`, `URL`, `Datum`, …) | `KorteTekst` | `NietBestaand` |
| `--domein` | moet voorkomen in het model (sinds 25-10-2026): minstens één entiteit, datatype of enum met dat domein (voor `register` en voor de modelnaam tellen entiteiten zonder domein mee). Eén domein per run | `inrichting` | `inrichting,aanvraag` |
| `meervoud` (padnaam) | uniek over alle domeinen in de build (sinds 23-10-2026): elke padnaam wordt een route, en gin paniekt bij het opstarten op een dubbele route. Types van het eigen domein tellen niet mee | `inrichting_producten` | `producten` (bestaat al bij `Initiatief_Product`, domein CG) |

#### Enums

| Veld | Regel | Voorbeeld goed | Voorbeeld fout |
|------|-------|----------------|----------------|
| `goType` | PascalCase Go-identifier, geen spaties | `CGLaag` | `CG laag` |
| `goType` | uniek per model | — | twee enums met dezelfde `goType` |
| `waarden[].constNaam` | PascalCase Go-identifier | `CGLaagLaag5` | `CG laagLaag5` |
| `waarden[].constNaam` | uniek over alle enums | `SchaalWaarde1`, `SchaalWaarde2` | `SchaalWaarde`, `SchaalWaarde` |

> **Veelvoorkomende fout:** De UML-editor staat spaties toe in enum-namen (bijv. `"CG laag"`). Deze moeten vóór codegen worden aangepast naar PascalCase (bijv. `"CGLaag"`), inclusief de bijbehorende `constNaam`-waarden en veld-referenties (`"enum": "CGLaag"`).

> **Tip:** Numerieke enum-waarden (bijv. schaal 1–4) vereisen unieke `constNaam`-waarden. Gebruik een suffix per waarde: `SchaalWaarde1`, `SchaalWaarde2`, etc. — niet vier keer `SchaalWaarde`.

### Afgeleide relaties (alleen lezen, geen tabel)

Een relatie met `afgeleid: true` (UML isDerived, "/" voor de naam) wordt **niet** geregistreerd
maar bij het lezen berekend uit `afleidingsregel` (CEL-subset met navigatie). Codegen haalt zulke
relaties vóór de generatie uit `entiteiten[].relaties` (`splitsAfgeleideRelaties` in
`cmd/codegen/gen_afgeleid.go`, ná de delta-analyse). Ze krijgen dus geen hub-, `_Data`-, Input-
of methode-code, geen regel in `OnderliggendeGegevenselementen`, geen tabel en geen routes.
De entiteit-entry krijgt wel een blok `AfgeleideRelaties: []AfgeleideRelatie{...}` met rolnaam,
doelentiteit, regel en editor-layout. De exporter zet het blok terug als
`V3Relatie{afgeleid: true}`, zodat de rebuild de relatie niet kwijtraakt.

Extra validatie bij `afgeleid: true`: `afleidingsregel` verplicht, `afleidingsregelTaal` leeg of
`cel`, geen `velden`, `afgeleideVelden` of `relatieSubtype`. `isMaterieel` wordt genegeerd.
Schemadiff meldt een afgeleide relatie erbij/eraf als informatief (categorie
`afgeleide_relatie`, geen SQL); omzetten van opgeslagen naar afgeleid is destructief (tabel
vervalt), andersom additief (tabel erbij).

Verder (V3-rondreis): `geordend` (UML isOrdered) op een relatie gaat naar `TypeMeta.Geordend`, en een afgeleid
veld (`velden[].afgeleid`) krijgt de struct tag `afleiding:"<regel>"` die de exporter weer leest
(het veld zelf blijft voorlopig een gewone kolom).

Ontwerp, navigatiesyntaxis en de leeskant: `docs/plans/2026-10-11 Afgeleide relaties backend — ontwerp.md`.

---

## 5. Roundtrip-verificatie

Stappen om te verifiëren dat de roundtrip 100% klopt:

```sh
# 1. Exporteer V3 JSON (zonder BOM)
$output = go run ./cmd/export_v3 --domein register 2>&1
[System.IO.File]::WriteAllText("$PWD\export_register.json", ($output -join "`n"), [System.Text.UTF8Encoding]::new($false))

$output = go run ./cmd/export_v3 --domein np-loc 2>&1
[System.IO.File]::WriteAllText("$PWD\export_np_loc.json", ($output -join "`n"), [System.Text.UTF8Encoding]::new($false))

# 2. Genereer code naar de centrale temp directory
New-Item -ItemType Directory -Force _temp/roundtrip | Out-Null
go run ./cmd/codegen --input export_register.json --mode additive --domein register --prefix register --output _temp/roundtrip
go run ./cmd/codegen --input export_np_loc.json --mode additive --domein np-loc --prefix np_loc --output _temp/roundtrip

# 3. Vergelijk met SHA256 hash
$files = Get-ChildItem _temp/roundtrip -Filter *.go
foreach ($f in $files) {
    $modelFile = Join-Path model $f.Name
    $genHash = (Get-FileHash $f.FullName -Algorithm SHA256).Hash
    $modelHash = (Get-FileHash $modelFile -Algorithm SHA256).Hash
    if ($genHash -eq $modelHash) { Write-Output "IDENTIEK: $($f.Name)" }
    else { Write-Output "VERSCHIL: $($f.Name)" }
}
```

Verwacht resultaat: **14/14 IDENTIEK** (7 register + 7 np-loc bestanden).

> Gebruik voor losse experimenten, tijdelijke JSON-exports en codegen-vergelijkingen voortaan bij voorkeur de centrale map `_temp/`, zodat de projectroot schoon blijft.

---

## 6. Nieuw domein toevoegen

Voorbeeld: toevoegen van domein `"hr"` (Human Resources).

### Stap 1: Maak het V3 model

Maak een JSON-bestand met de entiteiten, gegevenselementen, relaties en enums. Dit kan handmatig of via de UML-editor.

### Stap 2: Genereer code

```sh
go run ./cmd/codegen --input hr_model.json \
  --mode additive --domein hr --prefix hr --output model/
```

Dit genereert 7 bestanden: `hr_modellen_entiteiten.go`, `hr_metaregistry.go`, etc.

### Stap 3: Init-registratie (automatisch)

De codegen voert in `-mode additive` automatisch `ensureInitRegistration()` uit. Deze functie:
- Leest `metaregistry_plumbing.go` in de output-directory
- Controleert of init-calls voor het prefix al bestaan
- Voegt ze toe vóór `propageerDomeinNaarOnderliggende()` als ze ontbreken

Je hoeft dus **niets handmatig** te doen. Na codegen staan de volgende aanroepen automatisch in `init()`:

```go
func init() {
    // (eerder geladen domeinen staan hier al)
    // hr — domein-specifieke uitbreiding
    initHrEnumRegistry()
    initHrDatatypeRegistry()
    initHrMetaRegistry()

    propageerDomeinNaarOnderliggende()
}
```

> **Let op:** als de `init()` al calls bevatte voor het prefix (bijv. door een vorige codegen-run), worden ze niet gedupliceerd.

### Stap 4: Verifieer

```sh
go build ./...
go test ./...
```

---

## 7. Bestaand model wijzigen

### Via de UML-editor (aanbevolen)

1. Open de editor en bewerk het model visueel
2. Publiceer het model (POST naar `/api/schema/model`)
3. Genereer code:
   ```sh
   go run ./cmd/codegen --from-url http://localhost:8082/api/schema/model/code \
     --mode additive --domein np-loc --prefix np_loc --output model/
   ```
4. Bouw en test:
   ```sh
   go build ./...
   go test ./...
   ```

### Via V3 JSON bestand

1. Bewerk het JSON-bestand
2. Genereer code:
   ```sh
   go run ./cmd/codegen --input np_loc_model.json \
     --mode additive --domein np-loc --prefix np_loc --output model/
   ```
3. Bouw en test

### Handmatige wijzigingen

Voor kleine wijzigingen (extra veld, andere tag) kan je de gegenereerde bestanden direct aanpassen. Maar: bij de volgende codegen-run worden ze weer overschreven. Bewaar handmatige wijzigingen in apart niet-gegenereerde bestanden, of breng ze aan in het V3 model.

### 7.3b Rondreis code → V3 → code: wat er sinds 22-10-2026 behouden blijft

Een rebuild uit de **actieve schema-versie** (startup-rebuild in de devloop-container, zie
`docs/DEVLOOP.md`) genereert alle domeinen opnieuw uit een export van de code. Een end-to-end
test van die route legde drie verliezen bloot, alle drie verholpen:

| Verlies | Gevolg | Fix |
|---|---|---|
| `datatype_aliases.go` kreeg aliassen die `datatype_aliases_extra.go` (handgeschreven) al declareert (`Kleur`, `Duur`, …) | build: "redeclared in this block" | `mergeGedeeldBestand` slaat types over die elders in `model/` gedeclareerd zijn (`typesElders`) |
| de exporter leidde enum-**constNamen** af als goType + waarde (`IdeBestandFormaatjson`), terwijl handgeschreven handlers `IdeBestandFormaatJSON`, `…ModelSnapshot` gebruiken | build: "undefined: model.IdeBestandFormaatJSON" | nieuwe registry `model.EnumConstNamen` (door codegen in `<prefix>_enum_registry.go` gevuld); de exporter geeft de namen exact terug (`model.EnumConstNaam`) |
| `NaamLabelHeen`/`NaamLabelTerug` van relaties en GE's | UML-labels weg na een rebuild | `v3RelatieVanMeta`/`v3GegevenseElementVanMeta` nemen ze uit het onderliggende element |
| veld-`description` (25-10-2026) | beschrijvingen per veld weg na codegen, ook in OpenAPI/GraphQL | codegen schrijft `schema_desc:"…"` op data- én input-velden (`schemaDescTag`); die tag lazen export, OpenAPI, GraphQL en schema-viz al |
| `bronKardinaliteit`/`doelKardinaliteit` van gewone relaties (25-10-2026) | kardinaliteit weg (alleen afgeleide relaties hielden hem) | `TypeMeta.BronKardinaliteit`/`DoelKardinaliteit`, door codegen gevuld en door `v3RelatieVanMeta` teruggegeven. **Alleen metadata:** het register dwingt een kardinaliteit als `"1"` niet af (BACKLOG §33) |

Ook 25-10-2026: een veld met `format: date-time` wordt `time.Time`; `<prefix>_modellen_input.go`
kreeg dan geen `import "time"` en compileerde niet. `generateInput` voegt de import nu toe als
hij nodig is.

> **Een relatie verplicht maken:** V3 kent geen `verplicht` op een relatie (een onbekende sleutel
> wordt stil genegeerd). Gebruik `"doelKardinaliteit": "1"` (precies één) of `"1..*"`. Dat blijft
> bewaard en staat in de schema-API, maar wordt nog niet afgedwongen.

De bestaande `<prefix>_enum_registry.go`-bestanden zijn eenmalig gevuld met de constNamen uit
hun const-blokken; vanaf nu schrijft codegen ze zelf. Overgebleven drift bij een volledige
regeneratie is cosmetisch (volgorde van enums en velden, opmaak).

### 7.3c Zelf-relaties en het expliciete doeltype (23-10-2026)

Een relatie is een gegevenselement van de entiteit in de **eigenaarsrol**; de entiteit in de
andere rol wordt **verwezen** (Mark, 23-10). In de tabel: eigenaarskolom `<eigenaar>_id`
(`EntiteitIDKolom`) en verwijskolom `<doel>_id` (`SecondaireEntiteitIDKolom`). Bij een
**zelf-relatie** (doel = eigenaar, bv. `ArtefactAfhankelijkheid`: Artefact → Artefact) vielen die
samen en kreeg de struct twee keer `Artefact_ID`. Nu geeft `naamgeving.SecondaireIDKolom` in dat
geval `doel_<entiteit>_id` (`doel_artefact_id`, Go-veld `DoelArtefact_ID`); gewone relaties
veranderen niet. Een symmetrische relatie (huwelijk) is geen zelf-relatie maar een eigen entiteit
met twee relaties; dat gaf al geen botsing, want elke relatie is een eigen hub-tabel.

Het **doeltype staat sindsdien expliciet** in de MetaRegistry: `TypeMeta.DoelTypenaam`, door
codegen geschreven. Tot dan raadden vijf plekken het doeltype uit de kolomnaam (`gemeentedeel_id`
→ Gemeentedeel); dat breekt bij `doel_x_id`, en A kan meerdere relaties naar B hebben waarin B
verschillende rollen vervult. Alle plekken (exporter, schema-API, `/full`-verrijking,
relatie-id-handler, GraphQL reverse/forward, afleiding) gebruiken nu
`model.DoelTypenaamVanRelatie(meta)`; alleen voor registries zonder het veld geldt nog de
heuristiek. De bestaande `<prefix>_metaregistry.go`-bestanden zijn eenmalig gevuld.

### 7.3d Overerving (`erft`) over domeinen heen (26-10-2026)

Een subtype mag in een ander domein staan dan zijn ouder (FUNDAMENT: `GehandicaptenparkeerkaartAanvraag`
in `parkeren` erft `Aanvraag` uit `aanvraag`); codegen gebruikt alleen de naam van de ouder, en de
rebuild genereert per domein. Getest op de regressiedatabase met een proefmodel; drie fouten verholpen:

| Fout | Fix |
|---|---|
| hub-kinderen (GE's, relaties) van een subtype verwezen met `belongs-to … =id` naar de entiteit, maar een subtype heeft als sleutel de PFK `<ouder>_id`; de zelftest weigerde ("must have column id") | `entiteitPKKolom(ent)` in `gen_structs.go`/`conventions.go` |
| `dbsetup` maakte de entiteit-level `_aanvang`/`_einde`-tabel van een materieel subtype met kolom `<tabel>_<idkolom>` (`…_aanvraag_id`), codegen verwachtte `<tabel>_id`; elke `/full`-leesactie gaf 500 | `createmodeltables.go`: altijd `<tabel>_id` |
| `/full` van een subtype laadde de ouder kaal (alleen id), met peiltijdstip zelfs "missing FROM-clause entry" | ouder apart en volledig geladen in `laadOuderVoorSubtypes` (`full_handlers.go`); `GET /api/volgorde` vindt ook geërfde relaties |

Wat werkt (proef 26-10-2026): registreren in één registratie (ouder-hub + geërfde GE's + subtype-hub +
eigen GE's, zelfde id), alleen de subtype-hub (de engine maakt een kaal ouder-record), geërfde GE's later
toevoegen; `/full/<subtype>/<id>` toont eigen GE's en onder `parent_<ouder>` de volledige ouder;
`/full/<ouder>/<id>` toont alleen de ouder (zonder subtype-GE's); validatie (datatype, enum) op
subtype-GE's; materieel subtype met eigen aanvang/einde; formeel tijdreizen; het volgorde-endpoint via
een geërfde relatie. **Nog niet:** GraphQL geeft `parent_<ouder>` als tekst zonder inhoud (de ouder is
daar niet getypeerd), en codegen controleert niet of de ouder bestaat (een tikfout in `erft` valt pas bij
`go build`). Een lege `baseType` op een enum geeft ongeldige Go (`type X `) zonder melding.

### 7.4 Twee voetangels bij een regeneratie

Waargenomen bij het regenereren van `np-loc` voor het demo-model
(september 2026). Beide gaan om bestanden die codegen *deelt* met handwerk;
controleer ze met `git diff` na elke run.

**a. `datatype_aliases.go` botst met `datatype_aliases_extra.go`.**
`generateDatatypeAliases` schrijft een `type X …` voor elk datatype in
`v3.Datatypes` — en een export bevat de hele `DatatypeRegistry`, inclusief de 29
handmatig onderhouden types (`Kleur`, `Duur`, `GeoPunt`, `BAGPandID`, …) die al
in `datatype_aliases_extra.go` staan. Het resultaat compileert niet: dubbele
Go-type-declaraties. Oplossing: haal die datatypes uit de `datatypes`-lijst van
het modelbestand dat je aan codegen voert (zo is het demo-modelbestand
opgebouwd), of zet `datatype_aliases.go` na de run terug. Het bestand hoort
alleen te wijzigen als je écht een datatype toevoegt.

**b. `*_modellen_input.go` draagt handmatige delta's.**
Alle `_Input`-bestanden in `model/` zijn na generatie met de hand bijgewerkt:

- **Aanvang/Einde zijn eruit gehaald.** De normalizer splitst materiële plumbing
  als aparte wijzigingen af; codegen genereert ze wél als platte velden. Op hun
  plek staat een comment die dat uitlegt.
- **Sommige `schema:"…"`-tags zijn verwijderd** (bv. `datatype:NLPostcode` op
  `Locatie_Adres_Input`, de `enum=`-tags). De schema-handler kent een fallback
  via de `EnumWaarden`-registry voor `_Input`-structs zonder tag.

Na een regeneratie zijn die delta's weg. Zet ze terug (of laat ze bewust vallen,
maar dan met een testronde: het verandert de API-schema's). Structureel oplossen
vraagt een aanpassing in `cmd/codegen/gen_input.go` — staat op de backlog.

### 7.5 Werkwijze: één domein uitbreiden via V3 JSON (met nulmeting)

Gebruikt op 23-09-2026 om `QueryDefinitie` aan het domein `configuratie` toe te voegen
(Claude-sessie). De nulmeting maakt zichtbaar wat de generator hoe dan ook verandert, zodat je
dat niet voor je eigen wijziging aanziet.

1. **Exporteren**: `go run ./cmd/export_v3 --domein configuratie > origineel.json`
   (zonder `--strict`: de register-context moet mee).
2. **Nulmeting**: genereer het *ongewijzigde* export terug en bekijk `git diff model/`.
   Voor `configuratie` gaf dat precies de voetangels uit §7.4 (`datatype_aliases.go`, en de
   `schema:`-tags in `*_modellen_input.go`) plus één gewijzigde commentaarregel in
   `*_enum_registry.go`. Zet de nulmeting terug: `git checkout model/`.
3. **Wijzigen**: voeg entiteit, GE's en enum toe aan het export en sla het op in
   `docs/Model files (V3)/` (bv. `configuratie 2026-09-23 met QueryDefinitie — v3-model.json`).
   Dat bestand is de reproduceerbare invoer van de generatie.
4. **Genereren** voor alleen dat domein:
   ```sh
   go run ./cmd/codegen --input "docs/Model files (V3)/<bestand>.json" \
     --mode additive --domein configuratie --prefix configuratie --output model/
   ```
5. **Voetangels herstellen**: `git checkout model/datatype_aliases.go`, en de `schema:`-tags in
   `*_modellen_input.go` weer weghalen — ook op de nieuwe structs, zodat het bestand consistent
   blijft.
6. **Controleren dat het puur toevoegend is**: `git diff model/ | grep '^-' | grep -v '^---'`
   hoort (op de commentaarregel na) leeg te zijn. Daarna `go build ./... && go test ./...`.

7. **Veldnamen**: `runtime.veldnaam` in de V3-JSON wordt **niet** gelezen. De codegen leidt de
   `Veldnaam` van een GE af uit het laatste deel van de typenaam in kleine letters (`Naam` →
   `naam`), en pakt de volledige typenaam alleen bij een conflict *binnen dezelfde run* (`Meta` →
   `formulierdefinitie_meta`). Een conflict met een ander domein (`naam` bestaat ook in CG) ziet
   hij niet. Geef een GE daarom de entiteit als voorvoegsel, PascalCase zonder underscore
   (`QuerydefinitieNaam` → veldnaam `querydefinitienaam`, tabel
   `querydefinitie_querydefinitienaam`), zoals `Organisatienaam` in CG. Bij een botsing valt de
   registratie-engine terug op de entiteit-id in de payload, maar daar wil je niet op leunen.

8. **Extra voetangels bij het CG-domein** (gezien op 24-09-2026 bij `Aanmeldstatus`), naast a en b
   uit §7.4: de generator hernoemt bestaande **enum-constanten** naar een andere casing
   (`FaseIdeeNogGeenConcreteOpbrengsten` → `FaseIdeenoggeenconcreteopbrengsten`, idem `CGLaag…`,
   `CGPortfolioFase…`, `Gemeenterol…`), zet **`Aanvang`/`Einde` terug** in de `_Input`-structs van
   materiële GE's, en **`cg_datatype_registry.go` verliest zijn datatypes** (`URL`, …). Werkwijze:
   `git checkout model/datatype_aliases.go model/cg_datatype_registry.go`, de hernoemde constanten
   terugzetten, en in `cg_modellen_input.go` de `schema:`-tags strippen en de twee
   `Aanvang`/`Einde`-regels weer vervangen door de normalizer-opmerking. Daarna hoort
   `git diff model/ | grep '^-'` alleen de commentaarregel van punt 6 te tonen. Structureel
   oplossen: backlog §29.3/29.4.

9. **Delta-methode als de nulmeting niet schoon is** (25-09-2026, `NotificatieDefinitie`): de
   nulmeting gaf 600+ verschilregels (andere sortering van de generator t.o.v. de gecommitte
   bestanden). Genereer dan het *ongewijzigde* export én het gewijzigde export elk in een eigen
   tijdelijke map (`--output <map>/`, met een kopie van `metaregistry_plumbing.go` erin), maak
   `diff -ru gen-a gen-b > delta.patch` — dat is puur je eigen toevoeging — en pas die toe op
   `model/` (`patch -p1 -d model`); hunks die niet passen zijn per bestand aan het einde (types)
   of vóór de sluitaccolade van `init` (registries) in te voegen. Daarna `gofmt`, de
   `schema:`-tags strippen, `go build && go test`. `git diff model/ | grep '^-'` hoort leeg te zijn.

**Databasegevolg**: geen migratie zolang je alleen toevoegt. `dbsetup.CreateTables` maakt bij de
eerste start van de backend de nieuwe tabellen aan (`CREATE TABLE IF NOT EXISTS`); bestaande data
blijft onaangeroerd. Maar het voegt **geen kolommen toe** aan een bestaande tabel en verwijdert
niets: verander je een GE dat al tabellen heeft (veld erbij, materieel gemaakt), dan moeten die
tabellen weg vóór de herstart — met een opruimscript in `scripts/sql/`, kinderen vóór ouders
(foreign keys). Voorbeeld: `scripts/sql/2026-09-23-querydefinitie-losse-ges-opruimen.sql`.
Geverifieerd door de backend tegen een lege PostgreSQL te starten, een `QueryDefinitie` te
registreren via `POST /registratie/` en hem via GraphQL (met filter) terug te vragen.

---

## 8. Cross-domein relaties

### VoegOnderliggendGEToe

Wanneer een domein (bijv. np-loc) een child-relatie heeft naar een register-entiteit (bijv. Referentielijst), gebruikt de codegen `VoegOnderliggendGEToe()`:

```go
// In initNpLocMetaRegistry():
VoegOnderliggendGEToe("Referentielijst", OnderliggendGegevenselement{
    Rolnaam: "LandenlijstLanden", JSONRolnaam: "landenlijst_landen",
    Doeltype: "LandenlijstLand", Momentvoorkomen: Meervoudig,
})
```

### Wanneer wordt VoegOnderliggendGEToe wél/niet gegenereerd?

| Situatie | Resultaat |
|----------|-----------|
| Referentielijst zit in **dezelfde** codegen-run (bijv. `--domein register`) | Relatie staat **inline** in OnderliggendeGegevenselementen → **geen** VoegOnderliggendGEToe |
| Referentielijst zit **niet** in de codegen-run (bijv. `--domein np-loc`) | Relatie wordt via **VoegOnderliggendGEToe** toegevoegd |

Dit voorkomt duplicaten in de MetaRegistry.

### referentielijst_items relaties

Referentielijst-items relaties (subtype `referentielijst_items`) zijn altijd kinderen van Referentielijst. Ze koppelen een referentielijst-instantie (bijv. "Landenlijst") aan een doel-entiteit (bijv. Land). De structuur is:

```
Referentielijst (register)
  └── LandenlijstLand (register, items-relatie)
        └── LandenlijstLand_Data (geversioned inhoud)
```

De `DoelEntiteit` (Land) kan in een ander domein leven — dat is de cross-domein dependency.

---

## 9. Bestandsoverzicht

### Codegen bronbestanden (`cmd/codegen/`)

| Bestand | Rol |
|---------|-----|
| `main.go` | CLI entry point, flags, V3 laden, validatie, dispatch |
| `conventions.go` | Naamconventies, `DerivedType`, struct field helpers, `codegenOptions` |
| `gen_structs.go` | Genereert entiteit-structs en GE/relatie-structs |
| `gen_registry.go` | Genereert MetaRegistry entries (standalone/additive) |
| `gen_methods.go` | Genereert interface-methoden en GeefOnderliggendeGE's |
| `gen_input.go` | Genereert _Input structs |
| `gen_datatypes.go` | Genereert DatatypeRegistry entries |
| `gen_enum_registry.go` | Genereert EnumWaarden + EnumEditorLayouts |

### Export bronbestanden (`cmd/export_v3/`)

| Bestand | Rol |
|---------|-----|
| `main.go` | CLI entry point, roept `ExportMetaRegistryToV3()` aan |

### Model bronbestanden (niet-gegenereerd)

| Bestand | Rol |
|---------|-----|
| `metaregistry_plumbing.go` | Interfaces, TypeMeta struct, constanten, `VoegOnderliggendGEToe`, `init()` |
| `model_plumbing.go` | Representatie/FormeleRepresentatie interfaces, helpers |
| `v3_format.go` | V3 JSON type-definities (V3Model, V3Entiteit, etc.) |
| `v3_exporter.go` | `ExportMetaRegistryToV3()` — MetaRegistry → V3 JSON |
| `v3_importer.go` | V3 JSON parsing en validatie |

### Model bronbestanden (gegenereerd per domein)

Patroon: `{prefix}_{bestand}.go` — bijv. `register_metaregistry.go`, `np_loc_modellen_entiteiten.go`

Zie [§4 Gegenereerde bestanden](#gegenereerde-bestanden-7-per-domein) voor de lijst.

---

## 10. Veelgestelde vragen

### Domein hernoemd (bijv. kennis → kennis2): wat moet ik doen?

Als je een domein hernoemt in de UML-editor en opnieuw publiceert, genereert de devloop-rebuild nieuwe `<prefix2>_*.go` bestanden. De **oude** `<prefix>_*.go` bestanden blijven echter staan en veroorzaken een buildconflict (dubbele declaraties). Bij een mislukte rebuild worden de nieuwe bestanden teruggerold, maar de plumbing verwijst dan naar de nieuwe inits.

**Handmatige herstelstappen:**

1. Verwijder de oude prefixed Go-bestanden uit `model/`:
   ```bash
   rm model/<oude_prefix>_*.go
   ```
2. Verwijder ook de init-aanroepen voor het oude domein uit `model/metaregistry_plumbing.go`
   (en verwijder evt. init-aanroepen voor het nieuwe domein als die al ingevoegd werden).
3. Draai codegen handmatig:
   ```bash
   go run ./cmd/codegen --input _devloop_model.json --output model --domein <nieuw_domein> --prefix <nieuwe_prefix> --mode additive
   ```
4. Controleer met `go build ./...`.

### Receiver-letter conflicteert met time-parameter ('t')

Als een struct-naam begint met de letter **T** (bijv. `Trefwoord`), gebruikt de codegen `t` als receiver-variabele. Dat conflicteert met de parameter `t *time.Time` in `SetOpvoer` en `SetAfvoer`.

**Fix (geïmplementeerd):** `cmd/codegen/gen_methods.go` detecteert dit geval en gebruikt `ts` als parameternaam wanneer `rv == "t"`:
```go
func (t *Trefwoord) SetOpvoer(ts *time.Time) { t.Opvoer = ts }
func (t *Trefwoord) SetAfvoer(ts *time.Time) { t.Afvoer = ts }
```

### Validatie faalt op entiteiten uit andere domeinen ('meervoud leeg')

De validator controleert standaard *alle* entiteiten in de volledige multi-domein V3 JSON, ook die van andere domeinen. Als een ander domein entiteiten heeft met een lege `meervoud`-waarde, faalt de validatie — ook al generate je dat domein niet.

**Fix (geïmplementeerd):** `validateV3Model` accepteert nu een `domeinFilter`-parameter. Entiteiten met een ander domein worden bij validatie overgeslagen.

### Waarom additive mode en niet standalone?

Standalone overschrijft de hele MetaRegistry. Met meerdere domeinen (register + np-loc) wil je dat elk domein *toevoegt* aan de bestaande registry, niet vervangt. Additive mode genereert named init-functies die je centraal aanroept in de juiste volgorde.

### Waarom staat de init-volgorde in metaregistry_plumbing.go?

Go garandeert dat `var`-declaraties (MetaRegistry, DatatypeRegistry) klaar zijn vóór `init()`. Maar de *onderlinge* volgorde van init-functies tussen bestanden is niet gegarandeerd. Daarom roepen we ze expliciet aan vanuit één `init()` in `metaregistry_plumbing.go` — register eerst, dan de rest.

> **Sinds april 2026:** de `init()` in `metaregistry_plumbing.go` bevat zelf geen hardcoded domein-calls meer. Alle calls worden automatisch toegevoegd door `ensureInitRegistration()` als onderdeel van elke codegen-run in additive mode. Dit is gevalideerd via de [greenfield test](#11-greenfield-test--domeinonafhankelijkheid-bewezen).

### Wat als de roundtrip niet identiek is?

1. Controleer de V3 export: `go run ./cmd/export_v3 --domein X | python -m json.tool`
2. Controleer op duplicaten: zoek naar dubbele relaties met dezelfde naam
3. Vergelijk met `Compare-Object`:
   ```powershell
   Compare-Object (Get-Content model\file.go) (Get-Content _tmp\file.go)
   ```
4. Alle verschillen moeten verklaarbaar zijn — ofwel een bug in codegen/exporter, ofwel een handmatige wijziging die niet in het V3 model staat.

### Hoe voeg ik een veld toe aan een bestaand GE?

1. Voeg het veld toe in het V3 model (JSON of editor)
2. Genereer opnieuw met codegen
3. De struct krijgt automatisch het nieuwe veld, inclusief tags

### Welke veldnamen zijn gereserveerd?

De codegen genereert automatisch plumbing-velden in `_Data` structs. De volgende veldnamen zijn **gereserveerd** en mogen niet als inhoudsveld worden gebruikt:

| Veldnaam   | Type       | Reden                                            |
|------------|------------|--------------------------------------------------|
| `versie`   | `int64`    | Autoincrement PK voor data-versioning            |
| `rel_id`   | `int`      | FK naar parent hub                               |
| `opvoer`   | `*time.Time` | Formele tijd: opvoer                           |
| `afvoer`   | `*time.Time` | Formele tijd: afvoer                           |

Als een inhoudsveld dezelfde naam heeft als een systeemveld, wordt het **automatisch overgeslagen** met een waarschuwing (`⚠ veld "versie" in ... overgeslagen: conflicteert met systeemveld`). Hernoem het veld in de V3 JSON, bijvoorbeeld `versie` → `definitie_versie`.

### Unieke Veldnaam-afleiding voor GE hubs

Sinds juni 2026 detecteert de codegen automatisch wanneer twee GE-types (uit verschillende entiteiten) dezelfde korte Veldnaam zouden krijgen (bijv. "Meta" bij zowel FormulierDefinitie als WeergaveDefinitie). In dat geval wordt de volledige typenaam in lowercase gebruikt:

- `FormulierDefinitie_Meta` → Veldnaam `formulierdefinitie_meta` (i.p.v. `meta`)
- `WeergaveDefinitie_Meta` → Veldnaam `weergavedefinitie_meta`

GE-types zonder naamconflict behouden de korte Veldnaam (bijv. `layout`, `tabelconfig`).

### Custom datatypes

Domeinen kunnen eigen datatypes definiëren in de `datatypes`-array van de V3 JSON:

```json
{
  "naam": "Versie",
  "description": "Versienummer in formaat m.n.o.p (o en p optioneel).",
  "basistype": "string",
  "format": "versie",
  "validatie": { "pattern": "^\\d+\\.\\d+(\\.\\d+)?(\\.\\d+)?$" }
}
```

In gegenereerde structs krijgt het veld een `schema:"datatype:Versie"` tag. De frontend kan het format en de validatie uit de schema-API lezen.

### Hoe werkt de PowerShell BOM-workaround?

PowerShell 5.1 schrijft standaard UTF-16 LE BOM bij `>` redirect. Go's JSON parser herkent dat niet. Gebruik `[System.IO.File]::WriteAllText()` met `UTF8Encoding($false)` voor BOM-loze output.

### Replay-bestandsconventies

Replay files (`replay files/*.json`) bevatten registraties die via `POST /registratie/` worden ingeladen. Conventies:

1. **Hub-veldnamen gebruiken, niet `_data`-veldnamen.** Bij een eerste opvoer bestaat de hub nog niet; de registratielogica maakt automatisch zowel een hub- als een data-record aan. Gebruik dus `weergavedefinitie_meta` (niet `weergavedefinitie_meta_data`), `tabelconfig` (niet `weergavedefinitie_tabelconfig_data`), etc. De `_data`-veldnaam is alleen nodig bij low-level wijzigingen op een bestaand data-record.
2. **IDs beginnen bij 1** voor een verse database. Gebruik geen willekeurig hoge nummers (bijv. 9000+).
3. **Datum en tijdstip:** gebruik de actuele datum als aanvangsdatum voor standaard-definities. `exported_at` en `tijdstip` in ISO 8601.
4. **definitie_versie** invullen als het veld bestaat (bijv. `"0.1"`).
5. **Eén registratie per entitet-instantie:** elke entry in `entries[]` bevat de volledige set wijzigingen voor één entiteit (opvoer entiteit + GE hubs + aanvang).
6. **Adres -> Gemeente referentielijst:** in replaybestanden die op het nieuwe NP/Loc-adresmodel mikken, gebruik `adres.gemeente_id` (CBS-gemeentecode) als referentielink. `adres.plaats` geldt dan als legacy veld voor oudere modelversies.
7. **Synthetische schaalbestanden:** voor testdata met veel records (bijv. 50 NP's) gebruik hetzelfde patroon: per NP één registratie voor NP, één voor Locatie en één voor de woonadres-link, met 11-proef geldige synthetische BSN's.
8. **Batch-splitsing voor scenario-tests:** gebruik meerdere replaybestanden met aansluitende ID-ranges om stapsgewijs te seeden, bijvoorbeeld:
  - `registraties-replay-synth-50x-np-locatie-woonadres ID=1 tm 50.json`
  - `registraties-replay-synth-50x-np-locatie-woonadres ID=51 tm 100.json`
  - `registraties-replay-synth-50x-locatie-adres ID=101 tm 150.json` (alleen locaties/adressen, geen bereikbaarheid-links)

---

## 11. Greenfield test — domeinonafhankelijkheid bewezen

**Datum:** 7 april 2026  
**Status:** Geslaagd ✓

### Doel

Bewijzen dat de applicatie **volledig domeinonafhankelijk** is: je kunt alle prefixed domeinbestanden verwijderen, codegen draaien voor een willekeurig nieuw domein, en het systeem functioneert volledig — zonder enige handmatige aanpassing aan framework-code.

Dit is een fundamentele eigenschap van de architectuur: het framework (handlers, routes, schema-API, registratie-logica, frontend) is 100% meta-driven en heeft geen compile-time kennis van specifieke domeintypes nodig.

### Testopzet

#### Uitgangssituatie
Vier actieve domeinen met in totaal 30 prefixed bestanden:

| Prefix | Domein | Bestanden | Aard |
|--------|--------|-----------|------|
| `abuvwxy_` | abuvwxy | 7 | Test-/referentiemodel (A, B, Rel_A_B, etc.) |
| `register_` | register | 7 | Functioneel basisdomein (Referentielijst, Land, etc.) |
| `np_loc_` | np-loc | 8 | Nederlands locatiedomein |
| `cg_` | CG | 8 | CG Portfolio domein |

#### Gebruikte model
CG Portfolio V3 JSON (`docs/ontwerpgedachten/CG PF/Portfolio.v3.json`) — een eenvoudig maar representatief model:
- **5 entiteiten**: Initiatief, Organisatie, Persoon, Gemeente, Domein
- **9 gegevenselementen**: Planning, Product, Bijdrage, Naam×2, Contactgegevens×2, GemeenteGegevens, DomeinGegevens
- **5 enums**: OrganisatieType, Producttype, Fase, Schaal, Bijdragetype
- **5 datatypes**: Datum, URL, Email, Git_adres, Telefoonnummer
- **Geen relaties** — puur GE-gebaseerd model
- **Materiële entiteiten**: Initiatief, Organisatie, Persoon (met Aanvang/Einde)

### Stappen

#### Stap 1: Backup originele situatie
```bash
mkdir -p /tmp/greenfield_backup
tar czf /tmp/greenfield_backup/model.tar.gz model/
tar czf /tmp/greenfield_backup/baseline_model.tar.gz _baseline/model/
tar czf /tmp/greenfield_backup/routes.tar.gz routes/
```

#### Stap 2: Verwijder alle 30 prefixed files
```bash
rm model/abuvwxy_*.go model/cg_*.go model/np_loc_*.go model/register_*.go
rm _baseline/model/abuvwxy_*.go _baseline/model/cg_*.go _baseline/model/np_loc_*.go _baseline/model/register_*.go
```

#### Stap 3: Strip init() in metaregistry_plumbing.go
Alle domein-specifieke init-calls verwijderd uit `init()` in zowel `model/metaregistry_plumbing.go` als `_baseline/model/metaregistry_plumbing.go`:

```go
func init() {
    // Domein-specifieke init calls worden door codegen automatisch toegevoegd
    // via ensureInitRegistration(). Hier staat bewust niets hardcoded.
    propageerDomeinNaarOnderliggende()
}
```

#### Stap 4: Build met nul domeinen
```bash
go build -o /dev/null .
# Resultaat: COMPILEERT SUCCESVOL met 0 domeintypes
```

Dit bewees dat het framework géén compile-time afhankelijkheden heeft op domeincode.

#### Stap 5: Codegen CG-only
```bash
go run ./cmd/codegen \
  -input "docs/ontwerpgedachten/CG PF/Portfolio.v3.json" \
  -output model/ \
  -prefix cg \
  -domein portfolio \
  -mode additive
```

Resultaat:
- 8 bestanden gegenereerd (`cg_modellen_entiteiten.go`, `cg_metaregistry.go`, etc.)
- `ensureInitRegistration()` voegde automatisch de init-calls toe in `metaregistry_plumbing.go`

#### Stap 6: Build en start server
```bash
go build -o /dev/null .        # BUILD OK
DEVLOOP=true go run .          # Server start zonder panics
```

#### Stap 7: Verificatie

**Routes:** 153 routes dynamisch geregistreerd, inclusief:
- `/initiatieven`, `/organisaties`, `/personen`, `/gemeentes`, `/domeinen`
- `/full/initiatieven`, `/full/organisaties`, etc.
- `/initiatief_aanvang`, `/initiatief_einde`, `/bijdragen`, `/planningen`, `/producten`
- Alle standaard framework-routes (`/registraties`, `/wijzigingen`, `/api/schema/*`, etc.)

**Schema API** (`GET /api/schema/model/code`):
```
Totaal types: 35
Domeinen: ['portfolio']
Entiteiten (5): ['Domein', 'Gemeente', 'Initiatief', 'Organisatie', 'Persoon']
```

**Entiteitstructuur correct**:
```
Initiatief: 5 onderliggende
  - Initiatief_Planning (enkelvoudig) json=planningen
  - Initiatief_Product (enkelvoudig) json=producten
  - Initiatief_Bijdrage (meervoudig) json=bijdragen
  - Initiatief_Aanvang (enkelvoudig) json=aanvang
  - Initiatief_Einde (enkelvoudig) json=einde
Organisatie: 4 onderliggende
  - Organisatie_Naam (enkelvoudig) json=namen
  - Organisatie_Contactgegevens (enkelvoudig) json=contactgegevens
  - Organisatie_Aanvang (enkelvoudig) json=aanvang
  - Organisatie_Einde (enkelvoudig) json=einde
Persoon: 4 onderliggende
  - Persoon_Naam (enkelvoudig) json=namen
  - Persoon_Contactgegevens (enkelvoudig) json=contactgegevens
  - Persoon_Aanvang (enkelvoudig) json=aanvang
  - Persoon_Einde (enkelvoudig) json=einde
Gemeente: 1 onderliggende
  - GemeenteGegevens (enkelvoudig) json=gemeentegegevens
Domein: 1 onderliggende
  - DomeinGegevens (enkelvoudig) json=domeingegevens
```

**Full-entity endpoint**:
```bash
curl -s http://localhost:8082/full/initiatieven
# {"has_more":false,"initiatieven":[],"page":1,"size":20}
```
Lege lijst (geen data in DB), maar correcte response-structuur.

#### Stap 8: Herstel
```bash
tar xzf /tmp/greenfield_backup/model.tar.gz
tar xzf /tmp/greenfield_backup/baseline_model.tar.gz
go build -o /dev/null .   # BUILD OK — alle 30 files weer terug
```

### Gevonden en permanent gefixt

Tijdens de test werden twee hardcoded afhankelijkheden op domeincode blootgelegd en permanent opgelost:

#### 1. `routes/addroutes_helper.go` — hardcoded `model.Referentielijst`

**Was:**
```go
router.GET("/referentielijsten", handlers.MakeGetEntitiesHandler[model.Referentielijst]("Referentielijsten"))
```

**Werd:**
```go
refMeta, hasRef := model.MetaRegistry.GetTypeMeta("Referentielijst")
if !hasRef {
    return // geen referentielijsten in dit model
}
router.GET("/referentielijsten", handlers.MakeGetEntitiesByMetaHandler(refMeta))
```

Nu wordt de route alleen geregistreerd als het type `Referentielijst` in de MetaRegistry bestaat. Modellen zonder referentielijsten werken probleemloos.

#### 2. `model/REST request models.go` — dode code met ABUVWXY-types

De functies `AsA()`, `AsB()` en structs `OpvoerAfvoerA`, `OpvoerAfvoerB` bevatten hardcoded type-switches op `*A`, `*A_U`, `*B_X`, etc. Deze functies werden nergens meer gebruikt in v06 (de nieuwe generieke registratie-aanpak maakt ze overbodig) maar veroorzaakten compile-errors zonder het ABUVWXY-domein.

**Oplossing:** Verwijderd uit zowel `model/REST request models.go` als `_baseline/model/REST request models.go`.

### Samenvatting resultaten

| Aspect | Resultaat |
|--------|-----------|
| Build met 0 domeinen | ✓ Compileert zonder errors |
| Codegen CG-only (via CLI) | ✓ 8 bestanden gegenereerd |
| `ensureInitRegistration()` | ✓ Init-calls automatisch toegevoegd |
| Server start | ✓ 0 panics, 153 routes |
| Schema API | ✓ 35 types, 5 entiteiten, correct domein |
| Entity structure | ✓ Alle GEs, Aanvang/Einde correct genest |
| Full-entity endpoint | ✓ Correcte JSON-structuur |
| Referentielijsten afwezig | ✓ Geen crash, route wordt overgeslagen |
| Herstel naar origineel | ✓ Build OK met alle 30 bestanden |

### Conclusie

De applicatie is **volledig domeinonafhankelijk**. Je kunt:

1. Alle prefixed bestanden verwijderen
2. Codegen draaien voor een willekeurig V3 model
3. De server starten — alles werkt

Er is geen handmatige aanpassing nodig aan framework-code, routes, handlers, of de schema-API. Het enige dat nodig is, is een V3 JSON-model en één codegen-commando.

Dit bevestigt het ontwerpprincipe: **de MetaRegistry is de single source of truth**, en alle runtime-gedrag wordt daar dynamisch uit afgeleid.

### Aandachtspunt

De codegen genereert soms ongebruikte imports (`time`, `github.com/uptrace/bun`) in bestanden waar de betreffende types niet voorkomen. Dit is onschuldig maar vereist een `goimports`-stap na codegen. Overweeg `goimports` als automatische naverwerking in de codegen te integreren.

---

## 12. Een backend met alleen bepaalde domeinen bouwen

**Script:** `scripts/bouw-domeinen.ps1` (sinds 15-10-2026).

### Waarom zo, en niet met een instelling

Een domein *is* gegenereerde code: de zeven bestanden `model/<prefix>_*.go` en drie
`init…Registry()`-aanroepen in `model/metaregistry_plumbing.go`. Alles in de API (routes, tabellen,
GraphQL, OpenAPI, schema-API) leest de MetaRegistry; wat daar niet in staat, bestaat voor de API
niet. Een compacter register maak je dus door domeinen **weg te laten bij het bouwen**. Een
runtime-filter (`ENABLED_DOMAINS`) is bewust afgewezen: dat wordt een tweede waarheid naast het model
(besluit in het pf-plan, `docs/plans/2026-09-21 Opdracht tweede instantie pf…`). Dat het framework
zonder een bepaald domein werkt, bewijst §11.

### Wat het script doet

Het script raakt je werkmap niet aan. Het werkt in een tijdelijke kopie (standaard
`%TEMP%\omnium-bouw-domeinen`):

1. kopieert de Go-pakketten van de module (`go list ./...`, zonder tests) naar `…\bron`;
2. verwijdert daar de bestanden van de domeinen die je níet kiest;
3. haalt hun `init…Registry()`-aanroepen uit `metaregistry_plumbing.go` (de namen leest het uit
   de verwijderde bestanden zelf);
4. **controleert de afhankelijkheden**: wijst een gekozen domein naar een type uit een
   weggelaten domein (relatie-doel, onderliggend element, `VoegOnderliggendGEToe`), dan stopt het
   met de vindplaats. Met `-Forceer` bouwt het toch; die relatie werkt dan niet;
5. bouwt `bitemp-go-api.exe` en desgewenst een Docker-image met `Dockerfile.api`.

### Gebruik

```powershell
# Welke domeinen zijn er?
.\scripts\bouw-domeinen.ps1 -Lijst

# Alleen controleren (kopie + afhankelijkheden), niets bouwen
.\scripts\bouw-domeinen.ps1 -Domeinen "register,CG,gegevenstypen,configuratie,ide-bestanden,beheer" -AlleenControle

# Bouwen, en een image maken
.\scripts\bouw-domeinen.ps1 -Domeinen "register,CG,gegevenstypen,configuratie,ide-bestanden,beheer,meldingen,np-loc,org-geo" -Image omnium-api:pf

# Met de /admin/*-routes (rebuild, droptables, diff)
.\scripts\bouw-domeinen.ps1 -Domeinen "…" -Devtools
```

Domeinen mag je als domeinnaam (`np-loc`, `CG`) of als bestandsprefix (`np_loc`, `cg`) geven.
Verplicht zijn `register` (kern-entiteiten) en `ide-bestanden` (handgeschreven handlers gebruiken
zijn types: `bestanden_handlers.go`, `rebuild_handler.go`, `schema_model_handler.go`). Alle andere
domeinen, ook `CG`, kun je weglaten. Wat geen domein is (plumbing, studio, de tabellen voor
gebruikers en meldingen, `extra`-datatypes), gaat altijd mee.

### Wat je moet weten

- **Afhankelijkheden tussen domeinen** (gemeten 15-10-2026, elk domein één keer weggelaten):

  | Van | Naar | Via |
  |---|---|---|
  | `register` | `np-loc` | `AdellijkeTitelsTitel` → entiteit `AdellijkeTitel` (staat in np-loc) |
  | `np-loc` | `CG` | veld `Adres.gemeente` (`$ref: Gemeente`) |
  | `np-loc` | `org-geo` | `Gebiedsligging` → `Gemeentedeel` |
  | `org-geo` | `CG` | relaties naar `Organisatie` en `Gemeente` |
  | `meldingen` | `beheer` | melder/behandelaar → `Gebruiker` |

  Het script meldt deze; met `-Forceer` bouwt het toch, en die relatie of dat `$ref`-veld werkt
  dan niet. Wil je zonder np-loc, dan werkt de referentielijst *Adellijke titels* niet, tenzij
  `AdellijkeTitel` in het model naar register verhuist (modelbesluit).
- **Inloggen** (`AUTH_ENABLED=true`) vraagt het domein `beheer` (Gebruiker); **meldingen**
  (`/api/meldingen`) het domein `meldingen`.
- **Gebruik een eigen database.** De API maakt alleen tabellen voor de gekozen domeinen. Bestaande
  gegevens van weggelaten domeinen blijven in de database staan, maar zijn via deze API niet
  bereikbaar.
- **Tests:** het script bouwt zonder tests. Een deel van de unit-tests gaat uit van het testmodel
  `abuvwxy` en van np-loc; die compileren in zo'n kopie niet. Dat zegt niets over de API zelf.
- **Getest (15-10-2026):** zonder `abuvwxy`, `np-loc`, `org-geo`, `financieel` en `kennis2` start
  de API op een lege database, maakt de tabellen, verwerkt een registratie op Land, en `/full`,
  GraphQL en de schema-API antwoorden; np-loc-routes geven 404. Image-bouw: 62 MB.
