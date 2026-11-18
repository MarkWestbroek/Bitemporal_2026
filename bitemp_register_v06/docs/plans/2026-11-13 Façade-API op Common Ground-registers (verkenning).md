# Façade-API op Common Ground-registers — verkenning

> Datum: 13-11-2026 · Status: **verkenning**, nog niets gebouwd · Sessie: BACKEND (Claude), op vraag van Mark
> Bronnen: de code op main (5934b118), het antwoord van FUNDAMENT over de registers op het eigen
> cluster (13-11, uit kennis en repo; live controle volgt als het nieuwe cluster draait).

## 1. De vraag

Een spin-off van code + codegen: een **standalone API** die er van voren precies uitziet als een
register dat uit het CM is gegenereerd, maar die leest en schrijft op **bestaande Common
Ground-registers**. Openstellen:

- de registratie-endpoints (`POST /registraties`, de CRUD-GET's per type);
- GraphQL, inclusief opgeslagen documenten (persisted queries);
- eventueel `/full`, al is GraphQL daar de betere interface (geen over- en underfetching).

Aanvullend:

- de OpenAPI moet zeggen wat de façade per register wél en niet kan (bitemporaliteit);
- een klein eigen register legt **parallel** elke registratie vast: het **logboek dataverwerking**,
  zonder datatabellen;
- ook opvragingen loggen, met lineage naar de gebruiker;
- koppelen in twee stappen: eerst via de API's van de registers, later rechtstreeks op hun
  PostgreSQL.

Wat er al is: **persisted queries zijn gemerged** (sinds 24-09-2026, `dynql/opgeslagen_documenten.go`,
`QueryDefinitie` in het configuratie-domein; `POST /graphql/query {documentId}`). Die komen mee.

## 2. Conclusie vooraf

Het kan, en het meeste hergebruik zit aan de **voorkant**: MetaRegistry, het GraphQL-schema, de
OpenAPI-generator, de vorm van een registratie, de validatie, persisted queries. Alles daaronder
(resolvers, registratie-engine) praat nu rechtstreeks SQL op hub + `_Data`; daar moet een **naad**
in. Mijn advies:

1. **Een eigen binary in dezelfde repo** (`cmd/facade`), niet een fork. Zelfde `model`-pakket en
   codegen, eigen opslaglaag. Het gewone register blijft ongemoeid.
2. **Een bron-interface** onder de resolvers en de registratie-engine, met per register een
   implementatie: eerst via de API (stap 1), voor lezen later op de database (stap 2).
3. **Schrijven altijd via de API van het register**, ook in stap 2. Rechtstreeks in hun
   database schrijven slaat audittrail, notificaties, autorisatie en validatie over (zie §6).
4. **Een capaciteitsprofiel per type** dat de OpenAPI én het GraphQL-schema nuanceert, zodat de
   voorkant nooit belooft wat het register niet kan.
5. **Het logboek is een Omnium-register zonder datatabellen**: `registratie` + `wijziging` (met
   oude en nieuwe stand) + een tabel voor opvragingen, volgens de standaard Logboek
   Dataverwerkingen (trace-id over de hele keten).

## 3. Wat de registers kunnen (antwoord FUNDAMENT)

| Register | Historie | Correctie ≠ opvolging | Ongedaan maken | Materiële tijd / peildatum |
|---|---|---|---|---|
| **Objecten-API** (Open Object 4.3) | ja, elke wijziging een nieuw record (`index`, `registrationAt`); `/objects/{uuid}/history` | **ja** (`correctionFor`/`correctedBy`) | nee; corrigeren met een nieuw record | **ja**: `startAt`/`endAt`, `?date=` (materieel) én `?registrationDate=` (formeel) |
| Objecttypen | genummerde versies (draft/published) | n.v.t. | nee | versies |
| **Zaken**, Besluiten (Open Zaak 1.31) | **overschrijft**; wel audittrail met `oud`/`nieuw`; statussen append-only | nee | alleen terugschrijven (twee regels in het audittrail) | geen peildatum; losse datumvelden |
| Documenten | echte versies per informatieobject + audittrail | nee, elke wijziging is een versie | nee | `?registratieOp=` (formeel) |
| Catalogi | versies via `beginGeldigheid`/`eindeGeldigheid`, concept/publiceren | n.v.t. | nee | `?datumGeldigheid=` |
| Klantinteracties (Open Klant 2.19) | overschrijft; geen historie-endpoint (te controleren) | nee | nee | geen |
| Producten (Open Product 1.9) | overschrijft; interne auditlog (te controleren) | nee | nee | start/einddatum als velden |

Authenticatie: Open Zaak JWT-ZGW (client-id + secret, scopes per zaaktype en vertrouwelijkheid);
Open Object, Open Klant, Open Product `Authorization: Token …` (Open Object met rechten per
objecttype). Wijzigingen worden gemeld via Open Notificaties (bruikbaar voor cache-invalidatie).

Kortom: alleen de Objecten-API is echt bitemporeel. De ZGW-registers zijn CRUD met een
audittrail. Dat sluit aan bij Marks inschatting.

## 4. Architectuur

```
            Afnemer (Studio, Imprint, portaal)
                 │  REST (registraties, CRUD, /full)  ·  GraphQL + documentId
                 ▼
┌──────────────────────────────── façade (cmd/facade) ─────────────────────────────┐
│  MetaRegistry (codegen uit het CM)  ·  GraphQL-schema  ·  OpenAPI met capaciteiten │
│  validatie van registraties  ·  persisted queries  ·  rechten van de eindgebruiker │
│                         │                                     │                    │
│                 bron-interface                        logboek-schrijver           │
│            ┌────────────┼──────────────┐                     │                    │
│        ApiBron(ZGW)  ApiBron(Objecten)  DbBron (stap 2,       ▼                    │
│            │            │               alleen lezen)   logboek-DB (Omnium-      │
└────────────┼────────────┼───────────────┼──────────── registratie/wijziging/      ┘
             ▼            ▼               ▼              opvraging, geen datatabellen)
        Open Zaak    Open Object    read-only rol / replica
```

### 4.1 De naad: een bron-interface

Nu bouwen de resolvers in `dynql/query_resolvers.go` en de engine in
`handlers/registration_*.go` zelf `bun`-queries op de tabellen uit de MetaRegistry. Voor de façade
gaan die achter een interface, ruwweg:

```go
type Bron interface {
    Capaciteiten(typenaam string) Capaciteiten
    Haal(ctx, typenaam string, id ID, t Peil) (Representatie, error)       // full, met GE's/relaties
    Lijst(ctx, typenaam string, f Filter, p Pagina, t Peil) ([]Representatie, error)
    Registreer(ctx, r Registratieverzoek) (Registratieresultaat, error)    // één registratie, n wijzigingen
}
```

- `Peil` = peiltijdstip (formeel) + geldigOp (materieel); een bron die een as niet kent, weigert
  (zie §5).
- `Filter` is het bestaande GraphQL-filter. Een bron zegt per veld of hij het kan **doorgeven**
  (pushdown) of niet. Wat niet kan, weigert de façade met een duidelijke fout. Achteraf filteren
  in geheugen alleen voor kleine lijsten, anders klopt paginering niet.
- De schemabouw in `dynql` krijgt een **resolverfabriek** als parameter, zodat dezelfde typen,
  argumenten en filters met andere resolvers werken. Dat is de enige ingreep in de gedeelde code.
  Het gewone register blijft zijn huidige resolvers gebruiken.

### 4.2 Afbeelding CM ↔ register (de binding)

Per CM-type: welk register, welk endpoint of welke tabel, welke velden. Dit past in het
metaniveau-verhaal: de OAS van elk register is een **M1-model in het OAS-profiel** (de Studio kan
OAS 3.1 al lezen), en de binding is een set **kruisverbanden** CM ↔ OAS in de koppelingen-matrix.
Codegen maakt daar afbeeldingstabellen van (net als nu de MetaRegistry). Zo staat de binding in
het model en niet in handgeschreven Go.

Voorbeeld: CM-entiteit `Zaak` ↔ OAS `Zaak` (Zaken-API); GE `Zaakstatus` ↔ `Status` (append-only);
CM-entiteit `Aanvraag` ↔ object van objecttype `productaanvraag` (Objecten-API), velden in `data`.

### 4.3 Identiteit

Omnium gebruikt numerieke id's (entiteit-id door de client gekozen, `rel_id`'s, ints in de
gegenereerde structs); de registers gebruiken uuid's en URL's. Twee opties:

- **a. Afbeeldingstabel in de logboek-DB**: id ↔ (register, uuid/URL). Klein, en de rest van de
  code blijft gelijk. Nadeel: de façade moet bij elke lijst nieuwe uuid's een id geven.
- b. id-type configureerbaar maken in codegen (string/uuid). Groot, raakt veel generieke code.

Advies: **a** voor de proef. b alleen als de façade een blijvend product wordt.

**Mark, 13-11:** de bigint-id's voor entiteiten waren een keuze voor de leesbaarheid in de PoC.
Uuid's zijn beter, ook voor het gewone register (aparte beslissing, BACKLOG). De onderliggende
gegevenselementen houden hun **relatieve** id's (volgnummer binnen de entiteit). Dat klopt
inhoudelijk en sluit aan bij de Objecten-API, waar een record een `index` 1, 2, 3 per object
heeft.

**FUNDAMENT, 13-11, gelezen uit de databases op het nieuwe cluster:**

- **Open Zaak.** Elk subrecord is een eigen resource met een uuid en een eigen rij: status, rol,
  zaakeigenschap, zaakobject, resultaat, zaakinformatieobject. Zo ook besluit en
  besluitinformatieobject.
  - Uitzondering: de betrokkene-identificatie onder een rol (`zaken_natuurlijkpersoon` e.d.)
    heeft geen uuid. Het is een 1-op-1-rij aan de rol of het zaakobject.
  - `zaken_zaak` is één brede tabel: identiteit en inhoud staan door elkaar, er is geen kale
    entiteitstabel.
  - Een verwijzing naar een andere API staat er als `_x_id` (lokaal) of als `_x_base_url_id` +
    `_x_relative_url` (extern).
- **Documenten.** Er is wel een scheiding. `…canonical` is het stabiele ding, zonder uuid. Per
  versie is er één rij, met dezelfde uuid en een eigen `versie`.
- **Open Object.** De tabellen heten `core_object` en `core_objectrecord`. Precies hub +
  records:
  - `core_object` heeft id, uuid en objecttype;
  - `core_objectrecord` heeft index, data (jsonb), start_at, end_at, registration_at,
    correct_id (uniek) en geometry. Een record heeft geen uuid, alleen (object, index).
  - **Let op:** start_at, end_at en registration_at zijn van het type `DATE`. Formele tijd heeft
    dus dagprecisie.
- **Open Klant.** Gemengd.
  - Een eigen uuid hebben: partij, persoon/organisatie/contactpersoon, digitaal adres,
    partij-identificator, rekeningnummer, betrokkene en klantcontact.
  - Bezoek- en correspondentieadres en de contactnaam zijn **kolommen** op partij en betrokkene,
    zonder eigen identiteit.
- **Audittrail.** De tabel `audittrails_audittrail` heeft `oud` en `nieuw` als json. Live staan er
  alleen creates in. Volgens de standaard bevatten oud en nieuw bij een (partial) update allebei
  de **volledige** weergave, en is het verschil zelf te berekenen. Een wijziging op een subrecord
  krijgt een eigen regel, met de zaak als `hoofd_object`. Live bewijs van een PATCH vraagt één
  proef-PATCH, met Marks akkoord.

Gevolgen voor de afbeelding:

- **ZGW.** Een GE-voorkomen past op één subresource (uuid). Die wordt overschreven, of is
  append-only (status). Er is geen keten van voorkomens zoals in Omnium.
- **Objecten.** Het voorkomen is (object-uuid, index): het relatieve id dat Mark charmant vindt.
  Formele tijd op dagprecisie betekent dat het logboek het precieze tijdstip moet leveren.
- **Open Klant.** Een GE "adres" met eigen historie past niet; elke wijziging overschrijft de
  partij. In het capaciteitsprofiel wordt dat `formeel: geen` op GE-niveau.

### 4.4 Joins over registers

Relaties lopen via URL's (zaak → zaaktype, zaakobject → object) en naar de klant via
identificatie (BSN/KVK in de rol). Via de API is elke join een extra call. GraphQL helpt alleen
als de façade **batcht**: per laag in de query één verzameld verzoek per register (dataloader),
plus een korte cache die Open Notificaties ververst. Via de database (stap 2) wordt dat een gewone
join en valt het N+1-probleem weg. Daar zit de echte snelheidswinst.

## 5. Bitemporaliteit nuanceren: het capaciteitsprofiel

Per CM-type (afgeleid uit de binding, eventueel per register te overschrijven):

| Capaciteit | Waarden |
|---|---|
| `formeel` | `volledig` (Objecten-API) · `audittrail` (ZGW: reconstrueerbaar, niet bevraagbaar) · `geen` |
| `materieel` | `geldigheid` (Objecten, Catalogi) · `geen` |
| `correctie` | `echt` (Objecten) · `alsNieuweVersie` (Documenten) · `alsOverschrijving` (ZGW) |
| `ongedaanmaking` | `terugcorrigeren` (de façade schrijft de vorige stand terug) · `nee` |
| `peiltijdstip` / `geldigOp` | ja / nee (volgt uit formeel en materieel) |
| `filters` | per veld: doorgeven / niet |

Hoe dat zichtbaar wordt:

- **OpenAPI**: per path een `x-omnium-capaciteiten`-blok en een korte tekst in de beschrijving.
  Parameters als `peiltijdstip` en `geldigOp` staan er alleen als het register ze kan. Een
  niet-ondersteund registratietype geeft **501** met reden `niet_ondersteund_door_register`.
- **GraphQL**: argumenten die niet kunnen, zitten niet in het schema. Een afnemer ziet het dus al
  bij introspectie.
- **Registratie**: de façade voert een `Correctie` op een register met `alsOverschrijving` uit als
  overschrijving, en zegt dat in het antwoord (`toegepastAls: "overschrijving"`). Een strikte
  afnemer kan met een header (`Omnium-Strikt: true`) eisen dat de façade weigert in plaats van
  degradeert. **Besluit Mark 13-11:** een correctie wordt een patch (overschrijving) en het
  logboek legt hem vast, dus vanaf nu bouwt er wel een historie op. `Ongedaanmaking` wordt niet
  gebruikt en de façade ondersteunt het niet: 501. Terugcorrigeren kan later, met de standen
  uit het logboek.
- **Bonus**: wijzigingen die via de façade lopen, staan met tijdstip in het logboek. Voor die
  wijzigingen kan de façade zelf een formele tijdlijn tonen, ook bij een ZGW-register. Wijzigingen
  buiten de façade om ziet hij niet, of alleen via het audittrail. Dus geen echte peiltijdstip-
  belofte, hooguit een "volgens het logboek"-weergave.

## 6. Koppelen: API eerst, database later, schrijven altijd via de API

**Stap 1, via de API's.** Werkt overal, ook bij een gemeente waar een leverancier het register
beheert. Traag bij joins (§4.4), beperkt filteren (Objecten: `data_attrs`, geen OR; Zaken: vaste
filterlijst), verschillende paginering. Goed genoeg voor registreren en voor GraphQL met batching.

**Stap 2, rechtstreeks op de database, alleen lezen.** Technisch eenvoudig op ons eigen cluster:
één gedeelde PostgreSQL met per component een eigen database. Een read-only rol met GRANT SELECT
(de grants draait Mark), later eventueel logische replicatie naar de façade. Daarmee worden joins
en filters echte SQL en haalt GraphQL zijn voordeel.

Drie bezwaren (FUNDAMENT, en ik deel ze):

1. De tabellen zijn interne Django-modellen van de leverancier, geen contract; ze veranderen bij
   upgrades. De DbBron moet per registerversie getest worden en moet bij een onbekende
   schemaversie terugvallen op de ApiBron.
2. **Schrijven** in hun database slaat audittrail, notificaties, autorisatie en validatie over.
   Dat doen we niet.
3. Bij een echte gemeente krijg je de database meestal niet. Stap 2 is dus een optie voor eigen
   installaties, geen uitgangspunt.

## 7. Logboek dataverwerking

### 7.1 Registraties

Een Omnium-register met alleen de formele kant: `registratie` (tijdstip, actor, `namens`,
gevraagd en toegepast registratietype, register, extern id/versie, resultaat) en `wijziging` (per
representatie het verzoek en de **stand**). Geen hub- of `_Data`-tabellen. Dit is de plumbing die
er al is (`model/model_plumbing.go`).

**De stand is nieuw.** In het gewone register bevat `wijziging` geen gegevens: die staan in hub en
`_Data`, en `wijziging` wijst er alleen naar. Zonder datatabellen moet de stand dus in de mutatie
zelf. Dat wordt één jsonb-kolom met een serialisatie van het record na de mutatie, **zonder
opvoer en afvoer**, want die staan al in `wijziging` en `registratie`.

- Alleen de nieuwe stand: de oude is de stand van de vorige mutatie op hetzelfde record.
- Uitzondering: de eerste keer dat de façade een record raakt, kent het logboek de vorige stand
  niet, want het register had al historie. Die stand komt dan als nulmeting mee. De façade leest
  het record toch al vóór een patch, dus dat kost niets extra.
- Daarmee kan de façade later terugcorrigeren en een "volgens het logboek"-tijdlijn tonen.

Schrijfvolgorde: eerst het logboek ("gevraagd"), dan het register, dan het logboek bijwerken
("gelukt", met extern id en versie, of "mislukt"). Zo is ook een mislukte of halve poging
verantwoord. Er is geen transactie over registers heen. Een registratie die meer registers raakt,
kan half slagen. Het logboek moet dat tonen, en de façade compenseert niet stilzwijgend.

### 7.2 Opvragingen en de scope

Over de vraag "op register-niveau of hoger": de standaard **Logboek Dataverwerkingen** (Logius,
gebaseerd op W3C Trace Context / OpenTelemetry) maakt het geen of-of.

- Elke partij logt in **zijn eigen** logboek, met een gedeeld `trace_id` en een eigen `span_id`
  (met `parent_span_id` naar de aanroeper).
- De keten is achteraf te reconstrueren via het `trace_id`.

Voor ons betekent dat:

- de laag die de opvraag-"transactie" begint (portaal, Imprint, Studio), start de trace en stuurt
  `traceparent` mee;
- de façade logt per verzoek één verwerking: actor/`namens`, verwerkingsactiviteit (doelbinding),
  `documentId` of query-hash, register(s), en de betrokkenen waar het om ging (BSN e.d., zo zuinig
  mogelijk);
- de façade geeft `traceparent` door aan de registers, en hun logs hangen er via hetzelfde
  `trace_id` aan.

Persisted queries helpen hier: een `documentId` is een vaste, vooraf beoordeelde opvraag. Je kunt
er een verwerkingsactiviteit aan koppelen, in plaats van ad-hoc queries te moeten duiden.

Te controleren in de normatieve tekst (versie 1.0): veldnamen, en welke velden verplicht zijn.

## 8. Fasering (voorstel)

| Fase | Inhoud | Wie | Grootte |
|---|---|---|---|
| 0 | CM van de registers tekenen; OAS van Zaken en Objecten als M1 in de Studio; kruisverbanden CM ↔ OAS | Mark, OMNIUM-UI | — |
| 1 | Naad in `dynql` (resolverfabriek); `cmd/facade` met ApiBron voor **Open Zaak + Open Object** (besluit 13-11), alleen lezen: GraphQL + persisted queries + CRUD-GET, join zaakobject → object | BACKEND | ± 2½ week |
| 2 | Registreren via de ApiBron (correctie = patch); capaciteitsprofiel in OpenAPI en GraphQL; logboek met registratie/wijziging + stand (en nulmeting) en id-afbeelding | BACKEND | ± 2 weken |
| 3 | Opvragingen loggen volgens Logboek Dataverwerkingen (traceparent, verwerkingsactiviteit per documentId) | BACKEND | ± 1 week |
| 4 | DbBron voor lezen op een read-only rol (proef op het eigen cluster), met terugval op de API bij een onbekende schemaversie | BACKEND, FUNDAMENT (rol), Mark (grants) | ± 2–3 weken voor het eerste register |

Schattingen zijn grof. De grootste onbekenden zijn het filteren via de API's en de id-afbeelding.

## 9. Besluiten Mark (13-11)

1. **Beginnen met Open Zaak + Open Object samen.** Een object hangt altijd aan een zaak, dus de
   Objecten-API los is geen zinvolle proef. Voor Zaken bestaat een UML-model van de
   ZGW-standaard. Dat staat niet in deze repo; Mark zoekt het op. Het is de bron voor het CM in
   fase 0. Fase 1 wordt daarmee iets groter: twee registers en de join zaakobject → object.
2. **Correctie = patch**, vastgelegd in het logboek (§5, §7.1). Ongedaanmaking wordt niet
   ondersteund (501).
3. **De eindgebruiker staat in het logboek.** Hoe de façade zich bij het register meldt (token
   exchange of één serviceaccount), is daarmee nog niet beslist. Bij één serviceaccount moet de
   façade de ZGW-autorisatie per zaaktype en vertrouwelijkheid zelf afdwingen. Dat komt in fase 2
   opnieuw op tafel.
4. **Het logboek geldt alleen voor de façade**, niet voor het gewone Omnium-register.
5. **Database-toegang op het eigen cluster mag**, met een read-only rol.

## 10. Bron voor het CM: RGBZ zoals het in het GGM staat (FACADE, 14-11)

Mark leverde een EA-export (XMI 1.1, UML 1.3) van het **RGBZ in de GGM-versie** ("RGBZPlus").
Het officiële RGBZ zoekt hij nog op. Wat er in de export zit:

- Package *Model Kern RGBZ*: 25 objecttypen, waaronder Zaak (25 attributen), Zaaktype, Status,
  Statustype, Besluit, Besluittype, Document (abstract, met Enkelvoudig/Samengesteld),
  Documenttype, Object (abstract), Betrokkene (abstract), Medewerker,
  OrganisatorischeEenheid, Klantcontact, Betaling en Heffing.
- Daarnaast 7 groepattribuutsoorten (KenmerkenZaak, OpschortingZaak, VerlengingZaak,
  ContactpersoonRol, …), 4 enumeraties en 5 metagegevens (MaterieleHistorie, FormeleHistorie,
  InOnderzoek, …).
- In totaal 224 attributen, 150 associaties en 16 generalisaties.
- **90 associatie-uiteinden wijzen naar klassen buiten de export.** Het zijn GGM-brede typen
  (NatuurlijkPersoon, Pand, Nummeraanduiding, Vacature, Parkeerscan, …). Vooral `Object` heeft
  zo'n twintig "is"-relaties naar concrete objecttypen. Voor de proef vallen die buiten het CM.
- Ruis: een dubbele klasse `ZAAK - Origineel`, veel datums zonder type, en een tikfout
  `indicatieIaatstGezetteStatus`.

**Het RGBZ heeft een andere vorm dan de Zaken-API.** Dat is geen bezwaar: juist dat verschil moet
de binding (§4.2) dragen.

| RGBZ (GGM) | ZGW-API |
|---|---|
| `Betrokkene` "oefent uit" `Zaak`, met losse associaties per rol (aanvrager, behandelaar, …) | resource `rol` met een `roltype` uit de Catalogi |
| resultaat als attributen op Zaak (`omschrijvingResultaat`, `toelichtingResultaat`) | resource `resultaat` met een `resultaattype` |
| `Object` (abstract) "betreft" Zaak | `zaakobject` met objecttype; het object zelf staat in de Objecten-API |
| `Zaak` "kent" `Document` | `zaakinformatieobject` → `enkelvoudiginformatieobject` (Documenten-API) |
| kenmerken en eigenschappen als groepattribuut | `zaakeigenschap` met `eigenschap` uit de Catalogi |
| Zaaktype, Statustype, Besluittype en Documenttype in hetzelfde model | Catalogi-API, met verwijzingen als URL |

Voorstel voor fase 0: het CM is een **deelverzameling van het RGBZ**: Zaak, Zaaktype, Status,
Statustype, Besluit, Besluittype, Object en Betrokkene/Medewerker. De OAS van de Zaken- en
Objecten-API komen er als M1 naast, en de kruisverbanden leggen de afbeelding vast.

Een alternatief is het CM in de vorm van de API te tekenen (zoals het ZGW-klassendiagram). Dan
wordt de binding bijna 1-op-1, maar is de façade weinig meer dan een doorgeefluik. Te
controleren: het officiële RGBZ 2.x kent voor zover ik weet ROL, RESULTAAT en ZAAKOBJECT wel als
eigen klassen, en ligt dan dichter bij de API dan deze GGM-versie.

**Zaakmodel-voorstel van AI-INRICHTEN, 17-11** (Fundament-repo, `docs/zaakmodel-voorstel.md`
plus V3-bestanden). Het moet één model worden voor de loadtest en de façade. Het is uitgewerkt in
vorm B (ZGW-API), met de catalogus als entiteiten; de keuze A/B ligt bij Mark.

Reactie FACADE:
- **Nodig:** een meervoudige relatie `ZaakObject` naar een objectentiteit in een eigen domein. Die
  ontbreekt nog, en zonder haar kan de join zaakobject → object uit fase 1 niet. Voor de proef is
  één concreet objecttype genoeg.
- **Id per relatie-voorkomen:** status, resultaat, eigenschap en informatieobject zijn daar
  relaties met eigen velden. ZGW geeft elk van die subrecords een uuid, dus de eis "eigen id per
  voorkomen" (§4.3) geldt ook voor relaties.
- **Inkomende relaties:** "zaak met rollen en besluiten" moet in GraphQL en `/full` gelezen
  kunnen worden.

**Besluiten Mark, 18-11** (doorgegeven door AI-INRICHTEN):
- **Het CM krijgt de ZGW-vorm (B).** Daarmee vervalt de RGBZ-vorm van hierboven. Een bijkomende
  reden is dat het officiële RGBZ lastig te vinden is.
- De betrokkene blijft voor de test in de rol (de vijf betrokkene-GE's).
- **De rol hangt aan de zaak:** Zaak heeft een meervoudige relatie `ZaakRol` naar Rol, en RolZaak
  is vervallen. Voor de binding is ZGW `rol.zaak` de inkomende kant van ZaakRol.

**Mark, 18-11, na zijn review:** relaties lopen van geheel naar onderdeel.
- Catalogus verwijst naar zaaktypen, informatieobjecttypen en besluittypen.
- Zaaktype verwijst naar statustypen, roltypen, resultaattypen en eigenschappen.
- De relaties van kind naar ouder (StatustypeZaaktype, ZaaktypeCatalogus, …) zijn vervallen.
- BesluitZaak en ZaakHoofdzaak blijven.
- De tabel met alle relaties staat in het voorstel, §3.

Gevolgen voor de binding:
- **Lezen.** ZGW legt de verwijzing bij het kind: `rol.zaak`, `statustype.zaaktype`,
  `zaaktype.catalogus`. In het CM is dat de inkomende kant van de relatie van de ouder. Een
  lijst als "de rollen van een zaak" wordt in de ApiBron een gefilterde lijstvraag op het kind
  (`/rollen?zaak=<url>`). Via de DbBron is het een join op de FK van het kind.
- **Schrijven (fase 2).** Een registratie die een voorkomen van ZaakRol toevoegt, wordt een
  `POST /rollen` met `zaak=<url>`. Een registratie die het voorkomen beëindigt, wordt een
  `DELETE` van die rol. De relatie op de ouder valt dus uiteen in calls op het kind. De uuid van
  het kind hoort bij het relatie-voorkomen (id per voorkomen, zie hierboven).

**Mark, 18-11: zaakobject wijst overal heen met een IRI** (zoals DCAT-NL doet), niet naar één
objecttype. In het model is dat het meervoudige GE `ZaakobjectVerwijzing` op Zaak, met de velden
`objectIri` (nieuw gegevenstype IRI), `objectType` en `verwijzingRelatieomschrijving`. De IRI is
de identiteit, geen adres van een component. Verder: Catalogus blijft het bovenste element.

**Open: de vorm van de IRI voor een object in de Objecten-API.** Voorstel FACADE:

| Vorm | Voorbeeld | Beoordeling |
|---|---|---|
| a. URL van het component | `https://<objecten-api>/api/v2/objects/<uuid>` | Dit staat nu al in ZGW `zaakobject.object`. Maar het is een adres: het verandert bij een verhuizing of upgrade van het component, en het lekt infrastructuur. |
| b. `urn:uuid:<uuid>` | `urn:uuid:3f2c…` | Een zuivere identiteit en wereldwijd uniek. Maar je ziet er niet aan welk register het object heeft; de façade moet elk register proberen. |
| c. **Persistente https-IRI volgens de NL URI-strategie** | `https://<domein-organisatie>/id/object/<uuid>` | Identiteit los van het component, dereferentieerbaar (`/id/` verwijst door) en in lijn met DCAT-NL en linked data. **Voorkeur.** |

Bij c doet de façade het volgende:
- **Binding:** de binding bevat een tabel van IRI-prefix naar register, bijvoorbeeld
  `…/id/object/` ↔ Objecten-API. Daarmee kan de façade uit de IRI afleiden waar het object staat.
  Het is dezelfde tabel als de id-afbeelding uit §4.3.
- **Lezen:** de façade vertaalt de URL van een bekend register naar de IRI. Een onbekende URL
  laat hij staan, want een https-URL is zelf ook een geldige IRI. Het veld is dus altijd gevuld,
  ook voor zaakobjecten die buiten de façade om zijn gemaakt.
- **Schrijven:** de façade vertaalt de IRI terug naar de URL van het component.
- **Wat de IRI aanwijst:** het **object** (`core_object.uuid`), niet een record (object + index).
  Wil je op een stand peilen, dan gebruik je de tijdreisparameters, niet de IRI.

Het URL-patroon (`/id/`, `/doc/`) moet nog getoetst worden aan de normatieve tekst van de URI-strategie.

**Besluiten Mark, 18-11:**
1. **IRI-vorm c**: een persistente https-IRI volgens de NL URI-strategie, met een tabel van
   IRI-prefix naar register in de binding.
2. **De catalogus bestaat uit entiteiten**, niet uit referentielijsten.
3. **Groen licht voor fase 1**: lezen uit Open Zaak en Open Object.

Bronnen over de standaard: [Logboek Dataverwerkingen (Logius)](https://gitdocumentatie.logius.nl/publicatie/logboek/dataverwerkingen/0.8.0/logboek-dataverwerkingen-0.8.0.pdf),
[Inleiding 1.0.1](https://gitdocumentatie.logius.nl/publicatie/logboek/inleiding/1.0.1/logboek-inleiding-1.0.1.pdf),
[.NET-voorbeeld op developer.overheid.nl](https://developer.overheid.nl/kennisbank/data/standaarden/logboek-dataverwerkingen/implementaties/dotnet).
