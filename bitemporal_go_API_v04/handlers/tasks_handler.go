package handlers

import (
	"net/http"
	"os"

	"github.com/gin-gonic/gin"
	"github.com/uptrace/bun"
)

var DB *bun.DB

func HomePage(ctx *gin.Context) {
	const rootIndexPath = "./web/root_index.html"

	if _, err := os.Stat(rootIndexPath); err == nil {
		ctx.File(rootIndexPath)
		return
	}

	ctx.JSON(http.StatusOK, gin.H{
		"message":   "Welcome to the Bitemp Go API",
		"viz":       "/viz/index_schema.html",
		"version":   "/version",
		"graphql":   "/graphql/playground",
		"vizSchema": "/api/viz/schema",
	})
}
