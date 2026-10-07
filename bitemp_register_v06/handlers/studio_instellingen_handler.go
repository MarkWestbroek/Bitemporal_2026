package handlers

// Studio-instellingen van de server (plan 2026-10-07 Projectsync): wat de Studio
// bij het opstarten van de instantie wil weten. Nu alleen de poll-interval van de
// projectsync; beheerd via omgevingsvariabelen (admin-instelling per instantie).
//
//   GET /api/studio/instellingen → {"poll_ms": 5000}

import (
	"net/http"
	"os"
	"strconv"
	"strings"

	"github.com/gin-gonic/gin"
)

const (
	studioPollMsStandaard = 5000
	studioPollMsMin       = 500
	studioPollMsMax       = 120000
)

// StudioPollMs leest STUDIO_SYNC_POLL_MS (ms tussen twee polls van het operatielog
// per client zolang er geen SSE-kanaal is), begrensd op 500 ms – 120 s.
func StudioPollMs() int {
	v, err := strconv.Atoi(strings.TrimSpace(os.Getenv("STUDIO_SYNC_POLL_MS")))
	if err != nil || v <= 0 {
		return studioPollMsStandaard
	}
	if v < studioPollMsMin {
		return studioPollMsMin
	}
	if v > studioPollMsMax {
		return studioPollMsMax
	}
	return v
}

// MaakStudioInstellingenHandler — GET /api/studio/instellingen (open: niets gevoeligs).
func MaakStudioInstellingenHandler() gin.HandlerFunc {
	return func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{"poll_ms": StudioPollMs()})
	}
}
