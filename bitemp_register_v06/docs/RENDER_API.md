# Render-API — modeldiagrammen als SVG

> Opdracht van Imprint (25-09-2026, `Imprint-engine/docs/design/opdracht-omnium-render-api.md`),
> met aanvullingen van 29-09. Imprint toont modellen uit Omnium op webpagina's en wil niet
> zelf tekenen: layout, kleur en notatie horen bij de bron. Status: zie BACKLOG §36.

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
| `taal` | `v3` (later meer) | `v3` |
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

## Eisen aan de SVG (afspraken met Imprint)

- `viewBox`, **geen** `width`/`height` op `<svg>`.
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

```bash
# tekenaar (unit + golden): in web/vite
node --import ./test/register-aliases.mjs --test src/diagramsvg/diagramsvg.test.js
UPDATE_GOLDEN=1 …                     # golden bijwerken na een bewuste tekenwijziging

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
`RENDER_SVC_URL` op de API. De VPS-deploy (`deploy/vps`) heeft de sidecar nog niet.

`POST /api/render/svg` is publiek, ook in de PEP (`middleware/authz_pep.go`, `isPubliekPad`).
Hij rendert alleen wat de aanroeper meestuurt en leest geen registerdata.
