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
	"github.com/MarkWestbroek/Bitemporal_2026/bitemp_register_v06/filestore"
	"github.com/MarkWestbroek/Bitemporal_2026/bitemp_register_v06/handlers"
	"github.com/MarkWestbroek/Bitemporal_2026/bitemp_register_v06/middleware"
	"github.com/MarkWestbroek/Bitemporal_2026/bitemp_register_v06/routes"
)

var commit = "dev"
var buildTime = "17 april 2026 om 22.54"

func main() {
	loadDotEnvIfPresent()

	fmt.Println("Bitemp Go API Project")
	fmt.Printf("build commit: %s, build time: %s\n", commit, buildTime)
	dropTablesEnabled := isDropTablesEnabled()
	fmt.Printf("admin drop tables enabled: %t\n", dropTablesEnabled)
	if dropTablesEnabled && isProductionEnvironment() {
		fmt.Println("WARNING: ALLOW_DROP_TABLES=true while running in production context")
	}
	fmt.Printf("devtools endpoints (/admin/*) meegecompileerd: %t\n", handlers.DevtoolsEnabled)
	if !handlers.DevtoolsEnabled {
		fmt.Println("  (devloop/rebuild/droptables vereisen een build met -tags devtools)")
	}

	// Registratie-tijdmodus: synthetisch (demo, default) of klok (productie).
	// Zie handlers/registratie_tijd.go en .env.example (REGISTRATIE_TIJD).
	tijdModus := handlers.RegistratieTijdModus()
	fmt.Printf("registratie-tijdmodus: %s\n", tijdModus)
	if tijdModus == handlers.RegistratieTijdSynthetisch && isProductionEnvironment() {
		fmt.Println("WARNING: REGISTRATIE_TIJD=synthetisch in productiecontext — registraties krijgen fictieve demo-tijdstippen; zet REGISTRATIE_TIJD=klok voor echte implementaties")
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

	// Seed admin-gebruiker als AUTH_ENABLED en ADMIN_USERNAME/ADMIN_PASSWORD zijn ingesteld
	if middleware.IsAuthEnabled() {
		// BE-review actiepunt 3: met auth aan is een expliciet JWT_SECRET verplicht
		// (en in productie geen dev-default). Anders weigeren we te starten.
		if err := middleware.ValideerAuthConfiguratie(isProductionEnvironment()); err != nil {
			fmt.Println("FATAL:", err)
			return
		}
		if err := handlers.SeedAdminGebruiker(context.Background()); err != nil {
			fmt.Println("WARN: Admin-seed mislukt:", err)
		}
	}

	// Initialiseer MinIO filestore (optioneel — graceful degradation als niet geconfigureerd)
	if err := filestore.Init(); err != nil {
		fmt.Println("WARN: MinIO initialisatie mislukt:", err)
		fmt.Println("Bestandsopslag beperkt tot inline (database).")
	}

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

	// Registreer middleware (o.a. CORS, JWT) vóór alle endpoint-definities.
	routes.SetupMiddleware(router)

	// === Authenticatie routes (publiek, geen auth vereist) ===
	auth := router.Group("/api/auth")
	{
		auth.POST("/login", handlers.LoginHandler())
		auth.POST("/logout", handlers.LogoutHandler())
		auth.GET("/me", handlers.MeHandler())
		auth.GET("/status", handlers.AuthStatusHandler())
	}

	//Homepage
	router.GET("/", handlers.HomePage)
	router.GET("/index.html", handlers.HomePage)
	router.GET("/docs", handlers.DocsIndex)
	router.GET("/docs/*filepath", handlers.DocsPage)
	router.GET("/api/viz/schema", handlers.MaakVizSchemaHandler())
	router.GET("/api/viz/schema/datatypes", handlers.MaakVizSchemaDatatypesHandler())
	router.GET("/api/viz/entiteit/:typenaam/max-id", handlers.MaakVizEntiteitMaxIDHandler())
	router.GET("/api/viz/relatie/:typenaam/secondaire-ids", handlers.MaakVizRelatieSecondaireIDsHandler())
	router.GET("/api/viz/reflijst/:typenaam/opties", handlers.MaakVizReflijstOptiesHandler())
	router.Static("/viz", "./web")

	// Autorisatie (BE-review 2026-07-07, actiepunt 3): muterende routes vereisen
	// minimaal "editor", beheer-routes "admin". Beide zijn no-ops zolang
	// AUTH_ENABLED=false, dus dev-omgevingen zonder auth merken hier niets van.
	editor := middleware.RequireRol("editor")
	admin := middleware.RequireRol("admin")

	// Schema model endpoints (v3-formaat, zie ontwerpkeuzen.md §7)
	router.GET("/api/schema/model", handlers.MaakGetSchemaModelHandler())
	router.GET("/api/schema/model/code", handlers.MaakGetSchemaModelCodeHandler())
	router.GET("/api/schema/model/:id", handlers.MaakGetSchemaModelVersieHandler())
	router.POST("/api/schema/model", editor, handlers.MaakPostSchemaModelHandler())
	router.PUT("/api/schema/model/:id/activeer", admin, handlers.MaakActiveerSchemaVersieHandler())
	router.GET("/api/schema/versies", handlers.MaakLijstSchemaVersiesHandler())

	// Schema-domeinen endpoints
	router.GET("/api/schema/domeinen", handlers.MaakGetSchemaDomeinenHandler())
	router.POST("/api/schema/domeinen", editor, handlers.MaakPostSchemaDomeinHandler())

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
		// GraphQL kan zowel queries als mutaties uitvoeren en is op routeniveau
		// niet te splitsen; daarom vereist het query-endpoint een ingelogde
		// gebruiker (RequireAuth, no-op als AUTH_ENABLED=false). Fijnmaziger
		// rol-checks per mutatie zijn vervolgwerk (zie BE-review §5.6).
		router.GET("/graphql/playground", dynql.PlaygroundHandler("/graphql/query"))
		router.POST("/graphql/query", middleware.RequireAuth(), dynql.GraphQLHandler(gqlSchema))
		router.GET("/graphql/query", middleware.RequireAuth(), dynql.GraphQLHandler(gqlSchema))
		fmt.Println("GraphQL endpoint geregistreerd op /graphql/query")
	}

	// admin/devloop routes — drie beveiligingsringen (BE-review 2026-07-07, §3.3):
	//  1. Alleen meegecompileerd met `go build -tags devtools` (devloop-builds);
	//     productie-builds (Dockerfile, Dockerfile.api) hebben deze routes niet.
	//  2. Rol "admin" vereist zodra AUTH_ENABLED=true.
	//  3. Eigen flag- en wachtwoordchecks in de handlers (constant-time;
	//     wachtwoord bij voorkeur via header X-Beheer-Wachtwoord — de
	//     :password-padvariant blijft werken maar lekt via access-logs).
	if handlers.DevtoolsEnabled {
		router.DELETE("/admin/db/droptables", admin, handlers.DropTables)
		router.DELETE("/admin/db/droptables/:password", admin, handlers.DropTables)
		router.POST("/admin/db/createtables", admin, handlers.CreateTables)

		// Devloop rebuild routes (alleen actief als DEVLOOP=true)
		router.POST("/admin/rebuild", admin, handlers.MaakRebuildHandler())
		router.POST("/admin/rebuild/:password", admin, handlers.MaakRebuildHandler())
		router.GET("/admin/rebuild/status", admin, handlers.MaakRebuildStatusHandler())
		router.POST("/admin/diff", admin, handlers.MaakDiffHandler())
		router.POST("/admin/diff/:password", admin, handlers.MaakDiffHandler())
	}

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
