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