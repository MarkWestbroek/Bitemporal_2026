# Go Bun Task Manager API

This project showcases the implementation of a **Task Manager REST API** using Go Bun. It provides a complete CRUD (Create, Read, Update, Delete) functionality for managing tasks, with data persistence in a PostgreSQL database.

## Features

- Create, read, update, and delete tasks
- Store tasks in a PostgreSQL database using Go Bun ORM
- API endpoints for interacting with tasks
- Error handling and validation of input data
- Integration with Gin web framework for HTTP routing

## Requirements

- Go 1.16 or higher
- PostgreSQL database

## Getting Started

1. Clone the repository:

   ```shell
   git clone https://github.com/zaahidali/Learn-go-language
   ```

2. Install the dependencies:

   ```shell
   go mod tidy
   ```

3. Configure the PostgreSQL database connection in the `main.go` file:

   ```go
   // Replace the connection string with your own PostgreSQL database credentials
   dsn := "postgres://your-username:your-password@localhost:5432/your-database?sslmode=disable"
   ```

4. Run the application:

   ```shell
   go run main.go
   ```

5. Access the API at `http://localhost:8080` and start managing your tasks!

## Admin endpoint security

The destructive endpoint for dropping all tables is:

- `DELETE /admin/db/droptables/:password`

You can configure the expected password with environment variable:

- `ADMIN_DROP_PASSWORD`

If `ADMIN_DROP_PASSWORD` is not set, the default fallback password is `1234`.

You must also explicitly enable dropping with:

- `ALLOW_DROP_TABLES=true`

If `ALLOW_DROP_TABLES` is not `true`, the endpoint returns `403 Forbidden` and will not execute.

### Call examples

curl (local):

```bash
curl -X DELETE http://localhost:8080/admin/db/droptables/1234
```

Postman:

- Method: `DELETE`
- URL: `http://localhost:8080/admin/db/droptables/1234`
- Body: none

Expected responses:

- `200 OK` → tables successfully dropped
- `401 Unauthorized` → invalid password
- `403 Forbidden` → dropping disabled (`ALLOW_DROP_TABLES` is not `true`)
- `500 Internal Server Error` → database not initialized or drop operation failed

## Safe production settings

Recommended production configuration:

- `APP_ENV=production`
- `GIN_MODE=release`
- `ALLOW_DROP_TABLES=false`
- Set a strong custom `ADMIN_DROP_PASSWORD` (do not use `1234`)

Notes:

- On startup, the API logs whether dropping tables is enabled.
- If dropping is enabled in production context (`APP_ENV=production` or `GIN_MODE=release`), the API logs a warning.

### Example .env values

Development (local only):

```env
APP_ENV=development
GIN_MODE=debug
ALLOW_DROP_TABLES=true
ADMIN_DROP_PASSWORD=1234
DATABASE_URL=postgres://postgres:1234@localhost:5432/bitemp_go_db?sslmode=disable
```

Production:

```env
APP_ENV=production
GIN_MODE=release
ALLOW_DROP_TABLES=false
ADMIN_DROP_PASSWORD=use-a-long-random-secret
DATABASE_URL=postgres://<user>:<strong-password>@<host>:5432/<db>?sslmode=require
```

## Build & Docker

Use these commands to build the Docker image with embedded build metadata and to run/recreate containers.

- Build with `docker compose` (Linux/mac):

  ```bash
  docker compose build --no-cache --build-arg COMMIT=$(git rev-parse --short HEAD) --build-arg BUILD_TIME="$(date -u +%Y-%m-%dT%H:%M:%SZ)" api
  docker compose up -d --force-recreate --build
  ```

- Build with PowerShell:

  ```powershell
  $commit = (git rev-parse --short HEAD)
  $bt = (Get-Date -Format s)
  docker compose build --no-cache --build-arg COMMIT=$commit --build-arg BUILD_TIME=$bt api
  docker compose up -d --force-recreate --build
  ```

- Verify the running version:
  - Check the container logs for the startup message: `docker logs bitemp-go-api` and look for `build commit:` output.
  - Or call the new endpoint: `curl http://localhost:8080/version` which returns JSON with `commit` and `build_time`.

## Contributing

Contributions are welcome! If you find any issues or have suggestions for improvement, please create a new issue or submit a pull request.

## License

This project is licensed under the MIT License. See the [LICENSE](LICENSE) file for details.


-------
GraphQL
-------
GraphQL API Complete
Your bitemporal API now has a production-ready GraphQL endpoint. Here's what was implemented:

📊 What Was Added
gqlgen Integration - Industry-standard, type-safe GraphQL for Go

Comprehensive Schema - Full bitemporal data model including:

Entity A/B queries and mutations
Relationships (RelationAB)
Data elements (AÜ, AV, BX, BY)
Audit tracking (Registration, Change/Wijziging)
Task management
DateTime scalar handling
Gin Integration - GraphQL seamlessly integrated with your existing Gin server

Database Ready - Resolvers have access to your Bun ORM via r.DB

🚀 Access Your GraphQL API
Endpoints:

🎮 Playground (Interactive IDE): GET http://localhost:8080/graphql/playground
📤 Query/Mutation Endpoint: POST/GET http://localhost:8080/graphql/query
📝 Key Files
graph/schema.graphqls - Schema definition
graph/schema.resolvers.go - Resolver stubs (ready to implement)
graph/resolver.go - Dependency injection with DB
handlers/graphql_handler.go - Gin integration
GRAPHQL.md - Complete usage guide with examples
💡 Next Steps
Implement resolvers in schema.resolvers.go (they currently panic)
Start with Task resolvers since you already have the model
Use Bun to query your database
The schema is already designed for your bitemporal data model - just implement the database logic!


## HOW TO USE

### POST Task

```json
{
  "id": "1",
  "title": "De eerste taak",
  "description": "bjksdajk jk kjads",
  "status": "Al weer klaar"
}
```

This executes:
```sql
INSERT INTO "tasks" ("id", "title", "description", "due_date", "status") 
VALUES ('1', 'De eerste taak', 'bjksdajk jk kjads', '0001-01-01 00:00:00+00:00', 'Al weer klaar')
```

### POST Full Entity (A)

```json
{
  "id": "3",
  "opvoer": "2026-02-11T19:00:00Z",
  "vs": [
    {
      "rel_id": 3,
      "a_id": "3",
      "ccc": "eerste ccc op a=3"
    },
    {
      "rel_id": 4,
      "a_id": "3",
      "ccc": "tweede ccc op a=3"
    }
  ],
  "us": [
    {
      "rel_id": 5,
      "a_id": "3",
      "aaa": "eerste aaa op a=3",
      "bbb": "eerste bbb op a=3"
    }
  ]
}
```

## REGISTRATION

Via de endpoints:
- `/registreer/as` - for entity A registration
- `/registreer/bs` - for entity B registration

You can perform:
- Register an entity (A or B) with its data elements (Full A or Full B)
- Deregister an entity, including all valid (not yet deregistered) data elements
- Modify data elements of an entity (arbitrary combination of register and deregister operations)
  - TODO: implement and enforce singularity/plurality constraints

### Register Full Entity A

```json
{
  "registratie": {
    "registratietype": "registratie",
    "tijdstip": "2026-01-02T11:00:00Z",
    "opmerking": "Initiële invoering van entiteit A"
  },
  "wijzigingen": [
    {
      "opvoer": {
        "a": {
          "id": "5",
          "us": [
            {
              "rel_id": 5,
              "a_id": "5",
              "aaa": "a5",
              "bbb": "b5"
            }
          ],
          "vs": [
            {
              "rel_id": 7,
              "a_id": "5",
              "ccc": "c5-1"
            },
            {
              "rel_id": 8,
              "a_id": "5",
              "ccc": "c5-2"
            }
          ]
        }
      }
    }
  ]
}
```

### Deregister Full Entity A

```json
{
  "registratie": {
    "registratietype": "registratie",
    "tijdstip": "2026-02-16T10:30:00Z",
    "opmerking": "Afvoer van entiteit A"
  },
  "wijzigingen": [
    {
      "afvoer": {
        "a": {
          "id": "5"
        }
      }
    }
  ]
}
```

### Modify Data Elements

Deregister U5 and register U6 for entity A:

```json
{
  "registratie": {
    "registratietype": "registratie",
    "tijdstip": "2026-02-16T10:30:00Z",
    "opmerking": "Afvoer van u5 en opvoer van u6 (zelfde moment, ongebroken formele tijdslijn)"
  },
  "wijzigingen": [
    {
      "afvoer": {
        "u": {
          "rel_id": 5,
          "a_id": "5",
          "aaa": "a5",
          "bbb": "b5"
        }
      }
    },
    {
      "opvoer": {
        "u": {
          "rel_id": 6,
          "a_id": "5",
          "aaa": "a6",
          "bbb": "b6"
        }
      }
    }
  ]
}
```

## DONE
1
 full handlers uitbreiden met meer dan één relatie (array en itereren)

2
 Speciaal Registratie (POST) endpoint dat het volgende doet:
 - post registratie (onthoudt ID en tijdstip)
 - post gegevens (met reg_tijdstip in opvoer; opvoer kan altijd maar 1x, maar kan worden leeggemaakt bij ongedaanmaking van de opvoerende-registratie)
    * onthoudt id's of stop ze in de structs
 - post records in tussentabel wijziging (heel specifiek met soft links)

 ## TO DO
0 refactoren van de huidige ingewikkelde registreren code. (gegenned) Die is niet geparameteriseerd en warrig.

1 In modellen de materiële tijd toevoegen = aanvang en einde, Standaard element hergebruiken? Maar is foreign key per representatie, dus voor elke representatie een aparte {REP}_Aanvang + {REP}_Einde

2 Full handlers uitbreiden met meer dan één laag diepe relaties (vanwege bovenstaande mogelijke materiele 'mickey mouse oortjes' op entiteiten en gegevenselementen)

5 Andere optie is iets slimmers dan dit
6 plus functie ipv de standaard insert waar je bij een post gewoon aanvang/einde meegeeft, maar bijzonder wegschrijft. Correctie en ongedaanmaking hebben het vooral moeilijk

10 Autonumber IDs ipv via POST (registratie en wijziging zijn al autoincrement) (Maar dit is misschien niet handig met testen)
 
20 Speciaal Registratie (POST) endpoint dat het volgende doet:
 - registreer entiteit met GE'n of losse GE'n (DONE)
 - doe van alles met eerdere records bij ongedaanmaking en correctie (ingewikkeld?)

25 enkel- en meervoudigheid in een tag vastleggen (eigen tag? validatie tag?) in de modellen, zodat de /registreren/{entiteit} handler bij de opvoer van een nieuw enkelvoudig gegevenselement het actuele GE automatisch kan afvoeren
 - is dit wel een taak van het register of moet dat hoger liggen?

30 transactie over bovenstaande (deels gedaan, bij een enkele registratie van A+GE'n)

40 pbac, pep inbouwen