package main

import (
	"database/sql"
	"fmt"
	"os"
	"strings"

	"github.com/gin-gonic/gin"
	"github.com/joho/godotenv"
	"github.com/uptrace/bun"
	"github.com/uptrace/bun/dialect/pgdialect"
	"github.com/uptrace/bun/driver/pgdriver"
	"github.com/uptrace/bun/extra/bundebug"

	"github.com/MarkWestbroek/Bitemporal_2026/bitemporal_go_API_v03/dbsetup"
	"github.com/MarkWestbroek/Bitemporal_2026/bitemporal_go_API_v03/handlers"
	"github.com/MarkWestbroek/Bitemporal_2026/bitemporal_go_API_v03/routes"
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

	//Homepage
	router.GET("/", handlers.HomePage)

	// Version endpoint
	router.GET("/version", func(c *gin.Context) {
		c.JSON(200, gin.H{"commit": commit, "build_time": buildTime})
	})

	// GraphQL endpoint
	router.GET("/graphql/playground", handlers.PlaygroundHandler())
	router.POST("/graphql/query", handlers.GraphQLHandler())
	router.GET("/graphql/query", handlers.GraphQLHandler())

	// admin routes
	router.DELETE("/admin/db/droptables/:password", handlers.DropTables)
	router.POST("/admin/db/createtables", handlers.CreateTables)

	//Add all functional routes
	routes.AddRoutes(router)

	return router
}

func connectToDatabase() (*bun.DB, error) {
	// Get DSN from environment variable or use default
	dsn := os.Getenv("DATABASE_URL")
	if dsn == "" {
		// Default DSN for local development
		dsn = "postgres://postgres:1234@localhost:5432/bitemp_go_db?sslmode=disable"
	}
	sqldb := sql.OpenDB(pgdriver.NewConnector(pgdriver.WithDSN(dsn)))
	db := bun.NewDB(sqldb, pgdialect.New())
	return db, nil
}
