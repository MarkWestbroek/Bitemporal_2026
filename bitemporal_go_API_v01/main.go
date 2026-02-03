package main

import (
	"context"
	"database/sql"
	"fmt"
	"os"

	"github.com/gin-gonic/gin"
	"github.com/uptrace/bun"
	"github.com/uptrace/bun/dialect/pgdialect"
	"github.com/uptrace/bun/driver/pgdriver"
	"github.com/uptrace/bun/extra/bundebug"

	//"github.com/zaahidali/task_manager_api_with_bun/handlers"
	"github.com/MarkWestbroek/Bitemporal_2026/bitemporal_go_API_v01/handlers"
	//"github.com/zaahidali/task_manager_api_with_bun/model"
	"github.com/MarkWestbroek/Bitemporal_2026/bitemporal_go_API_v01/model"
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
	fmt.Println("connected to the database")
	defer db.Close()

	// Create the "tasks" table in the database if it doesn't exist
	err = createTables(db)
	if err != nil {
		fmt.Println("Failed to create table:", err)
		return
	}
	fmt.Println("Tables created successfully")

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
	fmt.Println("Connected successfully to the database")

	handlers.DB = db

	// Create router and register routes
	router := NewRouter()

	//run the server
	router.Run()

}

// NewRouter creates and returns a Gin engine with all routes registered.
func NewRouter() *gin.Engine {
	router := gin.Default()

	//Tasks routes
	router.GET("/", handlers.HomePage)
	router.GET("/tasks", handlers.GetTasks)
	router.GET("/tasks/:id", handlers.GetTask)
	router.DELETE("/tasks/:id", handlers.RemoveTask)
	router.POST("/tasks", handlers.AddTask)
	router.PUT("/tasks/:id", handlers.UpdateTask)

	//Test routes
	router.GET("/tests", handlers.GetTests)
	router.GET("/tests/:id", handlers.GetTest)
	router.DELETE("/tests/:id", handlers.RemoveTest)
	router.POST("/tests", handlers.AddTest)
	router.PUT("/tests/:id", handlers.UpdateTest)

	// Version endpoint
	router.GET("/version", func(c *gin.Context) {
		c.JSON(200, gin.H{"commit": commit, "build_time": buildTime})
	})

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

func createTables(db *bun.DB) error {
	ctx := context.Background()
	_, err := db.NewCreateTable().Model((*model.Task)(nil)).IfNotExists().Exec(ctx)
	if err != nil {
		return err
	}
	_, err = db.NewCreateTable().Model((*model.Test)(nil)).IfNotExists().Exec(ctx)
	return err
}
