# Backend code review — bitemp_register_v06

*Datum: 2026-07-07 · Reviewer: Claude (Fable 5), sessie met Mark · Scope: Go-backend van `bitemp_register_v06` (handlers, model-plumbing, dynql, dbsetup, codegen, schemadiff, middleware, cmd). Frontend en gegenereerde `model/*_…`-bestanden zijn alleen steekproefsgewijs bekeken. Branch `feat/studio05-afronding` bevat t.o.v. `main` geen enkele `.go`-wijziging; deze review geldt dus ook voor `main`.*

---

> **Statusupdate (zelfde dag, branch `chore/be-code-review`)** — actiepunten 1 t/m 4 uit §7 zijn uitgevoerd:
>
> 1. ✅ Beide falende tests gefixt (tests liepen achter op bewuste codewijzigingen); `go test ./...` is groen.
> 2. ✅ Registratietijdstip: nieuwe env-vlag `REGISTRATIE_TIJD=synthetisch|klok` (zie `handlers/registratie_tijd.go`).
>    **Nuance van Mark:** het synthetische tijdstip is géén vergissing maar een bewuste demo-modus — de React-tijdlijnpagina's
>    visualiseren bitemporaliteit via t=1, t=2, wat veel duidelijker is dan echte timestamps. Daarom blijft `synthetisch`
>    de default zolang het register in test-/demostatus is; échte implementaties (zoals het CG-domein) zetten `klok`.
>    Bij productiecontext + synthetisch logt de startup een warning.
> 3. ✅ `RequireRol("editor")` aangesloten op alle muterende routes, `RequireRol("admin")` op `/admin/*` en schema-activeren,
>    `RequireAuth()` op `/graphql/query`; JWT_SECRET verplicht bij `AUTH_ENABLED=true` (dev-default geweigerd in productie);
>    PDP nu fail-closed by default; `rolToegestaan` denies onbekende vereiste rollen. Alles no-op zolang `AUTH_ENABLED=false`.
>    OpenFTV-containers zijn hiervoor níét nodig: dit is de lokale rolcheck; de PDP blijft optioneel (`AUTHZ_PDP_ENABLED`).
> 4. ✅ Regressietests toegevoegd: `routes/auth_routes_test.go` (401 op alle muterende routes bij auth-aan) en
>    `middleware/auth_config_test.go` (configvalidatie + rolhiërarchie).
>
> **Aanvulling (vervolgsessie, zelfde branch):** ook §3.3 en §3.5 zijn uitgevoerd:
>
> 5. ✅ **§3.5 audit-trail-bypass gedicht.** `POST /{padnaam}` en `POST /full/{padnaam}` lopen nu via
>    `MakeAddEntityViaEngineHandler` (`handlers/opvoer_handlers.go`): de body wordt verpakt als reguliere opvoer en
>    gedelegeerd naar `RegistreerJSONCore` — normalisatie, validatie, audit-trail en transactie identiek aan
>    `POST /registratie/`. De directe-insert handlers zijn verwijderd. `POST /registraties` en `POST /wijzigingen`
>    bestaan niet meer (audit-records waren daarmee te vervalsen); die resources zijn read-only.
>    Response van de POST-routes bevat nu ook `registratie_id` + `tijdstip`.
> 6. ✅ **§3.3 admin-hardening.** De `/admin/*`-routes bestaan alleen nog in builds met `-tags devtools`
>    (Dockerfile.devloop en devloop-entrypoint.sh bouwen met die tag; de in-container rebuild ook, anders verliest de
>    herbouwde binary zijn eigen rebuild-endpoint). Productie-images hebben de endpoints simpelweg niet (getest: 404).
>    Wachtwoordchecks zijn constant-time, kunnen via header `X-Beheer-Wachtwoord` (padvariant blijft werken voor de FE),
>    en de dev-default "1234" is in productiecontext geweigerd. Rebuilds zijn geserialiseerd met een mutex (409 bij
>    gelijktijdige rebuild). Zie docs/DEVLOOP.md, sectie "Beveiliging van de devloop-endpoints".
>
> Daarmee zijn alle vier de §3-blockers geadresseerd. `go build`, `go vet` en `go test ./...` zijn groen, zowel mét als
> zónder `-tags devtools`.
>
> **Tweede aanvulling (zelfde branch):** ook de P1-punten §4.1 t/m §4.4 zijn uitgevoerd:
>
> 7. ✅ **§4.1 concurrency.** Ongedaanmaking-reads lopen binnen de tx met `FOR UPDATE` op de registratie-rij; de
>    engine-reads die daarna muteren (`haalRepresentatieUitDB`, actieve-IDs-queries) locken hun rijen; en de
>    enkelvoudig-invariant wordt nu ook in Postgres geborgd met partial unique indexes
>    (`dbsetup.createEnkelvoudigInvariantIndexes`: `UNIQUE (entiteit_id[, rel_id]) WHERE opvoer IS NOT NULL AND afvoer IS NULL`,
>    niet-fataal bij bestaande schendingen).
> 8. ✅ **§4.2/§4.3 foutafhandeling.** Onbekend ID geeft 404 (bun's `sql.ErrNoRows` werd 500); interne DB-fouten gaan
>    naar de server-log en de client krijgt generieke teksten (`handlers/http_fouten.go`); prechecks van DELETE/PATCH idem.
> 9. ✅ **§4.4 N+1 bij peiltijdstip.** De formele-tijdafleiding doet nu één set-based query per request op
>    `f_formele_wijziging_op_peil` voor alle entiteit-IDs samen (`laadFormeleTijdCache`), met "laatste wint" in Go
>    (zelfde ordering als voorheen). Een lijst van 100 entiteiten × 10 kinderen ging van 1000+ queries naar 1.
>    **Nog open uit §4.4:** de gecorreleerde subquery per rij in `applyFormeleTijdFilterVoorModel` (het WHERE-filter
>    bij `?peiltijdstip=` op lijsten) — kandidaat voor een `LATERAL JOIN`-herschrijving, meten met `EXPLAIN ANALYZE`.

## 1. Eindoordeel

**Nog niet productiewaardig, wel een sterk fundament.** De architectuurkeuzes zijn goed doordacht: een pure, transactionele registratie-engine (`RegistreerCore`) die door REST, CRUD-routes én GraphQL wordt hergebruikt; een MetaRegistry-patroon dat gegenereerde, compile-time getypeerde code aan generieke handlers koppelt; en een codegen-pipeline met validatie, rollback en gofmt. Dat is precies de "compileer fouten weg"-filosofie die je nastreeft.

Er zijn echter vier categorieën blockers die vóór productie opgelost moeten worden:

1. **Het formele tijdstip is synthetisch** (testconstructie in de kern-engine).
2. **Autorisatie wordt nergens afgedwongen** (middleware bestaat, maar is niet aangesloten).
3. **Admin-/rebuild-endpoints zijn feitelijk onbeveiligd** (default wachtwoord "1234" in de URL).
4. **De audit-trail is omzeilbaar** via directe POST-routes die buiten `RegistreerCore` om inserten.

Daarnaast zijn er hoge-prioriteit punten rond concurrency, foutafhandeling en N+1-performance. Verifieerbare status: `go build ./...` en `go vet ./...` zijn groen; `go test ./...` heeft **2 falende tests** (dynql en handlers, zie §4.9).

### Scorecard per beoordelingscriterium

| Criterium | Oordeel | Toelichting |
|---|---|---|
| Go-heid / degelijkheid | ● ● ● ○ ○ | Idiomatisch op veel plekken; maar globale `DB`-var, `fmt.Println`-logging, her-implementatie van stdlib, string-gebaseerde codemanipulatie |
| Onderhoudbaarheid | ● ● ● ● ○ | Uitstekend gedocumenteerd (NL comments, docs-cultuur); `handlers` is wel een grab-bag van 40+ bestanden |
| Architectuur | ● ● ● ● ○ | Kern (engine/metaregistry/codegen) sterk; packagegrenzen en schema-repository kunnen scherper |
| Performance | ● ● ○ ○ ○ | N+1-patronen bij tijdreizen; dubbele JSON-serialisatie; ondanks codegen veel runtime-reflectie |
| Afhankelijkheden | ● ● ● ● ○ | Weinig deps (goed); bun en gin lopen versies achter; `graphql-go` is nauwelijks onderhouden |
| Veiligheid | ● ○ ○ ○ ○ | Auth niet afgedwongen, admin-endpoints open, default secrets, foutlekkage — zie §3 |
| Correctheid / robuustheid | ● ● ● ○ ○ | Engine transactioneel en netjes; maar synthetisch tijdstip, races, `ErrNoRows`→500 |

---

## 2. Wat goed is (behouden!)

- **`RegistreerCore` als pure engine** (`handlers/registration_core.go`): transport-onafhankelijk, transactioneel met nette rollback-defer, hergebruikt door REST (`POST /registratie/`), CRUD (`DELETE/PATCH per padnaam`) en GraphQL-mutaties. Dit is de juiste kern-abstractie.
- **MetaRegistry + factories**: generieke handlers zonder `interface{}`-geknutsel op de query-paden; ID-kolommen en tabelnamen komen uit gegenereerde metadata, niet uit user-input (geen SQL-injectie via identifiers gevonden — alle waarden gaan via `?`-placeholders, kolomnamen worden gevalideerd met `isVeiligeKolomnaam` + whitelist in `core_handlers.go`).
- **Codegen-pipeline**: modelvalidatie met begrijpelijke foutmeldingen (`cmd/codegen/main.go:577`), gofmt op output, additive mode met domein-filtering, en de rebuild-flow heeft backup/rollback/baseline-mechaniek.
- **Documentatie**: vrijwel elk bestand heeft een package-/functie-comment die het *waarom* uitlegt; `docs/` is rijk. Zeldzaam goed.
- **Tests**: aanwezig voor schemadiff (uitgebreid), middleware, model-validatie en handlers (sqlmock). De basis om op door te bouwen is er.
- **Weinig third-party dependencies**: gin, bun, graphql-go, jwt, minio, godotenv, goldmark, yaml — dat is alles. Overzichtelijk.

---

## 3. Blockers voor productie (P0)

### 3.1 Synthetisch registratietijdstip in de kern-engine
`handlers/registration_core.go:109-116`:

```go
// TIJDELIJK: oplopend testtijdstip op basis van ID, zoals in originele handler.
req.Registratie.Tijdstip = time.Date(2026, 1, 1, ...).Add(time.Duration(req.Registratie.ID) * time.Hour)...
```

Elke registratie krijgt een fictief tijdstip (2026-01-01 + ID uren + ID microseconden). De hele formele tijdlijn — het bestaansrecht van een bitemporeel register — is daarmee synthetisch. De `t`/`ta`/`tb`-querystring-shorthands (`full_handlers.go:164`) bouwen op dezelfde truc.

**Actie:** vervang door `now()` uit de database (transactie-tijdstip, dan is het ook monotoon binnen de tx-volgorde van commits) of `time.Now().UTC()`. Behoud de `t`-shorthand desgewenst achter een `DEVLOOP`/test-flag. Dit raakt ook de extra UPDATE-roundtrip (insert → update tijdstip) die dan kan vervallen.

### 3.2 Autorisatie is nergens aangesloten
`middleware/auth_middleware.go` definieert `RequireAuth()` en `RequireRol()`, en de developer guide beschrijft ze — maar **geen enkele route gebruikt ze** (grep bevestigt: alleen definitie + docs). `JWTAuthMiddleware()` blokkeert bewust niet. Gevolg: ook met `AUTH_ENABLED=true` is elk data-endpoint (lezen én schrijven) publiek, tenzij óók de externe PDP aan staat. En de PDP-middleware is **fail-open by default** (`AUTHZ_DENY_ON_ERROR` default false, `authz_pep.go:220`): PDP down ⇒ alles toegestaan.

**Acties:**
- Sluit `RequireAuth()`/`RequireRol()` aan op route-groepen: minimaal `RequireRol("editor")` op alle muterende routes en `RequireRol("admin")` op `/admin/*` en `/api/schema/*` (activeren).
- Maak fail-closed de default zodra `AUTHZ_PDP_ENABLED=true`.
- Voeg een integratietest toe die bij `AUTH_ENABLED=true` een 401 op een muterende route afdwingt — dit was met één test gevonden.

### 3.3 Admin-endpoints: default wachtwoord, wachtwoord in URL, endpoint zonder auth
- `DELETE /admin/db/droptables/:password` — default wachtwoord **"1234"** (`admin_handler.go:11`), wachtwoord in het URL-pad (belandt in access-logs, proxies, browser-history). `ALLOW_DROP_TABLES` is de enige echte rem.
- `POST /admin/db/createtables` — **geheel zonder enige controle**; comment zegt letterlijk "beveiliging via obscurity".
- `POST /admin/rebuild/:password` — default wachtwoord "1234" (`rebuild_handler.go:42`); dit endpoint voert **codegen + `go build` uit en herstart het proces** (feitelijk remote code execution op modelniveau). `DEVLOOP=true` is de enige rem, en er is geen mutex: twee gelijktijdige rebuilds kunnen elkaars backup/rollback corrumperen.

**Acties:**
- Zoals je zelf al aangaf: droptables verwijderen vóór productie. Doe dat structureel: compileer dev-endpoints alleen mee met een build-tag (`//go:build devtools`) in plaats van een env-flag — dan *kan* het niet aanstaan in een productie-binary.
- Tot die tijd: wachtwoord uit de URL (header/body), `subtle.ConstantTimeCompare`, geen defaults (weiger te starten met flag aan zonder wachtwoord), en `RequireRol("admin")` erop.
- Rebuild-handler: `sync.Mutex` om de hele pipeline.

### 3.4 JWT-secret met default-fallback
`middleware/auth_middleware.go:31`: zonder `JWT_SECRET` wordt `"bitemp-dev-secret-change-in-production"` gebruikt. Iedereen die de broncode kent kan dan admin-tokens smeden.

**Actie:** bij `AUTH_ENABLED=true` en lege `JWT_SECRET`: weigeren te starten (`log.Fatal`). Zelfde patroon voor `ADMIN_PASSWORD`-seed en devloop/droptables-wachtwoorden.

### 3.5 Audit-trail omzeilbaar via directe insert-routes
- `POST /{padnaam}` → `MakeAddEntityByMetaHandler` (`core_handlers.go:420`) insert **rechtstreeks** in de entiteitstabel: geen `Registratie`, geen `Wijziging`, geen `opvoer`-tijdstip. Het record is daarmee onzichtbaar voor tijdreizen en ongedaanmaking — een corrupte toestand voor het bitemporele model.
- `POST /registraties` en `POST /wijzigingen` (`routes/addroutes.go:99,105`) laten clients handmatig audit-records aanmaken/vervalsen.

**Actie:** laat `POST /{padnaam}` delegeren naar `RegistreerCore` (zoals DELETE al doet via `VoerEntiteitAfCore` — het patroon bestaat al), en maak `/registraties`+`/wijzigingen` read-only. Invariant om te bewaken: *elke mutatie op modeltabellen loopt door `RegistreerCore`*.

---

## 4. Hoge prioriteit (P1)

### 4.1 Concurrency: read-then-write zonder locking
- `verwerkOngedaanmaking` (`registration_core.go:326-356`) doet zijn reads via **`db`** (buiten de transactie) in plaats van `tx`; de check "geen latere wijzigingen" en de daarop volgende updates zijn dus niet geserialiseerd. Twee gelijktijdige requests (registratie + ongedaanmaking op dezelfde entiteit) kunnen een inconsistente historie opleveren.
- `sluitActieveEnkelvoudigeVoorgangersAf` (`registration_helpers_generiek.go:777`): de "max 1 actief record"-invariant is een read-then-write; twee concurrente opvoeringen geven twee actieve records.

**Acties:** (a) alle reads binnen de tx; (b) `SELECT ... FOR UPDATE` op de betrokken rijen of `ISOLATION LEVEL SERIALIZABLE` met retry; (c) de invariant ook in de database borgen met een partial unique index: `CREATE UNIQUE INDEX ... ON <tabel>(<entiteit_id_kolom>) WHERE afvoer IS NULL` voor enkelvoudige GE's — dan vangt Postgres wat de applicatie mist.

### 4.2 `sql.ErrNoRows` ⇒ 500 in plaats van 404
Bun's `Scan` retourneert `sql.ErrNoRows` als er niets gevonden is. In `MakeGetEntityHandler`, `MakeGetEntityByMetaHandler`, `VoerEntiteitAfCore` en `WijzigEntiteitCore` wordt elke scan-fout als 500 teruggegeven; de `isZeroID`-check op de regel eronder is dood pad. Een GET op een onbekend ID geeft dus `500 {"error":"sql: no rows in result set"}`.

**Actie:** overal `errors.Is(err, sql.ErrNoRows)` → 404 (patroon staat al in `viz_entiteit_max_id_handler.go:53`). Eén helper `scanOf404()` scheelt tien herhalingen.

### 4.3 Interne fouten lekken naar de client
Vrijwel elke handler doet `c.JSON(500, gin.H{"error": err.Error()})` — database-foutteksten, tabelnamen en soms querydetails gaan naar buiten. **Actie:** generieke client-boodschap + volledige fout server-side loggen (zie §5.3, logging). RFC 9457 `ProblemDetails` bestaat al voor validatie — trek dat door naar alle fouten.

### 4.4 N+1-queries bij tijdreizen (`peiltijdstip`)
- `vulAfgeleideFormeleTijdVoorFullSlice` (`full_handlers.go:896`) draait per entiteit × per GE/relatie × per hub-kind een **aparte query** op `f_formele_wijziging_op_peil(...)`. Een lijst van 100 entiteiten met 10 kinderen = 1000+ queries per request.
- `applyFormeleTijdFilterVoorModel` (`full_handlers.go:761`) hangt per rij een gecorreleerde subquery op diezelfde set-returning functie.

**Acties:** haal per request één keer de relevante wijzigingen op peil op (één set-based query met `IN (…)` op de entiteit-IDs) en verdeel in Go; of maak er een `LATERAL JOIN` van. Meet met `EXPLAIN ANALYZE`; overweeg een covering index op `wijziging(entiteitnaam, entiteit_id, representatienaam, representatie_id, tijdstip)` (check `createviews.go`/`createFormeleTijdIndexes` of die er al precies zo ligt).

### 4.5 Dubbele JSON-serialisatie als verwerkingspatroon
`verrijkResponseMetWeergavenamen`, `sanitizeResponseWithoutAfvoer`, `structNaarMap`, dynql's `entityToMap`/`sliceToMaps`: struct → `json.Marshal` → `json.Unmarshal` naar `map[string]any` → bewerken → opnieuw serialiseren. Elke full-response wordt zo twee à drie keer geserialiseerd. Bovendien: ondanks het uitgangspunt "zo min mogelijk reflectie" leunt de runtime zwaar op reflectie (`haalIntWaardeVoorKolomUitRepresentatie`, `kopieerMatchendeVelden`, veld-lookup per tag per rij). Niet fout, maar het ondergraaft de performance-winst van codegen.

**Actie (structureel, past bij jullie filosofie):** genereer per type de accessors die nu via reflectie gaan (bijv. `GetRelID()`, `SetRelID()`, `WeergavenaamVelden()`) in `*_modellen_methods.go`. Dan verdwijnt het gros van reflectie én de JSON-roundtrips uit de hot path, compile-time gecheckt.

### 4.6 CORS-whitelist hardcoded in code
`routes/addroutes.go:21-35`: dev-origins (localhost-poorten, `test1.pleio.local`) staan in de bron, mét `Allow-Credentials: true`. **Actie:** origins uit env (`CORS_ORIGINS=...`), en productie-origins expliciet configureren.

### 4.7 Login-flow details
- Timing-based user-enumeration: bcrypt draait alleen als de gebruiker bestaat (`auth_handler.go:47`). Doe een dummy-`CompareHashAndPassword` in het not-found-pad.
- `LogoutHandler` bepaalt `isSecure` anders (`GIN_MODE`) dan `LoginHandler` (`COOKIE_SECURE`) — maak dat één helper.
- `rolToegestaan` (`auth_middleware.go:173`): onbekende huidige rol én onbekende vereiste rol geven beide 0 ⇒ `0 >= 0` ⇒ toegestaan. Een typo in `RequireRol("editer")` faalt open. Maak onbekende vereiste rol een deny (of een panic bij startup-registratie).

### 4.8 Mogelijke panics / loops
- `ensureParentRecordBijOpvoer` (`registration_helpers_generiek.go:1376`): `childID.(int)` — panic zodra een subtype-entiteit een niet-int ID heeft. Gebruik `anyNaarInt`.
- Diezelfde functie is recursief over `ParentTypenaam` **zonder cycle-guard**; het model komt uit de FE. Een (per ongeluk) cyclische parent-keten = oneindige recursie. Zelfde geldt voor de hub-recursie in `handleRepresentatieOpvoer`. Actie: dieptelimiet of visited-set; en de codegen/modelvalidatie zou cycles moeten weigeren.
- `RequireRol`: `val.(*JWTClaims)` zonder ok-check (theoretisch, maar gratis te fixen).

### 4.9 Tests zijn rood (ook op `main`)
```
FAIL dynql:    TestBuildPatchInputTypes_VultCacheVoorAlleEntiteiten — geen PatchInput voor ENT "C_sub"
FAIL handlers: TestMakeGetRegistratiesMetWijzigingenHandler_CapsSizeAndHasMoreFalse — expected capped size 100, got 1000
```
De tweede is duidelijk tests-uit-sync-met-code (cap is verhoogd naar 2000, test verwacht 100 — kies bewust en leg vast). De eerste wijst op een echt gat: subtype-entiteiten (TPT) krijgen geen PatchInput-type in GraphQL. **Actie:** groen maken en in CI afdwingen (er lijkt geen CI te zijn die `go test ./...` draait — dat is de goedkoopste kwaliteitswinst die er is).

---

## 5. Middenprioriteit (P2) — onderhoudbaarheid & Go-heid

### 5.1 Duplicatie (concreet aan te pakken)
| Waar | Wat | Actie |
|---|---|---|
| `dbsetup/deletetables.go` | `dropModelTables` vs `dropModelTablesByDomein` ~90% identiek | één functie met optioneel domein-filter |
| `registration_helpers_generiek.go:25-189` | `handleRepresentatieOntOpvoer` vs `OntAfvoer` verschillen alleen in `Set("opvoer/afvoer = NULL")` | één functie met kolom-parameter |
| `full_handlers.go:48-121` | `setForeignKeyOnRelatedEntity`: twee identieke switch-blokken (bun-tag / json-tag) | tag-lookup extraheren |
| `core_handlers.go` + `full_handlers.go` | page/size-parsing 4× gekopieerd (met verschillende maxSize!) | `parsePaginering(c) (page, size, error)` helper |
| `registration_core.go:292-309` | `joinAll`/`joinKort` herimplementeren `strings.Join` | `strings.Join` gebruiken |
| `crud_handlers.go` / `WijzigEntiteitCore` | 404-precheck 2× | delen met `VoerEntiteitAfCore` |

### 5.2 Package-indeling
`handlers/` bevat 44 bestanden met vijf verantwoordelijkheden: register-CRUD/registratie, schema-beheer, viz-endpoints, docs/openapi, auth/admin/bestanden. **Actie:** splitsen in subpackages (`handlers/register`, `handlers/schema`, `handlers/viz`, `handlers/admin`, `handlers/auth`) met de route-registratie erbij (nu is `main.go` + `routes/` + handler-constructors verspreid). De pure engine (`RegistreerCore` + helpers) verdient een eigen package (`register/engine`), los van HTTP.

### 5.3 Logging & lifecycle
- Alle logging is `fmt.Println/Printf` naar stdout, ongestructureerd, zonder levels of request-correlatie. **Actie:** `log/slog` (stdlib, geen extra dependency), request-ID-middleware.
- `main.go`: `router.Run()` zonder `http.Server` ⇒ geen `ReadHeaderTimeout` (slowloris), geen graceful shutdown (in-flight registraties worden bij deploy afgekapt — pijnlijk mét transacties, maar netjes afsluiten hoort er toch bij). Dubbele "Succesfully connected" (ook een typo) en `CreateTables` wordt vóór de `Ping` gedaan.
- Globale mutable state: `handlers.DB` (package-var in `tasks_handler.go:11`!) en `dynql.db`. Werkt, maar bemoeilijkt tests en parallelle instanties; een `Server`-struct met dependencies is de idiomatiche vorm.

### 5.4 Codegen-robuustheid
- `mergeGedeeldBestand` en `ensureInitRegistration` (`cmd/codegen/main.go:298,456`) muteren Go-bronbestanden met string-/regex-manipulatie. Dat werkt tot het een keer stil misgaat (comments, casing, gofmt-variaties — de casing-reparatielogica bewijst dat het al gebeurd is). **Actie:** gebruik `go/parser` + `go/ast` voor het bijwerken van `metaregistry_plumbing.go`, of beter: genereer een `zz_registrations_<prefix>.go` per domein met zijn eigen `init()` — dan is mergen helemaal niet nodig.
- Dode restanten: `_ = regels`, `_ = re`.

### 5.5 Dependencies
- **bun v1.1.14** — v1.2.x is al lang uit; upgrade levert bugfixes en betere `pgdriver`-ondersteuning.
- **gin v1.9.1** — v1.10/v1.11 beschikbaar; indirects (sonic 1.9.1, validator 10.14) komen dan mee.
- **graphql-go/graphql v0.8.1** — feitelijk slapend project (laatste release jaren geleden). Werkt, maar is een strategisch risico. `gqlgen` is schema-first mét codegen — dat past naadloos bij jullie filosofie en geeft compile-time resolvers i.p.v. de huidige map-gebaseerde resolvers.
- GraphiQL-playground laadt React/GraphiQL van **unpkg CDN** (`dynql/handler.go:76-86`) — voor een register in een gesloten omgeving: assets embedden (`go:embed`).
- Verder: jwt/v5, minio-go, x/crypto zijn actueel. Prima.

### 5.6 GraphQL-hardening
Geen query-depth/complexity-limiet; met reverse-relations en geneste entiteiten kan een client dure queries bouwen. Limit is al netjes gecapt op 100. **Actie:** depth-limit middleware (of de overstap naar gqlgen die dit ingebouwd heeft), en `GET /graphql/query` uitschakelen buiten dev (cache-/log-lekkage van queries in URLs).

### 5.7 Repo-hygiëne
`_temp/` (20+ scratch-mappen), `_baseline/`, `_pre_rebuild/`, `perf-results/`, `replay files/` (spatie in mapnaam) zitten in versiebeheer. **Actie:** `.gitignore` voor `_temp/`, `_pre_rebuild/`; `_baseline` is functioneel (rebuild-mechaniek) maar hoort eigenlijk niet in git — overweeg die naast de repo te plaatsen (env `BASELINE_DIR`).

---

## 6. Schema-repository & delta's (jouw eigen aandachtspunt)

Bevindingen die je vermoeden bevestigen:

1. **Migraties worden gegenereerd maar nooit geadministreerd of uitgevoerd.** `schemadiff.GenereerMigratie` schrijft SQL naar `dbsetup/migrations/`, maar niets in de applicatie leest die map (grep: nul verwijzingen). De zes bestaande `.sql`-bestanden zijn dus handmatig uitgevoerde, niet-geregistreerde acties. Er is geen `schema_migrations`-tabel (versie, checksum, applied_at), dus geen manier om te weten welke database welke stand heeft.
2. **Delta's worden niet vastgelegd.** `schema_versies` bevat het volledige model-JSON per versie, maar niet het diff-rapport of het migratieplan. De aansluiting tussen "versie X → versie Y" en "deze DDL is daarvoor gedraaid" ontbreekt.
3. **Activeren van een schema-versie is puur een status-flip** (`MaakActiveerSchemaVersieHandler`): het draait geen migraties en herbouwt niets; de samenhang activeren↔rebuild↔migratie zit alleen in de devloop-conventie.

**Voorstel (sluit aan op wat je zelf schetst):**
- Voeg `schema_migraties`-tabel toe: `(id, van_versie_id, naar_versie_id, diff_json, migratie_sql, status[pending|applied|failed], checksum, applied_at)`. Laat codegen/rebuild het diff-rapport + migratieplan **in dezelfde transactie** als de nieuwe `schema_versies`-rij wegschrijven.
- Maak activeren transactioneel: archiveer oude versie + markeer nieuwe actief + voer (idempotente) migratie-DDL uit + registreer in `schema_migraties`, alles in één tx; bij falen rollback en status `failed`.
- De FE-delta-check kan dan de server-side `schemadiff.Vergelijk` hergebruiken via een endpoint (die bestaat al deels als `POST /admin/diff/:password`) in plaats van een eigen lichte check — één bron van waarheid.

**Schema-repository lostrekken: ja, maar gefaseerd.** De lifecycles verschillen inderdaad (modelbeheer = design-time, register = run-time), en het register-per-domein-verhaal wordt schoner als elke registerinstantie zijn model uit een centrale schema-service haalt. Realistische route:
1. *Nu:* apart Go-package (`schemarepo/`) met eigen handlers en eigen tabellen (evt. eigen Postgres-schema `schemarepo.*`) — geen gedeelde types met de register-runtime behalve `V3Model`.
2. *Daarna:* apart deploybaar binary met eigen database; het register kent alleen nog "geef mij actief model + migratieplan". De bestaande `--from-url` in codegen wijst erop dat deze richting al half bestaat.

---

## 7. Actieplan (voorgestelde volgorde)

| # | Actie | Omvang | §
|---|---|---|---|
| 1 | ✅ (tests gefixt; CI-workflow nog toe te voegen) CI: `go build && go vet && go test ./...` verplicht groen; 2 falende tests fixen | klein | 4.9 |
| 2 | ✅ Echt registratietijdstip via `REGISTRATIE_TIJD=klok`; synthetisch blijft demo-default voor de FE-tijdlijnen | klein–middel | 3.1 |
| 3 | ✅ `RequireAuth`/`RequireRol` aangesloten; fail-closed PDP; JWT-secret verplicht | klein | 3.2, 3.4 |
| 4 | ✅ Admin/devloop-endpoints: build-tag, wachtwoord via header, constant-time, mutex op rebuild | klein | 3.3 |
| 5 | ✅ `POST /{padnaam}` (+ `/full`) door `RegistreerCore`; `/registraties`,`/wijzigingen` read-only | middel | 3.5 |
| 6 | ✅ (m.u.v. slog) `ErrNoRows`→404-helper; foutteksten niet naar client; `slog` invoeren | klein | 4.2, 4.3, 5.3 |
| 7 | ✅ Ongedaanmaking-reads binnen tx; `FOR UPDATE`; partial unique index op enkelvoudige GE's | middel | 4.1 |
| 8 | ✅ (afleiding set-based; WHERE-filter + EXPLAIN nog open) N+1 bij peiltijdstip | middel–groot | 4.4 |
| 9 | Duplicatie-lijst wegwerken (tabel §5.1) | klein, incrementeel | 5.1 |
| 10 | Schema-migratie-administratie (`schema_migraties`) + transactioneel activeren | middel | 6 |
| 11 | Codegen: ast-gebaseerde (of merge-vrije) registratie; reflectie in hot path vervangen door gegenereerde accessors | groot, gefaseerd | 5.4, 4.5 |
| 12 | Package-hersturcturering `handlers/` + schemarepo lostrekken (fase 1) | groot | 5.2, 6 |
| 13 | Dependency-bump bun/gin; besluit gqlgen-migratie; CDN-assets embedden | middel | 5.5, 5.6 |

Punten 1–6 samen zijn een dag of enkele dagen werk en nemen het gros van het productierisico weg; 7–8 zijn de correctheids-/schaalslag; 9–13 zijn de structurele verbeteringen.

---

*Verificatie tijdens review: `go build ./...` ✅ · `go vet ./...` ✅ · `go test ./...` ❌ (2 failures, zie §4.9). Reviewbestand is bewust niet gecommit; verplaats naar een eigen branch (bijv. `chore/be-code-review`) als het bewaard moet blijven.*
