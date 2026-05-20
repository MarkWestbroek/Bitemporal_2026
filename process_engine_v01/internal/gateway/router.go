// Package gateway exposeert de HTTP-API van de Process Engine. Het is een
// dunne laag die requests vertaalt naar Operaton-aanroepen of register-
// aanroepen via de adapter.
package gateway

import (
	"context"
	"encoding/json"
	"errors"
	"log/slog"
	"net/http"
	"os"
	"time"

	"github.com/MarkWestbroek/Bitemporal_2026/process_engine_v01/internal/registers"
)

// Server is een minimaal HTTP-server skeleton. Wordt in Fase 2 vervangen door
// een Gin-router met volledige route-set.
type Server struct {
	registry *registers.Registry
	addr     string
}

// New maakt een Server met defaults uit env-vars.
func New(registry *registers.Registry) *Server {
	addr := os.Getenv("PROCESS_ENGINE_ADDR")
	if addr == "" {
		addr = ":8090"
	}
	return &Server{registry: registry, addr: addr}
}

// Run start de HTTP-server tot context cancellation.
func (s *Server) Run(ctx context.Context) error {
	mux := http.NewServeMux()
	mux.HandleFunc("/healthz", s.handleHealth)
	mux.HandleFunc("/api/process/info", s.handleInfo)

	httpSrv := &http.Server{
		Addr:              s.addr,
		Handler:           mux,
		ReadHeaderTimeout: 10 * time.Second,
	}

	errCh := make(chan error, 1)
	go func() {
		slog.Info("gateway luistert", "adres", s.addr)
		if err := httpSrv.ListenAndServe(); err != nil && !errors.Is(err, http.ErrServerClosed) {
			errCh <- err
		}
		close(errCh)
	}()

	select {
	case <-ctx.Done():
		shutdownCtx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
		defer cancel()
		return httpSrv.Shutdown(shutdownCtx)
	case err := <-errCh:
		return err
	}
}

func (s *Server) handleHealth(w http.ResponseWriter, _ *http.Request) {
	w.WriteHeader(http.StatusOK)
	_, _ = w.Write([]byte("ok"))
}

func (s *Server) handleInfo(w http.ResponseWriter, _ *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(map[string]any{
		"naam":             "process-engine",
		"versie":           "v01-skeleton",
		"aantal_registers": s.registry.Count(),
	})
}
