# Bitemporeel register met quasi-REST API v0.4.01.02

This project showcases the implementation of a **Bitemporal Register API** using Go Bun. It provides CR (Create, Read) functionality for managing configurable data, with data persistence in a PostgreSQL database.
In addition it allows to correct data (in fact correct registrations and the registered data) and to undo registrations.

## Features

- Create, read configurable data
- Store data in a PostgreSQL database using Go Bun ORM
- API endpoints for interacting with data
- Error handling and TODO validation of input data
- Integration with Gin web framework for HTTP routing

## Requirements

- Go 1.16 or higher
- PostgreSQL database

## Getting Started

1. Clone the repository:

   ```shell
  git clone https://github.com/MarkWestbroek/Bitemporal_2026
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

## Tests and Coverage (VS Code Tasks)

In VS Code you can run the predefined tasks from `.vscode/tasks.json`:

- `go: test all (v05)`
  - Runs all tests in `bitemporal_go_API_v05`.
- `go: coverage report (v05)`
  - Generates `coverage.out` and prints function-level coverage in the terminal.
- `go: coverage html (v05)`
  - Generates `coverage.out`, `web/coverage.html` (detail) and `web/coverage_functions.txt` (function summary).

The HTML report is written to:

- `bitemporal_go_API_v05/web/coverage.html`

When the API is running, you can open it via:

- `/viz/coverage_report.html` (recommended start page)
- `/viz/coverage_functions.txt` (function-level percentages)
- `/viz/coverage.html` (raw Go source heatmap)

Open this file in your browser to inspect coverage per package and per function.

## Visualisatie (React + Vite)

De actieve visualisaties draaien nu als React + Vite build onder:

[![Open Viz Index](https://img.shields.io/badge/Open-Viz%20Index%20(React%20%2B%20Vite)-0f766e?style=for-the-badge)](http://localhost:8080/viz/react/)
[![Open Viz Tijdlijn](https://img.shields.io/badge/Open-Viz%20Tijdlijn%20(React%20%2B%20Vite)-0b7285?style=for-the-badge)](http://localhost:8080/viz/react/tijdlijn.html)
[![Open Docs](https://img.shields.io/badge/Open-Docs-1d4ed8?style=for-the-badge)](http://localhost:8080/docs)

- `http://localhost:8080/viz/react/` (index)
- `http://localhost:8080/viz/react/tijdlijn.html` (tijdslijn)
- `http://localhost:8080/viz/` (landingspagina met links)

De index-pagina:

- haalt schema op via `GET /api/viz/schema`
- toont entiteiten, gegroepeerde GEs en relaties op basis van het actuele schema
- ondersteunt opvoeren van nieuwe entiteiten, registreren van wijzigingen, correcties en ongedaanmakingen
- maakt `opv:`-waarden klikbaar zodat je direct naar de registratiedetails navigeert

De tijdslijn-pagina:

- toont alleen registraties die relevant zijn voor de gekozen entiteit
- combineert registratie- en snapshotvisualisatie in een horizontale tijdslijn
- visualiseert ongedaanmakingen met pijlen en highlights naar de ongedaan gemaakte representaties
- ondersteunt `Download PNG` en `Kopieer PNG` voor export van de tijdslijn

De oude links naar de legacy schema- en archiefpagina's zijn verwijderd van de startpagina's.

Opmerking:

- De frontend gebruikt gebuilde assets (geen runtime React-CDN meer nodig).
- Voor lokale markdown-documentatie kun je nu ook gebruiken:
  - `http://localhost:8080/docs` (overzicht van alle `.md` bestanden)
  - `http://localhost:8080/docs/web/readme.md` (web handleiding)

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

## Docker

For Docker build/run/share instructions (without docker compose), see [docker.md](docker.md).
For a short release flow, see [RELEASE.md](RELEASE.md).

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
      "bbb": true
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
              //"rel_id": 5, niet nodig bij PFK autoinc rel_id
              "a_id": "5",
              "aaa": "a5",
              "bbb": true
            }
          ],
          "vs": [
            {
              //"rel_id": 7, idem
              "a_id": "5",
              "ccc": "c5-1"
            },
            {
              //"rel_id": 8, idem
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
          "bbb": true
        }
      }
    },
    {
      "opvoer": {
        "u": {
          "rel_id": 6,
          "a_id": "5",
          "aaa": "a6",
          "bbb": false
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

3 refactoren van de huidige ingewikkelde registreren code. (gegenned) Die is niet geparameteriseerd en warrig.

4 Autoincrement van registratie en wijziging

5 tijdelijk: registratietijdstip loopt per uur op samen met het registratienummer, zodat registraties altijd sequentieel gedaan worden

6 MetaRegistry en structs zijn de enige files die bepalen welke data in het register zit! Registratie en Wijziging zijn 'plumbing'.

7 nu is de geconfigureerde data A, B, A-B, en U, V, X en Y

8 ook configureerbaar: het gegevenselementen en relaties krijgen een PFK die de entiteit-id en een relatief id combineert. Het _relatief_ id is autoincrement via een trigger. De code maakt de triggers aan bij createtables.

9 enkel- en meervoudigheid in een tag vastleggen (eigen tag? validatie tag?) in de modellen, zodat de /registreren/{entiteit} handler bij de opvoer van een nieuw enkelvoudig gegevenselement het actuele GE automatisch kan afvoeren
 - gedaan bij opvoer van een enkelvoudig gegevenselement: de eerder wordt afgevoerd
 - bij het vinden van meerdere actieve GEs wordt een foutmelding gegeven (en niet opgevoerd / afgevoerd)

10 elke request vormt een transactie

11 reeds afgevoerde records kunnen niet weer afgevoerd worden (todo: goed testen, maar geldt voor alles)

12 ongedaanmaking en correctie

13 documenteer huidige formele tijdreisqueries
14 maak ze A/B/U/V onafhankelijk (metamap): genereer op basis van de metamap (geparameteriseerde) views in de DB en gebruik die in de code

14 react pagina's
- onafhankelijk maken van A/B/U/V/X/Y
- enkelvoudig meervoudig tonen (1 of *)
- entiteit vette rand
- uitbreiden met klikbare elementen, waarop je acties kunt doen: afvoeren, opvoeren, corrigeren
- correctie van bepaalde reg mogelijk
- ongedaanmaken van reg mogelijk (onder voorwaarden)
- bij verstuur correctie van A en alleen wijzigen van 1 veld van de 7, alleen het gewijzigde veld corrigeren. Correctie mag een deelverzameling van een eerdere registratie zijn, qua welke velden worden gewijzigd.

15 react met vite maken

16 In react pagina's:
- enkel- meervoudigheid op formulier tonen
- type is nu number of string (of bool of datetime), terwijl in de struct int of float of string (of book of datetime) is: kan dat ook over naar typescript? dus onderscheid geheel, gebroken getal
- misschien al neigen naar OAS met format? Of hoe doet GraphQL dat?
- in formulier: groeperen op type
- in formulier: het type, verplichtheid en enkel of meervoudigheid reflecteren
- in formulier: soort invoerveld en validatie volgt type
- in formulier via metamap / schema api: enums als type
- secondaire ID's in een relatie worden opgezocht uit de mogelijke seondaire entiteiten
- reg vak alles iets kleiner
  

17 log alle requests en responses van /registratie/
- tevens een view op registraties in react waarop je:
  - het opmerking veld inline in de tabel kunt editen
  - een export van een keuze kunt maken
  - zo een export kunt importeren en afspelen, met een entiteit-id en registratie-id offset (om de database een beetje gevuld te krijgen)
  
18 React: formulier elementen worden nu als het goed is hergebruikt, maar ben nog niet helemaal overtuigd


## BUGS
### API:
10 aan een ongedaan gemaakte U1 bij een ongedaan gemaakte A1 kan nu gewoon een nieuwe U worden toegevoegd... ?


## TE TESTEN
### React
- code: hergebruik formulier elementen okee?
- entity pagina: payload checken. Er gebeuren rare dingen (data cross GE)

## TODO

10 loop tijdsreizen nog eens na (KVK voorbeelden) want corrigeren is nu nog hetzelfde als wijzigen. Je hebt twee soorten tijdreizen (of 3).

15 Enums
- in de metaregistry (en in de frontend als gevolg)
- en in de custom struct tags
- als soort van type, en niet alleen de waarden. Die staan al in de enum in go
- en gaan als het goed is ook mee in het schema

16 Datatypen, gegevenssoorten netjes inbouwen.
17 Referentielijsten

20 react - edit popups
- corrigeren en afvoeren hebben heel weinig met elkaar te maken en staan gebroederlijk naast elkaar
  - functioneel scheiden
    - door niet te klikken maar rechts te klikken: bekijk | bewerk | voer af
    - door eerst een popup met alle data te tonen in een view-kaart
    - op die kaart:
      1 bewerk (= afvoer + nieuwe opvoer) (enkelvoudig is eigenlijk altijd dit)
      2 corrigeer ( = corrigeer)
      3 voer af zonder opvolger

21 react pagina's
- enkelvoudig meervoudig tonen (1 of *)
- corrigeert registratie r ook een lijntje tekenen?
- enkele view:
  - inhoudelijke info over wijzigingen
  - Klikken op gerelateerde record: record ophalen en ook tonen, inclusief kinderen en relaties
  - Dan kun je het hele model doorklikken. Vraag hoe dat netjes past, of dat defocus ook kan (A klapt weer in naar alleen een kleine A?)
  - inklappen inclusief kinderen tonen (klein, maar zonder data)?

25 react pagina's uitbreiden met:
- (latere!) ongedaangemaaktheid van regs tonen
- dit is een soort 'blik op de toekomst'

30 Model uitbreiden met menselijke klassen

40 3D weergave model en tijdslijnen :-)

50 Autonumber Entiteit-IDs? Simpel maar wenselijk?

60 pbac: wat is een goed policy formaat?
61 pip maken op basis van metamodel?
62 pep inbouwen

## TO DO MATERIEEL = REDESIGN!
1 In modellen de materiële tijd toevoegen = aanvang en einde
- Voor elke representatie een aparte {REP}_Aanvang + {REP}_Einde tabel. (DONE)
- In de structs een standaard Aanvang en Einde plumbing struct, die zich in feite gedraagt als:
  - een GE op de entiteit (DONE in DB, PFK met 2 velden)
  - een _data element op een GE (todo, punt 2 eerst) (DONE in DB: PFK met 3 velden)


2 JSON voor een request waarbij Aanvang en /of Einde wordt toegevoegd aan een bestaande Entiteit

```json
{
  "registratie": {
    "registratietype": "registratie",
    "tijdstip": "2026-02-16T10:30:00Z",
    "opmerking": "Opvoer van aanvang en einde van A=1"
  },
  "wijzigingen": [
    {
      "opvoer": {
        "aanvang": {
          "a_id": "1",
          "datum": "01-01-2020"
        }
      }
    },
    {
      "opvoer": {
        "einde": {
          "a_id": "1",
          "datum": "31-12-2025"
        }
      }
    }
  ]
}
```


2 Aanvang en Einde op een entiteit via plumbing behandelen als een GE
- bij opvoer, afvoer en correctie
- ongedaanmaking moet misschien iets speciaals gebeuren in de queries

3 Full handlers uitbreiden met meer dan één laag diepe relaties (vanwege bovenstaande mogelijke materiele 'mickey mouse oortjes' op entiteiten en gegevenselementen)
- Dan heeft het GE een drievoudige PFK:
  - `entiteit-id`
  - `{ent}_{GE}.rel-id`
  - `{ent}_{GE}_data.versie`
- De splitsing van het gegevenselement in `{ent}_{GE}` en `{ent}_{GE}_data` is een vorm van plumbing.
- De API blijft nog dezelfde, met toevoeging van aanvang en einde als optionele types onder elk materieel element.
- Bij creatie worden de tabellen gesplitst gemaakt met indien materieel de aanvang en einde tabellen: `{ent}_{GE}_aanvang` en `{ent}_{GE}_einde`
- deze gedragen zich dus als een _data tabel met een versie.

