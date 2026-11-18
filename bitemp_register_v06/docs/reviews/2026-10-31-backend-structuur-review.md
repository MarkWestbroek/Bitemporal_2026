# Backend-review: structuur en separation of concerns

Datum: 2026-10-31. Reviewer: GitHub Copilot.
Baseline: `b0230f8b`, actieve v06-backend. Geen backendcode gewijzigd.
Bestaande wijzigingen in `docs/architectuur/` zijn niet aangepast.

## Oordeel

**De modelgedreven basis is goed behouden; de scheiding tussen applicatielogica,
transport en infrastructuur is slechts gedeeltelijk doorgezet.** Geen aanleiding
voor een herschrijving of microservices. Wel tijd om de bestaande registratie- en
leeslogica echte pakketgrenzen te geven, voordat nieuwe uitbreidingen de huidige
afhankelijkheden verder vastzetten.

De belangrijkste aanwijzing is niet bestandsgrootte, maar aantoonbare
gedragsverschillen tussen toegangspaden die dezelfde registeroperatie aanbieden.

Dit is een architectuurreview met gerichte code-inspectie en bestaande unittests,
geen volledige regel-voor-regel audit, security-audit of nieuwe PostgreSQL-loadtest.
De [review van juli](2026-07-07-backend-code-review.md) en
[review van september](2026-09-30-omnium-integrale-review.md) zijn als context gebruikt;
onderstaande bevindingen zijn opnieuw tegen de huidige code gecontroleerd.

## Bevindingen

P1 = eerst aanpakken vanwege functionele gevolgen; P2 = gerichte structuurverbetering.
De beschreven fouten volgen uit de codepaden; er is geen live database-reproductie
uitgevoerd. Architectuuradvies is apart herkenbaar als aanbeveling.

| ID | Prio | Bevinding |
|---|---|---|
| B01 | P1 | Notificaties en automatische herkansing hangen aan slechts een van de registratie-ingangen |
| B02 | P1 | GraphQL-relatienavigatie verliest de temporele leescontext |
| B03 | P1 | Samengestelde reads hebben geen gedeelde database-snapshot |
| B04 | P2 | Herbruikbare registerlogica zit in transportpakketten; afhankelijkheden lopen daardoor verkeerd om |
| B05 | P2 | Globale dependencies en initialisatie maken services onderling en aan de opstartvolgorde gekoppeld |
| B06 | P2 | De gebruikersresolver laadt alle gebruikers voor een enkele lookup |
| B07 | P2 | Groene tests bewaken de belangrijkste adapter-overstijgende contracten onvoldoende |

### B01. Het registratiecontract is over twee niveaus verdeeld

[RegistreerJSONCore](../../handlers/registration_handlers.go#L87) doet na een
geslaagde `RegistreerCore`-aanroep de notificatiehook en herhaalt een herkansbare
transactiefout eenmaal. Maar
[VoerEntiteitAfCore](../../handlers/crud_handlers.go#L123) en
[WijzigEntiteitCore](../../handlers/crud_handlers.go#L232) roepen rechtstreeks
`RegistreerCore` aan en keren daarna terug. De
[getypeerde GraphQL-mutaties](../../dynql/typed_mutations.go#L99) gebruiken deze
twee functies.

**Gevolg:** een geslaagde PATCH/DELETE, of getypeerde wijzig/corrigeer/voerAf-mutatie,
legt wel een registratie vast, maar activeert niet de notificatiehook die het
JSON-registratiepad uitvoert. Ook de automatische herkansing is niet uniform.
Dit is geen ontbrekende audittrail: de transactiekern wordt wel gedeeld.

**Aanbeveling:** maak een applicatieservice het enige publieke uitvoerpunt voor
registreren, wijzigen en afvoeren. Laat daarin de transactie, retry-strategie en
post-commit-hook samenkomen; adapters verzorgen alleen invoer en uitvoer.
Bij retries opnieuw opbouwen uit oorspronkelijke invoer, niet een reeds gemuteerd
request hergebruiken. Zet de hook niet simpelweg op een tweede plek: dat kan
dubbele notificaties opleveren.

**Acceptatie:** dezelfde wijziging via elke ingang geeft dezelfde auditgegevens en
precies een hook na commit; nul hooks bij rollback; een herkansing geeft geen
duplicaat. Dit garandeert nog geen duurzame bezorging na een procescrash:
in-memory bezorging is een afzonderlijke, reeds
[gedocumenteerde beperking](../plans/2026-09-25%20Notificeren%20en%20dashboards%20%E2%80%94%20NORA%20FDS%20verwerkt%20(ontwerp).md).

### B02. Leescontext is niet het contract van geneste resolvers

De [root-resolver](../../dynql/query_resolvers.go#L49) verwerkt formeel peilmoment
en `geldigOp`. De [reverse-resolver](../../dynql/query_resolvers.go#L439) en
[forward-resolver](../../dynql/query_resolvers.go#L505) beginnen opnieuw bij
`actueelOfPeil(nil)`. Reverse-navigatie selecteert bovendien relaties met
`afvoer IS NULL`, in plaats van op het peilmoment van de bron.

**Gevolg:** een historisch opgevraagde entiteit navigeert naar actuele relaties of
doelgegevens. Het materiele peilmoment van de bron wordt evenmin doorgegeven.
Dit speelt ook zonder gelijktijdige schrijvers. Het formele probleem was al in
september gesignaleerd en is in deze code nog aanwezig.

**Aanbeveling:** draag een expliciete leescontext mee met resolver-resultaten:
formele tijd, optionele materiele tijd en loader. Per root-tak, niet een enkel
peilmoment voor het hele HTTP-request: twee GraphQL-aliassen mogen verschillende
tijden opvragen. Trek dit door naar weergavenamen en afgeleide relaties.

**Acceptatie:** forward en reverse behouden beide tijdsdimensies; twee historische
aliassen interfereren niet; expliciet actuele queries houden hun huidige bedoeling.

### B03. Een gelijk peilmoment is nog geen gelijke snapshot

De [REST full-lijst](../../handlers/full_handlers.go#L1336) leest entiteiten,
hub-kinderen en aantallen met afzonderlijke queries via de globale DB.
De [GraphQL-root](../../dynql/query_resolvers.go#L57) en
[configuratie-loader](../../dynql/configuratie_lezen.go#L21) doen hetzelfde.
Ook de [afleidingsloader](../../handlers/afleiding_full.go#L37) gebruikt de globale
DB en vermeldt deze beperking expliciet.

**Gevolg:** een commit tussen leesstappen kan een samengestelde response uit
verschillende database-toestanden laten bestaan. Alleen overal dezelfde `time.Time`
doorgeven lost dat niet op. Dit is het bestaande open punt
[BACKLOG 32](../BACKLOG.md#32-leesconsistentie-op-het-formele-leesmoment-2026-09-21).

**Aanbeveling:** een read-only `REPEATABLE READ`-transactie voor een samenhangende
leesoperatie, met `bun.IDB` expliciet door alle bijlaadpaden. Geen tijdelijke
vervanging van package-globals. Ontwerp voor GraphQL ook de levensduur tijdens
geneste resolvers en scheid dit van mutatie-uitvoering.

**Acceptatie:** een gecontroleerde schrijverscommit tussen twee leesstappen levert
volledig de oude of volledig de nieuwe stand, nooit een mengvorm. Daarna poolgebruik
en responstijden meten op een afzonderlijke testdatabase.

### B04. Logica is per bestand gescheiden, maar niet per dependency

Concrete huidige importrichtingen:

```text
gebruikers   -> dynql + handlers
meldingen    -> gebruikers + dynql + handlers
notificaties -> dynql
dynql        -> handlers
handlers     -> dbsetup + filestore + middleware + model + pep + schemadiff
```

De [gebruikerspackage](../../gebruikers/stand.go#L12) verklaart zelf dat de
package-indeling mede nodig is vanwege deze importstructuur.
[Configuratie lezen](../../dynql/configuratie_lezen.go#L21) en materieel geldige
hubs selecteren zijn registerfuncties, niet inherent GraphQL-functies.
De [registratiekern](../../handlers/registration_core.go#L29) heeft geen Gin-parameter,
maar leeft in `handlers` en exposeert HTTP-statussen en problem-details.
Zelfs de [OpenAPI-CLI](../../cmd/openapi-export/main.go#L19) importeert `handlers`
voor documentgeneratie.

REST en GraphQL hebben daarnaast eigen versies van
`addOnderliggendeRelations`, `laadHubKinderenNaQuery` en `tijdstipUitT`:
zie [REST](../../handlers/full_handlers.go#L1068) en
[GraphQL](../../dynql/query_resolvers.go#L551). Transportvormen mogen verschillen;
temporele selectieregels zouden niet dubbel beheerd moeten worden.

**Aanbeveling:** eerst een gedeelde registratie- en leeslaag extraheren, met
domeinfouten die adapters naar HTTP/GraphQL vertalen. Daarna pas Studio-opslag,
rebuild-orchestratie en OpenAPI-generatie uit het verzamelpakket halen waar dat
hergebruik en tests helpt. Geen repository-interface per gegenereerde tabel;
behoud generieke toegang via de MetaRegistry.

### B05. Serviceconstructie is nog niet expliciet

`handlers.DB` staat in [tasks_handler.go](../../handlers/tasks_handler.go);
`dynql` heeft een [eigen globale DB](../../dynql/query_resolvers.go#L22).
[BuildSchema(database)](../../dynql/schema_builder.go#L21) zet deze laatste globaal.
Een tweede schema met een andere DB is daardoor niet onafhankelijk van het eerste.
Afgeleide GraphQL-relaties gebruiken bovendien loaders uit `handlers`.

[NewRouter](../../main.go#L249) registreert niet alleen routes, maar initialiseert
ook beleid, GraphQL, SSE en notificaties. De
[notificatieservice en hook](../../main.go#L458) worden alleen opgebouwd in de
succes-tak van GraphQL-schemabouw. Bij een schemafout blijft REST beschikbaar,
maar wordt geen nieuwe notificatiehook aangesloten.

**Aanbeveling:** bouw dependencies eenmaal in een expliciete applicatieconstructor
en geef die aan router, resolvers en services. Houd routerconstructie vrij van
procesafsluiting en verborgen globale mutaties. Maak expliciet welke onderdelen
verplicht zijn voor readiness en welke bewust optioneel zijn.

Niet alle globals zijn hiermee verkeerd: een na startup onveranderlijke
MetaRegistry of gedeelde parse-cache is iets anders dan een verwisselbare DB of hook.

### B06. De leesabstractie mist een gerichte lookup

[Resolver](../../gebruikers/stand.go#L129) roept `Zoek` aan; die roept
[LaadAlle](../../gebruikers/stand.go#L80) aan en zoekt daarna in Go op gebruikersnaam.
Daaronder worden alle actieve gebruikers met hun hub-kinderen geladen.

**Gevolg:** voor ieder verzoek dat deze resolver gebruikt groeit het lees- en
conversiewerk mee met het totale gebruikersbestand. Dit is op basis van het
codepad vastgesteld; er is hier geen nieuwe latencybenchmark gedaan.

**Aanbeveling:** voeg een gerichte lookup toe aan de gedeelde leeslaag die dezelfde
formele en materiele selectie bewaart. Niet als eerste een globale rolcache
toevoegen: blokkeren en intrekken moeten per verzoek correct blijven werken.

### B07. Vooral de verbindingen tussen componenten missen bewijs

De bestaande [DELETE-test met HappyPath in de naam](../../handlers/crud_handlers_test.go#L96)
verwacht bewust een 500 door een incomplete SQL-mock. Dat bewijst delegatie naar
de engine, niet een geslaagde afvoer met de juiste post-commit-effecten.
In de onderzochte handler- en dynql-tests staat geen assertie op `NaRegistratie`.
Groene losse engine- en notificatietests voorkomen B01 daardoor niet.

**Aanbeveling:** voeg contracttests over de adaptergrenzen toe voor B01 en B02,
en een echte PostgreSQL-test voor B03. Bewaak ook dat twee geconstrueerde
applicatie-instanties elkaars DB en hooks niet vervangen.

## Wat juist goed is gebleven

- **MetaRegistry en codegen blijven het centrale mechanisme.** Niet per domein een
  handgeschreven set routes en resolvers. Grote gegenereerde modelbestanden zijn
  op zichzelf geen architectuurprobleem.
- **De transactiekern wordt hergebruikt.** Het probleem in B01 zit rondom die kern,
  niet in afzonderlijke REST- en GraphQL-implementaties van de audittrail.
- **Afleiding heeft een echte poort:** de
  [Lader-interface](../../afleiding/afleiding.go#L36) houdt evaluatie onafhankelijk
  van database en HTTP. Dit is een bruikbaar voorbeeld voor verdere extracties.
- **Beleidsbeslissing en handhaving zijn onderscheiden:** de
  [PDP](../../toegang/pdp.go#L40) in `toegang` is los van Gin; `pep` verzorgt de
  aansluiting op responses.
- **De modellevenscyclus is herkenbaar:** codegen, schemadiff, modelmetadata en
  DB-setup zijn afzonderlijke verantwoordelijkheden. De rebuild-orchestratie zit
  nog in het verkeerde verzamelpakket, maar hoeft niet opnieuw ontworpen te worden.

Indicatie van de concentratie: `handlers` bevat 64 niet-test Go-bestanden en circa
19.060 fysieke regels inclusief comments; `dynql` 13 bestanden en circa 4.596
regels. Geteld in de package-mappen, zonder filtering op build-tags. Deze getallen
zijn signalen, geen reden op zichzelf om bestanden mechanisch op te knippen.

## Aanbevolen volgorde

1. Leg B01 en B02 vast met falende contracttests en herstel het uniforme gedrag.
2. Extraheer een registratie-applicatieservice, inclusief retry en post-commit.
3. Introduceer een gedeelde leeslaag met expliciete DB, tijdcontext en snapshot;
   laat REST, GraphQL, gebruikers en notificaties die gebruiken.
4. Geef de applicatie expliciete dependencies en initialisatie-uitkomsten.
5. Verplaats daarna de overige samenhangende verantwoordelijkheden uit `handlers`
   als afzonderlijke, overzichtelijke refactors.

Behoud de modulaire monoliet, het Hub + _Data-patroon en de dynamische metadata.
Een HTTP-DTO, GraphQL-flattening of domeinspecifieke gebruikersservice is niet
verkeerd; gedeelde registerregels afhankelijk maken van die adapters wel.

## Validatie uitgevoerd

Vanuit `bitemp_register_v06`, zonder PostgreSQL-integratietests:

```powershell
$env:DYNQL_TEST_PG_DSN=''
go test .\handlers .\dynql .\gebruikers .\meldingen .\notificaties .\afleiding .\model .\schemadiff .\naamgeving .\toegang .\pep .\middleware .\routes
go test . .\cmd\... .\dbsetup .\celexpr
```

Beide opdrachten geslaagd. Vijftien packages rapporteerden geslaagde tests;
de overige geselecteerde packages hadden geen tests. De standaard build werd
daarmee voor deze packages gecompileerd; geen aparte volledige build, race-run,
`devtools`-run, integratietest of loadtest uitgevoerd. De bevindingen zijn niet
opgelost door deze documentatie en groen betekent hier niet dat B01-B03 afgedekt zijn.
