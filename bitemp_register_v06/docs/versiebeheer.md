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
  getagd met prefix `studio/` (§7). Laatst getagd: **`studio/v0.6.0`**
  (2026-07-29, Toegangsspraak/Toegangsregel + Sequence/BPMN/ArchiMate-profielen);
  zie `web/vite/CHANGELOG.md`.
- Backend: **`api/v0.5.0`** — sinds die tag zijn er geen Go-wijzigingen.
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
