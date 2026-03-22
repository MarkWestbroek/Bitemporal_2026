# Release checklist

Korte checklist voor een API-release met losse DB-stack.

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
