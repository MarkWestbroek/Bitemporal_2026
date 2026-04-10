# Schema Diff — delta-analyse en migratie

## Overzicht

De `schemadiff` tooling vergelijkt twee V3-metamodellen en genereert:
1. Een **delta-rapport** met ernst-classificatie per wijziging
2. Optioneel: een **SQL-migratiebestand** met DDL-statements

Destructieve statements worden altijd uitgecommentarieerd en moeten handmatig bevestigd worden.

## Packages

| Package | Doel |
|---------|------|
| `schemadiff/` | Vergelijkingslogica, delta-datastructures, DDL-generatie |
| `naamgeving/` | Gedeelde naamgevingsconventies (gebruikt door zowel codegen als schemadiff) |
| `cmd/schemadiff/` | Zelfstandige CLI tool |

## Gebruik

### Zelfstandige CLI

```sh
# Twee lokale bestanden vergelijken
go run ./cmd/schemadiff --oud model_v1.json --nieuw model_v2.json

# Met domeinfilter
go run ./cmd/schemadiff --oud model_v1.json --nieuw model_v2.json --domein kern

# JSON-output
go run ./cmd/schemadiff --oud model_v1.json --nieuw model_v2.json --format json

# SQL-migratie genereren
go run ./cmd/schemadiff --oud model_v1.json --nieuw model_v2.json --format sql

# Migratiebestand direct naar dbsetup/migrations/ schrijven
go run ./cmd/schemadiff --oud model_v1.json --nieuw model_v2.json --migratie-dir dbsetup/migrations/

# Modellen ophalen van draaiende API
go run ./cmd/schemadiff --oud-url http://localhost:8082/api/schema/model --nieuw model_v2.json
```

### Geïntegreerd in codegen

```sh
# Delta-analyse vóór generatie (toont rapport, genereert daarna code)
go run ./cmd/codegen --input model_v2.json --diff model_v1.json

# Alleen delta-analyse, niet genereren
go run ./cmd/codegen --input model_v2.json --diff model_v1.json --diff-only
```

Bij `--diff` worden automatisch migratie-SQL-bestanden naar `dbsetup/migrations/` geschreven als er DB-wijzigingen zijn.

### VS Code taak

Er is een VS Code taak "go: schemadiff (v06)" beschikbaar die om de paden van het oude en nieuwe model vraagt.

## Ernst-classificatie

Elke wijziging krijgt een van vier ernst-niveaus:

| Ernst | Betekenis | Voorbeeld |
|-------|-----------|-----------|
| **Informatief** | Geen DB-impact | description, kleur, layout wijzigingen |
| **Additief** | Veilig toepasbaar | Nieuwe entiteit, GE, veld of relatie |
| **Modificatie** | Vereist controle | Type-wijziging, NOT NULL, enum-waarde verwijderd |
| **Destructief** | Mogelijk dataverlies | Entiteit/veld verwijderd, doelEntiteit gewijzigd |

## Vergelijkingscategorieën

| Categorie | Matchstrategie | Ernst-toekenning |
|-----------|---------------|------------------|
| Entiteit | Op `typenaam` | Verwijderd=destructief, toegevoegd=additief, description/kleur=informatief, isMaterieel=modificatie |
| Gegevenselement | Op `naam` binnen entiteit | Verwijderd=destructief, toegevoegd=additief, momentvoorkomen/isMaterieel=modificatie |
| Relatie | Op `naam` binnen entiteit | Verwijderd=destructief, doelEntiteit gewijzigd=destructief, isMaterieel=modificatie |
| Veld | Op `naam` binnen GE/relatie | Verwijderd=destructief, goType gewijzigd=modificatie, verplicht→true=modificatie |
| Enum | Op `goType` | Toegevoegd=informatief, verwijderd=modificatie, waarde verwijderd=modificatie |
| Datatype | Op `naam` | Toegevoegd=informatief, basistype gewijzigd=modificatie |
| Referentielijst | Op `systeemnaam` | Toegevoegd=informatief, verwijderd=modificatie |

## DDL-generatiepatronen

| Wijziging | DDL | Destructief? |
|-----------|-----|-------------|
| Entiteit/GE/relatie toegevoegd | Placeholder (Bun maakt tabellen bij herstart) | Nee |
| Entiteit/GE/relatie verwijderd | `DROP TABLE IF EXISTS "..." CASCADE` | Ja — uitgecommentarieerd |
| Veld toegevoegd | `ALTER TABLE ADD COLUMN IF NOT EXISTS` | Nee |
| Veld verwijderd | `ALTER TABLE DROP COLUMN IF EXISTS` | Ja — uitgecommentarieerd |
| Type gewijzigd | `ALTER TABLE ALTER COLUMN TYPE ... USING` | Ja — uitgecommentarieerd |
| Verplicht gemaakt | `ALTER COLUMN SET NOT NULL` | Nee |
| Optioneel gemaakt | `ALTER COLUMN DROP NOT NULL` | Nee |

## Exit codes

| Code | Betekenis |
|------|-----------|
| 0 | Geen breaking changes |
| 2 | Breaking changes (destructief of modificatie) gevonden |

## Architectuur

```
cmd/schemadiff/main.go    ─── CLI entry point
    │
    ├── schemadiff/diff.go     ── Vergelijk() functie
    │       │
    │       └── schemadiff/delta.go ── DeltaRapport, DeltaItem, Ernst
    │
    ├── schemadiff/migration.go ── GenereerMigratie(), MigratieResultaat
    │
    └── naamgeving/naamgeving.go ── ToSnakeCase, DeriveHub, GoTypeToDBType, etc.

cmd/codegen/main.go       ─── --diff / --diff-only integratie
    │
    └── schemadiff/           (zelfde package)
```

## Beperkingen

- **Geen rename-detectie**: als een veld hernoemd wordt, ziet de tool dit als verwijderd + toegevoegd. Hernoemingen moeten handmatig via `ALTER TABLE RENAME COLUMN` worden opgelost.
- **Geen data-migratie**: de tool genereert alleen DDL (structuur), geen DML (data-transformatie).
- **CREATE TABLE als placeholder**: nieuwe tabellen worden niet als volledig DDL gegenereerd, omdat Bun/createmodeltables dit automatisch doet bij herstart.
- **Trigger-aanpassing**: als PK-structuur wijzigt (bijv. door isMaterieel wijziging), moeten relatieve-autoincrement-triggers handmatig worden bijgewerkt.
