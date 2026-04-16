# Release checklist

Korte checklist voor een API-release met losse DB-stack.

## Publicatie markdown — tabelweergave hersteld (2026-04-16)

- Oorzaak: de lokale markdown-renderer in de frontend ondersteunde geen GFM-tabellen, waardoor tabelsyntax als platte tekst werd weergegeven op de publicatiepagina en in de markdown-preview.
- Oplossing: tabelparsing toegevoegd aan `markdownNaarHtml()` in zowel `web/vite/src/publicatie/PublicatieDetail.jsx` als `web/vite/src/components/editor/MarkdownWeergave.jsx`.
- Styling: tabelopmaak toegevoegd in `web/vite/src/styles/common-ground-theme.css` voor zowel `.cg-markdown-viewer__body table` als `.cg-form-card table`.
- Resultaat: geldige markdown-tabellen renderen nu als HTML-tabel in publicatie en editor-preview.

## Publicatie markdown — HTML entities niet meer zichtbaar (2026-04-16)

- Oorzaak: placeholderwaarden in `PublicatieDetail` werden eerst ge-escaped in `renderTemplate()` en daarna nogmaals via `markdownNaarHtml()`, waardoor tekst als `API&#39;s &amp; opslag` zichtbaar werd.
- Oplossing: placeholder-invoeging in `renderTemplate()` gebruikt nu ruwe tekst; escaping blijft centraal in `markdownNaarHtml()`.
- Resultaat: waarden uit de API worden weer normaal getoond, bijvoorbeeld `API's & opslag`.

## CG Portfolio — modeluitbreiding extra velden + meervoudige weergave (2026-04-16)

### DB-migratie: `20260415_add_cg_beoordeling_etalage_extra_velden.sql`
Voer dit script uit op de applicatiedatabase (`bitemp_go_db_v06`) vóór de volgende backend-start. Alle kolommen zijn nullable (backward-compatible).

Nieuwe kolommen op bestaande tabellen:

| Tabel | Kolom | Type | Toelichting |
|---|---|---|---|
| `initiatief_planning_data` | `obstakels` | TEXT | Beschrijving van obstakels voor de planning |
| `initiatief_planning_data` | `verwacht_ready_datum` | DATE | Verwachte datum van gereedmelding |
| `initiatief_product_data` | `vervangt_ouder_product` | BOOLEAN | Vervangt dit product een ouder product? |
| `initiatief_bijdrage_data` | `score` | INTEGER | Numerieke beoordelingsscore |
| `initiatief_initiatiefinfo_data` | `aanmeldingsdatum` | DATE | Datum van aanmelding van het initiatief |

Nieuwe tabellen (`initiatief_beoordeling`, `initiatief_beoordeling_data`, `initiatief_beoordeling_aanvang`, `initiatief_beoordeling_einde`, `initiatief_etalage`, `initiatief_etalage_data`) worden automatisch aangemaakt via Bun `IfNotExists()` bij backend-start — geen handmatige DDL nodig.

### Backend: meervoudige weergavenaam-verrijking (`handlers/full_handlers.go`)
Relatie-hubs met een `SecondaireEntiteitIDKolom` én een `IsWeergaveVeld`-AfgeleidVeld (zoals `InitiatiefDomein`) krijgen nu automatisch een `weergavenaam`-veld meegeleverd in de `/full/`-response. De waarde wordt server-side bepaald door de doelentiteit (bijv. `Domein`) op te halen en het AfgeleidVeld-pad te navigeren.

### Frontend: meervoudige veldpaden (`PublicatieTabel.jsx`)
`resolveVeldpad()` ondersteunt nu meervoudig `momentvoorkomen`: bij een GE/relatie met meerdere actieve items worden alle waarden verzameld en samengevoegd met `", "`. Voorbeeld: `"initiatief_domeinen.weergavenaam"` geeft `"Standaarden, Componenten"`.

### Weergave replay bijgewerkt
`registraties-replay-init-standaard-weergavedefinities.json`: kolom `"Domeinen"` (veldpad `"initiatief_domeinen.weergavenaam"`) toegevoegd aan de Initiatief-standaardweergave.

### Frontend: filter voor meervoudige kolommen (`PublicatieTabel.jsx`)
De globale zoekfunctie en per-kolom-filter werken nu ook correct voor meervoudige veldpaden (bijv. `"initiatief_domeinen.weergavenaam"`).

**Oorzaken van het probleem:**
1. TanStack Table kan kolom-IDs met punten (`.`) intern inconsistent afhandelen.
2. Kolommen gebaseerd op `accessorFn` + een verouderde `typeMetaByTypenaam`-closure konden `null` teruggeven in de filter-fase, ondanks correct tonen in de cell-renderer.

**Oplossing (dubbele aanpak):**
- `sanitizeKolId()`: vervangt punten in veldpaden door `__` voor veilige TanStack-sleutels.
- `resolvedData` memo: pre-berekent alle kolomwaarden upfront (inclusief meervoudige samenvoegingen) als directe string-properties op elke rij.
- Kolommen gebruiken nu `accessorKey` (eenvoudige string) i.p.v. `id + accessorFn`, zodat TanStack de waarde rechtstreeks uit `resolvedData[sanitizeKolId(veldpad)]` leest.
- `standaardSortering` ID is eveneens gesaniteerd.

Resultaat: filter en sortering werken nu voor alle kolomtypen — enkelvoudig en meervoudig.

## Editor v2 — dependency visibility & roundtrip fix (2026-04-08)

- `«use»` dependency-edges kunnen nu per stuk of per doel-node verborgen/getoond worden via rechtsklik in editor v2.
- Rechtsklik op een **stippellijn** → `Verberg deze dependency`.
- Rechtsklik op een **enum** of **gegevenstype** → `Verberg dependencies` / `Toon dependencies` voor alle inkomende `«use»`-lijnen.
- De metadata voor deze lijnen (`id`, `sourceHandle`, `targetHandle`, `hidden`) blijft nu behouden in **V3 JSON** via `useEdges[]`.
- Daarnaast blijft deze info nu ook behouden bij **editor → V3 → codegen → MetaRegistry → V3 → editor** roundtrips, doordat de codegenerator `useEdges[]` opslaat in `EditorLayout.UseEdges` in de gegenereerde `*_metaregistry.go` bestanden en de V3 exporter die weer teruggeeft.

## Frontend visual tweak (2026-04-01)

- Index visualisatie: centrale entiteitstekst schaalt nu mee met de lengte van de weergavetekst in de representatiekaart.
- Effect: lange labels (zoals bij Locatie-adressen) worden iets kleiner getoond dan korte labels, zodat de verhouding met NatuurlijkPersoon visueel consistenter blijft.

## Runtime fix notes (2026-03-21)

- `GET /full/<entiteit>?t=<...>`: tijdelijke workaround toegevoegd voor een Bun v1.1.14 panic bij geneste `has-many` relaties met callback-filters.
- Symptoom: `reflect: call of reflect.Value.Field on zero Value` tijdens `relation.selectMany`.
- Aanpak: peiltijdstip-filter blijft op hub-niveau actief; geneste hub-kinderen (`Data`, `Aanvang`, `Einde`) worden tijdelijk niet mee-geladen in dezelfde full-query.
- Trade-off: full-responses bevatten tijdelijk geen geneste hub-kinderen; clients moeten hiervoor (tijdelijk) dedicated endpoints gebruiken.
- TODO: na Bun-upgrade opnieuw valideren en callback-filter op geneste relaties herstellen.
- DB startup fix: bestaande functie `f_formele_wijziging_op_peil(timestamptz)` wordt nu eerst gedropt en daarna opnieuw aangemaakt.
- Reden: PostgreSQL staat geen wijziging van de `RETURNS TABLE` signature toe via `CREATE OR REPLACE FUNCTION` (SQLSTATE `42P13`).
- Post-load hub-kinderen: `laadHubKinderenNaQuery()` laadt Data/Aanvang/Einde records in aparte batch-queries na de hoofd-query, als workaround voor de Bun v1.1.14 geneste has-many panic. Zie `ONTWERP_DATA_PATTERN.md` §15.
- Afgeleide formele tijd: `vulAfgeleideFormeleTijdVoorFullEntity()` daalt nu ook af in hub-kinderen (Data/Aanvang/Einde) bij peiltijdstip-filtering.

## V3.1 runtime extensie (2026-03-29)

- V3 modelformaat uitgebreid met **runtime/deployment metadata** (`V3Runtime`), zodat frontends (content editor, formulieren) en API-clients alle benodigde paden, tabelnamen en kolominfo rechtstreeks uit de model-API (`/api/schema/model`) kunnen lezen — zonder de oudere `viz/schema`-API nodig te hebben.
- Nieuw type `V3Runtime` in `model/v3_format.go` met velden: `veldnaam`, `padnaam`, `tabelnaam`, `idKolom`, `heeftPFK`, `entiteitIDKolom`, `klassenaam`, `relatieveAutoincrement`.
- `V3Runtime` wordt als `"runtime"` (omitempty) opgenomen in `V3Entiteit`, `V3Gegevenselement` en `V3Relatie`.
- `V3Veld` uitgebreid met OAS 3.1 `type`, `format` en `verplicht` velden, zodat frontends weten welk invoerveld ze moeten renderen.
- V3 exporter (`model/v3_exporter.go`) aangevuld met `runtimeVanMeta()` en `oasTypeVoorGoType()` helpers; alle drie de builder-functies vullen nu `Runtime` en de veld-loop vult `Type`/`Format`/`Verplicht`.
- Volledig backward-compatible: alle nieuwe JSON-velden gebruiken `omitempty`, codegen en UML-editor negeren ze.
- Nieuwe tests in `model/v3_exporter_test.go` voor runtime op entiteiten, relaties, en OAS type/format op velden.
- Zie `docs/v3_1_runtime.md` voor de volledige technische documentatie.

## Runtime fix notes (2026-03-26)

- Editor v2 laadt bij opstart standaard de nieuwste DB-versie via `GET /api/schema/versies` en daarna `model_url`.
- Statusbar toont nu modelbron (`[DB #id (status)]` of `[demo]`) en modelnaam met tooltip op modelbeschrijving.
- CORS-fix: middleware-registratie staat nu vóór alle route-definities, zodat ook `GET /api/schema/versies` CORS-headers teruggeeft voor Vite dev-origin (`localhost:5174`).
- Persistency-fix afgeleide velden: Go V3 struct-model uitgebreid zodat deze velden niet meer wegvallen bij `POST /api/schema/model`:
	- `V3Entiteit.AfgeleideVelden`
	- `V3Veld.Afgeleid`
	- `V3Veld.AfleidingsregelTaal`
	- `V3Veld.Afleidingsregel`
	- nieuw type `V3AfgeleidVeld`
- Effect: afgeleide velden blijven nu behouden na publiceren naar DB en reload van editor v2.

## 1. Nieuwe image bouwen en pushen

```bash
docker build --no-cache -t markwestbroek/bitemp-go-api:v06.00.01 .
docker push markwestbroek/bitemp-go-api:v06.00.01
```

## 2. API tag bijwerken op server

In `.env.docker`:

```dotenv
API_IMAGE=markwestbroek/bitemp-go-api:v06.00.01
```

### 2.1 Eerste deployment op een lege server

Als de doel-database nog niet bestaat, kun je de API deze eenmalig laten aanmaken:

```dotenv
AUTO_CREATE_DATABASE=true
```

Optioneel (aanrader): gebruik een admin connectie met CREATEDB-rechten:

```dotenv
DATABASE_ADMIN_URL=postgres://postgres:<password>@<host>:5432/postgres?sslmode=disable
```

Na succesvolle eerste start kun je `AUTO_CREATE_DATABASE` weer uitzetten of verwijderen.

## 3. API stack redeployen

```bash
docker compose -f docker-compose.api-only.yml up -d
```

## 4. Smoke test

```bash
curl http://<server-ip>:8082/version
curl http://<server-ip>:8082/viz/index_schema.html
docker logs --tail 100 bitemp-go-api-v06
```

## 5. Rollback (indien nodig)

Zet `API_IMAGE` terug naar vorige stabiele tag in `.env.docker` en redeploy:

```bash
docker compose -f docker-compose.api-only.yml up -d
```

## 6. Opruimen (optioneel)

Verwijder lokaal oude ongebruikte images:

```bash
docker image prune -a
```

Verwijder oude tags in Docker Hub volgens je bewaarbeleid.
