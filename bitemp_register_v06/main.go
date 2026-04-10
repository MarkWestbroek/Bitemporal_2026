package main

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
	"net/url"
	"os"
	"strings"

	"github.com/gin-gonic/gin"
	"github.com/joho/godotenv"
	"github.com/uptrace/bun"
	"github.com/uptrace/bun/dialect/pgdialect"
	"github.com/uptrace/bun/driver/pgdriver"
	"github.com/uptrace/bun/extra/bundebug"

	"github.com/MarkWestbroek/Bitemporal_2026/bitemp_register_v06/dbsetup"
	"github.com/MarkWestbroek/Bitemporal_2026/bitemp_register_v06/dynql"
	"github.com/MarkWestbroek/Bitemporal_2026/bitemp_register_v06/handlers"
	"github.com/MarkWestbroek/Bitemporal_2026/bitemp_register_v06/routes"
)

var commit = "dev"
var buildTime = "26 feb 2024"

func main() {
	loadDotEnvIfPresent()

	fmt.Println("Bitemp Go API Project")
	fmt.Printf("build commit: %s, build time: %s\n", commit, buildTime)
	dropTablesEnabled := isDropTablesEnabled()
	fmt.Printf("admin drop tables enabled: %t\n", dropTablesEnabled)
	if dropTablesEnabled && isProductionEnvironment() {
		fmt.Println("WARNING: ALLOW_DROP_TABLES=true while running in production context")
	}

	// Establish a connection to the PostgreSQL database
	db, err := connectToDatabase()
	if err != nil {
		fmt.Println("Failed to connect to the database:", err)
		return
	}
	fmt.Println("Succesfully connected to the database.")
	defer db.Close()

	// Create the "tasks" table in the database if it doesn't exist
	err = dbsetup.CreateTables(db)
	if err != nil {
		fmt.Println("Failed to create table:", err)
		return
	}
	fmt.Println("Table(s) created successfully or they were already present.")

	// Add a query hook for logging only when explicitly enabled.
	if isBunDebugEnabled() {
		db.AddQueryHook(bundebug.NewQueryHook(
			bundebug.WithVerbose(true),
		))
	}

	// Ping the database to test the connection
	err = db.Ping()
	if err != nil {
		fmt.Println("Failed to connect to the database")
		return
	}
	// Connection successful
	fmt.Println("Succesfully connected to the database.")

	handlers.DB = db

	// Create router and register routes
	router := NewRouter()

	//run the server
	router.Run()

}

func loadDotEnvIfPresent() {
	err := godotenv.Load()
	if err != nil {
		fmt.Println("No .env file loaded (using existing environment variables)")
	}
}

func isDropTablesEnabled() bool {
	return os.Getenv("ALLOW_DROP_TABLES") == "true"
}

func isBunDebugEnabled() bool {
	v := strings.ToLower(strings.TrimSpace(os.Getenv("BUNDEBUG")))
	return v == "1" || v == "true" || v == "yes" || v == "on"
}

func isProductionEnvironment() bool {
	if os.Getenv("APP_ENV") == "production" {
		return true
	}

	return os.Getenv("GIN_MODE") == gin.ReleaseMode
}

// NewRouter creates and returns a Gin engine with all routes registered.
func NewRouter() *gin.Engine {
	router := gin.Default()

	// Registreer middleware (o.a. CORS) vóór alle endpoint-definities.
	routes.SetupMiddleware(router)

	//Homepage
	router.GET("/", handlers.HomePage)
	router.GET("/docs", handlers.DocsIndex)
	router.GET("/docs/*filepath", handlers.DocsPage)
	router.GET("/api/viz/schema", handlers.MaakVizSchemaHandler())
	router.GET("/api/viz/schema/datatypes", handlers.MaakVizSchemaDatatypesHandler())
	router.GET("/api/viz/entiteit/:typenaam/max-id", handlers.MaakVizEntiteitMaxIDHandler())
	router.GET("/api/viz/relatie/:typenaam/secondaire-ids", handlers.MaakVizRelatieSecondaireIDsHandler())
	router.GET("/api/viz/reflijst/:typenaam/opties", handlers.MaakVizReflijstOptiesHandler())
	router.Static("/viz", "./web")

	// Schema model endpoints (v3-formaat, zie ontwerpkeuzen.md §7)
	router.GET("/api/schema/model", handlers.MaakGetSchemaModelHandler())
	router.GET("/api/schema/model/code", handlers.MaakGetSchemaModelCodeHandler())
	router.GET("/api/schema/model/:id", handlers.MaakGetSchemaModelVersieHandler())
	router.POST("/api/schema/model", handlers.MaakPostSchemaModelHandler())
	router.PUT("/api/schema/model/:id/activeer", handlers.MaakActiveerSchemaVersieHandler())
	router.GET("/api/schema/versies", handlers.MaakLijstSchemaVersiesHandler())

	// Schema-domeinen endpoints
	router.GET("/api/schema/domeinen", handlers.MaakGetSchemaDomeinenHandler())
	router.POST("/api/schema/domeinen", handlers.MaakPostSchemaDomeinHandler())

	// Version endpoint
	router.GET("/version", func(c *gin.Context) {
		c.JSON(200, gin.H{"commit": commit, "build_time": buildTime})
	})

	// OpenAPI 3.1 specificaties (conform NL API Strategie ADR 2.1.0)
	// /core/publish-openapi: publiceer op /openapi.json en /openapi.yaml
	router.GET("/openapi.json", handlers.MaakOpenAPIHandler("json"))
	router.GET("/openapi.yaml", handlers.MaakOpenAPIHandler("yaml"))
	router.GET("/openapi", handlers.MaakOpenAPIDomeinenLijstHandler())
	router.GET("/openapi/:domein", handlers.MaakOpenAPIDomeinHandler(""))

	// Interactieve API-documentatie (Swagger UI en ReDoc)
	router.GET("/swagger", handlers.MaakSwaggerUIHandler())
	router.GET("/redoc", handlers.MaakReDocHandler())

	// GraphQL endpoint (dynamisch vanuit MetaRegistry)
	gqlSchema, err := dynql.BuildSchema(handlers.DB)
	if err != nil {
		fmt.Println("WARN: GraphQL schema bouwen mislukt:", err)
	} else {
		router.GET("/graphql/playground", dynql.PlaygroundHandler("/graphql/query"))
		router.POST("/graphql/query", dynql.GraphQLHandler(gqlSchema))
		router.GET("/graphql/query", dynql.GraphQLHandler(gqlSchema))
		fmt.Println("GraphQL endpoint geregistreerd op /graphql/query")
	}

	// admin routes
	router.DELETE("/admin/db/droptables/:password", handlers.DropTables)
	router.POST("/admin/db/createtables", handlers.CreateTables)

	// Devloop rebuild routes (alleen actief als DEVLOOP=true)
	router.POST("/admin/rebuild/:password", handlers.MaakRebuildHandler())
	router.GET("/admin/rebuild/status", handlers.MaakRebuildStatusHandler())

	//Add all functional routes
	routes.AddRoutes(router)

	return router
}

func connectToDatabase() (*bun.DB, error) {
	// Get DSN from environment variable or use default
	dsn := os.Getenv("DATABASE_URL")
	if dsn == "" {
		// Default DSN for local development
		dsn = "postgres://postgres:1234@localhost:5432/bitemp_go_db_v06?sslmode=disable"
	}

	if isAutoCreateDatabaseEnabled() {
		err := ensureDatabaseExists(dsn)
		if err != nil {
			return nil, err
		}
	}

	sqldb := sql.OpenDB(pgdriver.NewConnector(pgdriver.WithDSN(dsn)))
	db := bun.NewDB(sqldb, pgdialect.New())
	return db, nil
}

func isAutoCreateDatabaseEnabled() bool {
	v := strings.ToLower(strings.TrimSpace(os.Getenv("AUTO_CREATE_DATABASE")))
	return v == "1" || v == "true" || v == "yes" || v == "on"
}

func ensureDatabaseExists(appDSN string) error {
	databaseName, err := extractDatabaseNameFromDSN(appDSN)
	if err != nil {
		return err
	}

	adminDSN := strings.TrimSpace(os.Getenv("DATABASE_ADMIN_URL"))
	if adminDSN == "" {
		adminDSN, err = replaceDSNDatabase(appDSN, "postgres")
		if err != nil {
			return err
		}
	}

	adminDB := sql.OpenDB(pgdriver.NewConnector(pgdriver.WithDSN(adminDSN)))
	defer adminDB.Close()

	ctx := context.Background()
	var exists bool
	err = adminDB.QueryRowContext(
		ctx,
		"SELECT EXISTS (SELECT 1 FROM pg_database WHERE datname = $1)",
		databaseName,
	).Scan(&exists)
	if err != nil {
		return fmt.Errorf("failed checking database %q existence: %w", databaseName, err)
	}

	if exists {
		fmt.Printf("Database %q already exists.\n", databaseName)
		return nil
	}

	_, err = adminDB.ExecContext(ctx, fmt.Sprintf("CREATE DATABASE %s", quoteIdentifier(databaseName)))
	if err != nil {
		return fmt.Errorf(
			"failed creating database %q: %w (set DATABASE_ADMIN_URL with a user that has CREATEDB privilege)",
			databaseName,
			err,
		)
	}

	fmt.Printf("Database %q created successfully.\n", databaseName)
	return nil
}

func extractDatabaseNameFromDSN(dsn string) (string, error) {
	parsed, err := url.Parse(dsn)
	if err != nil {
		return "", fmt.Errorf("invalid DATABASE_URL: %w", err)
	}

	databaseName := strings.TrimPrefix(parsed.Path, "/")
	if strings.TrimSpace(databaseName) == "" {
		return "", errors.New("DATABASE_URL must include a database name in the path")
	}

	return databaseName, nil
}

func replaceDSNDatabase(dsn string, databaseName string) (string, error) {
	parsed, err := url.Parse(dsn)
	if err != nil {
		return "", fmt.Errorf("invalid DATABASE_URL: %w", err)
	}

	parsed.Path = "/" + strings.TrimPrefix(databaseName, "/")
	return parsed.String(), nil
}

func quoteIdentifier(name string) string {
	return `"` + strings.ReplaceAll(name, `"`, `""`) + `"`
}
