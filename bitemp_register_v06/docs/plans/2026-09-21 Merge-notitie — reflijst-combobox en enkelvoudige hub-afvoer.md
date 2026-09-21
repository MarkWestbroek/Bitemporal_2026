# Merge-notitie 2026-09-21 — reflijst-combobox en enkelvoudige hub-afvoer

> **Doel van dit document:** uitleggen wat er op 21 september 2026 (Claude-sessie) is
> gewijzigd, zodat de merge van de zware backend-optimalisatie deze wijzigingen kan
> herkennen en correct kan meenemen. Status bij schrijven: **niet gecommit**, werkkopie op `main`.

Het begon als frontend-werk (relatie-dropdown op `/t/gemeentedelen/nieuw`), maar leidde
tot twee backend-aanpassingen. De **tweede (§3) is een echte correctheidsfix** in de
registratielogica en is de belangrijkste om bij de merge te behouden.

## 1. Overzicht

| # | Onderdeel | Bestand(en) | Soort | Merge-risico |
|---|-----------|-------------|-------|--------------|
| A | Relatieveld heet "gemeente" i.p.v. `gemeente_id`, zoekende combobox | `web/vite/src/shared/entiteitOpvoerUtils.js`, `components/actions/ActionFormParts.jsx`, `components/editor/NieuwEntiteitPagina.jsx` | frontend | geen (backend-optimalisatie raakt dit niet) |
| B | `RefCombobox`: ▼ toont opties, geen "Geen resultaten"-flits, race-fix, min. breedte | `web/vite/src/components/editor/RefCombobox.jsx` | frontend | geen |
| C | `/api/viz/reflijst/{typenaam}/opties` alleen data onder **actieve hub** | `handlers/viz_reflijst_opties_handler.go` | backend, read-only query | laag |
| D | **Enkelvoudige hub vervangen: rel_id doorgeven + oude data afsluiten + guard** | `handlers/registration_helpers_generiek.go` (+ test) | backend, registratie | **hoog** — kernlogica |

Documentatie: `docs/inhoud-editor-technisch.md` (§12 punt 6) beschrijft A–C kort.

## 2. Frontend (A, B) — kort

- **A.** Bij een nieuwe entiteit met een relatie (bv. Gemeentedeel → Gemeentedeelgemeente)
  werd de secundaire id-kolom als `<select>` getoond, gevuld via
  `/full/{padnaam}?size=200`. De server kapt `size` af op **100** → maar 100 van 343 gemeenten.
  - `bouwGroepOptiesVanTypeMeta` levert nu per relatie-optie `secondaireLabel`
    (veldnaam van de doel-entiteit, bv. `gemeente`) en `secondaireRefType`
    (typenaam als doel een `referentielijst_item` is).
  - `ActionGroupedSections` toont het label "gemeente" (tooltip: `kolom: gemeente_id`);
    de payload blijft `gemeente_id`.
  - `ActionFieldControl` rendert bij `secondaireRefType` een `RefCombobox` (server-side zoeken).
  - Niet-reflijst-doelen: `NieuwEntiteitPagina` pagineert over `/full/` (100/pagina, max. 20).
- **B.** `RefCombobox` (lijsten > 30 items): openen zonder zoekterm laadt de eerste 50;
  `loading` direct aan tijdens debounce; verouderde antwoorden genegeerd via volgnummer;
  `minWidth` zodat hij in smalle flex-rijen niet tot ~44px inklapt.
- `IndexSchemaPage` is **niet** aangepast (bouwt eigen opties, oude dropdown).

## 3. Backend

### C. Reflijst-opties: alleen data onder een actieve hub

`MaakVizReflijstOptiesHandler` selecteerde `… FROM <data-tabel> WHERE afvoer IS NULL`.
Een open data-record onder een **afgevoerde** hub (zie D) gaf daardoor dubbele opties
(Gemeente 1993 twee keer).

Wijziging:
- `vindDataMeta` retourneert nu ook `hubMeta`: signatuur
  `(dataMeta, hubMeta model.TypeMeta, entiteitIDKolom string, ok bool)` (enige aanroeper is deze handler).
- Query met alias `d` + `EXISTS (SELECT 1 FROM <hub> h WHERE h.rel_id = d.rel_id AND h.<ent_id> = d.<ent_id> AND h.afvoer IS NULL)`.
- Zoekkolommen/select-kolommen geprefixt met `d.` (via `bun.Ident`).

**Bij de merge:** als de optimalisatie deze handler of een generieke "actieve representatie"-query
herschrijft, behoud de eis *data telt alleen als de hub ook actief is*. Na fix D zou de
join theoretisch overbodig zijn, maar hij beschermt tegen bestaande inconsistente data (§5).

### D. Enkelvoudige hub vervangen — de eigenlijke bug

**Invariant (Mark):** een enkelvoudig element heeft op elk moment precies **één** actief
record — ook op `_Data`-niveau. Semantiek v06 (`docs/bitemporele-registers-vergelijking-v0.1.md`):
**wijziging = nieuwe hub (nieuwe `rel_id`), correctie = zelfde hub, nieuwe `_Data`-versie.**

**Reproductie (Gemeente 1993, registratie 942):** UI-"Wijzigen" stuurt
`{"opvoer":{"gemeentegegevens":{"gemeente_id":1993,"rel_id":1,"naam":…,"code":"GM1993"}}}`.
Resultaat vóór de fix:

```
hub  rel 1  afgevoerd            (goed: enkelvoudige voorganger)
hub  rel 2  actief, ZONDER data  (fout)
data 1.v1   afgevoerd
data 1.v2   ACTIEF onder afgevoerde hub 1   (fout: nieuwe data op de verkeerde hub)
```

In de UI leek de wijziging mislukt (actieve hub zonder data); daarna is via Corrigeren
data op hub 2 gezet (943, 944). Er waren **drie** samenhangende fouten:

1. **rel_id niet doorgegeven aan kinderen.** `inputNaarHub` kopieert de request-`rel_id`
   naar hub én `_Data`. De hub krijgt bij registratie via `ClearID()` + INSERT een nieuwe
   `rel_id`, maar de kinderen hielden de oude → `_Data` op de afgevoerde hub.
2. **Geen cascade bij enkelvoudige voorganger-hub.** `sluitActieveEnkelvoudigeVoorgangersAf`
   zette alleen `afvoer` op de hub-rij, **niet** op diens `_Data/_Aanvang/_Einde`. Dat gold
   ook voor "Wijzigen" *zonder* `rel_id` — daar bleef de oude data stil actief. (In 942 werd
   data 1.v1 alleen "per ongeluk" afgesloten door fout 1.) De cascade bestond wel, maar
   alleen in het expliciete afvoerpad (`handleRepresentatieAfvoer`, hub-tak).
3. **Geen guard.** Een hub-kind kon onder een afgevoerde hub worden opgevoerd.

**Fix in `handlers/registration_helpers_generiek.go`:**

| Plek | Wijziging |
|------|-----------|
| `handleRepresentatieOpvoer`, na rel_id-afleiding voor hub-kinderen | aanroep `controleerBovenliggendeHubActief` → fout als hub (ent_id, rel_id) niet actief is |
| `handleRepresentatieOpvoer`, RECURSIE-blok | bij een hub: lees de **werkelijke** `rel_id` van de (net ge-inserte) hub en zet die met `zetIntWaardeVoorKolomOpRepresentatie` op elk kind waarvoor `isHubChildSubtypeMetRelID` geldt, vóór de recursieve opvoer |
| `handleRepresentatieAfvoer`, hub-tak | kinderen-lus geëxtraheerd naar nieuwe helper `voerActieveHubKinderenAf` (gedrag ongewijzigd) |
| `sluitActieveEnkelvoudigeVoorgangersAf`, na afvoer + wijziging-record van elke voorganger | als `meta.GESubtype == GESubtypeHub`: `voerActieveHubKinderenAf(…, entiteitID, id)` |
| nieuw: `voerActieveHubKinderenAf` | afvoer van alle actieve kinderen van één hub + wijziging-record per kind (entiteitnaam = bovenliggende entiteit, representatie_id = rel_id, versie) |
| nieuw: `controleerBovenliggendeHubActief` | `haalActieveIDsMetScope(hubMeta, {ent_id, rel_id})`; leeg → fout |

**Test aangepast:** `TestSluitActieveEnkelvoudigeVoorgangersAf_ClosesExistingActiveRecord`
verwachtte het oude gedrag (hub dicht, data niet); verwacht nu ook
`SELECT … FROM "a_u_data" … rel_id = 5` → `UPDATE "a_u_data" SET afvoer` → `INSERT INTO "wijziging"`.

**Extra queries per registratie** (relevant voor de performance-optimalisatie):
- per opgevoerd hub-kind: 1 `SELECT` (guard);
- per afgesloten enkelvoudige voorganger-hub: 1 `SELECT` per kindtype + `UPDATE`/`INSERT wijziging` per actief kind.

Als de optimalisatie deze stappen batcht of samenvoegt (bv. set-based afvoer, of de guard
in een constraint/trigger), mag de vorm anders zijn — **de drie gedragsregels moeten blijven:**

1. kinderen van een hub krijgen de `rel_id` van de hub zoals die ná insert is;
2. afvoer van een hub (expliciet óf als enkelvoudige voorganger) voert al zijn actieve kinderen af, met wijziging-records;
3. geen hub-kind opvoeren onder een niet-actieve hub.

## 4. Verificatie (uitgevoerd)

Tegen een kopie van `bitemp_go_db_v06` (tijdelijke DB, na afloop verwijderd), backend op
eigen poort, Gemeente 9999:

| Stap | Registratie | Resultaat |
|------|-------------|-----------|
| 1 | opvoer gemeente + gemeentegegevens | hub 1 + data 1.v1 |
| 2 | Wijzigen **met** `rel_id:1` | hub 1 + data 1.v1 af; hub 2 + data **2**.v1 op |
| 3 | Wijzigen **zonder** `rel_id` | hub 2 + data 2.v1 af; hub 3 + data 3.v1 op |
| 4 | Corrigeren `rel_id:3` | hub 3 blijft; data 3.v1 af, 3.v2 op |
| 5 | `gemeente_gemeentegegevens_data` opvoeren op `rel_id:1` | **geweigerd** door guard |

Na elke stap exact één actieve hub en één actief data-record; `wijziging`-trail klopt.
Verder: `go build`, `go vet`, `go test ./handlers/` groen **behalve**
`TestMakeGetRegistratiesMetWijzigingenHandler_CapsSizeAndHasMoreFalse` — die faalde al
vóór deze wijzigingen (verwacht cap 100, krijgt 1000) en staat hier los van.
Frontend: node-tests 28/28, `vite build` ok, handmatig in headless browser gecontroleerd.

## 5. Bestaande data (niet aangepast)

Scan op de lokale DB `bitemp_go_db_v06`: open kind-records onder een afgevoerde hub —
restanten van fout 2 (vooral "Wijzigen" zonder `rel_id`):

| Tabel | aantal |
|-------|--------|
| formulierdefinitie_meta_data | 17 |
| formulierdefinitie_layout_data | 16 |
| contactpersoon_data | 7 |
| persoon_persoonnaam_data | 2 |
| gemeente_gemeentegegevens_data | 1 (Gemeente 1993, rel 1 v2) |
| natuurlijkpersoon_burgerschap_data | 1 |
| natuurlijkpersoon_burgerschap_aanvang | 1 |
| persoon_persoonscontactgegevens_data | 1 |

Opties: opnieuw seeden via replay (de fix corrigeert dit bij replay vanzelf), of een
eenmalige reparatie (`afvoer` van het kind = `afvoer` van de hub, plus wijziging-records).
Scan-query per kindtabel:

```sql
SELECT count(*) FROM <hub>_data d
JOIN <hub> h ON h.rel_id = d.rel_id AND h.<ent_id> = d.<ent_id>
WHERE d.afvoer IS NULL AND h.afvoer IS NOT NULL;
```

**Let op bij replay:** replay-files die ooit data expliciet op een inmiddels afgevoerde hub
opvoerden, worden nu door de guard geweigerd. Dat is bedoeld, maar kan een replay laten stoppen.
