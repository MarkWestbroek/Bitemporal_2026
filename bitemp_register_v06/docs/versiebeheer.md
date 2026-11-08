# Versionering — conventie

> Datum: 2026-07-13
> Doel: één afspraak voor versienummers, tags en de branch→PR→merge-werkwijze,
> zodat we betekenisvolle labels hebben zonder rommelige branch-/tag-lijsten.

## 1. Twee lagen: generatie vs. release

We onderscheiden bewust twee dingen die allebei "versie" heten:

| Laag | Wat | Waar | Bumpt wanneer |
|------|-----|------|---------------|
| **Generatie** | de architectuur-generatie van het register | de map: `bitemp_register_v06/` (v04, v05 = archief) | alleen bij een volledige herarchitectuur (zeldzaam) |
| **Release** | de semver van de actieve app | `bitemp_register_v06/web/vite/package.json` → `"version"` | bij elke betekenisvolle mijlpaal |

De **single source of truth** voor het release-nummer is `package.json` van de actieve app.
Op dit moment: **generatie v06, release `0.2.1`**.

## 2. Semver (pre-1.0)

Formaat: **`vMAJOR.MINOR.PATCH`**. Zolang we vóór 1.0 zitten gebruiken we `0.MINOR.PATCH`:

- **PATCH** (`0.2.x`): bugfixes en kleine, niet-brekende dingetjes. Bv. `0.2.0 → 0.2.1` (de Prism-fix).
- **MINOR** (`0.x.0`): nieuwe features. Vóór 1.0 mogen hier ook **breaking changes** in.
- **`1.0.0`**: de eerste stabiele/productiewaardige mijlpaal. Vanaf dan gelden strikte semver-regels
  (breaking → MAJOR).

## 3. Werkwijze

1. **Werk op een branch** met een sprekende naam (`feat/…`, `fix/…`, `docs/…`, `refactor/…`).
2. **PR naar `main`** → reviewen (desnoods jezelf) → **merge** → **branch opruimen**
   (lokaal `git branch -d <naam>`; op GitHub *Delete branch*). De historie blijft in `main` +
   de PR blijft als permanent archief bestaan.
3. **Bij een betekenisvolle mijlpaal op `main`:**
   - werk `"version"` in `package.json` bij;
   - zet een **annotated tag** die daaraan gelijk is:
     ```sh
     git tag -a v0.2.2 -m "Korte omschrijving van de mijlpaal"
     git push origin v0.2.2
     ```
   - GitHub maakt van de tag automatisch een **Release**-pagina (optioneel met changelog-notities).

De `package.json`-versie en de git-tag horen **altijd gelijk** te zijn.

## 4. Tags

- Gebruik **annotated tags** (`-a`, met boodschap/datum/auteur), geen lightweight tags.
- `git tag -l` geeft in één oogopslag alle versies; `git checkout v0.2.1` brengt je naar die
  exacte toestand.
- **Historische tags van vóór deze conventie** (bv. `v0.5-fase-4` uit de v05-generatie) volgen dit
  schema niet — laat ze staan, maar hergebruik het fase-schema niet.

## 5. Branches weggooien kost geen historie

Een branch is slechts een verplaatsbaar naamlabel. Na een merge zitten de commits permanent in
`main`; `git log --graph` toont nog steeds welke commits bij die lijn hoorden, en de PR bewaart de
volledige diff en discussie. Merged branches opruimen is dus veilig en houdt de lijst overzichtelijk.
Alleen een **niet-gemergede** branch verwijderen verweest commits — daarom weigert `git branch -d`
dat, en forceert `git branch -D` het (met opzet).

## 6. Huidige stand

- Generatie **v06**; Studio-release = `web/vite/package.json` (bron van waarheid),
  getagd met prefix `studio/` (§7). Laatst getagd: **`studio/v0.34.1`**
  (2026-11-08, patch: V3-export zet `doelEntiteit` op de naam van het doel, niet het element-id;
  inrichtingsexport uit een Studio-project; samen met render 0.3.7 en devloop 0.25.3), na **`studio/v0.34.0`**
  (2026-11-08: elementen uit een andere taal op een diagram, koppelingen als lijnen met een
  soortenlijst per project, leesrichtingspijl langs de lijn, een referentielijst (items-relatie)
  als veldtype, de assistent wijzigt velden, sequence-berichten via plan en MCP, SHACL-profiel
  (preview) en ODRL AssetCollection; samen met api 0.22.0, render 0.3.6 en devloop 0.25.1), na
  **`studio/v0.33.0`**
  (2026-11-07: Project → Register bouwen… — het register uit dít project, via de server; samen
  met api 0.21.0 en render 0.3.5), na **`studio/v0.32.0`**
  (2026-11-06: kopiëren en plakken via rechtsklik en als kopie, diagram kopiëren/plakken in de
  boom, overerving en «gebruikt» als connectoren (ERFT-1, GEBR-1), uiteinden van een verbinding,
  lijnen verschuiven en spreiden, subtype zonder eigen tijdlijn; samen met render 0.3.4, api
  blijft 0.20.0), na **`studio/v0.31.0`**
  (2026-11-06: elementen maken en nesten in de projectboom (fase 0 "Linked data als M2"),
  kopiëren en plakken, tabs verslepen, diagrambundels, «gebruikt», GE-kardinaliteit 0..*,
  laadModel via het vangnet, PUT noemt de eigen tab; samen met render 0.3.3, api blijft 0.19.0),
  na **`studio/v0.30.0`**
  (2026-11-06: de tekenaar tekent wat het canvas tekent — «use»-lijnen, afgeleide vakken,
  opgenomen delen, labeldelen —, levenslijn altijd 14 breed, sequence uit een plan met punten en
  activaties; samen met render 0.3.2, api blijft 0.19.0), na **`studio/v0.29.0`**
  (2026-11-06: Kopieer als SVG-link — de server tekent —, snapshot op verzoek, labels op dezelfde
  zijde stapelen, inrichting: bronnen als artefacten; samen met api 0.19.0, render blijft 0.3.1),
  na **`studio/v0.28.0`**
  (2026-11-05: één tekenaar stap 3 en 4 — het canvas tekent met de tekenaar, alle profielvormen
  zijn ShapeTypes, de oude React-vormen zijn weg; samen met render 0.3.0, api blijft 0.18.0), na
  **`studio/v0.27.0`**
  (2026-11-05: één tekenaar — vormcontract ShapeType/ShapeRenderer in het M3, `diagramcore/tekenaar/`
  voor documenten en gedeelde plaatjes; samen met render 0.2.0, api blijft 0.18.0), na
  **`studio/v0.26.0`**
  (2026-10-31: V3 als delta in het project, `uuid` op modelelementen, namen uniek per domein,
  FieldRef gebonden via de uuid; samen met api 0.18.0), na **`studio/v0.25.0`**
  (2026-10-31: inrichting van e-diensten uit het model — objecttype, formulier, zaaktype,
  GZAC-dossierbundel, uitvoerbare BPMN en een DMN-beslistabel, export als zip voor Fundament; de
  V3.1-veldsleutels overleven de Studio; alleen frontend), na **`studio/v0.24.0`**
  (2026-10-23: auto-layout op leesvolgorde in alle profielen en ArchiMate-lagen op afhankelijkheden,
  use case naar Cockburn, het superprofiel (notitie, constraint, annotatie-lijn, diagramverwijzing),
  doorklikken en Verwezen door, groupings als containers; alleen frontend), na **`studio/v0.23.0`**
  (2026-10-16: plaatjes als link voor Confluence, velden via de assistent, op raster,
  documentdiagram recht, lege rijen weg, instellingen-crash; samen met api 0.17.0), na **`studio/v0.22.0`**
  (2026-10-16: use case als ouder in de boom, boom opgeruimd, assistent op het canvas en weghalen,
  Gebruikt op, kopieer voor Teams/Confluence; alleen frontend), na **`studio/v0.21.0`**
  (2026-10-15: AI-assistent in context, Mijn API-tokens, boomregel, sequence fase 0; samen met
  api 0.16.0), na **`studio/v0.20.1`**
  (2026-10-14: nieuwe versie zonder F5, wat is er nieuw, meldingen #5–#7; alleen frontend), na **`studio/v0.20.0`**
  (2026-10-14: melden vanuit Omnium — F8, Mijn meldingen, melden.html; samen met api 0.15.0),
  na **`studio/v0.19.0`**
  (2026-10-14: uitnodigen en toegang per project, vijf rollen, help en kennismakingstour,
  relatiepaneel, GE-kardinaliteit `0..*` `{enkelvoudig}`; samen met api 0.14.0), na **`studio/v0.18.0`**
  (2026-10-13: beschrijving als vaste M3-eigenschap, inspector altijd bruikbaar, projectboom-fixes,
  beleidsbundel-export; alleen frontend), na **`studio/v0.17.0`**
  (2026-10-12: canvas-fixes — deselecteren, kaders, vergroten, aanhechten op toppen, donker thema,
  slepen uit een domein — afgeleide relaties en UML-Property-kernset; alleen frontend), na
  **`studio/v0.16.0`**
  (2026-10-10: Sparx EA ↔ Omnium, acht nieuwe profielen, M3-overerving, documenten uit sjablonen),
  na **`studio/v0.15.2`** (2026-10-08: patch — snapshot-grens reist mee), na **`studio/v0.15.1`**
  (2026-10-08: patch — boomvolgorde synct en overleeft de snapshot) en **`studio/v0.15.0`**
  (2026-10-08: live samenwerken — projectsync stap 2 — en canvas-bediening vervolg). Daarvoor
  **`studio/v0.14.0`** (2026-10-07: project op de server, operatielaag, projectboom-fixes) en
  **`studio/v0.13.0`** (2026-10-07: canvas-bediening — inline hernoemen, verbind-modus, kaders,
  taakbalken op een rij); zie `web/vite/CHANGELOG.md`.
- Backend: **`api/v0.22.3`** (2026-11-08, patch: de startup-rebuild genereert het
  standaardpakket alleen als het expliciet gegenereerd was — vlag `gegenereerd` op
  `gebouwde_domeinen`; devloop-image 0.25.5). Daarvoor **`api/v0.22.2`** (2026-11-08, patch: meerregelige beschrijvingen breken het
  gegenereerde Go-commentaar niet meer; devloop-image 0.25.4). Daarvoor **`api/v0.22.1`** (2026-11-08, patch: items-relatie op het item — eigen tabel
  `<item>_<relatie>` en niet meer onder Referentielijst; devloop-image 0.25.2; devloop-image 0.25.3 = dezelfde api met studio 0.34.1). Daarvoor **`api/v0.22.0`** (2026-11-07: de domeinen van het register expliciet — `domeinen`,
  `alle_domeinen`, `precies` op `/admin/rebuild`, `schema_versies.gebouwde_domeinen` voor de
  startup-rebuild, `/admin/wees-tabellen` —, GitAdres naar gegevenstypen, codegen klaar voor
  gegevenstypen uit het model; devloop-image 0.25.0; devloop-image 0.25.1 = dezelfde api met studio 0.34.0). Daarvoor **`api/v0.21.1`** (2026-11-07, patch: vervallen kolommen breken geen insert meer —
  `WithDiscardUnknownColumns`, vervallen NOT NULL nullable —, en de startup-rebuild leest
  `schema_versies` vóór de migratie; devloop-image 0.24.14). Daarvoor **`api/v0.21.0`**
  (2026-11-07: rebuild uit een Studio-project — `POST /admin/rebuild
  {project_id}` met de V3 van de render-sidecar en de herkomst op `schema_versies` —, `GET
  /api/studio/projecten/:id/v3`, en de codegen-weigering van `isMaterieel`/`tijdprecisie` op een
  subtype; devloop-image 0.24.13). Daarvoor **`api/v0.20.0`** (2026-11-06: een volledige PUT op een Studio-project wordt geweigerd
  zolang een andere client bezig is — 409 `project_in_gebruik` —, met een uitzondering voor de
  snapshot van een verbonden tab die bij is; devloop-image 0.24.11). Daarvoor **`api/v0.19.0`** (2026-11-06: projectdiagram als SVG met toegang — `diagram.svg`
  en `views.json` op een Studio-project, soort `svg` bij de gedeelde plaatjes; stap 6 van het
  plan *Eén tekenaar*). Daarvoor **`api/v0.18.0`** (2026-10-31: materieel enkelvoudig met opvolging en `geldigOp`,
  tijdprecisie datum|tijdstip — `date` → `timestamptz` bij het opstarten —, subtype-id in JSON,
  `uuid` uit de Studio in V3/TypeMeta/plat schema, `/api/volgorde`, `/health`, devloop
  startup-rebuild/zelftest/dbproef; devloop-image 0.24.9). Daarvoor **`api/v0.17.0`**
  (2026-10-16: gedeelde plaatjes — tabel `studio_gedeeld_beeld`,
  PNG in MinIO, `/api/studio/projecten/:id/beelden` en openbaar `/api/beeld/<token>.png`).
  Daarvoor **`api/v0.16.0`** (2026-10-15: persoonlijke API-tokens — tabel `gebruiker_token` —,
  `tools/omnium-mcp` met meldingen, projecten en modellen, AI-proxy-instellingen in de
  app-compose). Daarvoor **`api/v0.15.0`** (2026-10-14: domein `meldingen` en `/api/meldingen`, tabel
  `melding_bestand`). Daarvoor **`api/v0.14.0`** (2026-10-14: uitnodigen, vijf rollen en toegang per Studio-project
  — tabellen `studio_project_toegang`, `studio_migraties`, `gebruiker_uitnodiging` en een eenmalige
  toegangsmigratie —, toegangsbeleid fase 1a/1b (PDP en PEP op het leespad), afgeleide relaties
  bij lezen, EUPL-1.2). Daarvoor **`api/v0.13.0`** (2026-10-10: EA-import via de server — node-sidecar uit git —
  en projectinhoud tot 100 MB; geen databasegevolg). Daarvoor **`api/v0.12.0`** (2026-10-08: operatielog, SSE-kanaal, compactie, presence en
  werkruimte voor Studio-projecten; tabellen `studio_project_ops`, `studio_werkruimtes`; geen
  brekende wijzigingen). Daarvoor **`api/v0.11.0`** (2026-10-07: Studio-projecten op de server,
  tabel `studio_projecten`); zie `RELEASE.md`.
- Generator: **`codegen/v0.1.0`**; sindsdien geen release.
- Render-sidecar: **`render/v0.3.7`** (2026-11-08: `/export/v3` met de doelEntiteit-fix van
  studio 0.34.1; image `bitemp-render-svc:0.3.7`), na **`render/v0.3.6`** (2026-11-08: de tekenaar van studio 0.34.0 — leesrichtingspijl
  langs de lijn, een `$ref`-veld toont zijn verwijzing, «gebruikt» naar een items-relatie;
  image `bitemp-render-svc:0.3.6`), na **`render/v0.3.5`** (2026-11-07: `POST /export/v3`, V3 uit een Studio-project
  met de terugreis van de Studio; zustand, zundo en react als devDependencies voor de bundel;
  image `bitemp-render-svc:0.3.5`), na **`render/v0.3.4`** (2026-11-06: de tekenaar van studio 0.32.0 — oude
  generalisaties gevouwen, «gebruikt» uit het veldtype, lijnen spreiden en verschuiven,
  zelf-relatie met associatieklasse; image `bitemp-render-svc:0.3.4`), na
  **`render/v0.3.3`** (2026-11-06: «gebruikt» en de model-migratie van het
  profiel vóór het tekenen, packages met uitwerking; image `bitemp-render-svc:0.3.3`), na
  **`render/v0.3.2`** (2026-11-06: de tekenaar van studio 0.30.0 — «use»-lijnen,
  afgeleide vakken, labeldelen, de kop van de buitenste levenslijn in beeld; image
  `bitemp-render-svc:0.3.2`), na **`render/v0.3.1`** (2026-11-06: labels op dezelfde zijde van een lijn onder
  elkaar, zoals het canvas; image `bitemp-render-svc:0.3.1`), na **`render/v0.3.0`** (2026-11-05: profielvormen van stap 3/4, bouw los van
  web/vite, `data-render-versie` in elke SVG; image `bitemp-render-svc:0.3.0`), na
  **`render/v0.2.0`** (2026-11-05: `taal=studio` met de ene tekenaar) en **`render/v0.1.0`**
  (eerste uitgave, 2026-10-06), zie
  [`DOCKER_RELEASE.md`](DOCKER_RELEASE.md) §4.2a.
- Deze nummers zijn óók de Docker-image-tags (zonder `v`): zie
  [`DOCKER_RELEASE.md`](DOCKER_RELEASE.md).

---

## 7. Meerdere componenten (monorepo)

> Toegevoegd 2026-07-16. De conventie in §1–§6 ging uit van één semver voor "de app".
> De repo bevat in werkelijkheid **meerdere onafhankelijk te versioneren componenten**.

**Belangrijk (git-mechanica):** een git-tag wijst altijd naar een **hele-repo-commit** —
je kunt géén submap taggen. De monorepo-oplossing is een **prefixed tag** per component:
`component/vMAJOR.MINOR.PATCH`. De tag snapshot nog steeds de hele repo; de prefix zégt op
welk component het nummer slaat.

| Component | Map | Bron-van-waarheid | Tag-prefix |
|-----------|-----|-------------------|------------|
| Frontend / **Studio** | `web/vite/` (Studio + inhoud-editor + publicatie + IDE) | `package.json` `"version"` | `studio/` |
| **Backend** (Go API) | Go-code buiten `web/` (`model/`, `handlers/`, `dynql/`, `dbsetup/`, …) | git-tag (evt. later een `VERSION`-bestand) | `api/` |
| **Generator** (codegen) | `cmd/codegen/` | git-tag | `codegen/` |
| **Render-sidecar** | `render-svc/` (+ de tekenaars `web/vite/src/diagramsvg` en `diagramcore/tekenaar`) | git-tag | `render/` |

**Slash, geen hyphen.** We schrijven `studio/v0.4.0`, niet `studio-v0.4.0`. Redenen:
- Git behandelt `/` als ref-hiërarchie (`refs/tags/studio/…`), dus `git tag -l 'studio/*'`
  filtert per component als een map.
- `submap/vX.Y.Z` (slash) is bovendien het formaat dat **Go-module-tooling vereist** voor
  sub-module-tags — relevant in deze Go-monorepo.
- Alternatieven `component@1.2.3` (npm/changesets) en `component-v1.2.3` bestaan, maar slash
  is dominant in monorepos (Go, Nx) en het meest "map-achtig".

Filteren/inspecteren:
```sh
git tag -l 'studio/*'              # alle Studio-releases
git describe --tags --match 'api/*' # dichtstbijzijnde backend-versie vanaf HEAD
```

Componenten bewegen onafhankelijk en mogen op dezelfde óf verschillende commits getagd worden.
Conventional-commit-scopes (`feat(studio):`, `fix(api):`, `feat(codegen):`) maken per-component
filteren en changelog-generatie mogelijk.

**Grandfathered:** de kale tags `v0.2.1` (was de FE-brede release) en `v0.5-fase-4` (v05-generatie)
blijven staan; het prefixed schema geldt vanaf nu.

### 7.1 Retroactieve ankerpunten (2026-07-16)

**Studio (FE)** — logische mijlpalen uit de historie (`git log -- web/vite/src/studio`):

| Tag | Datum | Commit | Mijlpaal |
|-----|-------|--------|----------|
| `studio/v0.1.0` | 2026-06-17 | `baaffae` | Raamwerk: VS Code-schil, activity-registry, eerste activiteiten |
| `studio/v0.2.0` | 2026-07-12 | `78afc70` | Consolidatie fase 0–2: Modelleren-tab-host, projectboom, structuur-undo, shape-editor |
| `studio/v0.2.1` | 2026-07-13 | `b645190` | 07-13-features (Koppelingen-matrix, transformeren-raamwerk) + Prism-fix + versionering-conventie (= bestaande `v0.2.1`) |
| `studio/v0.3.0` | 2026-07-14 | `10c69f9` | Kruisverband grafisch + transformatie-generatoren + state-machine-profiel + beeld-export |
| `studio/v0.4.0` | 2026-07-16 | *bij merge van `feat/formulier-editor-studio`* | Visuele FormulierDefinitie-editor (palette→canvas→preview, DB-save, meervoudigheid/`lijst`, runtime-integratie) |

De anker-datums zijn pragmatisch: `v0.2.1` bundelt enkele 07-13-features die strikt genomen een
minor waren — het nummer stond echter al vast. Nummers mogen bij herziening wijzigen.

**Backend** — `api/v0.5.0` als baseline op `main` (`10c69f9`). Vóór deze baseline: gezamenlijke,
gemengde FE/BE-historie; niet per component te reconstrueren (zie `git log`).

**Generator** — `codegen/v0.1.0` als baseline op `main` (`10c69f9`).

### 7.1a Van git-tag naar Docker-tag

De Docker-image-tag is hetzelfde nummer, zónder component-prefix en zónder `v`:
`studio/v0.6.0` → `markwestbroek/bitemp-viz-frontend:0.6.0`. Elke push zet daarnaast
`latest`. Het volledige beleid staat in [`DOCKER_RELEASE.md`](DOCKER_RELEASE.md).

### 7.2 Release-logs (per component)

- `web/vite/CHANGELOG.md` — FE/Studio (secties per `studio/vX`).
- `RELEASE.md` (repo-root van v06) — backend/overall chronologisch log (bestaand).
- `cmd/codegen/CHANGELOG.md` — generator.

Formaat: [Keep a Changelog](https://keepachangelog.com). Elke tag/Release verwijst naar zijn
changelog-sectie.
