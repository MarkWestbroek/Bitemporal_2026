# Projectsync — eenmalig naar de server, daarna operaties als events (plan)

Datum: 2026-10-07 · Status: **stap 1 live (07-10), stap 2 onderdeel 1–2 gebouwd** ·
Claude-sessie met Mark. Hoort bij BACKLOG §27.2 ("Modellen bitemporeel opslaan") en is
een **tussenstap** naar `2026-10-06 Modelregister — het model in het register
(ontwerpvoorstel).md`.

Aanleiding: het Studio-project leeft per browser in `localStorage`. Mark wil met één of
twee collega's aan een project werken terwijl de M3-herziening (die de echte
databasestructuur van het modelregister bepaalt) nog loopt. Dus: nu iets kleins dat
samenwerken mogelijk maakt, zonder de latere structuur vast te leggen.

---

## 0. Wat er nu is (feiten uit de code)

| Wat | Waar | Opmerking |
|---|---|---|
| Projectstructuur (mappen, plaatsing, tabs) | `useModellerenStore`, sleutel `studio-modelleren` | eigen `leesOpslag`/`schrijfOpslag`, eigen structuur-undo |
| Modelinhoud per profiel | `createDiagramStore({persistKey})`, sleutel `studio05-<profiel>` | Zustand `persist` + `zundo` (undo, limiet 50) |
| Kruisverbanden | `useKruisStore`, sleutel `studio-kruisverbanden` | |
| Project-werkbestand | `exporteerProject()` / `importeerProjectTekst()` in `modellerenActivity.jsx` | formaat `studio-project` v1: structuur, tabs, kruisverbanden, profielen; **geen id, geen naam**; klassieke editors overgeslagen; M2 (profielen/vormen/iconen) reist niet mee |
| Mutaties | ~35 losse Zustand-acties over drie stores | geen reducer, geen actietypes, geen centraal punt |
| Backend | Go, Gin, Bun, PostgreSQL 15 | JWT HS256 in httpOnly-cookie `bitemp_token`; `RequireAuth`, `RequireRol` (admin > editor > viewer); no-op bij `AUTH_ENABLED=false` |
| Realtime | — | geen WebSocket, SSE of LISTEN/NOTIFY; `notificaties/` levert alleen aan webhooks/mail |
| Server-opslag van modellen | `schema_versies` (V3), MinIO (`/api/bestanden`) | geen `/projects`-achtig endpoint |

Het ontwerpvoorstel Modelregister voorziet al: elke handeling één registratie,
optimistische versiecontrole, "SSE daarna", en een migratie-import van het
`studio-project`-JSON. Dit plan past daarin: stap 1 is de parkeerplaats voor de blob,
stap 2 levert het operatievocabulaire dat straks de registraties worden.

---

## 1. Stap 1 — eenmalige sync (één blob per project)

**Principe:** het project is al één JSON (de export). We zetten die blob, met een id en
een naam, in één gewone tabel. Bewust **geen** bitemporele entiteit en geen
`omnium`-domein: die structuur is nu juist onderwerp van de M3-herziening. De blob
is wegwerp-opslag; de latere migratie-import leest hem.

### 1.1 Backend

Tabel `studio_projecten` (Bun-model `model.StudioProject`, aangemaakt in
`dbsetup.CreateTables` met `IfNotExists`):

```
id              text  pk        -- UUID, door de client gekozen (localStorage kent hem al)
naam            text  notnull
eigenaar        text            -- gebruikersnaam van de maker (leeg zonder auth)
versie          bigint notnull  -- telt op bij elke opslag; optimistische vergrendeling
inhoud          jsonb notnull   -- het studio-project-JSON (formaat v2, §1.3)
aangemaakt      timestamptz
bijgewerkt      timestamptz
bijgewerkt_door text
```

Endpoints (`handlers/studio_project_handler.go`, routes in `main.go`):

| Methode | Pad | Rol | Gedrag |
|---|---|---|---|
| GET | `/api/studio/projecten` | ingelogd | lijst zonder `inhoud`: id, naam, eigenaar, versie, bijgewerkt, bijgewerkt_door, grootte |
| GET | `/api/studio/projecten/:id` | ingelogd | volledig record incl. `inhoud` |
| POST | `/api/studio/projecten` | editor | `{id?, naam, inhoud}` → aanmaken, versie 1; bestaand id → 409 |
| PUT | `/api/studio/projecten/:id` | editor | `{naam?, inhoud, versie}` → alleen als `versie` = huidige; anders **409** met de huidige meta (naam, versie, bijgewerkt_door). Onbekend id → 404 |
| DELETE | `/api/studio/projecten/:id` | eigenaar of admin | hard verwijderen |

"Ingelogd" = `RequireAuth`; bij `AUTH_ENABLED=false` (dev) is alles open en is de
eigenaar leeg. Zichtbaarheid: iedereen die is ingelogd ziet alle projecten (geen
lidmaatschap; dat komt met het modelregister).

### 1.2 Studio

- `useModellerenStore` krijgt `project: {id, naam, serverVersie}` (persist in
  `studio-modelleren`). Ontbreekt het (bestaande browser) → nieuw UUID, naam
  "Naamloos project", `serverVersie: null`.
- Project-menu:
  - kop met de projectnaam, *Hernoem project…* (via `vraagNaam`)
  - *Nieuw project…* = **parkeren**: eerst het huidige project als JSON exporteren
    (bevestiging), dan alle stores leegmaken en een nieuw id/naam zetten
  - *Naar server sturen*: POST bij `serverVersie === null`, anders PUT met de bekende
    versie; bij 409 een keuze: overschrijven (PUT met de serverversie) of afbreken
  - *Van server ophalen…*: dialoog met de lijst (naam, eigenaar, bijgewerkt);
    kiezen → bevestiging → stores vullen (zelfde pad als de JSON-import) → `serverVersie`
    overnemen
  - *Exporteer/Importeer project…* blijven
- Helpers worden gedeeld: `bouwProjectData()` (export én sync) en
  `pasProjectToe(data)` (import én ophalen).
- API-aanroepen in `studio/activities/projectSync.js` met `credentials: "include"`
  en `apiBase()`.

### 1.3 Formaat `studio-project` v2

Topniveau krijgt `project: {id, naam}` en `versie: 2`. Import accepteert v1 (dan nieuw
id, naam uit de bestandsnaam of "Geïmporteerd project") en v2.

### 1.4 Beperkingen van stap 1 (bewust)

- Laatste schrijver wint per **heel project**; de versiecontrole voorkomt alleen dat
  je ongemerkt andermans werk overschrijft. Samenwerken = om de beurt, of in
  gescheiden projecten.
- M2 (eigen profielen, vormen, iconen) en de inhoud van klassieke editors reizen niet
  mee. Collega's gebruiken dezelfde standaardprofielen. Meenemen van M2 in de blob is
  een kleine uitbreiding als het nodig blijkt.
- Eén project per browser tegelijk (vaste `localStorage`-sleutels); vandaar
  "parkeren" = exporteren en leegmaken.

---

## 2. Stap 2 — wijzigingen als operaties, live naar collega's

### 2.1 Transportkeuze

**SSE (server → browser) + gewone POST (browser → server).** Geen WebSocket.

| Optie | Oordeel |
|---|---|
| **SSE** | gewone HTTP, werkt door elke reverse proxy op de VPS, browser herverbindt zelf en stuurt `Last-Event-ID` mee; Gin heeft `gin-contrib/sse` (al indirecte dependency); de JWT-cookie reist mee met `EventSource(url, {withCredentials: true})` |
| WebSocket | tweerichtingsverkeer dat we niet nodig hebben; kost een hub, eigen reconnect en proxy-upgrade-configuratie; pas nuttig bij cursorposities/live-slepen |
| AsyncAPI | geen transport maar een **beschrijvingsformaat** (de OAS-tegenhanger voor event-kanalen); bruikbaar om het SSE-kanaal te documenteren, later mogelijk een M2-profiel naast OAS |
| CRDT (Yjs/Automerge) | lost gelijktijdig bewerken écht op, maar past slecht op het registratiemodel en is zwaar voor 2–3 mensen; niet nu |
| Postgres LISTEN/NOTIFY | pas nodig bij meer dan één Go-instantie; nu volstaat een in-memory hub per proces |

### 2.2 Operaties

Elke store-actie wordt een serialiseerbare **operatie**:

```json
{ "projectId": "…", "clientId": "…", "volgnummer": 1234, "actor": "mark", "tijd": "…",
  "store": "model:canoniek-uml", "op": "updateNodePosition",
  "args": { "diagramId": "…", "elementId": "…", "x": 120, "y": 80 } }
```

Het vocabulaire is de bestaande actielijst van de drie stores
(`createDiagramStore.js` r.100–526, `useModellerenStore`, `useKruisStore`). Dit is
tegelijk de concrete invoer voor de M3-herziening: dit zijn de handelingen die in het
modelregister elk één registratie worden.

### 2.3 Flow

1. **Lokaal toepassen** zoals nu; de operatie gaat in een **outbox** (in de store, ook
   gepersisteerd zodat een herlaad niets verliest).
2. Outbox → `POST /api/studio/projecten/:id/ops` (batch). De server kent een
   **volgnummer** toe (per project, monotoon), slaat op in `studio_project_ops` en
   zendt via SSE naar de andere clients van dat project.
3. Clients ontvangen operaties op `GET /api/studio/projecten/:id/events` en passen ze
   toe via dezelfde store-acties; eigen operaties (zelfde `clientId`) worden
   overgeslagen (of gebruikt als bevestiging).
4. **Herverbinden**: `Last-Event-ID` = laatste volgnummer; de server speelt de
   tussenliggende operaties na. Te groot gat (of onbekend) → snapshot opnieuw laden.
5. **Snapshot-compactie**: de server past zelf niets toe op de JSON (geen
   duplicatie van store-logica in Go). Een online client stuurt om de N operaties een
   nieuwe snapshot (de blob van stap 1) met het volgnummer tot waar hij geldt.
   Ophalen = snapshot + operaties daarna.

### 2.4 Details die vooraf geregeld moeten zijn

- **Undo**: operaties van anderen mogen niet in de eigen undo-stapel; `zundo`
  pauzeren (`temporal.pause()/resume()`) en de structuur-undo overslaan tijdens het
  toepassen van remote operaties. **Pauzeren alleen is niet genoeg** (gebleken bij de
  bouw): de undo is snapshot-gebaseerd, dus een eigen Ctrl+Z zou de hele oude stand
  terugzetten, daarmee het werk van de ander wissen, en dat via het vangnet naar
  iedereen sturen. Daarom wordt na elke remote operatie de undo-historie **gerebased**:
  de wijziging van de ander wordt per id (element, diagram, map, plaatsing) in elke
  bewaarde stand verwerkt (`rebaseStand` in `studio/sync/operaties.js`). Grof op
  id-niveau: raakte de ander hetzelfde diagram, dan is jouw undo op dat diagram een
  no-op. Nooit verlies van andermans werk.
- **Vangnet naast de benoemde operaties**: niet alles loopt via een actie (undo/redo,
  migraties, oude functiereferenties). Een diff op de store-subscription meldt die
  wijzigingen als `patchElementen`/`patchDiagrammen`/`patchStructuur`/`patchLinks`
  (upsert/wis per id). De kruisverbanden gebruiken alleen het vangnet: `toggleLink`
  hangt van een UI-keuze (actieve soort) af, de netto wijziging is de operatie.
- **Vocabulaire bijhouden bij nieuwe store-acties.** Studio 0.13.0 (canvas-bediening,
  op main, 07-10) voegde `updateElementen` (meerdere elementen in één stap) en
  `zetElementen` (hele map vervangen, gebruikt door hernoemen inclusief verwijzingen)
  toe en gaf `updateNodeSize` een optionele positie. Beide nieuwe acties staan in
  `MODEL_OPS`; `zetElementen` wordt als `patchElementen` (alleen het verschil) gemeld,
  omdat "vervang alles" bij last-writer-wins het gelijktijdige werk van een ander op
  andere elementen zou overschrijven. Gebaren zonder modeloperatie (taakbalken,
  lijngloed, weergavenaam) blijven buiten de outbox. Regel: elke nieuwe actie in
  `createDiagramStore.js` die `elements`/`diagrams` raakt, hoort in `MODEL_OPS`; staat hij
  er niet in, dan vangt het vangnet hem als patch (werkt, maar zonder naam).
- **Deterministische args**: waar een actie zelf een id genereert (map-id, voorkomen-id
  bij meerdere voorkomens) normaliseert de wikkel de args zodat de ander hetzelfde id
  gebruikt. `verplaatsMap` zet `volgorde` op `Date.now()`; dat wijkt per client iets af
  (semantisch "achteraan"), de volgende snapshot gelijkt het weer.
- **Conflicten**: last-writer-wins per operatie in servervolgorde. Voor 2–3 mensen op
  verschillende diagrammen ruim genoeg. Verwijderen vs. bewerken van hetzelfde element:
  de latere operatie faalt zacht (element bestaat niet meer) en wordt genegeerd.
- **Identiteit**: id's worden client-side gegenereerd (UUID); geen volgnummers in id's.
- **Wie is online**: optioneel een `presence`-event (join/leave) via hetzelfde kanaal.
- **Dev**: Vite (5174) ↔ Go (8082) is cross-origin; `EventSource` met
  `withCredentials: true` en de bestaande CORS-middleware met credentials.

### 2.5 Omvang

| Stap | Werk | Inschatting |
|---|---|---|
| 1 | tabel + 5 handlers + test; Studio: projectnaam/id, menu, dialoog, formaat v2 | ~1 dag |
| 2 | operatie-omwikkeling van ~35 acties, outbox, ops-endpoint + tabel, SSE-hub, reconnect, undo-pauze | enkele dagen, het leeuwendeel is het benoemen en omwikkelen van de acties |

---

## 3. Relatie met het Modelregister

- De blob-tabel is tijdelijk; het ontwerpvoorstel voorziet de migratie-import.
- Het operatievocabulaire (§2.2) wordt hergebruikt: operatie → registratie(s) in het
  domein `omnium`. De outbox/SSE-laag blijft; alleen de server-kant verandert van
  "dom logboek" naar "registraties met formele tijd".
- Open vraag uit het voorstel blijft open: projectrollen (eigenaar/bewerker/lezer) of
  alleen de `beheer`-rollen. Stap 1 gebruikt de `beheer`-rollen.

## 4. Voortgang

- [x] Stap 1 backend (2026-10-07): `model/studio_project.go`, `dbsetup/createtables.go`,
  `handlers/studio_project_handler.go` (+ `_test.go`: validatie altijd, roundtrip tegen
  PostgreSQL met `STUDIO_TEST_PG_DSN`), routes in `main.go`, API_REFERENCE §15.
  HTTP-roundtrip handmatig gecontroleerd tegen de dev-database.
- [x] Stap 1 Studio (2026-10-07): `project` in `useModellerenStore`, werkbestand v2,
  `activities/projectSync.js` (+ test), `activities/ProjectServerDialoog.jsx`, menu
  *Project*; STUDIO.md bijgewerkt. **Live sinds 07-10** (studio 0.14.0 / api 0.11.0 op app en
  pf) en door Mark getest: desktop → server → laptop, kleine wijziging, terug naar de server,
  op de desktop opgehaald — goed.
- [x] Stap 2, onderdeel 1 en 2 (2026-10-07): `web/vite/src/studio/sync/operaties.js`
  (koppelStore met omwikkelde acties + diff-vangnet, `pasOperatieToe` met undo-pauze én
  undo-rebase, vocabulaire `MODEL_OPS`/`STRUCTUUR_OPS`/patch-ops), `sync/outbox.js`
  (gepersisteerde outbox `studio-outbox`, `clientId` per tab), patch-acties in
  `createDiagramStore.js`, `useModellerenStore` (`patchStructuur`, `nieuweMap` met id) en
  `useKruisStore` (`patchLinks`); koppeling in `maakDiagramActiviteit.jsx`,
  `modellerenActivity.jsx`, `koppelingenActivity.jsx`; snapshot laden/leegmaken gedempt
  en wist de outbox. Tests: `sync/operaties.test.js` (naspelen, vangnet, undo-rebase,
  geen echo, demping, voorkomen-id). Nog niet in de browser doorlopen.
- [x] Stap 2, onderdeel 3 (2026-10-07, branch `feat/projectsync-ops`): tabel
  `studio_project_ops` (`model.StudioProjectOp`, pk project_id+volgnummer), kolom
  `studio_projecten.tot_volgnummer`, `POST/GET /api/studio/projecten/:id/ops`
  (`handlers/studio_project_ops_handler.go`; volgnummers in één transactie met FOR UPDATE op de
  projectrij; hook `NaStudioProjectOps` voor de SSE-hub), `laatste_volgnummer` in de projectmeta,
  DELETE ruimt het log op. API_REFERENCE §15. Test: `TestStudioProjectOps_Roundtrip` (pg).
- [x] Werkruimte gescheiden van project (2026-10-07, na Marks analyse): `studio-modelleren`
  houdt alleen mappen, plaatsing en projectidentiteit; tabs, actieve tab en open/dicht mappen
  staan in `studio-werkruimte:<projectId>` (per project bewaard, eenmalige migratie uit de oude
  sleutel). Werkbestand **v3**: zonder tabs/actieveTab en zonder viewports (`laadModel` houdt
  de lokale pan/zoom als de blob er geen draagt). Apparaat-laag (paneelbreedtes, taakbalken)
  blijft waar hij was. Later: werkruimte naar de server (tabel project+gebruiker, LWW),
  diagramsets privé/gedeeld, taakbalkvoorkeuren per gebruiker.
- [x] Stap 2, onderdeel 4 (2026-10-07): `studio/sync/verzender.js` — outbox in batches van 200
  naar `POST …/ops` (debounce 300 ms, backoff 1–30 s bij netwerkfout, 404 = niet op de server,
  afgekeurde batch wordt overgeslagen), `haalBinnen()` past operaties van anderen toe (eigen
  client-id overgeslagen; na een snapshot `inclusiefEigen`), **poll elke 5 s** zolang de tab
  zichtbaar is én direct na elke eigen verzending (SSE vervangt dit in onderdeel 5).
  Het interval is een **admin-instelling per instantie**: env `STUDIO_SYNC_POLL_MS`
  (standaard 5000, begrensd 500–120000), door de Studio gelezen via
  `GET /api/studio/instellingen`; lokale override `localStorage["studio-sync-poll-ms"]`.
  Een lege poll kost ~1 kB en ~1 ms serverwerk (gemeten: 27 ms rondreis naar de VPS).
  **Bug gevonden bij Marks test (twee browsers simultaan):** de verzender zette na een POST het
  laatst bekende volgnummer op het nummer van de eigen batch en sprong zo over operaties heen
  die de ander net daarvoor had gekregen — die kwamen nooit meer. Fix: het volgnummer schuift
  alleen op via `haalBinnen`, die eigen operaties op client-id overslaat. Regressietest in
  `verzender.test.js`; plus `web/vite/test/sim-client.mjs`: twee node-processen als "Chrome en
  Edge" tegen de echte API (25 + 25 elementen simultaan) eindigen met hetzelfde model. Project-state: `laatsteVolgnummer`,
  `liveSync` (menu *Live synchroniseren*), outbox persisteert alleen zolang live-sync aan is en
  wist zich bij een ander project. *Naar server sturen* = eerst outbox leeg, dan snapshot met
  `tot_volgnummer`; *Van server ophalen* = snapshot + operaties daarna. Menu-kop toont de stand.
  Tests: `sync/verzender.test.js` (batch/bevestig, offline, 404/400, inactief, haalBinnen).
- [x] Stap 2, onderdeel 5 (2026-10-07): `handlers/studio_project_sse.go` — in-memory hub per
  proces aan de hook `NaStudioProjectOps`, `GET /api/studio/projecten/:id/events`
  (naspelen vanaf `Last-Event-ID`/`?vanaf`, dan `event: stand`, daarna live `event: op` met
  id = volgnummer; keepalive 15 s; `X-Accel-Buffering: no` voor nginx; volle abonnee wordt
  afgekoppeld en herverbindt met naspelen). Studio: `startKanaal()` in `sync/verzender.js`
  (EventSource met withCredentials, zelfde `verwerkOp` als de poll, idempotent op volgnummer);
  de poll blijft als terugval en slaat het ophalen over zolang het kanaal verbonden is.
  Menu-kop toont "live" of "gesynchroniseerd (poll)". Tests: `TestStudioProjectSSE_NaspelenEnLive`
  (pg, echte HTTP-stream), `verwerkOp`-idempotentie in `verzender.test.js`.
- [x] Stap 2, onderdeel 6 (2026-10-07): snapshot-compactie. Server: `PUT` met `tot_volgnummer`
  verwijdert de operaties t/m de grens (grens nooit terug, afgekapt op het log; volgnummers
  tellen door vanaf de grens via `laatsteVolgnummerVan`); `GET …/ops` antwoordt
  `snapshotNodig` en het SSE-kanaal `event: snapshot` als een client vóór de grens staat.
  Studio: `overweegSnapshot()` in de poll-tik zet via `maakSnapshotStil` een stille snapshot
  zodra het log ≥ 200 (`SNAPSHOT_NA`) voorbij de grens staat én de client bij is (outbox leeg,
  stand ok); 409 = een ander was eerder, grens overnemen. `herlaadSnapshotStil` laadt de
  snapshot opnieuw (werkruimte blijft) en haalt daarna de operaties ná de grens binnen; het
  SSE-kanaal sluit en herverbindt daarvoor. Tests: pg-roundtrip (compactie, grens, nummering),
  SSE-snapshot-event, verzender (drempel, snapshotNodig).
- [x] Stap 2, onderdeel 7 (2026-10-08): presence over het SSE-kanaal. De hub kent per
  verbinding client-id (`?client=`) en actor; bij aan-/afmelden gaat `event: presence` met de
  lijst naar alle abonnees van het project. Studio: `useSyncStore.aanwezig`,
  `aanwezigSamengevat()` (per persoon, aantal tabs, "jij"), `StudioAanwezig.jsx` rechts in de
  menubalk ("2 anderen online", namen in de tooltip) en een kop "Online: …" in het Project-menu.
  Zonder auth heet iedereen "anoniem".
- [x] Poll-interval in de Studio-UI (2026-10-08): sectie *Samenwerken* in Studio-instellingen
  (`SamenwerkenInstellingen.jsx`): standaard van de instantie of 1/2/5/15/30 s per browser
  (`studio-sync-poll-ms`), met de actuele stand; `herstartPoll()` past het direct toe.
  Instantiebreed blijft `STUDIO_SYNC_POLL_MS` (een instellingen-opslag op de server is er niet).
- [ ] Werkruimte naar de server (tabel project+gebruiker, LWW), diagramsets privé/gedeeld.
