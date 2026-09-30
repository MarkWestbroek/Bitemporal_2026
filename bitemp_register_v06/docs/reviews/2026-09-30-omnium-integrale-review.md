# Omnium Studio en register: integrale review

Datum: 2026-09-30. Reviewer: GitHub Copilot. Scope: actieve v06-backend,
Omnium Studio, modeluitwisseling, performance, documentatie en positionering.
Dit is een code- en documentreview, geen certificering of volledige penetratietest.
Applicatiecode wordt in deze taak niet gewijzigd.

Baseline: commit `cf017099`, branch `feat/render-api-svg`, plus de aanwezige
werkboom op de reviewdatum. Bestaande gebruikerswijzigingen zijn niet aangepast.
Eerdere reviews zijn als vertrekpunt gebruikt, niet als bewijs van de huidige code.

## 1. Bevindingen Eerst

**Advies: behoud de modelgedreven architectuur, maar behandel dit nog niet als een
productierijp register of een betrouwbare multi-user modelrepository.** De grootste
risico's liggen momenteel bij veiligheid, consistente tijdreisresultaten en het
behouden van modelwijzigingen, niet bij de keuze voor Go of metadata.

P0 betekent: blokkade voor de betreffende blootstelling aan andere gebruikers of
onbetrouwbare invoer. P1: eerstvolgende hardeningfase. P2: aansluitende verbetering.
"Code" betekent rechtstreeks vastgesteld in broncode; "probe" is hier uitgevoerd;
"historisch" betekent eerder gerapporteerd, zonder nieuwe database-loadrun.

| ID | Prio | Bevinding | Bewijs |
|---|---|---|---|
| R01 | P0 | Inline SVG uit iconen/vormen kan scriptgedrag uitvoeren | code + onschuldige browserprobe |
| R02 | P0 | GraphQL accepteert mutaties via GET; risico op CSRF met login-cookie | codepad + cookieconfiguratie; geen productie-exploit uitgevoerd |
| R03 | P1 | Samengestelde reads zijn geen consistente database-snapshot | huidige code + historische loadbevinding |
| R04 | P1 | GraphQL forward-navigatie verliest het historische peilmoment | code |
| R05 | P1 | Verplichte aanwezigheid en referentievaliditeit zijn niet generiek afgedwongen | code + bestaande bevinding 003 |
| R06 | P1 | Uploads en GraphQL missen voldoende uniforme resourcebudgetten | code; geen uitputtingsproef uitgevoerd |
| R07 | P1 | Undo kan gewijzigde data als schoon laten staan; reload verliest dirty-status | geheugenprobe + code |
| R08 | P1 | Map-import kan inhoud stil overslaan en een mislukking als succes melden | code |
| R09 | P1 | Bewaren van profielen/assets heeft geen betrouwbare bevestiging of conflictcontrole | code |
| R10 | P1 | Standaard `npm test` draait hier nul tests en slaagt toch | commando gereproduceerd |
| R11 | P2 | Historische full-lijsten tellen ongefilterde totalen | code |
| R12 | P2 | Submenu's blijven ontoegankelijk via toetsenbord | huidige code; ook in juni gevonden |
| R13 | P1/P2 | Dependency-, deployment- en publicatiebeleid nog niet als releasepoort geborgd | audit + repositorycontrole; details hieronder |

### R01. Onbetrouwbare SVG wordt actieve pagina-inhoud

[dataIcoon.jsx](../../web/vite/src/diagramcore/shapes/dataIcoon.jsx#L17) haalt met
een regex de binnenkant uit SVG en geeft die aan `dangerouslySetInnerHTML`.
[dataShape.jsx](../../web/vite/src/diagramcore/shapes/dataShape.jsx#L113) doet dit
ook met `silhouet.inner`. De
[iconenregistratie](../../web/vite/src/studio/activities/iconenRegistratie.js#L30)
neemt data uit lokale opslag, de build en het dev-endpoint over zonder sanitization.

Een lokale probe met de echte icoonfunctie liet een onschuldige eventhandler een
DOM-attribuut wijzigen. Geen netwerkverkeer of blijvende modelwijziging gebruikt.
Dit bewijst uitvoerbare inline event-attributen, niet een aanval op een productiehost.
Exploitvoorwaarde: een gebruiker laadt/renderert een onbetrouwbaar icoon of vorm.
HttpOnly beschermt cookies tegen uitlezen, maar niet tegen acties vanuit dezelfde origin.

**Aanpak:** een onderhouden SVG-sanitizer met een strikte allowlist op de centrale
invoer/rendergrens; event-attributen, actieve HTML, ongewenste externe verwijzingen
en URL-schema's uitsluiten. Geen regex als veiligheidsfilter. Bestaande opgeslagen
assets ook behandelen. CSP als tweede laag; devserver nooit publiek aanbieden.
**Acceptatie:** browserregressies voor iconen en silhouetten voeren geen handlers
uit en halen geen ongewenste bronnen op; normale vormen blijven visueel correct.

### R02. Muteren via GET en SameSite=Lax

[GraphQLHandler](../../dynql/handler.go#L49) accepteert zowel GET als POST en
voert na de rolcheck ook een GET-mutatie uit. Beide methoden zijn
[geregistreerd](../../main.go#L272).
[LoginHandler](../../handlers/auth_handler.go#L71) gebruikt een SameSite=Lax-cookie.
Die kan bij een cross-site top-level GET-navigatie meegaan. De editorrolcontrole
beschermt dan niet tegen een misleid ingelogd slachtoffer. CORS blokkeert zo'n
navigatie niet. De bestaande test weigert alleen de *anonieme* GET-mutatie.

**Aanpak:** GET uitsluitend voor queries, geselecteerde mutation via GET altijd
405; cookiegebaseerde schrijfacties daarnaast beschermen met expliciet Origin/CSRF-
beleid en een passend content-typecontract. Authenticatie blijft noodzakelijk.
**Acceptatie:** ook met geldige editor/admin-cookie veroorzaakt GET nul mutaties;
queries via GET en geautoriseerde POST-mutaties blijven werken. Test dit met een
in-memory resolver, niet met echte registerdata.

### R03. Samengestelde reads kunnen verschillende toestanden mengen

[full_handlers.go](../../handlers/full_handlers.go#L1483) leest via `DB.NewSelect`,
laadt relaties en daarna hub-kinderen met extra queries. Er is geen gedeelde
read-only transactie. De
[historische bevinding 002](../../test/2026-09-21-bevinding-002-full-read-niet-snapshot-consistent.md)
beschrijft het waargenomen gevolg: een actieve hub met al afgevoerde data tijdens
gelijktijdige correctie. De huidige code heeft deze oorzaak nog steeds.

**Aanpak:** een request-scoped `bun.IDB` met een korte read-only `REPEATABLE READ`-
transactie, doorgeven aan *alle* bijlaadpaden en resolvers. Niet het globale `DB`
tijdelijk vervangen. Eén SQL-query is ook een optie waar praktisch.
**Acceptatie:** een deterministische test forceert een schrijverscommit tussen
twee leesstappen; het antwoord is volledig oud of volledig nieuw. Daarna sc 33
op een dedicated testdatabase, plus p95/poolmeting.

**Correctie op het eerdere oplossingsdocument:** `max(registratie.id)` is geen
bewijs van een aaneengesloten gecommitteerde stand. Transactie 10 kan committen
terwijl 9 nog loopt. Een latere query tot en met 10 kan dan meer bevatten dan de
oorspronkelijke snapshot. Noem zo'n ID hooguit diagnostiek; een reproduceerbare
stand vereist een expliciet ontworpen commit/publicatievolgorde of bewaarde
snapshotidentiteit. Ook kost REPEATABLE READ mogelijk poolcapaciteit en heeft het
interactie met DDL; "geen meetbare kosten" is een hypothese, geen garantie.

### R04. GraphQL forward-relaties springen naar het heden

De [root-resolver](../../dynql/query_resolvers.go#L46) leest `peiltijdstip` uit de
argumenten. De [forward-resolver](../../dynql/query_resolvers.go#L417) gebruikt
daarentegen `actueelOfPeil(nil)`, dus `time.Now()`. Er reist geen peilmoment mee
in de bronwaarde. Een historische persoon kan zo naar actuele locatiegegevens
navigeren. Dit probleem bestaat ook zonder gelijktijdige schrijvers.

**Aanpak:** een resolver-envelope met data, formele/materiele leescontext en
request-scoped loader. Bewaar peilmomenten per root-tak: één GraphQL-document kan
immers twee aliassen met verschillende historische tijden opvragen. Een enkel
globaal peilmoment per HTTP-request is daarvoor onvoldoende.
**Acceptatie:** historische parent + later gewijzigd doel geeft bij forward-
navigatie de oude doelwaarde; twee root-aliassen met verschillende tijden blijven
gescheiden. Toets ook reverse-relaties, weergavenamen en REST/GraphQL-pariteit.

### R05. Het register accepteert meer dan het model toestaat

[validation_walker.go](../../model/validation_walker.go#L45) behandelt datatype-
en enumtags, slaat lege strings over en controleert geen aanwezigheid of `ref:`.
De [bestaande bevinding 003](../../test/2026-09-21-bevinding-003-verplichte-velden-en-verwijzingen-niet-afgedwongen.md)
beschrijft de gevolgen. De registratie-engine roept deze validatie en een
uniekheidscontrole aan, maar daarmee zijn de ontbrekende controles niet opgelost.

**Aanpak:** presence-aware normalisatie vanuit modelmetadata, validatie van het
uiteindelijke resultaat bij PATCH, en gebundelde referentiechecks binnen de
schrijftransactie. `0`, `false`, ontbrekend en `null` zijn verschillende situaties.
Een SQL-FK toetst bestaan, niet automatisch temporele geldigheid. Definieer of
een referentie formeel actief, materieel geldig of alleen historisch bekend moet zijn.
**Acceptatie:** generieke tests over meerdere domeinen; 422 met veldpad; volledig
rollback; nulwaarden die het model toestaat blijven toegestaan. Seeds en oude
data krijgen een expliciete migratie-/validatierapportage.

### R06. Begrens werk voordat het wordt uitgevoerd

[Upload](../../handlers/bestanden_handlers.go#L51) parseert multipart voordat de
bestandsgrootte gecontroleerd wordt, leest daarna maximaal 500 MB als geheel en
maakt extra byte/stringkopieen. De bestandslimiet begrenst niet vooraf de volledige
multipart-request. Meerdere toegestane uploads kunnen geheugen of tijdelijke schijf
uitputten. Dit is vooral relevant bij gedeelde editoraccounts of auth-uit.

De [GraphQL-handler](../../dynql/handler.go#L90) heeft geen eigen querykosten-,
diepte- of aliasbudget. Paginalimieten alleen begrenzen geen geneste graaf.
[main.go](../../main.go#L113) start via `router.Run`, zonder expliciete server-
timeouts. Een reverse proxy kan mitigeren; de echte deployment is hier niet geaudit.

**Aanpak:** `MaxBytesReader` voor multipart/JSON-parsing, streaming naar objectopslag,
concurrentielimieten, request-/DB-deadlines, GraphQL AST-kostenanalyse inclusief
fragmenten en list-multipliers, query-/resultaatbudget en login-rate-limiting.
Sommige nieuwere handlers hebben al lokale grenzen: generaliseer die discipline.
**Acceptatie:** te grote input geeft vroeg 413; te dure queries worden voor
resolvers geweigerd; cancellation stopt DB-werk; normale workloads blijven binnen SLO.

### R07. Dirty-status en undo vertellen niet dezelfde waarheid

[createDiagramStore.js](../../web/vite/src/diagramcore/model/createDiagramStore.js#L543)
bewaart in undo uitsluitend `elements` en `diagrams`. `isDirty` zit daar niet in
en wordt niet herberekend bij undo. Probe: element wijzigen, `markeerOpgeslagen`,
undo resulteert in de oude naam met **`isDirty=false`**. Ook persist bewaart geen
dirty-status of saved-baseline. Na herladen kan lokale inhoud dus schoon lijken.
[herlaad](../../web/vite/src/studio/activities/maakDiagramActiviteit.jsx#L246)
vraagt alleen bij `isDirty` om bevestiging voordat de sandbox wordt vervangen.

**Aanpak:** een expliciete saved-revision/baseline en een modelrevision of hash;
dirty afleiden ten opzichte van die baseline, ook na undo en rehydration. Definieer
of "opgeslagen" lokaal, bestand of server betekent. Zet grote modellen niet bij
elke viewportmutatie synchroon in localStorage.
**Acceptatie:** edit/save/undo/redo/reload en opslagquota-fouten geven juiste status;
vervangacties verliezen nooit stil niet-opgeslagen wijzigingen.

### R08. Map-import is niet betrouwbaar als roundtrip

[transformaties.js](../../web/vite/src/studio/activities/transformaties.js#L186)
meldt parse-/formaatfouten met `alert` en keert zonder resultaat terug.
[normaliseerTransformatieResultaat](../../web/vite/src/studio/activities/transformatieRegistry.js#L72)
vertaalt juist dat lege resultaat naar succes. Bestaande element-IDs worden stil
overgeslagen terwijl nieuwe diagrammen naar die bestaande elementen verwijzen.
`geplaatst.elementen`, losse plaatsingen en viewport/meta worden bij deze import
niet symmetrisch hersteld; kruisverbanden worden niet als zodanig in de JSON-export
opgenomen. Voor een gewijzigde export kan zo oud modelmateriaal onder nieuw
geimporteerde diagrammen terechtkomen.

**Aanpak:** expliciete resultaten `success/warning/error/cancelled`, preflight op
het hele pakket, collision-/mergebeleid, complete referentieremapping en één
transactie/undo-command over profielstores, mapplaatsingen en kruisverbanden.
Hergebruik de atomaire importstijl die OAS/ArchiMate al hebben.
**Acceptatie:** export/import in lege workspace bewaart de ondersteunde semantiek;
import met botsende IDs weigert of toont een diff; fout/cancel verandert geen data
of mappen en verschijnt nooit als succes.

### R09. Profielopslag kan stil verloren gaan

[profielRegistratie.jsx](../../web/vite/src/studio/activities/profielRegistratie.jsx#L33),
iconen en vormen bewaren fire-and-forget naar het dev-endpoint. HTTP-fouten worden
niet gecontroleerd; lokale opslagfouten worden genegeerd. Productie valt terug op
localStorage. Gebundelde/git-profielen winnen vervolgens bij startup van de cache.
Een lokaal gewijzigd ingebouwd profiel kan daardoor bij herladen worden vervangen.

**Aanpak:** behoud local-first als bewuste modus, maar onderscheid lokale draft,
gepubliceerde revision en server/git-bron. Bevestig writes, bied download/herstel
bij quota-/netwerkfouten en gebruik revision/ETag-vergelijking voor gedeeld bewaren.
Het [Vite-dev-endpoint](../../web/vite/vite.config.js#L59) is geen productie-
modelrepository: het kent geen eigen auth, bodybudget of conflictcontrole.
**Acceptatie:** vertraagde writes, HTTP 500, volle opslag, twee tabs en herladen
overschrijven geen wijzigingen zonder melding of conflictkeuze.

### R10. Een groene testopdracht kan nul dekking betekenen

[package.json](../../web/vite/package.json#L13) gebruikt een single-quoted glob.
`npm test` gaf in deze Windows-omgeving exit 0 en **tests 0**. Dezelfde bestanden
expliciet aan Node doorgeven gaf **718 geslaagde tests**. Er ontbreekt dus niet
zozeer een unittestbasis als wel een betrouwbare, platformonafhankelijke ingang.

**Aanpak:** cross-platform testdiscovery en hard falen bij nul gevonden tests;
CI op Windows en Linux. Er is geen ingecheckte `.github/workflows`-map aangetroffen;
eventuele externe CI is niet onderzocht. De twee aanwezige Playwright-specs testen
de oude IDE, niet de centrale Omnium-projectworkflow.
**Acceptatie:** `npm test` draait aantoonbaar dezelfde suite op beide platforms;
CI omvat Go, frontendtests, build en de kern-Omnium-E2E's.

### R11. Historische paginering heeft actuele/ongefilterde aantallen

[MakeGetFullEntitiesByMetaHandler](../../handlers/full_handlers.go#L1520) past
het formele filter toe op de lijst, maar niet op de afzonderlijke `Count`.
`has_more` gebruikt vervolgens dat totaal. Een peilmoment voor het ontstaan van
de meeste entiteiten kan dus lege vervolgpagina's beloven.
**Aanpak:** één metadata-gedreven filterplan delen tussen items en count, binnen
dezelfde snapshot; stabiele ordering en een gecontroleerd pagineringcontract.
**Acceptatie:** dataset met later opgevoerde/afgevoerde entiteiten geeft per
peilmoment juiste items, totaal en laatste pagina.

### R12. Toetsenbordgebruik blijft een functioneel gat

[MenuBar.jsx](../../web/vite/src/studio/MenuBar.jsx#L50) opent submenu's met
`onMouseEnter`; de submenu-button heeft geen click/key-handler. Dit was al in de
[review van juni](../STUDIO-code-review-2026-06-30.md) genoemd en is niet opgelost.
**Aanpak:** menubar-pattern met roving focus, pijlen, Enter/Space/Escape,
focusterugkeer en pointerondersteuning voor splitters. Test kernworkflows geheel
zonder muis. Voor de beoogde overheidsmarkt is toegankelijkheid productkwaliteit,
niet cosmetische nazorg; beoordeel de toepasselijke toegankelijkheidseisen per inzet.

### R13. Release- en afhankelijkheidsbeleid

- `npm audit --json` meldde op de reviewdatum **7 high, 0 critical** op pakketniveau.
	Dit zijn advisories, geen zeven bewezen exploiteerbare paden. Onder meer
	React Router-meldingen betreffen server-/SSR-functies; deze frontend is Vite/SPA.
	Bereikbaarheid moet per advisory worden vastgesteld. Geen automatische fixes uitgevoerd.
- Auth en leespoort zijn configureerbaar maar standaard permissief; synthetische
	registratietijd is default. Maak een expliciet productieprofiel dat ongeldige
	combinaties weigert, inclusief cookie-/TLS-, proxy- en CORS-beleid. Niet elke
	toepassing vereist gesloten leesdata: open publicatie moet een bewuste keuze zijn.
- Login slaat bcrypt over voor onbekende gebruikers; timing-enumeratie is een
	resterend risico. Login/logout bepalen `Secure` verschillend. Centraliseer dit
	en neem rate limits, sessieverval en sleutelrotatie mee.
- `.env` is nu niet meer gevolgd; alleen voorbeeldbestanden kwamen uit de
	git-controle. Het oude punt is dus niet opnieuw een actueel lek genoemd.
	Historische secrets zijn niet gescand; verwijderen uit HEAD roteert ze niet.
- Er is geen projectbrede licentie gevonden; third-party LICENSE-bestanden zijn
	geen licentie voor Omnium. Ook is een gevolgde `node_modules_backup_*` aangetroffen.
	Audit die publicatie-oppervlakte en bouw een kleine, reproduceerbare release.

## 2. Sterke En Zwakke Punten

### Sterk: de architectuur verdient behoud

1. **Modelgedreven uitvoering is echt aanwezig.** De MetaRegistry voedt factories,
	 routes, schema's en generieke handlers. Geen aparte handgeschreven API per domein.
2. **Een centrale transactionele schrijfengine.**
	 [RegistreerCore](../../handlers/registration_core.go#L93) is transportarm en
	 verwerkt audit, validatie en wijzigingen binnen een transactie. REST en GraphQL
	 kunnen daardoor dezelfde invarianten delen. De eerdere audit-bypass is aangepakt.
3. **Veiligheidsverbeteringen zijn substantieel.** Rolguards, verplichte JWT-secret
	 bij ingeschakelde auth, devtools-buildscheiding, conflictresponses en poolbeheer
	 zijn meer dan cosmetiek. De normale Go-suite is nu groen.
4. **De diagrammotor scheidt element en voorkomen.** Eén semantisch element kan
	 op meerdere diagrammen staan; layout is niet de identiteit van het model.
	 Dit is een goed vertrekpunt voor echte modeluitwisseling.
5. **Herbruikbare profiel-/activiteitcontracten.** Registries en descriptorvalidatie
	 voorkomen veel profielspecifieke UI-code. De snelle uitbreiding met notaties
	 is daardoor niet uitsluitend kopieerwerk.
6. **Testbare adapters bestaan al.** OAS en ArchiMate hebben pure parsing/mapping
	 en injecteerbare storekoppelingen. De 718 frontendtests zijn een bruikbare basis.
7. **Ongebruikelijk rijke domeinkennis.** Audit, canonieke semantiek, formulieren,
	 beleidsmodellering en API's zijn inhoudelijk gekoppeld, niet alleen naast elkaar gezet.

### Zwak: grenzen zijn nog niet overal expliciet

- **Brede POC, nog geen afgebakend productcontract.** Een werkend tekenprofiel,
	een uitvoerbaar metamodel en een verliesvrije serializer zijn verschillende claims.
- **Semantiek en presentatie zijn deels vermengd.** Een maximum van negen
	compartimenten in [typeRegistry](../../web/vite/src/diagramcore/types/typeRegistry.js#L18)
	is een UI-keuze, geen universele M3-wet. Vrije `data`-objecten bieden flexibiliteit,
	maar onvoldoende bewijs van modelconformiteit.
- **Twee implementaties van leestijdlogica.** REST en GraphQL hebben eigen laad-
	en filterpaden. R04 laat zien waarom transportadapters een gedeeld read-contract nodig hebben.
- **Grote frontendcomponenten en globale stores.** Extracteer langs commands,
	persistence, adapters en selectors, niet langs willekeurige regelaantallen.
	Voeg JSDoc-checking/TypeScript eerst aan publieke contracten toe; geen totale rewrite.
- **Opslag en samenwerking zijn niet hetzelfde.** localStorage en git-backed
	dev-endpoints zijn handig voor een maker, maar geen gedeelde repository met rechten,
	revisions, conflicten, herstel en audit.
- **Documentatie groeit als logboek.** Beschikbare kennis is rijk, maar de lezer
	moet actuele contracten uit historische aanvullingen reconstrueren.

## 3. Huidige Stand Van De Genoemde Gaten

| Onderwerp | Wat in deze checkout aantoonbaar bestaat | Wat nog nodig is |
|---|---|---|
| Materiele tijd | Aanvang/einde-plumbing, formele queryparser | generieke `t_m`-querysemantiek en gecombineerde tests |
| MMM/M3 | eigen descriptor-/type-/modelstructuur met validatie | expliciete conformance/mapping naar MOF; geen MOF-conformiteit aangetoond |
| MIM in Omnium | [MIM-activiteit](../../web/vite/src/studio/activities/mimActivity.jsx#L20) met `vanMimXmi` en canoniek-naar-MIM | volledige workflow in Modelleren, metagegevens, export en EA-roundtrip |
| Transformaties | centrale registry, opties, diagnostics en paneel | versioneerbaar uitvoerings-/trace-/mergecontract; nu vooral JS `run`-functies |
| OAS roundtrip | OAS 3.0/3.1-adapter met bronbehoud en tests | expliciete dekkingsmatrix, delete/rename/collision-tests en volledige dialectgrenzen |
| ArchiMate | Exchange-parser, mapping, views en Studio-import; tests groen | Exchange-export en bewezen Archi-terugreis inclusief layout/metadata |
| Canoniek naar/van OAS | runtime OpenAPI-export en OAS `components.schemas` naar canoniek | herleidbare tweerichtingssynchronisatie; import sluit operations bewust uit |
| GraphQL M2 | dynamisch runtimeschema vanuit MetaRegistry | apart SDL/introspectieprofiel, serializers en inverse mapping |
| DB-schema M2 | ERD-notatieprofiel bestaat | fysiek PostgreSQL-profiel, catalogusimport, DDL/migratie-export en drift/renamebeleid |
| Performance | declaratieve scenario's, loadrunner en historische cijfers | releasegebonden, herhaalbaar meetrapport inclusief netwerk en correctheid |
| Open source | publieke bron, third-party licenties | eigen licentie, governance, contribution/securitybeleid en herkomstcontrole |

De hoofd-README en het architectuuroverzicht liepen bij ArchiMate-import achter
op de code. "MIM zit niet in Omnium" is ook te absoluut: het zit in een
profielactiviteit, maar dat bewijst nog geen complete geïntegreerde import/export.

## 4. Materieel Queryen Zonder De Architectuur Te Verlaten

Leg eerst het contract vast, daarna pas SQL. Advies als startpunt:

1. Reconstrueer de formele toestand op `t_f`, inclusief correctie/ongedaanmaking.
2. Bepaal binnen die toestand de geldige aanvang/eindeversies van de hub.
3. Selecteer op materiele datum `t_m`, bijvoorbeeld halfopen `[aanvang, einde)`.
	 Beslis expliciet wat ontbrekende grenzen, gelijk begin/einde en onbekende datum betekenen.
4. Bepaal hoe parent, relatie en doelentiteit elkaar beperken. Een geldig kind
	 betekent niet automatisch een geldige parent of doelentiteit.
5. Houd `t_f` een instant met timezone en `t_m` een domeindatum waar het model
	 dat vraagt. Een toekomstige materiele datum is toegestaan; een formele toekomst
	 behoeft een expliciete afwijzings-/clampregel.

Maak dit één metadata-gedreven leesplan, gedeeld door REST, GraphQL, count en
reverse/forward navigatie. Geen per-domein SQL in handlers. De huidige
[parser](../../handlers/full_handlers.go#L24) accepteert `peiltijdstip` als
RFC3339 en `t` als demo-integer; introduceer nieuwe parameters zonder die stil
anders te interpreteren.

Minimale testmatrix: geen grenzen; alleen begin; alleen einde; exacte grens;
toekomst; overlap; correctie van alleen aanvang/einde; correctie van data;
ongedaanmaking; afgevoerde parent; twee formele peilmomenten voor dezelfde
materiele datum; meerdere domeinen en gelijktijdig lezen/schrijven.

## 5. M3, Profielen En Roundtrips

### Geen volledige MOF-herbouw als eerste stap

MOF is het OMG-raamwerk voor metamodeldefinitie; XMI serialiseert modellen met
identiteiten en referenties. XMI is niet zelf de UML-semantiek en garandeert geen
EA-layout of leveranciersmetadata. Een eigen M3 kan een exportmapping hebben;
een MOF-conform M3 kan nog steeds een verliesgevende tooladapter hebben.

Ook "profiel" vraagt precisie: Omnium gebruikt dit voor een configureerbare
modeltaal. Een UML Profile is specifieker: stereotypes/tagged values/constraints
op UML-metaclasses, niet iedere willekeurige taaldefinitie.

**Aanbevolen scheiding:** semantisch metamodel, modelinstanties, diagramweergaven,
stijlen en tool-extensies. Leg namespace URI, model-/type-/elementidentiteit,
metamodelversie, types, cardinaliteiten, containment/opposites, overerving en
constraints vast. Maak een expliciete mapping naar een relevante EMOF/Ecore-subset
waar dat interoperabiliteit oplevert. Bouw pas meer MOF als een concrete afnemer
of conformancetest het nodig heeft. Presenteer een subset ook als subset.

### Roundtrip is een contract, geen exportknop

Onderscheid vier niveaus: syntax opnieuw kunnen lezen, dezelfde semantiek behouden,
dezelfde diagrammen behouden en wijzigingen uit twee bronnen kunnen samenvoegen.
Per adapter zijn expliciete ondersteunde versies en verliescategorieen nodig.

Een bruikbaar generiek contract bevat:

- Bron-/doelmetamodel en versies, adapter-/regelversie en bronhash.
- Stabiele ID-mapping en trace-links, inclusief many-to-one en one-to-many.
- Een bewaarde baseline van de laatste synchronisatie.
- Bekende mappings, onbekende extensies als getypeerd opaque/restmateriaal,
	en diagnostics op element-/eigenschapsniveau.
- Dry-run met semantische diff; nooit automatisch destructief toepassen.
- Three-way merge: oorspronkelijke baseline, huidige lokale toestand en nieuwe
	externe toestand. Rename, delete, splitsen en tegengestelde edits zijn expliciete conflicten.
- Eén atomaire toepassing met undo/rollback en een machineleesbaar verliesrapport.

Stabiele IDs moeten onafhankelijk van namen en proceslokale tellers zijn. De
[OAS-importprefix](../../web/vite/src/diagramprofielen/canoniek-uml/oasCanoniekImport.js#L88)
is prima voor toevoegen binnen een sessie, maar geen synchronisatie-identiteit.

### Concreet Per Doelformaat

| Keten | Eerste afgebakende oplevering | Bewijs dat nodig is |
|---|---|---|
| UML / Sparx EA | specifieke UML/XMI-versie, packages/classes/properties/associations/generalizations en relevante profiles | EA-export naar Omnium, wijziging, terug naar EA en opnieuw exporteren; GUIDs, tags en ontbrekende layout expliciet vergelijken |
| MIM | MIM-versie en EA-profielvariant, metagegevens en bestaande importer hergebruiken | echte MIM-fixtures, validatie en volledige heen-/terugmatrix; generieke UML-export is niet vanzelf MIM-export |
| ArchiMate / Archi | Open Group Exchange als contract; bouw export op bestaande import-IR | meertaligheid, properties, organizations, views, meerdere voorkomens, stijl en niet-ondersteunde connection-vormen |
| OAS | huidige bronbehoud/delta-aanpak versterken | `$ref`, nullability, enumtypen, composites, defaults, security, rename/delete en onbekende extensions |
| GraphQL | SDL-parser/printer en introspectie naar eigen profiel | object/interface/union/input/scalar/enum, list/non-null-wrappers, argumenten/defaults/directives; introspectie behoudt niet alle brontekst |
| PostgreSQL | read-only catalogusimport naar fysiek profiel | schema's, kolomtypen, PK/FK/unique/check, defaults, identity, indexes/views; DDL diff pas na expliciete goedkeuring |

EA- en Archi-desktop-roundtrips zijn in deze review niet uitgevoerd. Een serializer-
unittest mag niet als bewijs van interoperabiliteit met die producten worden verkocht.

### Een Transformatietaal: Eerst Het Model, Dan De Syntax

Maak bovenop de bestaande registry een `TransformationSpec` en `TransformationRun`:
bron/doel, toepasselijke profielen, pre-/postcondities, regels, parameters,
traceability, verliesclassificatie en conflictoplossing. Scheid pure planning van
toepassing op stores. Laat dezelfde runner in UI en CLI draaien.

Gebruik voor selectors/condities een beperkte bestaande expressietaal, bijvoorbeeld
CEL voor zover frontend/backendsemantiek aantoonbaar gelijk is. Geen vrij JavaScript
uit geimporteerde profielen uitvoeren. Complexe mappings blijven aanvankelijk
geteste plugins. Vergelijk met QVT Relations/QVT Operational, ATL of Epsilon aan
de hand van twee echte mappings; een eigen universele taal bouwen is nu te duur.
Die ecosystemen hebben bovendien deployment-/toolingkosten die niet verdwijnen
doordat hun begrippen goed passen.

### Canoniek Naar API En Terug Is Niet Algemeen Inverteerbaar

Een OAS- of GraphQL-schema vertelt niet vanzelf welke velden hubs, geversioneerde
data, afgeleide waarden of materiele grenzen zijn. Flattening en schema-compositie
verliezen betekenis. Leid die niet stil uit naamgeving af.

Voor eigen gegenereerde schema's: draag canonieke identiteit, herkomst en mapping-
versie mee in bijvoorbeeld `x-omnium-*`, directives of een sidecar. Bewaar de
baseline. De terugrichting levert een **wijzigingsvoorstel** op het canonieke model,
geen onvoorwaardelijke vervanging. Voor vreemde schema's zonder herkomst is het
een import met aannames, confidence en handmatige bevestiging.

No-op roundtrip moet semantisch gelijk blijven. Een ondersteunde doelwijziging
moet na toepassing en opnieuw genereren terugkomen. Onbekende restinformatie blijft
behouden of verschijnt expliciet als verlies; conflicten mogen geen stille voorkeur krijgen.

## 6. Performance: Wat Weten We Echt?

### Bestaande Metingen, Niet Opnieuw Gedraaid

Bronnen: [poolbevinding](../../test/2026-09-18-bevinding-001-too-many-clients-bij-loadtest.md)
en [regressiehandleiding](../REGRESSIETEST.md#referentiecijfers). Het betreft
in-process API-tests op een dev-laptop met PostgreSQL in Docker, geen productie-
throughputclaim. De poolfix is een sterk resultaat, maar niet dezelfde verandering
als een optimalisatie van het modelgedreven queryplan.

| Workload | Voor poolfix | Na poolfix | Betekenis |
|---|---|---|---|
| sc 30, 100 VU x 2, kleine seed | 922 req/s; p95 251 ms; 5 fouten | 3510 req/s; p95 70 ms; 0 fouten | korte piekproef; geen langdurig capaciteitsbewijs |
| sc 32, 2000 NP, 16 VU | 674 req/s; p95 87 ms | 2109 req/s; p95 23 ms | nuttige lokale leesbaseline |
| sc 33, gemengd | eerder 10 fouten op 3827 requests | snapshotprobleem nog open | snelle maar incorrecte responses zijn geen geslaagde performance |

Rapporteer p95 per operatie, niet alleen over gemengde requests. De oude
[performancehandleiding](../../performance_test.md) verwijst nog naar v05 en is
niet de actuele v06-loadhandleiding. Maak die historisch of laat haar doorverwijzen.

### Een Reproduceerbaar Meetrapport

Per run bewaren: commit, modelhash, adapter/codegenversie, hardware/OS, Go/Node/PG,
pool/proxy/authconfig, datasetvolume *en historiediepte*, seed, distributie/skew,
gelijktijdigheid of arrival rate, warmup, duur en ruwe meetdata. Geen secrets in rapporten.

Meet drie lagen apart: pure mapping/serialisatie (`benchmem`), API+echte PG,
en end-to-end via TLS/proxy vanaf een aparte loadgenerator. Gebruik de bestaande
scenario's als semantische bron en k6/Hurl-export waar passend. Voeg een open
arrival-rate-proef toe: een gesloten VU-test vertraagt zichzelf bij verzadiging.

Workloads: actuele detail/lijst/full; formeel tijdreizen diep in historie; later
materieel en gecombineerd; GraphQL met fan-out; corrigeren/ongedaan maken onder
contention; bulkimport; mix lezen/schrijven; grote Studio-modellen. Begin met de
2000-recordbaseline en schaal naar grotere aantallen en histories binnen een
afgesproken testbudget. Herhaal minstens drie runs en voeg een duurtest toe.

Metrieken: p50/p95/p99, throughput, fouten per categorie (409 apart), correcte
antwoorden, responsebytes, queryaantallen, CPU/RSS/allocaties/GC, pool wait,
lock waits/deadlocks, WAL en I/O. Bewaar `EXPLAIN (ANALYZE, BUFFERS)` en profiles
voor de duurste representatieve queries. SLO's vooraf afspreken, niet na de meting
aan de uitkomst aanpassen. Onvoldoende hardware-/netwerkmetadata = geen vergelijkbare run.

### Sneller En Nog Steeds Modelgedreven

| Stap | Optie | Wanneer / aandachtspunt |
|---|---|---|
| 1 | Request-scoped batching en loaders | GraphQL forward/reverse N+1; cachekey bevat type, ID, leescontext en autorisatiescope |
| 2 | Metadata bij startup compileren naar read-/validatieplannen | veldpaden, joins, reflectie-indexen en CEL-programma's niet per record opnieuw afleiden |
| 3 | Getypeerde accessors en serializers genereren | vervang gemeten hotspots in struct -> JSON -> map; model blijft bron, compiler doet meer werk |
| 4 | Set-based SQL, indexes en queryplanning | herschrijf gecorreleerde tijdreisfilters alleen na EXPLAIN; LATERAL is geen automatische versnelling |
| 5 | Transactionele actuele leesprojecties | behoud audit als waarheid; rebuildbaar, gecontroleerd op gelijkheid met generieke referentie-uitvoering |
| 6 | Read replicas, asynchrone projecties of partitionering | pas bij bewezen volume; expliciete lag/stand, read-your-writes en herstelcontract |

Niet kiezen tussen "alles reflectie" en "alles handwerk". Een metadata-compiler
plus gegenereerde hot paths is vaak het passende midden. Laat tests de generieke
referentie en geoptimaliseerde uitvoering over hetzelfde model vergelijken.

Frontend: `JSON.stringify` van het hele model voor undo-equality en localStorage
bij elke storemutatie geeft O(modelgrootte)-werk bij interacties. Meet input latency
en drag/zoom met 100/1000/5000 elementen; optimaliseer selectors, structural sharing,
gegroepeerde commands, async persistence en workers voor parsing/layout. Activiteiten
worden veelal eager geimporteerd: scheid lichte descriptors van lazy geladen editors.
Geen bundle- of FPS-cijfers geclaimd: die zijn hier niet gemeten.

## 7. Documentatie En Eerste Kennismaking

De hoofd-README legt inmiddels goed uit *waarom* Omnium bestaat. Het probleem is
de volgende stap: de [v06-README](../../README.md#L1) begon bij aanvang met een oude
CR-API, Go 1.16, verbinding aanpassen in code en `go run main.go`. Het werkelijke
[go.mod](../../go.mod#L3) vraagt Go 1.25.0; `go run .` neemt ook de overige bestanden
van package main mee. De performancehandleiding wijst naar v05. Het architectuur-
overzicht beweerde dat ArchiMate Exchange-import nog ontbrak. De README-intro en
quickstart, de formeel/materieel-status en de ArchiMate-status zijn in deze taak
gecorrigeerd; een schone installatie en complete herziening van oudere docs niet.

Ook oudere reviews hebben een oorspronkelijk negatief eindoordeel onder een lange
reeks opgeloste statusupdates. Dat is als geschiedenis nuttig, als actuele onboarding
verwarrend. De in instructies genoemde `uml-editor/README.md` bestaat in deze checkout
niet; de actieve bronnen staan onder `web/vite/src`.

**Aanbevolen structuur:**

- Eén startpagina met productbelofte, doelgroep, stabiel/preview/gepland en demo.
- Eén actuele lokale quickstart, gecontroleerd op een schone clone; productie apart.
- Begrippenkaart M3/M2/M1/M0, profiel versus UML Profile, model versus diagram,
	canoniek versus API-/opslagmodel, formeel versus materieel.
- Taakgerichte handleidingen: importeren, model bewerken, exporteren, publiceren,
	corrigeren/tijdreizen. Ieder met verwachte uitkomst en bekende beperkingen.
- Technische referentie met eigenaar, status en laatst geverifieerde versie.
- ADR's voor besluiten; chatlogs/plannen als achtergrond, niet als normatieve handleiding.
- Automatische controle op links, commando's en featurestatus. Eén capabilitymatrix
	voor UI en docs voorkomt twee verschillende waarheden.

De bijgevoegde [walkthrough](../OMNIUM_WALKTHROUGH.md) biedt een eerste leesroute
en afgebakende oefening. Het is geen claim dat een schone installatie of alle
desktopinteroperabiliteit in deze review is getest.

## 8. Licentie En Open Werken

**Voorkeursrichting: EUPL-1.2 als een gemeenschappelijk onderhouden publieke kern
en de Nederlandse/Europese overheidsmarkt centraal staan.** Kies MIT wanneer
maximale ongeconditioneerde inbedding, ook in gesloten producten, expliciet zwaarder
weegt. Beide staan commercieel gebruik toe. De licentie is niet het verdienmodel.

| Keuze | Sterkte | Consequentie |
|---|---|---|
| MIT | eenvoudig, lage hergebruikdrempel, ruime proprietary inbedding | afgeleide verbeteringen hoeven niet openbaar terug; weinig bescherming tegen gesloten forks |
| EUPL-1.2 | wederkerigheid, Europese juridische context, expliciete compatibiliteitsregeling | communicatie/distributie en bronbeschikbaarheid zorgvuldig beoordelen, ook bij online dienstverlening |
| EUPL plus aparte commerciele licentie | afwijkende afspraken mogelijk voor eigen rechthebbenden | alleen bij voldoende rechten op alle bijdragen; geen eenvoudige ontsnapping aan third-party verplichtingen |

Niet `MIT OR EUPL` aanbieden als je wederkerigheid beoogt: de ontvanger kan dan MIT
kiezen. EUPL is evenmin een verplichting voor iedere opdracht van de NL overheid.
Het algemene beleid is **open, tenzij**; vraag per aanbesteding naar concrete
licentie-, toegankelijkheids-, security- en hostingvoorwaarden. Geen juridisch advies:
laat de uiteindelijke keuze en afhankelijkheidscompatibiliteit toetsen.

EUPL's communicatiebegrip omvat ook toegang tot essentiele functionaliteit. Dat
maakt "we hosten alleen, dus geen bronverplichtingen" geen veilige aanname.
Het maakt klantdata en onafhankelijk gemaakte modellen niet automatisch openbaar.
Regel software, documentatie, voorbeelden, merkassets, klantmodellen en gegenereerde
code apart; templates kunnen wel beschermd materiaal in output opnemen.

Voor publicatie: rechthebbenden/bijdragen/meegeleverde modellen inventariseren,
projectlicentie en notices, SBOM, contributorbeleid (bijvoorbeeld DCO; CLA alleen
bij een onderbouwde behoefte), SECURITY/contact voor vertrouwelijke meldingen,
release-/supportbeleid en maintainerrollen. Bouw CI en een kleine golden-corpus
met vrij deelbare fixtures. Controleer ook modelstandaarden, vendorassets en
chatexports op rechten, persoonsgegevens en secrets. Deze review publiceert geen
live accounts, geheimen of interne deploymentadressen.

## 9. Positionering En Geld Verdienen

### Aanbevolen Positionering

**Omnium Studio: een open modelwerkbank die informatiemodellen verbindt met
toetsbare API-contracten, beleid en herleidbare registerimplementaties.**

De eerste verkoopbare belofte moet smaller zijn: *van bestaand informatiemodel
naar controleerbaar API-contract, met zicht op wijzigingen en informatieverlies*.
Dat spreekt een informatiearchitect/API-team concreter aan dan "alle notaties
in één editor" of "een nieuw universeel M3".

Positioneer aanvankelijk naast EA en Archi, niet als volledige vervanger. Het
onderscheid zit in de uitvoerbare keten, traceability en semantische kwaliteitscontrole.
De breedte aan profielen ondersteunt die keten, maar is op zichzelf geen houdbaar
concurrentievoordeel. AI is een hulpmiddel, niet het bewijs dat de mapping klopt.

Houd productmatig drie delen herkenbaar, voorlopig zonder verplichte reposplitsing:
Studio (modelleren), adapters/conformancetests (uitwisseling) en registerruntime
(opslag/uitvoering). Een klant moet Studio kunnen gebruiken zonder al voor jouw
registerarchitectuur te kiezen. Dat verlaagt adoptierisico.

### Verdienmodellen In Volgorde Van Haalbaarheid

1. **Betaalde interoperabiliteitspilot.** Eén klantmodel, één afgesproken keten,
	 een diff-/verliesrapport, tests en overdracht. Vast bereik; geen belofte dat elk
	 willekeurig model automatisch uitvoerbaar wordt. Dit valideert zowel techniek
	 als betalingsbereidheid.
2. **Implementatie, migratie en training.** Profielen inrichten, legacy-mapping,
	 API-/modelkwaliteit en teams opleiden. Snelste omzet, maar bewaak dat verbeteringen
	 herbruikbaar worden en niet als klantspecifieke forks blijven leven.
3. **Onderhoud/support en managed omgeving.** Abonnement voor upgrades, backups,
	 beveiligingsonderhoud, hosting en afgesproken responstijden. Pas na herstelproeven,
	 tenant-/projectisolatie, observability en releasehardening SLA's aanbieden.
4. **Gezamenlijk gefinancierde adapterroadmap.** Meerdere organisaties financieren
	 MIM/EA, Archi of GraphQL-conformiteit, met open oplevering. Partners leveren
	 domeinexpertise en fixtures; jij onderhoudt de generieke kern.

Een betaalde gesloten enterprise-editie of dual licensing kan later, maar kies dat
niet als eerste reddingsboei. Het vraagt rechtenbeheer, duidelijke productgrenzen
en echte enterprisefunctionaliteit. Open bron neemt de waarde van onderhoud,
garanties en integratiewerk niet weg; het neemt exclusiviteit op de bron weg.

### De Komende Marktproef

Spreek 5-8 potentiele gebruikers, met architect, API-eigenaar en budgethouder als
aparte rollen. Vraag naar de laatste echte model/API-drift, huidige uren/kosten,
welke tools niet vervangen mogen worden en welk resultaat een betaalde pilot waard is.
Kies 2-3 designpartners; neem alleen een tweede keten op als iemand die nodig heeft.

Stuur op tijd tot eerste bruikbaar importresultaat, aantal handmatige correcties,
gedetecteerde conflicten, reproduceerbare export, bespaarde doorlooptijd en betaalde
vervolgopdracht. Nog geen omzet- of marktgrootteclaim: daarvoor ontbreekt bewijs.
Prijs een pilot op afgebakende inspanning/waarde en houd supportkosten zichtbaar.

## 10. Uitvoerbare Backlog En Volgorde

Onderstaande bandbreedtes zijn planningshypothesen voor een ervaren ontwikkelaar
die de code kent, geen offerte. Complexe interop hangt vooral af van fixtures en
afspraken met afnemers. Productkeuzes zijn aanbevelingen, nog geen genomen besluiten.

| Item | Prio | Oplevering / klaar als | Omvang |
|---|---|---|---|
| SEC-01 | P0 | SVG-invoer centraal veilig; regressies voor iconen/vormen (R01) | S-M |
| SEC-02 | P0 | GET-mutaties geweigerd en cookie-CSRF-contract getest (R02) | S |
| READ-01 | P1 | alle samengestelde reads delen een snapshot; sc 33 correct (R03) | M-L |
| TIME-01 | P1 | peilmoment blijft behouden door GraphQL-navigatie (R04) | M |
| VAL-01 | P1 | presence/ref-validatie modelgedreven, inclusief PATCH en seeds (R05) | L |
| LIMIT-01 | P1 | body/query/concurrency/deadlinebudgetten (R06) | M |
| ST-01 | P1 | saved-baseline, dirty/undo/reload en opslagfouten kloppen (R07/R09) | M-L |
| ST-02 | P1 | atomaire map-import met conflicts/diagnostics en complete export (R08) | M |
| QA-01 | P1 | cross-platform testscript; CI kan niet groen met nul tests (R10) | S |
| QA-02 | P1 | Omnium E2E: nieuw/import/edit/undo/export/reload/conflict + toetsenbord | M |
| READ-02 | P2 | historische count/paginering klopt (R11) | S |
| UX-01 | P2 | menubar en splitters keyboard/pointer-toegankelijk (R12) | M |
| REL-01 | P1 | dependencytriage, productieconfig, licentie/CI/securitybeleid (R13) | M |
| PERF-01 | P1 | versiegebonden nulmeting met correctness, tail latency en ruwe data | M |
| TIME-02 | P1 | contract + generieke formeel/materieel-querymatrix, gedeeld leesplan | L |
| RT-01 | P1 | TransformationSpec/Run, baseline/trace/diff en verliesrapport | L |
| RT-02 | P1 | één bewezen pilotketen MIM/UML-EA of OAS-canoniek-OAS | L-XL |
| RT-03 | P2 | ArchiMate Exchange-export + echte Archi-roundtrip | L |
| MM-01 | P2 | semantiek/presentatie scheiden; MOF-mappingmatrix en versiecontract | L |
| MM-02 | P2 | GraphQL-profiel + SDL/introspectie + fixtures | L |
| MM-03 | P2 | fysiek PG-profiel + catalogusimport + veilige migratiediff | L-XL |
| DOC-01 | P1 | actuele quickstart, capabilitymatrix, walkthrough en linkchecks | M |
| BIZ-01 | P1 | licentiekeuze en betaalde pilot met toetsbaar klantresultaat | parallel |

S = circa 1-2 dagen, M = 3-5 dagen, L = 1-2 weken, XL = meerdere weken; inclusief
gerichte tests, exclusief onbekende externe toolverschillen. Niet alle items in
één kwartaal plannen. Laat securitytriage de echte volgorde bepalen.

**Fase A, vertrouwen (circa 2-4 weken):** P0, testpoort, belangrijkste read-/opslag-
correctheid en actuele statusdocs. Marktgesprekken parallel. Geen externe gedeelde
pilot met onbetrouwbare assets zolang P0 open is.

**Fase B, één keten (circa 4-6 weken):** minimale trace/diff-infrastructuur en de
door een partner betaalde roundtrip. Meet prestaties en informatiesemantiek samen.
Een eigen generieke transformatietaal of volledige MOF-port is hier geen voorwaarde.

**Fase C, gerichte verbreding:** materiele queryuitvoering en extra M2/adapters op
basis van gebruik. Een registergerichte klant trekt TIME-02 naar voren; een
modelleerpilot hoeft daarop niet te wachten. Geen SaaS-belofte voor multi-tenancy
voordat isolatie en gedeelde opslag werkelijk zijn ontworpen en getest.

## 11. Verificatie En Grenzen

| Controle tijdens deze review | Resultaat |
|---|---|
| Formele queryparser via VS Code testrunner | 5 controles geslaagd |
| Gerichte GraphQL/auth/routertests | 17 controles geslaagd |
| `go test ./...`, zonder integration-tag | alle testbare packages geslaagd |
| Gerichte Node-suite (store, OAS, ArchiMate, registry) | 63 tests geslaagd |
| Standaard `npm test` | exit 0, maar 0 tests; bevinding R10 |
| Alle `src/**/*.test.js` expliciet aan Node doorgegeven | 718 tests geslaagd, 0 mislukt/overgeslagen |
| Browser laadt bestaande lokale Studio | shell rendert; geen volledige UX-/responsive-audit |
| Onschuldige SVG-probe met echte icoonfunctie | event-attribuut behouden en uitgevoerd; tijdelijk DOM-element verwijderd |
| Undo-geheugenprobe met echte storefactory | gewijzigde naam met `isDirty=false` bevestigd |
| npm advisorycontrole | 7 high, 0 critical; bereikbaarheid niet volledig bepaald |

Niet gedaan: productiepenetratietest, nieuwe database-load/reset, volledige
integratiesuite, race detector, Go-vulnerabilityscan, frontendproductiebuild,
volledige browser-E2E, clean-clone-installatie, EA/Archi-desktoproundtrip en
juridische dependency-/licentietoets. Die beperkingen maken dit een bruikbare
prioriteringsreview, geen productieverklaring. Geen applicatiecode, dependencies,
databases of bestaande gebruikersmodellen aangepast; geen commit of push uitgevoerd.

## 12. Bronnen Voor Standaarden En Licenties

Primaire bronnen geraadpleegd op 2026-09-30:

- [OMG MOF 2.5.1](https://www.omg.org/spec/MOF/2.5.1/About-MOF): metamodeldefinitie,
	identifiers en reflectieve modeloperaties.
- [OMG XMI 2.5.1](https://www.omg.org/spec/XMI/2.5.1/About-XMI): XML-representatie,
	identiteit en verwijzingen; niet een garantie voor tool-specifieke semantiek/layout.
- [OSI MIT-licentie](https://opensource.org/license/mit).
- [Europese Commissie: EUPL-1.2](https://interoperable-europe.ec.europa.eu/collection/eupl/eupl-text-eupl-12)
	en de [volledige Engelse tekst](https://interoperable-europe.ec.europa.eu/sites/default/files/custom-page/attachment/2020-03/EUPL-1.2%20EN.txt),
	met name artikelen 1, 3, 5, 6 en 9.
- [Digitale Overheid: opensourcewerken](https://www.digitaleoverheid.nl/overzicht-van-alle-onderwerpen/open-source/):
	beleid open, tenzij; dit is geen algemene eis om uitsluitend EUPL te kiezen.