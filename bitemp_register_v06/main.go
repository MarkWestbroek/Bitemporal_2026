package main

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
	"net/url"
	"os"
	"strings"
	"time"

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
	// max-id en secondaire-ids lezen registerdata: achter de leesguard (LEESTOEGANG, zie
	// middleware/leestoegang.go). Schema en reflijst-opties zijn metadata/naslag en blijven open.
	router.GET("/api/viz/entiteit/:typenaam/max-id", middleware.RequireLezer(), handlers.MaakVizEntiteitMaxIDHandler())
	router.GET("/api/viz/relatie/:typenaam/secondaire-ids", middleware.RequireLezer(), handlers.MaakVizRelatieSecondaireIDsHandler())
	router.GET("/api/viz/reflijst/:typenaam/opties", handlers.MaakVizReflijstOptiesHandler())
	// WEB_DIR (optioneel): serveer de frontend uit een andere map, bv. de gebouwde frontend van een
	// andere checkout. Handig voor een test-instantie in een worktree waar de frontend niet gebouwd is.
	webDir := strings.TrimSpace(os.Getenv("WEB_DIR"))
	if webDir == "" {
		webDir = "./web"
	}
	router.Static("/viz", webDir)

	// Leespoort (plan 2026-09-22 §7.7 stap 3): LEESTOEGANG=documenten sluit anoniem lezen van
	// registerdata af; alleen publieke opgeslagen documenten, configuratie en naslag blijven open.
	if middleware.LeesToegangAlleenDocumenten() {
		if middleware.IsAuthEnabled() {
			fmt.Println("leestoegang: documenten — anoniem alleen publieke QueryDefinities, configuratie en referentielijsten; overige registerdata vereist minimaal rol viewer")
		} else {
			fmt.Println("WARN: LEESTOEGANG=documenten heeft geen effect zolang AUTH_ENABLED=false")
		}
	} else {
		fmt.Println("leestoegang: open — alle GET-routes en GraphQL-queries zijn anoniem leesbaar (zet LEESTOEGANG=documenten om de poort te sluiten)")
	}

	// Autorisatie (BE-review 2026-07-07, actiepunt 3): muterende routes vereisen
	// minimaal "editor", beheer-routes "admin". Beide zijn no-ops zolang
	// AUTH_ENABLED=false, dus dev-omgevingen zonder auth merken hier niets van.
	editor := middleware.RequireRol("editor")
	admin := middleware.RequireRol("admin")

	// Openbare indiening van een formulier (aanmeldformulier stap C, handlers/aanmelding_handler.go):
	// anoniem, maar alleen voor de FormulierDefinitie-id's in OPENBARE_FORMULIEREN, alleen
	// opvoeren op plaatshouder-id's, vaste waarden afgedwongen, bron "aanmeldformulier".
	router.POST("/aanmelding/:formulierId", handlers.MaakAanmeldingHandler())
	if of := handlers.OpenbareFormulieren(); len(of) > 0 {
		fmt.Println("openbare formulieren (POST /aanmelding/:id):", of)
	} else {
		fmt.Println("openbare formulieren: geen (zet OPENBARE_FORMULIEREN=<FD-id,…> om een formulier anoniem indienbaar te maken)")
	}

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
		// niet te splitsen; de handler kijkt daarom naar het document zelf.
		// Queries zijn openbaar, net als de GET-routes van REST (de publicatiepagina
		// haalt detail-templates via GraphQL op). Een document met een mutatie vereist
		// rol "editor", net als de muterende REST-routes (no-op als AUTH_ENABLED=false).
		// Tot 22-09-2026 stond het hele endpoint achter RequireAuth: dat sloot anoniem
		// lezen af en liet een "viewer" wél muteren. Zie docs/AUTH_DEVELOPER_GUIDE.md §3.4.
		magMuteren := func(c *gin.Context) bool { return middleware.ControleerRol(c, "editor") }
		// Opgeslagen documenten (documentId, zie dynql/opgeslagen_documenten.go): een
		// publiek document mag anoniem, een intern document vereist een ingelogde gebruiker
		// (minimaal "viewer"; no-op als AUTH_ENABLED=false).
		magIntern := func(c *gin.Context) bool { return middleware.ControleerRol(c, "viewer") }
		// Een ad-hoc query (geen documentId, geen introspectie) leest registerdata en valt
		// onder de leespoort: open, of minimaal "viewer" als LEESTOEGANG=documenten.
		router.GET("/graphql/playground", dynql.PlaygroundHandler("/graphql/query"))
		router.POST("/graphql/query", dynql.GraphQLHandler(gqlSchema, magMuteren, magIntern, middleware.MagLezen))
		router.GET("/graphql/query", dynql.GraphQLHandler(gqlSchema, magMuteren, magIntern, middleware.MagLezen))
		// Een document valideren zonder uit te voeren (voor de frontend, vóór het opslaan
		// van een QueryDefinitie). Alleen-lezen en zonder data, dus openbaar zoals queries.
		router.POST("/graphql/valideer", dynql.ValideerDocumentHandler(gqlSchema))
		fmt.Println("GraphQL endpoint geregistreerd op /graphql/query (+ /graphql/valideer)")

		// Uitvoeren op naam: er wordt niets opgebouwd (de documenten zijn data en worden
		// per aanroep opgezocht), maar bij het opstarten worden het contract en de actuele
		// documenten wél gecontroleerd, zodat een model dat onder een document vandaan is
		// veranderd hier in het log staat.
		if ok, reden := dynql.OpgeslagenDocumentenBeschikbaar(); !ok {
			fmt.Println("WARN: GraphQL uitvoeren op naam (documentId) staat uit:", reden)
		} else if regels, err := dynql.ValideerOpgeslagenDocumenten(context.Background(), gqlSchema, time.Now()); err != nil {
			fmt.Println("WARN: opgeslagen documenten valideren mislukt:", err)
		} else {
			fmt.Printf("GraphQL uitvoeren op naam (documentId) aan; %d actuele QueryDefinitie(s)\n", len(regels))
			for _, r := range regels {
				fmt.Println("  ", r)
			}
		}
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
		// Regressie-UI (regressie_np_loc_test.go afspelen vanuit de browser); zie docs/REGRESSIETEST.md.
		handlers.RegistreerRegressieRoutes(router, admin)
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
	configureerPool(sqldb) // zie db_pool.go
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
