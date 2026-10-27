# Omnium op Fundament — inrichting van e-diensten (opdracht en coördinatie)

Datum: 2026-10-22 · Opdracht van Mark aan de sessie BACKEND; coördinatie met de sessies
FUNDAMENT (beheert Fundament, de experimentele soevereine NL-overheidscloud) en TRANSFORMATIES
(`docs/TRANSFORMATIES.md`). Dit document is de overdracht: §1 is Marks tekst letterlijk, §2 is wat
BACKEND aan FUNDAMENT heeft meegegeven over het uitrollen van Omnium, §3 de vraag aan
TRANSFORMATIES, §4 de gedachten en vragen van BACKEND, §5 de stand van de coördinatie.

## 1. Opdracht van Mark (letterlijk, 22-10-2026)

> Ik zou op Fundament (de chat FUNDAMENT beheert dat: het is de nieuwe - nu nog in een
> experimentele fase verkerende souvereine NL overheidscloud) het volgende willen installeren, het
> liefst in een semi-separate (sub-)omgeving.
> - De Omnium front end (i.i.g. de IDE, Studio, weergave en inhoud)
> - Omnium backend, maar inclusief de codebase
> - De mogelijkheid vanuit de FE de codegenerator aan te sturen met een V3 model
> - en daarna de backend opnieuw te kunnen bouwen en daarna te herstarten
> - een aantal (standaard en/of custom) formulieren kunnen draaien, dus inclusief Widgets (dat is
>   weergave en inhoud)
>
> Daarnaast zou ik uit de data die in de nieuwe MDA-backend zit *middels transformaties*
> **inrichting** willen kunnen uitvoeren in de op fundament geinstalleerde Common Ground
> componenten.
>
> Dit is nieuw. Dit is Model Driven, Data Driven Configuration (we noemen dit **inrichting** om het
> onderscheid met de technische configuratie te kunnen maken, die meer gaat over poorten en tokens
> enzo). We moeten daarbij in het model achter de inrichtingsdata een aantal dingen heel duidelijk
> noteren:
> - welke componenten in welke versie staan geinstalleerd? (Dit is een soort productmodel als
>   Imprint al gebruikt) (zie UML)
> - welke datatypen in elk component beheerd worden (dat is een inhoudelijk model, a la DiDo,
>   volgende plaatje en het componenten overzicht daarna. Die registers zouden ongeveer moeten
>   mappen op wat er nu in Fundament staat, maar veel mist er nog, wat wordt opgevangen met het
>   generieke OpenObject(en).)
> - Welke **e-dienst** (lees: business service, product/dienst, of concrete use case
>   specialisatie) richten we in. Wat is de versie daarvan. Op welke componenten baseert deze zich
>   (dependencies) en welke data is daar allemaal nodig om deze dienst werkend te krijgen?
>
> De data die onder een e-dienst valt zit typisch in deze hoek:
> - producttype (aanwezig, en welke naam en versie), anders toevoegen / versie ophogen en de
>   gewenste versie toevoegen aan OpenProduct
> - zaaktype (is de data onder een procestype)
> - het procestype = BPMN (dat kan netjes in Omnium getekend worden) -> dat moet in GZAC zitten,
>   met de juiste naam en versie, of daaraan toegevoegd worden via het gangbare BPMN-exchange
>   formaat
> - Verzoektype, dat nog in OpenObjecten aangemaakt zou moeten kunnen worden (zelfde stramien)
> - Formuliertype, idem, in OpenFormulieren, waarbij er een json schema vastligt waarin de data
>   van het ingevulde formulier in het verzoek landt
> - eventuele onderliggende klanttaken, met bijbehorend formulier en json schema
> - Beschikkingtype (zaakresultaat of gevolg) met schema.
>
> Mijn idee is dat alle data-typen, schema's en toestanden die heen en weer gaan, zoveel als
> mogelijk uit 1 canoniek model gegenereerd worden.
>
> Dat is in wezen dus de transformatie van het ene M1 naar het andere. Dat andere is nu dus vaak
> een simpel json schema dat voor een bepaalde inrichting in een bepaald component in een bepaald
> veld moet landen. FUNDAMENT weet hoe dat werkt, daar hoef jij je geen zorgen over te maken; dit
> is voor de context. Wat jij moet doen is FUNDAMENT uitleggen hoe het zulke transformaties
> inricht. Dat zul je misschien dan weer de TRANSFORMATIES chat in dit project moeten vragen. Deze
> kan dat ook direct aan FUNDAMENT vertellen. Maar wil jij dit coordineren?
>
> Het is dan aan FUNDAMENT om te zorgen dat zulke getransformeerde M1's landen op de juiste plek.
> a. in het inrichting-register (om een geheugen daarvan op te bouwen)
> b. in het juiste component, als concrete inrichting
>
> Het idee is dat je daarmee, als je de technische configuratie op een omgeving gedaan hebt, een
> **functionele inrichting** van een **e-dienst** kunt 'kiezen' uit het e-dienst-inrichtingregister
> en met een druk op de knop kunt 'uitrollen'.
>
> Dus:
> - wil je dit idee aan FUNDAMENT doorspelen (letterlijk)
> - wil je wat jij kunt doen: hoe met de Omnium FE/BE/codegen om te gaan doorgeven; wat is de beste
>   manier? Indien codegen waarschijnlijk geen docker, of het hele proces op de server mogelijk
>   maken van build - docker image - run docker image. Let wel: het register is **geen
>   productieregister** in de zin van dat het bij elke gemeente draait: het is een soort centrale
>   bibliotheek waarmee wij productie-instanties maken. Het is een soort meta-productie...
> - wil je TRANSFORMATIES ook inlichten en vragen FUNDAMENT uit te leggen hoe met transformaties
>   om te gaan.

Bij de opdracht horen drie UML-plaatjes (context, geen Omnium-modellen): het productmodel zoals
Imprint het gebruikt (Product, ProductRelease, Component, ComponentVersion,
ProductComponentItinerary met afgeleide first/lastRelease; Standaard/Specificatie); een
DiDo-achtig inhoudelijk model (Documentatie/Werkmap, Uitvoering: Verzoek, Melding, Aanvraag,
Afhandeling, Taak, Contact, Gevolg; Relatiebeheer: Partij; Persoon; HR); en het
Common-Ground-componentenoverzicht (laag 4+5 mijnomgeving, formulieren-dienst, werkdossierbeheer,
zaak-beheer, handeling-component; laag 3 notificatie- en ketenpartner-diensten; laag 1+2 de
registers: procesdefinitie, formuliertype, verzoektypen, verzoeken, werkdossier, klantcontacten,
berichten, handelingen, gevolgen, partij, organisatie, producten/producttypen, configuratie,
selectie- en referentielijsten, doelbinding, autorisatie (PAP/PDP/PEP/PIP); beheer en generieke
hulpdiensten).

## 2. Omnium op Fundament — wat BACKEND aan FUNDAMENT heeft meegegeven

### 2.1 Wat de stack is (zoals hij nu op de VPS draait)

`deploy/vps/docker-compose.vps.yml`: **postgres 16**, **MinIO** (S3; bucket `ide-bestanden`,
aangemaakt door `minio-init`), **api** (Go, image `markwestbroek/bitemp-go-api`), **render-svc**
(SVG/PNG-rendering voor export en gedeelde plaatjes), **frontend** (nginx, image
`markwestbroek/bitemp-viz-frontend`; `API_UPSTREAM`, `FRAME_ANCESTORS`, `NGINX_RESOLVER` via
`deploy/frontend/default.conf.template`), optioneel **OpenFTV** (manager + pdp + eigen postgres)
voor toegang op beleid. TLS en routering: Caddy vóór de stack. Alles is state in volumes
(postgres, minio); de containers zelf zijn vervangbaar. Documentatie: `docs/VPS_DEPLOYMENT.md`,
`deploy/vps/update.sh` (pull + herstart + smoke-test), `RELEASE.md`.

### 2.2 Twee assen van verandering — en welke route bij welke hoort

| As | Wat verandert | Route | Frequentie |
|---|---|---|---|
| **Software** (Omnium zelf: Studio, API, render-svc) | een nieuwe release | nieuw image bouwen (`Dockerfile.api`, `Dockerfile`, `Dockerfile.devloop`) → registry → `update.sh`-achtige pull + herstart | per release, weken |
| **Model** (het V3-model: domeinen, entiteiten, formulieren) | codegen → nieuwe gegenereerde Go-code → nieuwe binary | **in-container rebuild** (devloop) | per modelwijziging, minuten |

De vraag "codegen zonder Docker, of het hele proces build → image → run op de server" is dus
geen óf-óf. Voor **modelwijzigingen** is de in-container rebuild de ontworpen en geteste route;
een image per modelwijziging bouwen is daarvoor te zwaar en te traag. Voor **softwarereleases**
blijft image-bouw de route.

### 2.3 De devloop-container: de rebuild-route die er al is

`Dockerfile.devloop` + `docker-compose.devloop.yml` + `scripts/devloop-entrypoint.sh` +
`handlers/rebuild_handler.go`; handleiding `docs/DEVLOOP.md`. Het image bevat de Go-toolchain,
Node, de **volledige broncode**, de frontend-build, voorgecompileerde `bin/codegen` en
`bin/export_v3`, en een schone `_baseline/model/`. De API is gebouwd met `-tags devtools`, de
enige build waarin `/admin/*` bestaat (`/admin/rebuild`, `/admin/diff`, `/admin/droptables`,
`/admin/rebuild/status`). Omgevingsvariabelen: `DEVLOOP=true`, `DEVLOOP_CONTAINER=true`,
`DEVLOOP_PASSWORD`, en voor leegmaken `ALLOW_DROP_TABLES` + `ADMIN_DROP_PASSWORD`.

De keten, van knop tot herstart:

1. Studio: *Publiceer + Rebuild* met een of meer domeinen aangevinkt →
   `POST /admin/rebuild/<DEVLOOP_PASSWORD>` met het V3-model (of met een opgeslagen
   schema-versie-id uit de database, of zonder body: huidige code opnieuw).
2. In de container: baseline-sync van kernbestanden, opschonen van de gegenereerde bestanden van
   de doeldomeinen (`model/<prefix>_*.go`), backup van `model/` naar `_pre_rebuild/`, per domein
   `bin/codegen --mode additive --domein … --prefix … --output model/`, dan
   `go build -tags devtools`. Mislukt codegen of build, dan rollback uit `_pre_rebuild/`.
3. Gelukt: de API eindigt met **exit 42**; de entrypoint-loop start de nieuwe binary. Crasht de
   nieuwe binary binnen 10 s, dan herstelt de entrypoint `model/` uit `_baseline/` en bouwt
   opnieuw. Onderbreking: seconden.
4. Het model zelf staat los van de container in de database (`schema_versies`, met een actieve
   versie) en is altijd uit de draaiende code te halen (`GET /api/schema/model/code`).

Dit is meta-productie, geen gemeentelijk productieregister: de centrale bibliotheek waarmee
instanties gemaakt worden. Seconden onderbreking bij een rebuild past daarbij.

### 2.4 Als Fundament geen toolchain in een draaiende container toestaat

Dan is het alternatief een **builder-job**: een aparte job-container (zelfde broncode + toolchain)
die uit het V3-model een nieuw api-image bouwt en naar de Fundament-registry pusht, waarna de
api-deployment uitgerold wordt. Dat is schoner gescheiden en past beter bij een platform met
image-policies, maar: het bestaat nog niet (de rebuild-handler kent geen "externe bouwer"), het
duurt minuten in plaats van seconden, en het vraagt registry-rechten vanuit de omgeving. Advies:
beginnen met de devloop-route (bestaat, is getest), en pas naar een builder-job als Fundaments
beleid dat afdwingt. Dan bouwt BACKEND die modus.

### 2.5 Aandachtspunten voor een (sub)omgeving

- **Eigen database en eigen bucket**; `AUTO_CREATE_DATABASE` of een aangemaakte database;
  `DATABASE_URL`, `MINIO_*`.
- **Authenticatie**: `AUTH_ENABLED=true` vereist `JWT_SECRET`; eerste admin via
  `ADMIN_USERNAME`/`ADMIN_PASSWORD` (seed, domein `beheer`); leestoegang via `LEESTOEGANG`.
- **`/admin/rebuild` is beveiligd met alleen een wachtwoord in de URL**. Op Fundament hoort dat
  achter netwerkbeleid of een extra laag; niet publiek.
- **Modelbehoud bij een software-update**: een nieuw api-image bevat het model van de release,
  niet de code die in de vorige container gegenereerd was. Na een software-update hoort een
  rebuild vanuit de actieve databaseversie (`DEVLOOP.md` §"Rebuild vanuit databaseversie").
  Voorstel BACKEND: dat **automatisch bij het opstarten** doen als de actieve schema-versie
  nieuwer is dan de ingebakken code (nog te bouwen, klein).
- **Domeinselectie**: een kleinere backend (alleen de nodige domeinen) kan met
  `scripts/bouw-domeinen.ps1` (`docs/CODEGEN.md` §12). Dat script is PowerShell; voor een
  Linux-pipeline is een bash-variant nodig (klein werk). Verplicht: `register` en
  `ide-bestanden`; afhankelijkheden staan in §12.
- **Formulieren en widgets**: `FormulierDefinitie`/`LijstDefinitie` (domein `configuratie`;
  `docs/FORMULIERDEFINITIES.md`), de inhoud-editor en widgets zitten in de Studio-build;
  bestanden via MinIO. Imprint-contentmodel op V3: `docs/imprint-contentmodel-v3.md`.
- **render-svc** alleen nodig voor SVG/PNG-export en gedeelde plaatjes.
- **Image-grootte**: het devloop-image is groot (Go + Node + broncode); het productie-api-image
  is ~60 MB.

## 3. Vraag aan TRANSFORMATIES

Leg FUNDAMENT uit hoe een transformatie in Omnium is ingericht (`docs/TRANSFORMATIES.md` §3:
lezer → regelset → toepasser → schrijver; §9.0: een regelset is M2 en volgt de profielen; JSON als
drager), en hoe de transformaties voor de inrichting van e-diensten eruit zouden zien:
canoniek model → JSON-schema (OpenFormulieren, OpenObjecten/verzoektype, beschikkingtype), BPMN
2.0 XML (GZAC; import bestaat, §10), producttype (OpenProduct). En vooral: wat er nodig is om zo'n
transformatie **server-side** te draaien (nu is de toepasser JavaScript in de Studio), zodat
"kiezen en uitrollen" zonder browser kan.

## 4. Gedachten, vragen en bedenkingen van BACKEND

1. **Het inrichting-register is een Omnium-domein.** De drie modellen die Mark noemt
   (productmodel met componentversies; datatypen per component; e-dienst met versie,
   afhankelijkheden en benodigde data) zijn M1-modellen in het canonieke profiel, gegenereerd tot
   een domein (voorstel: `inrichting`, niet `configuratie`, want dat domein bestaat al en betekent
   formulieren/lijsten). De *inrichtingsdata* is dan M0 in dat register: bitemporeel, met
   registraties. Dat geeft het "geheugen" (a) vanzelf: formele tijd = wanneer uitgerold, materiële
   tijd = geldigheid van een inrichting.
2. **Model als data.** Een e-dienst bevat artefacten die zelf M1 zijn (BPMN, JSON-schema's,
   zaaktype). In het register zijn dat waarden (tekst/JSON) in een `_Data`, met versie. Dat is
   precies wat `schema_versies` nu al doet voor het V3-model; het patroon is bekend.
3. **Transformaties draaien nu in de browser.** Voor een "druk op de knop" vanuit een
   inrichting-register moet de toepasser server-side kunnen draaien: de regelsets zijn data
   (JSON), dus een Go-toepasser is mogelijk, of een Node-runner naast de API (render-svc is al
   Node). Dit is de grootste open keuze; vraag aan TRANSFORMATIES.
4. **Uitrol als registratie.** Elke uitrol hoort een record: welke e-dienstversie, naar welke
   componentversie, wanneer, met welke artefact-hash. Dan kan FUNDAMENT drift detecteren
   (component wijkt af van het register) en is herhaling idempotent. Voorstel: entiteit `Uitrol`
   in het domein `inrichting`.
5. **Versiebeleid.** Producttype "aanwezig, anders toevoegen / versie ophogen" vraagt een
   vergelijkingsregel per component (naam + versie + hash?). Dat hoort in het model, niet in
   FUNDAMENT-scripts, anders ontstaat een tweede waarheid.
6. **BPMN-uitwisseling.** Omnium leest BPMN 2.0 XML (TRANSFORMATIES §10); of de terugweg
   (model → BPMN 2.0 XML voor GZAC) al volledig is, moet TRANSFORMATIES bevestigen.
7. **OpenObjecten als vangnet** voor ontbrekende registers: het datatype dat daarin landt is een
   JSON-schema uit hetzelfde canonieke model — dat is dezelfde transformatie als voor
   OpenFormulieren, met een andere schrijver.
8. **Beveiliging van de rebuild** (§2.5) en de keuze devloop versus builder-job (§2.4) zijn
   besluiten voor FUNDAMENT.

## 5. Stand van de coördinatie

- 22-10: FUNDAMENT heeft Marks tekst (letterlijk) en §2 ontvangen.
- 22-10: TRANSFORMATIES heeft §3 ontvangen (de sessienaam verdwijnt na een tijd; Mark heeft hem
  opnieuw hernoemd), met het verzoek FUNDAMENT rechtstreeks te antwoorden en BACKEND een kopie te
  sturen.

### 5.1 Antwoord FUNDAMENT (22-10)

Kiest de **devloop-route** (geen Pod Security-restricties; images van Docker Hub, gepind op tag of
digest). Wacht op Marks go voor de installatie. Omgeving: namespace `omnium` op cluster cg-test,
eigen database `omnium` op Postgres 17 (CloudNativePG), S3-bucket op Ceph RGW (geen MinIO-server),
hostname `omnium.fundament.common-ground-lab.nl` (TLS op Envoy Gateway), OpenFTV later. Vraagt:
S3-env (beantwoord: `MINIO_ENDPOINT` host:poort zonder scheme, `MINIO_ACCESS_KEY`,
`MINIO_SECRET_KEY`, `MINIO_BUCKET`, `MINIO_USE_SSL`; path-style; bucket vooraf aanmaken);
devloop-image op Docker Hub (**bestaat nog niet**: te bouwen en pushen, voorstel
`markwestbroek/bitemp-devloop:<versie>`); persistente werkmap (pad `/app`, advies: geen PV, wel
**startup-rebuild**); startup-rebuild vanuit de actieve `schema_versies` (**nog te bouwen**);
health (alleen `GET /version`; `/health` met DB-ping aangeboden; exit 42 herstart ín de container,
pod blijft; probes ruim); `/admin/*` achter Envoy SecurityPolicy (Studio roept het aan op dezelfde
origin, via nginx → api); resources (voorstel requests 2 cpu/3Gi, limits 4 cpu/6Gi); token-auth
(Omnium-token `omt_…` als Bearer, gebruiker "fundament" + token in een Secret).
Voor het register wil FUNDAMENT: GET artefacten per e-dienstversie in afhankelijkheidsvolgorde
(doelcomponent, versie-range, artefactsoort, stabiele identifier per component, payload in
doelformaat, hash) en POST Uitrol (per artefact status, tijdstip, hash, URL/uuid uit het
component). Bouwt zelf per doelcomponent een uitrol-adapter; eerste doel één e-dienst end-to-end
("aanvraag", objecttype staat al in Open Object). Stand Fundament: Open Zaak 1.31.0, Open
Notificaties 1.16.2, Open Klant 2.19.1, Open Object 4.3.0, Open Formulieren 4.0.3, Keycloak
26.8.1, GZAC/Valtimo 13.50; Open Product nog niet. Code: github.com/MarkWestbroek/CG-Fundament.

**Bevestiging FUNDAMENT (22-10, later):** geen PV op `/app` (startup-rebuild = bron van waarheid,
startupProbe 10 min); wil `GET /health` met database-ping (200/503) voor readiness, `/version`
voor liveness; S3 via ObjectBucketClaim "omnium" op Ceph RGW (poort 80, SSL uit, regio zo nodig
`MINIO_REGION`); image `markwestbroek/bitemp-devloop:<versie>` linux/amd64; resources akkoord;
SecurityPolicy op `/admin/*`, `DEVLOOP_PASSWORD` uit een Secret, `ALLOW_DROP_TABLES` uit; gebruiker
"fundament" met Omnium-token; wil het artefacten-endpoint, kan met GraphQL starten. Bereidt alvast
(reversibel) namespace, database/rol, bucket, hostname + certificaat + routes voor; de uitrol zelf
pas na Marks go en de image-tag. Open vraag aan Mark: moet **Open Product** er nu bij (hoort bij
het producttype-artefact)?

### 5.2 Antwoord TRANSFORMATIES (22-10, aan FUNDAMENT; kopie aan BACKEND)

- Vorm uitgelegd (§3, §9.0). **Trace** (bron-element → regel → doel-item) bij elk artefact in het
  register bewaren: herkomst, impactanalyse, driftdetectie. De toepasser geeft hem terug maar
  bewaart hem nog nergens.
- **BPMN**: alleen import; de terugweg naar BPMN 2.0 XML **bestaat niet** (te bouwen als spiegel
  van de lezer, met roundtrip-test). Het echte gat: *uitvoerbare* BPMN voor GZAC (isExecutable,
  engine-extensies, formKeys) — het profiel is beschrijvend.
- **JSON Schema**: geen schrijver canoniek → JSON Schema (de Go-OAS is het API-schema van een
  gedeployd register; het oas31-profiel schrijft vanuit een OAS-model). Nodig: nieuwe regelset +
  generieke JSON-schrijver; die dient ook producttype, verzoektype, beschikkingtype.
- Een formulierschema is een **selectie** van het canonieke model: bereik (§4) en samengestelde
  bron (§7.7) nodig, beide nog niet gebouwd.
- **Server-side**: eens met stap 1 (transformeren in de Studio, artefact in het register,
  FUNDAMENT rolt het uit), mits het artefact regelset-id+versie, bronmodel+versie/hash,
  schrijver, trace en uitvoer-hash draagt. Stap 2: **Node-runner** (POST /transformeer in
  render-svc of een broertje), **geen Go-port** (twee toepassers + alle lezers/schrijvers =
  pariteitsdrift zoals bij CEL). Go alleen als Fundament geen Node toestaat.
- Nieuwe doel-syntax: regelset (betekenis), schrijver (syntax, golden-file-tests) en
  uitrol-adapter (FUNDAMENT) strikt gescheiden; een nieuw component is meestal alleen een adapter.
- **Volgorde**: eerst één verzoektype-JSON-schema end-to-end naar OpenObjecten (dwingt regelset,
  JSON-schrijver, bereik en artefactrecord af), daarna BPMN voor GZAC. Onderschrijft §4 punt 1, 2,
  4, 5, 7; bij 5 hoort ook de **regelset-versie** in de vergelijking.

### 5.3 Besluiten van Mark (22-10)

1. Installatie op Fundament: **go**.
2. Devloop-image bouwen en pushen: **ja** — BACKEND doet dit ná punt 3, zodat startup-rebuild en
   `/health` in het image zitten.
3. Startup-rebuild, `/health`, later het artefacten-endpoint: **BACKEND bouwt**.
4. Domein `inrichting`: **FUNDAMENT maakt een voorzet** (kent het domein het best); Mark en
   BACKEND reviewen.
5. Volgorde (verzoektype-schema eerst): **hangt af van het model** — beslissen bij de review van 4.
6. Open Product: niet apart beslist; volgt uit het model/producttype-artefact.

**Gebouwd door BACKEND (23-10, branch `feat/devloop-startup-rebuild`):** `GET /health`
(database-ping, 200/503), `bitemp-go-api startup-rebuild` + entrypoint-stap (`STARTUP_REBUILD`,
exit 43; `docs/DEVLOOP.md` §"Startup-rebuild"), de rebuild-pijplijn gedeeld in
`handlers/rebuild_core.go` (backup vóór opschonen; alleen doeldomeinen opschonen), en drie
rondreis-fixes die de end-to-end test blootlegde (`docs/CODEGEN.md` §7.3b: dubbele aliassen,
enum-constNamen via `EnumConstNamen`, naamlabels). Getest: volledige export (11 domeinen) als
actieve versie → exit 43, herbouwde binary start en antwoordt op `/health`; tweede run: niets te
doen. **Voorwaarde** voor Fundament: activeer de gepubliceerde versie (Publiceer + Rebuild maakt
`proposed`); zie open punt 7.

7. Vereenvoudiging: laat `/admin/rebuild` de versie die hij bouwt ook opslaan én activeren —
   **Mark 23-10: ja; gebouwd** (`handlers/rebuild_activeer.go`).
8. Zelf-relatie (`Artefact → Artefact`): **Mark 23-10: (a) codegen-fix**, het model blijft zoals
   het is. Volgende stap voor BACKEND (zie `docs/plans/2026-10-11 Afgeleide relaties backend —
   ontwerp.md` §8 voor de plekken die het doeltype uit de kolomnaam afleiden).
9. FUNDAMENT's V3 (23-10, commit 38fc769 in CG-Fundament): `versie` → `versienummer`,
   `Datatype` → `Gegevenssoort` doorgevoerd; door codegen gevalideerd. Nog open: `ArtefactSoort`/
   `ArtefactFormaat` als referentielijst, traceregel niet-materieel (FUNDAMENT: eens).

10. **Devloop-image gepusht (23-10):** `markwestbroek/bitemp-devloop:0.24.0` (+ `latest`),
    linux/amd64, digest `sha256:847e186011a6…`, uit main 53ca4e2f. Daarbij een bestaande fout in
    `Dockerfile.devloop` gefixt (geneste, verouderde baseline uit git; nu verse kopie, mappen in
    `.dockerignore`). FUNDAMENT rolt uit.
11. Zelf-relatie-fix (Mark 23-10): verwijskolom `doel_<entiteit>_id` bij doel = eigenaar, en het
    doeltype **expliciet** in de MetaRegistry (`DoelTypenaam`), niet geraden uit de kolomnaam
    (A kan meerdere relaties naar B hebben waarin B verschillende rollen vervult). **Gebouwd
    23-10** (branch `feat/zelf-relatie-doeltypenaam`; `docs/CODEGEN.md` §7.3c): verwijskolom
    `doel_artefact_id`, `TypeMeta.DoelTypenaam` (bestaande registries eenmalig gevuld), alle vijf
    de raad-plekken vervangen door `model.DoelTypenaamVanRelatie`. Daarbij: codegen leidt een
    ontbrekend `goType` af uit `type`/`format`/`verplicht`/`enum` (FUNDAMENT's V3 heeft geen
    goType, zoals elk extern OAS-achtig model) en meldt een onbekend `datatype` als fout.
    **FUNDAMENT's V3 (38fc769, met `Gegevenssoort`) genereert en bouwt ongewijzigd** als domein
    `inrichting`. Volgende: commit/merge, nieuw devloop-image, dan het artefacten-endpoint.
    **Review afgerond 23-10:** `ArtefactSoort` en `ArtefactFormaat` worden **referentielijsten**
    (uitbreidbaar zonder rebuild, met geschiedenis; een item draagt standaarddoelcomponent en
    identifier-regel), `ArtefactTraceregel` **niet-materieel**, `Gegevenssoort` en `versienummer`
    akkoord. Aan FUNDAMENT doorgegeven met het V3-patroon (`docs/Referentielijsten.md`).
13. **Devloop-image 0.24.1 gepusht (23-10):** `markwestbroek/bitemp-devloop:0.24.1` (+ `latest`),
    digest `sha256:ca36dc7e8d9a…`, uit main e06cb6ff (zelf-relatie-fix, `DoelTypenaam`,
    goType-afleiding). Nummer-tags voortaan, geen datumtags (Mark). FUNDAMENT wisselt het image.
14. FUNDAMENT's V3 met referentielijsten (`ArtefactSoort`, `ArtefactFormaat` als
    `referentielijst_item`, `$ref`-velden, traceregel niet-materieel) **genereert en bouwt**
    (23-10). Eerste vulling klaar in CG-Fundament `docs/inrichting-referentielijsten.json`
    (17 soorten, 8 formaten); BACKEND maakt daar registratie-JSON van zodra het domein op
    Fundament staat (veldnamen uit `/api/schema/model/code`), incl. 7 Component-registraties.
15. **Crashlus op Fundament (23-10) en de fix** (gemerged naar main 25-10, 1b4739a1, gepusht;
    devloop-image `markwestbroek/bitemp-devloop:0.24.2`, digest `sha256:b480b2ec4718…`). De rebuild met inrichting activeerde een model waarvan de binary compileerde maar
    bij het opstarten paniekte: padnaam `producten` van inrichting-`Product` botste met
    `Initiatief_Product` (CG). Mitigatie door FUNDAMENT: `STARTUP_REBUILD=false` + herstart, geen
    database-write. Fix: (1) de rebuild bouwt naar een tijdelijk pad en draait `bitemp-go-api
    zelftest` vóór vervangen, baseline en activeren; (2) de startup-rebuild onthoudt een mislukte
    versie en bouwt die niet bij elke start opnieuw; (3) codegen weigert een padnaam die al in een
    ander domein bestaat. FUNDAMENT's V3 heeft nu `inrichting_producten`, `ediensten`,
    `edienstversies`; lokaal gegenereerd, gebouwd en de zelftest geslaagd.
16. **Eerste vulling + volgorde-endpoint** (zelfde branch): replay-bestand met 38 registraties
    (7 componenten, 8 formaten, 17 soorten met standaarddoelcomponent, per component de soorten
    die het ontvangt) en `GET /api/volgorde/{pad}?via=&doel=&na=` (zie `docs/API_REFERENCE.md`).
    Integratietest op de regressiedatabase: vulling afgespeeld, artefacten in volgorde
    objecttype → formulier → BPMN, cyclus geeft 409.
17. **Inrichting live op Fundament (25-10):** devloop 0.24.2/0.24.3, schema-versie 2 actief,
    eerste vulling 38/38 (17 soorten, 8 formaten, 7 componenten). Na de rebuild met
    `schema_versie_id` 2 staat inrichting ook in de domeincatalogus.
18. **Canoniek model `aanvraag` — voorzet FUNDAMENT** (CG-Fundament `docs/aanvraag-domein-v3.json`,
    e857959; wacht op Marks review, niet gebouwd op Fundament). BACKEND-controle: codegen zonder
    fouten, geen padnaambotsingen (ook samen met inrichting), zelftest OK, registratietest met
    `/full/aanvragen` en 422 bij dubbel aanvraagnummer, ongeldige status en ongeldig e-mailadres.
    URL, Emailadres en Telefoonnummer staan in de gedeelde datatypebibliotheek. Open, niet aan het
    model: `ref`-velden worden niet op bestaan gecontroleerd (BACKLOG §33.4); `ingediendOp`
    (DatumTijd) wordt een string, met `format: date-time` een `time.Time`.
    **Review TRANSFORMATIES:** (1) de transformaties hebben drie bronnen nodig: het canonieke
    datamodel, een e-dienst-inrichtingsmodel (veldselectie per artefact, objecttype-metadata,
    statuskoppeling, rol-/resultaat-/statustypen) en referentielijst-items (M0, met peilmoment in
    ArtefactHerkomst). E-dienstspecifieke koppelingen (ingediend → Ontvangen) horen niet in een
    regelset (M2) of het datamodel, maar in het e-dienstmodel: eerst een klein JSON-bestand, op
    termijn EDienstVersie-data in inrichting. (2) Het zaaktype volgt nauwelijks uit het datamodel;
    alleen roltype Aanvrager en informatieobjecttype Bijlage. (3) De hash-toets wijkt op meer
    punten af (toelichting/reden, beschrijvingen per property, patroon aanvraagnummer, aanvrager
    verplicht, arraynaam bijlagen); advies: model aanvullen tot de hash gelijk is, formulier en
    telefoonnummer daarna als bewuste nieuwe artefactversie.
19. **Aanvraag live op Fundament (25-10).** Tweede versie van de V3 (beschrijvingen, datatype
    Aanvraagnummer, `doelKardinaliteit: "1"` i.p.v. `verplicht`, `format: date-time`) legde codegen-
    gaten bloot, gerepareerd in 79d3c581 (veldbeschrijvingen, time-import, kardinaliteit in de
    rondreis, 422 met veldpad bij onleesbare waarden); devloop 0.24.4. FUNDAMENT rebuildde met één
    samengesteld model (inrichting + aanvraag) → schema-versie 4; inrichting-gegevens ongewijzigd.
    Codegen weigert sindsdien een domein dat niet in het model staat (63282b87; aanleiding: een
    samengevoegde domeinnaam activeerde versie 3 zonder aanvraag-code). **Mark:** hij heeft een
    wijziging op het aanvraag-model, bewust pas ná volledige implementatie, als test van hoe
    flexibel het systeem een modelwijziging opvangt.
20. **Overerving en het gpk-model (26-10).** FUNDAMENT's samengestelde model (inrichting,
    relatiebeheer met Partij + 7 subtypen, aanvraag v2 met AanvraagPartij → Partij + `$ref` Partijrol,
    zorg, parkeren met GehandicaptenparkeerkaartAanvraag erft Aanvraag) lokaal getest. Gerepareerd:
    subtype met eigen GE's (gemerged 356ed51b); nieuw ongecommit: codegen weigert typenamen die al in
    een ander domein bestaan, tabelnamen > 63 tekens, en zet `ref:` ook op `_Input`. Getest en goed:
    relaties naar subtypen (ook over domeinen), subtype → subtype, `$ref` op een relatieveld,
    materiële meervoudige relatie naar de ouder. **Flexibiliteitstest v1 → v2 op één database:** oude
    aanvraag leesbaar, nieuwe relatie werkt, oude tabellen verweesd (schemadiff: destructief, DROP
    voorgesteld); een gewijzigd doel onder dezelfde relatienaam is níet additief (500). **Risico afgedekt (27-10, akkoord Mark):**
    `dbsetup.CreateTables` was bij het opstarten fataal (`main.go`); een modelwijziging die een
    constraint laat falen kwam door de zelftest maar stopte de API bij de start → crashlus. Gebouwd:
    FK-constraints niet-fataal, en de rebuild doet een **databaseproef** (`bitemp-go-api dbproef`:
    CreateTables in een transactie met ROLLBACK) vóór activeren; zie `docs/DEVLOOP.md`.
21. **Subtype toont `id` in JSON (27-10, besluit Mark; gemerged 9bb56b7f, devloop 0.24.6,
    digest `sha256:24f5e4cb…`).** Een subtype ís zijn ouder met hetzelfde id; de registratievorm is
    daarom `{"<subtype>": {"id": N}}` (was `{"<ouder>_id": N}`), en `/full` toont `id`. De
    databasekolom blijft `<ouder>_id`. Plaatshouders (`$nieuw`) werken op ouder én subtype in één
    registratie. Codegen-controles uit punt 20 (typenaam-/tabelnaambotsingen) zijn mee in 0.24.6
    (gemerged 9403a0be). FUNDAMENT's gpk-docs en -scripts moeten `id` gebruiken.
12. FUNDAMENT heeft het devloop-image 0.24.0 uitgerold (23-10): startup-rebuild liep ("geen
    actieve versie"), `/health` 200, `/admin/*` achter de Gateway-allowlist. Rebuild met het
    inrichting-model wacht op het nieuwe image.

Oorspronkelijke vraaglijst:

1. Go voor de installatie op Fundament (FUNDAMENT wacht daarop).
2. Devloop-image bouwen en naar Docker Hub pushen (`markwestbroek/bitemp-devloop`).
3. Bouwen door BACKEND: startup-rebuild vanuit de actieve schema-versie, `/health`, en (zodra het
   domein er is) het artefacten-endpoint in afhankelijkheidsvolgorde.
4. Het domein `inrichting` modelleren (Studio, canoniek) — wie, en met FUNDAMENT's veldenlijst
   plus TRANSFORMATIES' artefactrecord als input.
5. Volgorde van TRANSFORMATIES: verzoektype-JSON-schema → OpenObjecten eerst, dan BPMN → GZAC.
6. Open Product nu al op Fundament zetten (vraag FUNDAMENT), of pas bij het producttype-artefact.
