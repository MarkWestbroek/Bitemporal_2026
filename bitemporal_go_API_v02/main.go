package main

import (
	"database/sql"
	"fmt"
	"os"

	"github.com/gin-gonic/gin"
	"github.com/uptrace/bun"
	"github.com/uptrace/bun/dialect/pgdialect"
	"github.com/uptrace/bun/driver/pgdriver"
	"github.com/uptrace/bun/extra/bundebug"

	"github.com/MarkWestbroek/Bitemporal_2026/bitemporal_go_API_v02/dbsetup"
	"github.com/MarkWestbroek/Bitemporal_2026/bitemporal_go_API_v02/handlers"
	"github.com/MarkWestbroek/Bitemporal_2026/bitemporal_go_API_v02/routes"
)

var db *bun.DB
var commit = "dev"
var buildTime = "dev"

func main() {
	fmt.Println("Bitemp Go API Project")
	fmt.Printf("build commit: %s, build time: %s\n", commit, buildTime)

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

	// Add a query hook for logging
	db.AddQueryHook(bundebug.NewQueryHook(
		bundebug.WithVerbose(true),
		bundebug.FromEnv("BUNDEBUG"),
	))

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

	//Add all routes
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
