package handlers

import (
	"os"
	"strings"
)

func debugLogsEnabled() bool {
	v := strings.ToLower(strings.TrimSpace(os.Getenv("APP_DEBUG_LOGS")))
	return v == "1" || v == "true" || v == "yes" || v == "on"
}
