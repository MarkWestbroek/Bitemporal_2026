# Render-API — modeldiagrammen als SVG

> Opdracht van Imprint (25-09-2026, `Imprint-engine/docs/design/opdracht-omnium-render-api.md`),
> met aanvullingen van 29-09. Imprint toont modellen uit Omnium op webpagina's en wil niet
> zelf tekenen: layout, kleur en notatie horen bij de bron. Status: gebouwd, door Imprint
> end-to-end geaccepteerd en op 30-09 gemerged naar `main` (`cf017099`); open punten in BACKLOG §36.

## Architectuur: één tekenaar

```
Imprint ──HTTP──▶ Go-API (publiek: auth, model ophalen, asOf, ETag)
                    │  intern
                    ▼
                 render-svc (Node, geen dependencies)
                    │  import
                    ▼
                 web/vite/src/diagramsvg   ◀── ook bruikbaar vanuit Studio
                    ├─ umleditor/metamodel/v3ModelNaarEditor.js  (mapping, dezelfde als Studio)
                    └─ umleditor/metamodel/autoLayout.js         (layout, dezelfde als Studio)
```

**Waarom geen headless browser.** Studio tekent met React Flow, dus als HTML/CSS in de DOM.
De bestaande export (`diagramcore/export/exporteerCanvas.js`, `html-to-image`) levert een
`<foreignObject>` op. Dat verbiedt Imprint, en de uitkomst hangt af van lettertypes in de
browser, dus byte-gelijk wordt het niet. Mapping en layout zijn wél gewone JS. Daarom schrijft
`diagramsvg` zelf pure SVG, met tekstmaten uit een vaste tabel (`tekstmaat.js`).

**Waarom een sidecar.** De API is Go en de tekenaar JS. De enige andere route is mapping, layout
en tekenen in Go na te bouwen, en dan heb je twee tekenaars die uit elkaar lopen. Besluit
Mark (29-09): Node-sidecar.

## Interface

### `POST /api/render/svg` (model-code) — ✅ gebouwd

Body (JSON). Onbekende velden geven een 400.

| Veld | Betekenis | Standaard |
|---|---|---|
| `taal` | `v3`, of `studio` (zie [hieronder](#taalstudio-elk-studio-profiel)) | `v3` |
| `model` / `code` | het V3-model als object, óf als JSON-tekst. Precies één van de twee. Een Studio-export met envelop `{ versie, …, model: {…} }` wordt uitgepakt. | — |
| `diagram` | naam van een opgeslagen diagram (`diagrammen[].naam`), op de posities uit dat diagram | — |
| `domein` | alle elementen van één domein, in autoLayout. Buren in een ander domein verschijnen als gestippelde stomp. | — |
| `entiteiten` | kommalijst of array: alleen deze entiteiten, hun gegevenselementen en hun onderlinge relaties (verfijning binnen diagram/domein) | alle |
| `richting` | `TB` \| `LR` (autoLayout) | `TB` |
| `theme` | `auto` \| `light` \| `dark` | `auto` |
| `velden` | `true` \| `false`: velden in de kaarten | `true` |
| `afhankelijkheden` | `true` \| `false`: datatype-kaartjes en «use»-lijnen. Standaard uit, want de veldkolom noemt het type al. | `false` |
| `idPrefix` | prefix voor alle id's (`[A-Za-z][A-Za-z0-9_-]{0,39}`) | `o<hash van invoer>` |
| `linkPattern` | maakt entiteiten klikbaar, bv. `/model/{entiteit}` (ook `{domein}`); moet beginnen met `/`, `#`, `http://` of `https://` | — |

**Keuze van de weergave:**
- `diagram` óf `domein` (niet allebei).
- Zonder keuze tekenen we het hele model alleen als het precies één domein heeft en geen
  diagrammen. Anders volgt een 400 met `diagrammen` en `domeinen` in de body, zodat Imprint een
  keuzelijst kan tonen.

**Antwoord:**
- `200 image/svg+xml; charset=utf-8`, met een `ETag` (sha256 over de SVG). `If-None-Match` geeft 304.
- Fouten komen als `application/problem+json`: `{ type, title, status, detail, … }`.

| Status | `type` | Wanneer | Extra velden |
|---|---|---|---|
| 400 | `urn:omnium:render:ongeldige-parameter` | onbekende of ongeldige parameter, geen weergave gekozen | `diagrammen`, `domeinen`, `parameters`, `entiteiten` |
| 404 | `urn:omnium:render:niet-gevonden` | diagram of domein bestaat niet | `diagrammen`, `domeinen` |
| 413 | `urn:omnium:render:te-groot` | body groter dan 5 MB | |
| 422 | `urn:omnium:render:ongeldig-model` | model niet te tekenen, of JSON-fout in `code` | `element`, `pad` (bv. `entiteiten[0].relaties[2].doelEntiteit`), bij JSON ook `regel`, `kolom` |
| 502 | `urn:omnium:render:render-svc-onbereikbaar` | sidecar niet bereikbaar | |

De validatie (`diagramsvg/validatie.js`) is bewust ruimer dan `validateV3Model.js`. Die laatste
volgt de codegen-eisen. Hier weigeren we alleen wat een tekening onmogelijk maakt: geen
entiteiten, een ontbrekende of dubbele typenaam, een relatie naar een onbekende entiteit, …

### `taal=studio`: elk Studio-profiel

Sinds 04-11 (BACKLOG §36) tekent dezelfde route ook diagrammen uit een Studio-project, voor
elk ingebouwd profiel (M2). De POST tekent wat de aanroeper meestuurt; voor een diagram dat op de
server in een project staat is er sinds 05-11 een `GET` met toegang, zie *Projectdiagram* hieronder.

| Veld | Betekenis |
|---|---|
| `model` / `code` | een Studio-projectexport (`{ formaat, project, profielen }`), of één profiel (`{ diagramTypeId, elements, diagrams }`) |
| `profiel` | profiel-id, bv. `archimate05`; nodig als een diagramnaam in meer profielen voorkomt |
| `diagram` | id of naam van het diagram. Verplicht als het model er meer heeft. |
| `theme`, `idPrefix` | zoals bij `v3` |

Andere velden geven een 400. `POST /views` op de sidecar geeft de keuzes, ook als
`weergaven: [{ id, naam, profiel }]`. Fouten volgen de tabel hierboven; een eigen profiel uit de
ontwerper, of een element waarvan het type niet in het profiel staat, geeft een 422. Een 503
(`studio-niet-beschikbaar`) betekent dat de profielbundel niet is gebouwd of geladen; `v3` werkt
dan gewoon door.

**Wat er nu getekend wordt.** Posities en maten komen uit het diagram, de inhoud uit de
compartimenten, lijnen uit `edgePresentatie`, met knikken. Nog geen profieleigen iconen. Bekende
zwakke plek: een sequence-diagram heeft nog geen echte levenslijnen, dus berichten overlappen.
**Lijnen zoals in de Studio (05-11):** de geometrie van een lijn (aanhechting, vorm bezier/
hoekig/recht/boom, knikken, zelf-lus, markers, labelchips) komt uit dezelfde bouwstenen als het
Studio-canvas (`zwevendeRand.js`, de React Flow-padfuncties), dus een lijn die in de Studio via
een omweg of met een andere lijnvorm is getrokken, rendert hier identiek (proef: 65 lijnen in
tien diagrammen gelijk op 0,5 px, sequence-berichten inbegrepen).
**Sequence (05-11):** de levenslijn tekent hier met dezelfde renderer als op het canvas: de
lijn tot onder haar laagste punt (minstens 500) en de activaties afgeleid uit de berichten. Het
type van een levenslijn (`instantieVan`, een element uit een ander profiel) kent de server
niet: de kop is dan de rechthoek met alleen de naam, onderstreept. In de Studio toont de kop
"naam:Type" of de vorm van het type.

**Vormtrouw groeit mee.** Sinds stap 5 van het plan *Eén tekenaar* (`docs/plans/2026-11-04`,
04-11) tekent `taal=studio` met dezelfde tekenaar als documenten en gedeelde plaatjes
(`diagramcore/tekenaar/`): inhoud uit de compartimenten, markers, knikken en nesting. Vormen
zonder ShapeType vallen terug op de zeven families; wordt een vorm een echt ShapeType (stap 4),
dan tekent de API hem zonder wijziging hier. Nog op de terugval: `archimate-box`,
`archimate-grouping`, `seq-levenslijn`, `act-begin`/`-eind`/`-beslissing`, `uc-actor`/`-ellips`/
`-systeem`. De tekening verandert dus per release; `idPrefix` en het foutcontract niet.

**Hoe het is opgebouwd.**
- `diagramsvg/studio.js` kiest het diagram, controleert de invoer (422 met het element), roept de
  tekenaar aan en werkt af: `title` en `aria-label`, de achtergrond, en elke `fill`/`stroke` door
  een witte lijst. De tekenaar draait met `controleer: true`: een ShapeRenderer die de SVG-eisen
  breekt (ander element, `on*`, `style`, externe `href`) geeft een 500 in plaats van foute uitvoer.
- Tekenaar en descriptors komen **uit dezelfde bundel**. De ShapeTypes staan in een register in
  modulestaat; een los geïmporteerde tekenaar zou de vormen uit de profielen niet zien en stil op
  de terugval tekenen. Daarom krijgt `renderStudioSvg` ze mee als `{ descriptorVan, tekenDiagram,
  naarSvg }`.
- `render-svc/studioProfielen.js` + `bouw.mjs` bundelen descriptors en tekenaar met esbuild. De profielen
  importeren JSX; in de bundel zijn die modules stubs met dezelfde exportnamen, dus React gaat
  niet mee. Een ontbrekende naam laat de bouw falen.
- Een nieuw profiel moet ook in `PROFIELEN` in `studioProfielen.js` staan.

### `GET /api/models/{naam}/diagram.svg` en `…/views.json` (model-link) — ✅ gebouwd

**Adres (besluit Mark 30-09):** naam + versie + tijdstip. Het model komt uit `schema_versies`
(`model_naam`, `model_versie`, `tijdstip`), waar Studio en de IDE publiceren (`POST /api/schema/model`).

| Parameter | Betekenis |
|---|---|
| `{naam}` (pad) | `model_naam`, URL-gecodeerd (bv. `np-loc%20+%20register`) |
| `versie` | `model_versie`; weglaten = de nieuwste versie |
| `asOf` | RFC 3339; de nieuwste rij met `tijdstip <= asOf` (maakt naam + versie uniek bij herpublicatie) |
| overige | als de POST: `diagram`, `domein`, `entiteiten`, `richting`, `theme`, `velden`, `afhankelijkheden`, `idPrefix`, `linkPattern` |

- `diagram.svg`: `200 image/svg+xml` met `ETag` (304 op `If-None-Match`) en `Last-Modified` (het
  `tijdstip` van de gebruikte versie). Fouten zoals bij de POST, plus 404 als er geen model is
  met die naam/versie/asOf, en 400 bij een onbekende queryparameter of een ongeldige `asOf`.
- `views.json`: `{ diagrammen, domeinen, naam, versie, tijdstip }` voor de keuzelijst in Imprint.
  `versie` en `tijdstip` zeggen welke opgeslagen versie is gebruikt.
- Open voor iedereen, net als `/api/schema/*`. Een API-sleutel voor niet-publieke modellen komt later.
- Let op: een hernoemd model krijgt een nieuwe naam, en de link met de oude naam geeft dan 404.
  Dat is bewust: het adres volgt het model zoals het gepubliceerd is.
- Nog niet: modellen die alleen in de browser staan (Studio-localStorage). Die moeten eerst
  gepubliceerd worden.

### Projectdiagram: `GET` op een Studio-project, met toegang — ✅ gebouwd (05-11, uitgebracht als api 0.19.0 op 06-11)

Stap 6 van het plan *Eén tekenaar* (`handlers/render_project.go`). `studio_projecten` is privé
("alles dicht tenzij"). **Privacy-besluit Mark 05-11-2026:** een projectdiagram is op te halen door
wie is ingelogd met leesrecht op het project, én met een token of link zoals bij de gedeelde
plaatjes.

| Route | Toegang |
|---|---|
| `GET /api/studio/projecten/{id}/diagram.svg?profiel=&diagram=&theme=&idPrefix=` | ingelogd + leesrecht op het project; ook met een persoonlijk API-token (`Authorization: Bearer omt_…`) |
| `GET /api/studio/projecten/{id}/views.json` | idem |
| `POST /api/studio/projecten/{id}/beelden` met `{ profiel_id, diagram_id, diagram_naam, soort: "svg" }` | ingelogd + leesrecht; geeft de link (`pad`: `/api/beeld/<token>.svg`) |
| `GET /api/beeld/<token>.svg?theme=&idPrefix=` | openbaar: het onraadbare token is de toegang, tot dat ene diagram |

- **`diagram.svg`**: `diagram` is het id of de naam, `profiel` het profiel-id (bv. `archimate05`).
  Met `profiel` haalt de database alleen dat profiel uit het project; zonder `profiel` gaan alle
  profielen naar de sidecar, wat bij een groot project op de grens van 5 MB stuit (413 met de
  aanwijzing om `profiel` mee te geven). `200 image/svg+xml` met `ETag` (304 op `If-None-Match`),
  `Last-Modified` (de snapshot), `Cache-Control: private, no-cache`, `X-Omnium-Project-Versie` en,
  als er operaties zijn die nog niet in de snapshot zitten, `X-Omnium-Achterstand: <aantal>`.
  Fouten zoals bij de POST (`problem+json` van de sidecar, ongewijzigd), plus 404 voor een onbekend
  project of profiel en 400 bij een onbekende queryparameter.
- **`views.json`**: `{ naam, versie, bijgewerkt, tot_volgnummer, laatste_volgnummer, weergaven:
  [{ id, naam, profiel }], diagrammen, domeinen: [] }`, op profiel en naam gesorteerd. Go leest dit
  zelf uit de snapshot; geen grens van 5 MB.
- **De link (soort `svg`)** hoort bij de gedeelde plaatjes (`studio_gedeeld_beeld`, zie
  `docs/STUDIO.md`): één link per diagram, zichtbaar in *Gedeelde plaatjes*, in te trekken met
  `DELETE …/beelden/{token}`; daarna geeft het adres meteen 404. Er wordt geen plaatje bewaard: de
  server tekent bij de aanvraag. `Cache-Control: public, no-cache`, `ETag`, `noindex`,
  `Cross-Origin-Resource-Policy: cross-origin`. De lezer kiest alleen `theme` en `idPrefix`; project,
  profiel en diagram liggen vast in de link. **Een fout van de sidecar gaat hier niet door**: zijn
  404 noemt de andere diagrammen van het profiel en een 422 een element. De lezer krijgt een kale
  melding (404 "Dit diagram is er niet (meer)", 422 of 502), het detail staat in de API-log.
- **Wat er getekend wordt: de snapshot.** De server bewaart een project als snapshot plus een
  operatielog dat alleen de Studio toepast. Een online client zet een nieuwe snapshot na 200
  operaties (`SNAPSHOT_NA`). De tekening kan dus achterlopen op wat iemand in de Studio ziet, en een
  diagram dat alleen nog in het log staat geeft 404 tot de volgende snapshot. `X-Omnium-Achterstand`
  en `laatste_volgnummer` zeggen hoeveel.
- **Cache**: een getekende SVG blijft tien minuten in het geheugen van de API, op projectversie,
  profiel, diagram, `theme` en `idPrefix`. Een navraag (`If-None-Match`) kost zo één lichte query
  in plaats van een render; een nieuwe snapshot geeft meteen een nieuwe tekening.
- **Titel**: de sidecar krijgt alleen `profielen` en `project.naam` mee, dus de titel van de SVG is
  "<projectnaam> — <diagramnaam>".
- **In de Studio (06-11)**: rechtsklik op het canvas → *Kopieer als SVG-link (de server
  tekent)*. Studio brengt daarbij eerst de snapshot bij (snapshot op verzoek), zodat de link het
  diagram van nu toont; zie `docs/STUDIO.md` (gedeelde plaatjes).
- **Open**: de link bijhouden tússen snapshots (nu: bij het maken van de link en na elke 200
  operaties); operaties ná de snapshot toepassen (vraagt de toepasser uit `studio/sync/operaties.js`
  in de sidecar, of een snapshot op verzoek); de CORS-lijst voor een los scherm; `HEAD` geeft 404
  (gin kent alleen de GET).

Beproefd 05-11 tegen de echte keten (API + sidecar 0.3.0 + PostgreSQL): de 35 diagrammen van het
project *Omnium architectuur* tekenen alle; met `AUTH_ENABLED=true` geeft de link anoniem 200 en
geven `diagram.svg`, `views.json` en het maken van een link anoniem 401.

Beproefd 06-11 op app (api 0.19.0, render 0.3.1, `AUTH_ENABLED=true`) met een persoonlijk
API-token op het project *Omnium architectuur*: `views.json` en `diagram.svg` ingelogd 200 en
anoniem 401; een link maken geeft 201 (anoniem 401) en een tweede keer hetzelfde adres; de link
geeft anoniem dezelfde SVG als `diagram.svg`, met `ETag` (304 op navraag), `noindex` en
`Cross-Origin-Resource-Policy: cross-origin`; `.png` op het token geeft 404; na intrekken geeft
het adres meteen 404 en is de lijst weer leeg. `theme` kent `auto`, `light` en `dark`; een andere
waarde geeft 400. Niet beproefd: de knop in de Studio zelf op app (met de snapshot op verzoek), en een
tweede client tegelijk.

Daarbij gevonden: de kop van de buitenste levenslijn viel buiten de `viewBox` (opgelost in de
tekenaar, zie `web/vite/CHANGELOG.md`; in de render-API met het eerstvolgende render-image). En
de twaalf sequence-diagrammen van dat project zijn via de MCP gemaakt: levenslijnen als doos van
160 × 70 zonder punten, zodat de berichten van doosrand naar doosrand lopen, alle op één hoogte.
Het canvas tekent ze precies zo (paden gelijk); dat is de inhoud van het model, geen
renderverschil.

## Eisen aan de SVG (afspraken met Imprint)

- `viewBox`, **geen** `width`/`height` op `<svg>`.
- `data-render-versie` op de wortel (en header `X-Render-Versie` van de sidecar, `GET /health` → `versie`): de versie van render-svc uit `render-svc/package.json`. De tekening verandert per release; wie een SVG bewaart, legt zo vast waarmee hij getekend is. Binnen één versie blijft de uitvoer byte-gelijk.
- `<title>`, `role="img"` en `aria-label` (titel plus de getekende entiteiten). Namen staan als
  `<text>` in de SVG, zodat ze doorzoekbaar zijn.
- Geen `<script>`, `on*`, `<foreignObject>`, `<image>`, externe `href` of `@font-face`. Geen
  `<style>`: alle opmaak staat in attributen, zodat een sanitizer niets hoeft weg te halen.
- Generieke fonts: `ui-sans-serif, system-ui, …`.
- **Kleuren, `theme=auto`:** diagramkleuren zijn `var(--diagram-<token>, <licht>)`. De tokens:

  | Token | Gebruik | Licht (fallback) | Donker (`theme=dark`) |
  |---|---|---|---|
  | `--diagram-surface` | achtergrond, externe stompen | `#ffffff` | `#0f172a` |
  | `--diagram-border` | kaartranden, compositie, generalisatie | `#64748b` | `#94a3b8` |
  | `--diagram-text` | labels (kardinaliteit), tekst in stompen | `#1e293b` | `#e2e8f0` |
  | `--diagram-muted` | «use»-lijnen, notitie-lijnen | `#64748b` | `#94a3b8` |
  | `--diagram-accent` | relaties, associatie-anker | `#7c3aed` | `#a78bfa` |

  - Zet de pagina niets, dan blijft het diagram licht, "als een figuur", ook op een donkere
    site. Dat is Marks voorkeur.
  - Koppelt Imprint de variabelen aan de sitetokens, dan volgt het diagram de site.
  - `theme=light` en `theme=dark` schrijven vaste waarden, zonder `var()`.
- **Elementkleuren** staan letterlijk in de SVG. Voor een entiteit geldt: `kleur` op de entiteit,
  anders `domeinen[].kleur`, anders de Studio-standaard. De andere elementtypen gebruiken de
  Studio-standaarden. Alleen `#rgb` en `#rrggbb` komen door.
- **Tekst óp een element** volgt het thema níet. Per elementkleur kiezen we op contrast (WCAG)
  donker (`#0f172a`) of wit. Dat is deterministisch en leesbaar, ook als de rest donker is
  (afspraak 29-09, als alternatief voor `--diagram-on-element`).
- **Stabiele id's:** `{prefix}ent-Product`, `{prefix}ge-Product_Kern`, `{prefix}rel-…`,
  `{prefix}enum-…`, `{prefix}ext-ent-…` (stomp), `{prefix}e-<edge-id>`, `{prefix}mk-…`
  (markers), `{prefix}titel`.
  - Zonder `idPrefix` is de prefix een hash van de invoer. Twee verschillende diagrammen op één
    pagina botsen dan nooit.

## Byte-gelijkheid

- Geen tijdstempels en geen willekeur.
- Getallen worden afgerond op 0,1, en attributen staan in een vaste volgorde.
- `autoLayout.js` is deterministisch, en `ontwarren.js` (overlap weghalen) ook.
- Tekstbreedtes komen uit een vaste Helvetica-tabel, niet uit een font.
- Gecontroleerd: de Linux-container (Node 22) levert byte voor byte dezelfde SVG als Windows (Node 24).

## Tekenkeuzes (afwijkingen van Studio)

- **Rechte lijnen van rand tot rand**, in plaats van bezier tussen handles. Dat is rustiger in
  een figuur en hangt niet af van de handle-keuze. Bekend nadeel: een lijn kan door een kaart lopen.
- **Geen «use»-lijnen en geen datatype-kaartjes** (tenzij `afhankelijkheden=true`). De layout
  krijgt die lijnen wél, zodat een enum bij zijn gebruikers staat.
- **Enums: maximaal 12 waarden**, daarna `… +N`.
- **Overlap weghalen na autoLayout** (`ontwarren.js`). Het lichtste element schuift weg: eerst
  badge, anker of notitie, dan gegevenselement, entiteit als laatste.
- In een diagramweergave gebruiken we de opgeslagen posities met onze eigen geschatte maten.
  Kaarten kunnen daardoor iets anders uitvallen dan in Studio.

## Draaien en testen

**Lokaal met F5:** de compound *Start frontend and debug API v06* (in `.vscode/launch.json` in de
repo-root) start de Vite-devserver, de Go-API (`:8082`, uit `.env`) én de sidecar
(*Render-svc v06*, `type: node`, dus breakpoints werken in `diagramsvg`). De Go-API vindt de
sidecar via `RENDER_SVC_URL`, standaard `http://127.0.0.1:8095`; zet die alleen als de sidecar
elders draait (in Docker: `http://render-svc:8095`). Zonder sidecar geven de render-routes een 502.
`bitemp_register_v06/.vscode/launch.json` heeft *Render-svc v06* als losse configuratie.

**Postman:** `postman/render-api.postman_collection.json`. De map *Sidecar* werkt zonder DB;
de map *Via Go-API* test ook de GET. Het resultaat staat als plaatje in de tab **Visualize**.

```bash
# tekenaar (unit + golden): in web/vite
node --import ./test/register-aliases.mjs --test src/diagramsvg/diagramsvg.test.js
UPDATE_GOLDEN=1 …                     # golden bijwerken na een bewuste tekenwijziging

# profielbundel voor taal=studio: één keer, en opnieuw na een wijziging in een profiel
cd render-svc && npm install && npm test   # bouwt de bundel en draait de sidecar-tests

# sidecar lokaal
node render-svc/server.mjs            # luistert op 127.0.0.1:8095; POST /api/render/svg (of /render/svg)
                                      # werkt zonder DB/Go-API; handig voor lokaal testen vanuit Imprint
node --test render-svc/server.test.mjs   # (map-argument werkt niet op Windows)

# Go-API: RENDER_SVC_URL (standaard http://127.0.0.1:8095)
go test ./handlers/ -run TestRenderSvg

# container
docker build -f Dockerfile.render -t bitemp-render-svc .
```

`docker-compose.yml` start `render-svc` naast de API, zonder gepubliceerde poort, en zet
`RENDER_SVC_URL` op de API. `deploy/vps/docker-compose.vps.yml` heeft de sidecar sinds 05-10 ook, maar is **nog niet
uitgerold**: daarvoor zijn een render-image en een nieuwe API-image nodig (VPS_DEPLOYMENT §11).

`POST /api/render/svg` is publiek, ook in de PEP (`middleware/authz_pep.go`, `isPubliekPad`).
Hij rendert alleen wat de aanroeper meestuurt en leest geen registerdata.
