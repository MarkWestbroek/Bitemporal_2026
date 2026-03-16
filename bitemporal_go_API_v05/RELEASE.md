# Release checklist

Korte checklist voor een API-release met losse DB-stack.

## 1. Nieuwe image bouwen en pushen

```bash
docker build --no-cache -t markwestbroek/bitemp-go-api:v05.01.03 .
docker push markwestbroek/bitemp-go-api:v05.01.03
```

## 2. API tag bijwerken op server

In `.env.docker`:

```dotenv
API_IMAGE=markwestbroek/bitemp-go-api:v05.01.03
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
curl http://<server-ip>:8081/version
curl http://<server-ip>:8081/viz/index_schema.html
docker logs --tail 100 bitemp-go-api-v05
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
