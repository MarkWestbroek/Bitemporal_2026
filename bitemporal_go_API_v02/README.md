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
POST Task is done via:

{
  "id": "1",
  "title": "De eerste taak",
  "description": "bjksdajk jk kjads",
  "status": "Al weer klaar"
}
 
and does:
INSERT INTO "tasks" ("id", "title", "description", "due_date", "status") VALUES ('1', 'De eerste taak', 'bjksdajk jk kjads', '0001-01-01 00:00:00+00:00', 'Al weer klaar')

POSTEN van Full<Entiteit> (hier A) werkt als volgt:

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


## DONE
 1
 full handlers uitbreiden met meer dan één relatie (array en itereren)

 ## TO DO
 1
 full handlers uitbreiden met meer dan één laag diepe relaties (vanwege de materiele 'mickey mouse oortjes' aan mogelijk elk gegevenselement)

2
materiële tijd toevoegen = aanvang en einde als mogelijke 'derde laag' diep 1-* relatie inbouwen in full material? handlers  
of functie ipv de standaard insert waar je bij een post gewoon aanvang/einde meegeeft, maar bijzonder wegschrijft. Correctie en ongedaan making hebben het vooral moeilijk


 3
 Autonumber IDs ipv via POST
 
 4
 Speciaal Registratie (POST) endpoint dat het volgende doet:
 - post registratie (onthoudt ID en tijdstip)
 - post gegevens (met reg_tijdstip in opvoer; opvoer kan altijd maar 1x, maar kan worden leeggemaakt bij ongedaanmaking van de opvoerende-registratie)
    * onthoudt id's of stop ze in de structs
 - post records in tussentabel wijziging (heel specifiek met soft links)
 - doe van alles met eerdere records bij ongedaanmaking en correctie (ingewikkeld)

5
transactie over bovenstaande

6
pbac, pep inbouwen