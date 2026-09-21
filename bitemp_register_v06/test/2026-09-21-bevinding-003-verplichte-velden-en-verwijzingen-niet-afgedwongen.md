# Testbevinding 003 — verplichte velden en verwijzingen worden niet afgedwongen

| Veld | Waarde |
|---|---|
| Datum | 2026-09-21 |
| Gevonden in | handmatige test via `inhoud.html` op de regressiedatabase (Mark): `adres.land` is volgens het model verplicht, maar nergens in de testdata ingevuld |
| Ernst | Middel tot hoog: het register accepteert en bewaart gegevens die volgens het eigen model ongeldig zijn, zonder melding |
| Status | **Open, voor later** (na de merge van `chore/be-code-review` naar `main`) |
| Gemeld door | Mark; analyse Claude-sessie (BE-review, 2026-09-21) |

## Waarneming

Alle seeds en scenario's voeren adressen op zónder `land`. De API antwoordt `201`. In de database:

```
locatie_adres_data.land = 0   voor alle 63 records   (bitemp_regressie_np_loc)
```

Er is dus geen "leeg" opgeslagen maar de waarde **0**: een verwijzing naar land 0, dat niet bestaat.

## Analyse

Er ontbreken twee controles, die elkaar versterken.

1. **Verplicht wordt nergens gecontroleerd.**
   - In het model betekent verplicht: een niet-pointer Go-type (`Land int`, `Straatnaam string`).
     Optioneel is een pointer met `omitempty` (`Postcode *string`). Het V3-model kent het begrip
     wel (`Verplicht bool` in `model/v3_format.go`, afgeleid van "geen pointer-type"), en de
     frontend toont het.
   - De validatie (`model/validation_walker.go`) kent alleen `datatype:` (BSN, NLPostcode) en sinds
     2026-09-16 `enum=`. Er is geen controle op aanwezigheid.
   - De databasekolommen zijn allemaal nullable; er zijn geen `NOT NULL`-constraints.
   - Gevolg: een weggelaten verplicht veld wordt bij het inlezen van de JSON stilzwijgend de
     **nulwaarde** van het Go-type: `0`, `""` of `false`. Die wordt opgeslagen alsof hij is
     aangeleverd. Na het inlezen is "niet meegegeven" niet meer te onderscheiden van "0 meegegeven".
2. **Verwijzingen worden niet gecontroleerd.** `land` heeft de tag `schema:"ref:LandenlijstLand"`
   en `gemeente` heeft `ref:Gemeente`, maar de validatie doet niets met `ref:`. Een verwijzing naar
   een niet-bestaand of afgevoerd item wordt geaccepteerd. Er zijn ook geen foreign keys op deze
   kolommen. Daardoor valt de 0 uit punt 1 niet alsnog door de mand.

Dit raakt alle domeinen, niet alleen np-loc: de oorzaak zit in de generieke validatie en in de
conventie van de codegenerator.

## Reproductie

```
POST /registratie/   opvoer locatie {id: 900} + adres {locatie_id: 900, straatnaam: "X", huisnummer: "1"}
→ 201; daarna GET /full/locaties/900 → adres.data.land = 0, adres.data.gemeente = 0
```

Niet apart uitgevoerd: dit volgt rechtstreeks uit de waarneming (alle seeds doen precies dit voor
`land`, met `201` en `land = 0` als resultaat). Dat `gemeente` zich hetzelfde gedraagt is een afleiding.

## Voorgestelde oplossing (voor later)

1. **Aanwezigheid controleren op de ruwe JSON, vóór het inlezen in structs.** Alleen daar is
   "ontbreekt" nog te onderscheiden van "nulwaarde". De normalizer werkt al op de ruwe wijziging;
   dat is de natuurlijke plek. Bron van waarheid: `Verplicht` uit de MetaRegistry / het V3-model,
   niet de Go-types zelf.
2. **Melden als `422 application/problem+json`**, in dezelfde vorm als de bestaande datatype- en
   enumfouten (code bv. `verplicht`), met het veldpad. Respecteer de bestaande strengheid
   (`strict` blokkeert, `lenient` rapporteert).
3. **Correctie is geen volledige opvoer.** Bij een correctie of merge patch (`PATCH /full/...`)
   mag een verplicht veld ontbreken als het al een waarde heeft: controleer dan het resultaat na
   samenvoegen, niet de aangeleverde deelverzameling. Dit is het lastigste deel.
4. **Verwijzingen controleren:** bestaat het doel, en is het actief op het registratiemoment? Dit
   is een query per verwijzing; bundelen per type om N+1 te vermijden. Apart in te schakelen, want
   het kost leestijd bij elke registratie.
5. **Overwegen: `NOT NULL` in de database** voor verplichte kolommen van `_Data`-tabellen, als
   vangnet onder de applicatiecontrole. Let op bestaande data (zie hieronder) en op de
   migratieroute in `dbsetup`.

## Gevolgen bij invoeren

- **Bestaande seeds, replay-bestanden en scenario's worden ongeldig.** Vrijwel alle np-loc-adressen
  missen `land`; sc 07 en sc 31 voeren namen op met alleen `voorletters` en `achternaam`. Bij het
  invoeren moeten de testdata mee: óf aanvullen, óf het model versoepelen waar "verplicht" te
  streng blijkt. Dat laatste is een modelvraag: is `adres.land` echt verplicht, of heeft het een
  redelijke default (Nederland)?
- **Bestaande data** bevat nulwaarden waar verplichte velden ontbraken. Tel ze vóór een eventuele
  `NOT NULL`-migratie; een scan per tabel op `= 0` / `= ''` geeft een indicatie, maar kan een
  echte 0 niet onderscheiden van een ontbrekende waarde.
- De regressiesuite krijgt er sc's bij: verplicht veld ontbreekt → 422 met veldpad; correctie
  zonder het veld → 200; verwijzing naar niet-bestaand item → 422.

## Modelkeuze (Mark, 2026-09-21)

Het np-loc-model is een benadering, geen realistisch adresmodel. Adressen zijn een wereld op zich:
in de lokale BRP ligt een adres standaard in de eigen gemeente en dus in Nederland; het
handelsregistermodel (dat leent van BRP, BAG en RNI) kent een binnenlands en een buitenlands adres
met elk een eigen formaat; een partij als Amazon heeft weer een veel complexer formaat.

Besluit voor nu:

- **`adres.land` wordt optioneel, en "geen land" betekent Nederland.** Een default NL is logisch,
  maar het veld hoeft niet verplicht te zijn. Dat is in veel gevallen ook inhoudelijk juist.
  Gevolg: `land` hoort in het model een optioneel veld te zijn (pointer, `omitempty`), zodat een
  weggelaten land als leeg wordt opgeslagen en niet als `0`.
- **Referentietabellen worden altijd als eerste geseed, daarna de rest.** Dat is de voorwaarde om
  verwijzingen (punt 4 van de oplossing) te kunnen controleren. De regressie-seed doet dit voor np-loc
  nu andersom (eerst NP/LOC, dan de adellijke titels) en de CBS-gemeenten zitten alleen in de
  load-seed; bij het invoeren van de verwijzingscontrole moet de volgorde van `defaultSeeds` mee.

De bevinding zelf blijft staan: voor velden die wél verplicht zijn controleert de API niets, en
verwijzingen worden niet gecontroleerd.

## Verwant

- `docs/REGRESSIETEST.md`, bevinding 3 (enumvalidatie): zelfde plek in de code, zelfde responsvorm.
- `test/2026-09-21-bevinding-002-…`: beide gaan over de vraag wat het register als waarheid
  vastlegt en teruggeeft.
