# Afgeleide relaties in de backend — ontwerp

Datum: 2026-10-11 · Branch `feat/afgeleide-relaties-backend` (worktree
`D:\Git\Bitemporal_2026_afgeleide_rel`) · Claude-sessie BACKEND-GEN, overdracht van M3-MOF.

Vervolg op `2026-10-10 UML Property en afgeleide relaties.md` §4 (de verkenning met
bestand:regel-verwijzingen staat daar). Dit document is het ontwerpdocument waar BACKLOG §9
"Afgeleide associaties / GE's / RELs" om vraagt, voor zover het om **relaties** gaat.

## 1. Besluiten

Mark, 10-10: een relatie kan afgeleid zijn (UML `isDerived`, "/" voor de naam). In het register
krijgt ze **geen tabel en geen schrijfroutes**; ze is **alleen leesbaar** en wordt berekend uit
haar afleidingsregel.

Mark, 11-10 (open vragen uit de overdracht):

| Vraag | Besluit |
|---|---|
| Volgorde | Eerst dit korte ontwerp, dan de **structuur** (V3, codegen, MetaRegistry, rondreis, schemadiff, schema-API). De **evaluator** (lezen) volgt als tweede commit op dezelfde branch. |
| Expressietaal | **Eigen CEL-subset**, gelijk aan `web/vite/src/shared/celEvaluator.js`, uitgebreid met navigatie. Geen `cel-go`. Eén gedeeld Go-pakket vervangt de twee bestaande Go-evaluators. |
| Berekening | **Live bij elk lezen**, op het peiltijdstip van het verzoek. Niets materialiseren en geen cache: niets opslaan betekent ook geen registratie en geen invalidatie. |

## 2. V3-contract

Op `V3Relatie` komen dezelfde namen als op `V3Veld` (de frontend schrijft ze al):

```json
{
  "naam": "Woonwijk",
  "meervoud": "woonwijk",
  "momentvoorkomen": "enkelvoudig",
  "doelEntiteit": "Gemeentedeel",
  "directioneel": true,
  "afgeleid": true,
  "afleidingsregelTaal": "cel",
  "afleidingsregel": "woonlocatie.gebiedsligging"
}
```

Plus **`geordend`** (bool, UML `isOrdered`), voor alle relaties. Dat veld ging tot nu toe verloren.
Bij een niet-afgeleide relatie staan `afgeleid`, `afleidingsregelTaal` en `afleidingsregel`
niet in het JSON (`omitempty`).

**Validatie** (`validateV3Model`), alleen bij `afgeleid: true`:
- `afleidingsregel` is verplicht en moet parsen. `afleidingsregelTaal` is leeg of `"cel"`; leeg betekent `"cel"`.
- `velden` en `afgeleideVelden` zijn verboden: een afgeleide relatie heeft geen eigen gegevens.
- `relatieSubtype` is verboden (een referentielijst-relatie kan niet afgeleid zijn).
- `doelEntiteit` is verplicht en moet bestaan.
- `isMaterieel` wordt genegeerd. De materiële tijd volgt uit de relaties waarlangs genavigeerd wordt.

## 3. Navigatiesyntaxis

De taal is de bestaande subset (literals, paden, `+ == != < <= > >= && || !`, `?:`,
`filter/map/exists/all/size`, `[n]`, `string()/size()/int()/leeftijd()`). Daar komen drie
afspraken bij.

### 3.1 De context is de bronentiteit

De regel wordt geëvalueerd op één exemplaar van de entiteit waar de relatie onder hangt, de
**bron**. In de context staan dezelfde namen als bij afgeleide velden op entiteitniveau
(`bouwCelContext`):

- **klassenaam** van een GE of relatie (bv. `Woonlocatie`, `Naam`): het eerste actieve
  voorkomen, plat geslagen (de hub- en `_Data`-velden samen);
- **rolnaam** (bv. `woonlocatie`, `namen`): de lijst van actieve voorkomens;
- **`self`**: de bron zelf. Nieuw; handig voor een directe `self.id`.

Namen worden hoofdletterongevoelig opgezocht, maar een exacte treffer gaat voor (zoals nu).

### 3.2 Een relatie-voorkomen kijkt door naar zijn doel ("doorkijk")

Een relatie-voorkomen in de context toont eerst zijn eigen velden (`rel_id`, `locatie_id`, de
`_Data`-velden). Een naam die het voorkomen zelf niet kent, wordt opgezocht in de
**doelentiteit**, met dezelfde namen als in §3.1. Zo werkt een pad door een keten van relaties
heen, zoals de rolpaden die Toegangsspraak en de modelboom al gebruiken
(`NatuurlijkPersoon.woonlocatie.gebiedsligging.wijkaanduiding.wijk`, zie
`docs/demo-model-np-loc-org-geo.md`).

De doelentiteit wordt **op hetzelfde peiltijdstip** gelezen als de bron. Een eigen veld van het
relatie-voorkomen gaat voor bij een gelijke naam.

### 3.3 Een pad over een lijst verzamelt (impliciete `collect`)

Nu geeft `lijst.veld` `null`. Voortaan betekent het: pas `.veld` toe op elk element en zet de
uitkomsten plat in één lijst, zonder `null`. Dat is hoe OCL navigeert, de taal waarin UML
afleidingsregels van oudsher schrijft. Zo werkt `ouders.ouders` (grootouders) zonder
`map`-in-`map`. `lijst[n]`, `size()`, `filter`, `map`, `exists` en `all` blijven zoals ze zijn.

Bestaande expressies veranderen niet van betekenis: die kregen hier `null` (een fout) en
schrijven een lijst nu altijd met `filter` of `map`.

### 3.4 Wat de regel oplevert

De uitkomst moet naar exemplaren van `doelEntiteit` wijzen. Toegestaan zijn:

| Uitkomst | Betekent |
|---|---|
| een relatie-voorkomen waarvan het doel `doelEntiteit` is | dat doel |
| een doorgekeken entiteit van type `doelEntiteit` (bv. `self`, of een `Woonlocatie[0]`-doel) | die entiteit |
| een geheel getal | het id van een `doelEntiteit` |
| `null` of een lege lijst | geen doel |
| een lijst van het bovenstaande, ook genest | alle doelen, plat |

Dubbele id's worden weggelaten (UML `isUnique` is standaard waar). De volgorde is die van de
navigatie, en voorkomens staan op `rel_id`, dus de volgorde is deterministisch. Bij
`momentvoorkomen: "enkelvoudig"` telt alleen het eerste doel; komen er meer uit, dan logt de
backend een waarschuwing. Een uitkomst van een ander type (een string, of een entiteit van een
ander type) is een **evaluatiefout**: de relatie blijft leeg en de backend logt de fout.

### 3.5 Voorbeelden (demo-model np-loc)

| Afgeleide relatie (op) | Doel | Regel |
|---|---|---|
| `/woonwijk` (NatuurlijkPersoon) | Gemeentedeel | `woonlocatie.gebiedsligging` |
| `/woongemeente` (NatuurlijkPersoon) | Gemeente | `woonlocatie.gebiedsligging.gemeente` |
| `/bereikbare wijken` (NatuurlijkPersoon, meervoudig) | Gemeentedeel | `bereikbaarheden.gebiedsligging` |
| `/grootouders` (Persoon, hypothetisch) | Persoon | `ouders.ouders` |
| `/hoofdwijk` (hypothetisch veld `soort`) | Gemeentedeel | `bereikbaarheden.filter(b, b.soort == 'hoofdverblijf').gebiedsligging` |

De rolnamen zijn de JSON-rolnamen uit het model: `woonlocatie` en `bereikbaarheden`
(NatuurlijkPersoon), `gebiedsligging` (Locatie) en `gemeente` (Gemeentedeel → relatie
`Gemeentedeelgemeente`).

### 3.6 Buiten deze stap

- **Inverse navigatie**, bv. "de kinderen van": alle Personen waarvan `ouders` naar mij wijst.
  Daarvoor moet je zoeken in plaats van navigeren (een query op `secondaire_id = mij`). Dat
  kan later, als functie, bijvoorbeeld `inverse('Persoon', 'ouders')`.
- Een afgeleide relatie als **stap in een andere regel** (`woonwijk.…`). De evaluator staat dat
  toe, met een diepte- en cyclusbewaking; zie §5.

## 4. Structuur: codegen en MetaRegistry (commit 1)

1. **`model/v3_format.go`**: `V3Relatie` krijgt `Afgeleid`, `AfleidingsregelTaal`, `Afleidingsregel` en `Geordend`.
2. **Codegen** (`cmd/codegen/main.go`): direct na het domeinfilter worden de afgeleide relaties
   uit `ent.Relaties` gehaald en apart meegegeven in `codegenOptions.afgeleideRelaties`
   (`map[typenaam][]V3Relatie`). Voor alle bestaande generators bestaan ze dan niet. Geen
   struct, `_Data`, Input, methoden, hub- of data-entry of regel in
   `OnderliggendeGegevenselementen`; daarmee ook geen tabel, routes, GraphQL-mutatie of
   afvoer-cascade.
3. **MetaRegistry**: `TypeMeta.AfgeleideRelaties []AfgeleideRelatie`, geschreven door
   `writeEntiteitEntry` (zoals `writeAfgeleideVelden`). `AfgeleideRelatie` heeft: `Naam`,
   `Description`, `Domein`, `Meervoud`, `Rolnaam`, `JSONRolnaam` (dezelfde naamgeving als een
   gewone relatie), `DoelEntiteit`, `Momentvoorkomen`, `Directioneel`, `Geordend`,
   `NaamLabelHeen/Terug`, `BronKardinaliteit`, `DoelKardinaliteit`, `AfleidingsregelTaal`,
   `Afleidingsregel` en `Layout *EditorLayout` (voor de rondreis). Bewust **geen** vlag op
   `OnderliggendGegevenselement`; zie §4 van het vorige plan (~15 plekken).
   `Geordend` van een gewone relatie gaat naar `TypeMeta.Geordend` op de relatie-hub.
4. **Rondreis**: `ExportMetaRegistryToV3` zet `AfgeleideRelaties` terug als
   `V3Relatie{Afgeleid: true, …}` (met layout), en zet `Geordend` en `V3Veld.Afgeleid`
   terug. Anders verdwijnen ze via `/api/schema/model/code` en de rebuild.
5. **Schemadiff**: een afgeleide relatie erbij of eraf is een **metadata**-wijziging zonder
   DB-migratie. `afgeleid` van onwaar naar waar betekent dat de relatietabel verdwijnt
   (destructief); van waar naar onwaar komt er een tabel bij (additief). Een andere
   afleidingsregel is metadata. `naamgeving.AlleDerivedTypes` slaat afgeleide relaties over.
6. **Schema-API en OAS** (`viz_schema_handler.go`, `openapi_generator.go`): de relatie wordt
   gemeld met `afgeleid: true`, de regel en `readOnly`. Ze komt niet in request bodies.

`V3Veld.Afgeleid` (een afgeleid veld binnen een GE of relatie) blijft in deze stap een gewone
kolom. Alleen de vlag gaat nu de rondreis mee. Dat veld alleen-lezen maken is een aparte stap.

## 5. Lezen: de evaluator (commit 2)

**Pakket `celexpr`** (nieuw, naast `model`): tokenizer, parser en evaluator, één-op-één met
`celEvaluator.js` plus §3. Dit pakket vervangt `evalueerCELConcatenatie` en co.
(`handlers/full_handlers.go`) en de kopie in `dynql/query_resolvers.go`. De bestaande
afgeleide velden lopen dan via dezelfde evaluator. Dat is wel een gedragsverandering: de
huidige Go-versie splitst op `+` en kent geen `?:`. Daarom komt er een vergelijkingstest
met de bestaande voorbeelden uit `metamodel_v3.json`.

**Navigatie zonder N+1: evalueren in rondes.** Een doorkijk naar een doelentiteit die nog niet
geladen is, geeft in de evaluator een *mis* die onthouden wordt. De handler:

1. evalueert alle afgeleide relaties voor **alle** bronnen in de response;
2. laadt alle missers per doeltype in **één batch** (`IN (?)`, met `addOnderliggendeRelations`
   en `laadHubKinderenNaQuery`, op hetzelfde peiltijdstip);
3. herhaalt dit tot er geen missers meer zijn, met een maximum van 8 rondes (diepte en cyclus).

Evalueren is zuiver, dus herhalen kan geen kwaad. Het aantal queries is dan gelijk aan het
aantal hops, niet aan het aantal bronnen.

**Tijd.** Bron en doelen worden op hetzelfde formele peiltijdstip gelezen (`?t=` /
`peiltijdstip`), en het "eerste actieve voorkomen" is hetzelfde als bij afgeleide velden.
**Leesconsistentie** (BACKLOG §32, bevinding 002) wordt hier niet opgelost: de extra batches
lopen, net als de rest van `/full`, niet in één snapshot. Dat wordt opgelost zodra `/full` in
een `REPEATABLE READ`-transactie gaat lopen; de doelen-loader krijgt daarom de `bun.IDB` van
het verzoek mee en geen globale `DB`.

**Responsvorm** (`/full`, één en lijst): onder de `JSONRolnaam` een lijst, net als bij een
gewone relatie:

```json
"woonwijk": [ { "gemeentedeel_id": 7, "weergavenaam": "Stadsdeel West" } ]
```

De sleutel `<doelentiteit>_id` volgt de conventie van `SecondaireEntiteitIDKolom`, zodat de
frontend het voorkomen net zo kan tonen als een gewone relatie. `weergavenaam` wordt alleen
gevuld als het doel een weergaveveld heeft. De schema-API vertelt dat de relatie afgeleid is.

**GraphQL** (`dynql`): op het entiteittype een veld `<rolnaam>: [AfgeleideVerwijzing!]` met
`AfgeleideVerwijzing { id: Int!, weergavenaam: String }`. De volledige doelobjecten
(geneste selectie) kunnen later. (Gebouwd als *nullable* lijst, zie §8.)

**Lijst-endpoints** zonder `/full` berekenen niets; de doelen staan alleen in `/full` en
GraphQL.

## 6. Tests

- `model/v3_exporter_test.go`: rondreis van een afgeleide relatie en `geordend`.
- `cmd/codegen`: een model met een afgeleide relatie geeft geen hub-, `_Data`- of Input-type,
  wel `AfgeleideRelaties` op de entiteit.
- `schemadiff/diff_test.go`: de vier gevallen uit §4.5.
- `celexpr`: de tabel uit `CEL-evaluatie-js.md`, plus §3.2–3.4, plus pariteit met de
  frontend. Liefst dezelfde testgevallen in één JSON-bestand, gelezen door de Go-test én
  `celEvaluator.test.js`.
- `handlers/full_handlers_test.go` / `dynql/handler_test.go`: `/woonwijk` op np-loc, met het
  aantal queries per hop.
- `routes/addroutes_test.go`: geen routes voor een afgeleide relatie.

## 7. Frontend (M3-MOF)

- `geordend` meesturen naar V3 zodra `V3Relatie` het veld heeft (commit 1).
- `celEvaluator.js`: §3.3 (collect over lijsten) en `self`. De doorkijk (§3.2) kan in de Studio
  alleen met geladen doelen; voor een voorvertoning is het genoeg om de regel te parsen en
  het pad tegen het model te controleren (rolnamen, doeltype aan het eind).

## 8. Stand na commit 2 (gebouwd 11-10)

Wat er staat, en waar het van het ontwerp hierboven afwijkt of het preciseert:

- **`celexpr`** (taal, geen MetaRegistry): één-op-één met `celEvaluator.js` plus collect (§3.3).
  `Parse` is **strikt**: tekst na een volledige expressie is een fout; de frontend negeert die nu.
- **`afleiding`** (navigatie, geen database): `Entiteit`/`Voorkomen` als `celexpr.Object`,
  `Omgeving` met rondes en batch-laden, `BerekenAfgeleideRelaties`, en `Weergavenaam`/`AfgeleidVeld`
  voor de afgeleide velden. De entiteit-context leest zowel de `/full`-vorm (lijst, hub met `data`)
  als de platte GraphQL-vorm (enkelvoudig als object, data al samengevoegd).
- **De twee oude Go-evaluators zijn vervangen** (`handlers/full_handlers.go`,
  `dynql/query_resolvers.go`). Gevolg: afgeleide velden kennen in de backend nu ook `?:`, `==`,
  `filter` enz.; de NP-weergavenaam uit `metamodel_v3.json` (BRP-naamgebruik met geneste `?:`)
  wordt nu goed berekend, waar de oude evaluator op `+` splitste. Tekstvelden blijven tekst
  (`""` voor null), `leeftijd` op een int-veld blijft een `int`.
- **Lader** (`handlers.NieuweAfleidingLader`), sinds 13-10 **lui**: eerst alleen de kale
  entiteitrijen (formele-tijdfilter op het peilmoment), en per onderliggend element pas als een
  regel of weergaveveld het aanspreekt (`LaadVoorkomens`: de hubrijen plus hun `_Data`/`_Aanvang`/
  `_Einde`, gegroepeerd op `(entiteit, rel_id)`). De omgeving houdt naast ontbrekende entiteiten
  ook ontbrekende rollen bij en laadt beide per type (en rol) in één batch. Aanleiding: de droge
  test op het echte np-loc-model liet zien dat een volledige `/full`-lading per doel scenario 16
  (max 40 queries) liet falen. Gemeten (np-loc-seed, 5 personen, met peiltijdstip): 40 queries
  zonder afgeleide relaties, 43 mét drie (waarvan twee met doorkijk via Locatie → Adres); zonder
  peiltijdstip 79 → 47. `regressie_afgeleide_relaties_test.go` bewaakt dit relatief (≤ 8 extra,
  nulmeting op een tweede router). GraphQL `<rol>_doelen` laadt de doelen wél volledig
  (`handlers.LaadVolledigeEntiteiten`), want daar zijn de hele objecten gevraagd. De laadhelpers
  nemen een `context.Context` (een `*gin.Context` blijft werken).
- **Peilmoment zonder `?t=`/`peiltijdstip`**: `/full` filtert dan zelf niet op formele tijd (de
  response bevat ook beëindigde voorkomens). De afgeleide relaties gebruiken dan "nu" en laden
  de bron daarvoor opnieuw (één extra batch per hop-niveau). Met een peiltijdstip wordt de
  response als bron hergebruikt. GraphQL filtert altijd (actueelOfPeil) en hergebruikt altijd.
- **Uitkomst**: een id `0` (lege int-verwijzing, bv. een niet ingevulde `$ref`) is geen doel en
  geen fout. Een verkeerd type of een parsefout geeft een lege relatie en een logregel
  (`AFLEIDING: …`), nooit een 500.
- **GraphQL**: het veld is een *nullable* lijst. De full-resolvers (`full_<padnaam>`,
  `full_<padnaam>_list`) rekenen het per lijst in één keer uit en alleen als het veld gevraagd
  is; op andere plekken (gewone lijst, genest via een forward-relatie) is het `null`.
  Sinds 11-10 (branch `feat/afgeleid-graphql-doelen`) staat ernaast `<rolnaam>_doelen:
  [<Doeltype>]` met de volledige doelobjecten, in dezelfde platte vorm als `full_<padnaam>` en
  op hetzelfde peilmoment (de doelen die de omgeving voor de weergavenaam al laadde). Afgeleide
  relaties van zo'n doelobject zelf zijn `null`. Let op: de weergavenaam-verrijking van de
  relatie-voorkomens in een doelobject doet, net als bij `full_<padnaam>_list`, een query per
  object.
- **Codegen-validatie** parset de regel nu ook (`celexpr.Parse`).
- **Materiële tijd** telt bij de navigatie (nog) niet mee: "actief" is formeel actief, net als
  bij afgeleide velden. Een woonlocatie met een einde in het verleden telt dus nog mee. Open punt:
  een materieel peilmoment (`?m=`) voor afgeleide relaties en velden.

**Zelf-relatie — opgelost 23-10-2026** (`docs/CODEGEN.md` §7.3c: verwijskolom `doel_<entiteit>_id`, doeltype expliciet in `TypeMeta.DoelTypenaam`). Oorspronkelijke tekst: (doel = bron, bv. Persoon → Persoon voor `ouders.ouders`). Codegen
noemt de doelkolom `<doel>_id` en die valt dan samen met de eigen FK-kolom; zo'n relatie kan
het register nu niet opslaan. Een andere naam (bv. `doel_<doel>_id`) raakt alle plekken die het
doeltype uit de kolomnaam afleiden (`afleiding.DoelTypeVanRelatie`,
`handlers.doelEntiteitVanSecondaireKolom`, `dynql.vindDoelEntiteit`,
`model.doelEntiteitVanRelatie`, `entiteitTypeUitKolomnaam`, codegen/naamgeving); af te stemmen
samen met de syntaxis van inverse navigatie. De Studio waarschuwt al (M3-MOF).

**Pariteit met de frontend**: `testdata/cel-pariteit.json` (60 gevallen) is de gedeelde bron
voor `celexpr/celexpr_test.go` en (door M3-MOF) `web/vite/src/shared/celEvaluator.test.js`.
De huidige frontend haalt alle gevallen zonder `kenmerk`; de gevallen met `kenmerk: "collect"`
en `"strikt"` zijn het nieuwe gedrag.

**Tests**: `celexpr` (pariteit + NP-weergavenaam), `afleiding` (twee hops met batch-telling,
uitkomstregels, ontdubbelen, afgeleide velden), handlers/dynql (bestaande weergavenaam- en
leeftijd-gevallen via de nieuwe evaluator), en end-to-end
`regressie_afgeleide_relaties_test.go` (`-tags integration`: `/full` detail en lijst met
N+1-bewaking, doorkijk via Locatie.Adres, GraphQL). De volledige np-loc-regressie blijft groen.
Daarvoor is `regressie_declaratief_test.go` hersteld: `handlers.SeedAdminGebruiker` heet sinds
api 0.10.0 `gebruikers.SeedAdmin` (de integratietests compileerden op main niet meer).

**Regressie-harness herhaalbaar** (11-10): `regressie_np_loc_test.go` gooit bij de reset ook
`gebruiker_inlog` weg. Die valt buiten `dbsetup.DeleteTables`; na een run met scenario 17
(seed_admin) brak de FK bij de volgende `CreateTables`.
