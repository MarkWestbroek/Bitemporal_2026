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

	"github.com/zaahidali/task_manager_api_with_bun/handlers"
	"github.com/zaahidali/task_manager_api_with_bun/model"
)

var db *bun.DB

func main() {
	fmt.Println("Task Manager API Project")

	// Establish a connection to the PostgreSQL database
	db, err := connectToDatabase()
	if err != nil {
		fmt.Println("Failed to connect to the database:", err)
		return
	}
	fmt.Println("connected to the database")
	defer db.Close()

	// Create the "tasks" table in the database if it doesn't exist
	err = createTasksTable(db)
	if err != nil {
		fmt.Println("Failed to create table:", err)
		return
	}
	fmt.Println("created Tasks table successfully")

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
	router := gin.Default()

	router.GET("/", handlers.HomePage)
	router.GET("/tasks", handlers.GetTasks)
	router.GET("/tasks/:id", handlers.GetTask)
	router.DELETE("/tasks/:id", handlers.RemoveTask)
	router.POST("/tasks", handlers.AddTask)
	router.PUT("/tasks/:id", handlers.UpdateTask)
	router.Run()
}

func connectToDatabase() (*bun.DB, error) {
	// Get DSN from environment variable or use default
	dsn := os.Getenv("DATABASE_URL")
	if dsn == "" {
		// Default DSN for local development
		dsn = "postgres://postgres:1234@localhost:5432/task_manager_api_with_bun?sslmode=disable"
	}
	sqldb := sql.OpenDB(pgdriver.NewConnector(pgdriver.WithDSN(dsn)))
	db := bun.NewDB(sqldb, pgdialect.New())
	return db, nil
}

func createTasksTable(db *bun.DB) error {
	ctx := context.Background()
	_, err := db.NewCreateTable().Model((*model.Task)(nil)).IfNotExists().Exec(ctx)
	return err
}
