package handlers

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"

	"github.com/gin-gonic/gin"
)

// LogRequestBodyAsJSON reads the request body, prints it as pretty JSON,
// and resets the body so it can still be used by ShouldBindJSON
func LogRequestBodyAsJSON(ctx *gin.Context) {
	// Read the request body
	body, err := io.ReadAll(ctx.Request.Body)
	if err != nil {
		fmt.Println("Error reading body:", err)
		return
	}

	// Reset the body for subsequent reads
	ctx.Request.Body = io.NopCloser(bytes.NewBuffer(body))

	// Parse as JSON
	var jsonData interface{}
	err = json.Unmarshal(body, &jsonData)
	if err != nil {
		fmt.Println("Error parsing JSON:", err)
		return
	}

	// Pretty print
	jsonBytes, _ := json.MarshalIndent(jsonData, "", "  ")
	fmt.Println("Request body (pretty JSON):")
	fmt.Println(string(jsonBytes))
}
