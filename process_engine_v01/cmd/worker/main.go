// Command worker draait de Operaton external-task workers (Fase 4 vooruit-
// trekken voor PoC: minimale "register-call" worker die bitemp v06 aanroept).
//
// Configuratie via env:
//
//	OPERATON_BASE_URL          (default: http://localhost:8080/engine-rest)
//	WORKER_ID                  (default: go-worker)
//	REGISTER_HOOFDREGISTER_URL (default: http://localhost:8082)
//	WORKER_LOCK_MS             (default: 30000)
//	WORKER_POLL_MS             (default: 1000)
package main

import (
	"context"
	"log/slog"
	"os"
	"os/signal"
	"strconv"
	"syscall"
	"time"

	"github.com/MarkWestbroek/Bitemporal_2026/process_engine_v01/internal/worker"
)

func main() {
	logger := slog.New(slog.NewTextHandler(os.Stdout, &slog.HandlerOptions{Level: slog.LevelInfo}))
	slog.SetDefault(logger)

	cfg := worker.Config{
		OperatonBaseURL: getenv("OPERATON_BASE_URL", "http://localhost:8080/engine-rest"),
		WorkerID:        getenv("WORKER_ID", "go-worker"),
		LockDuration:    msEnv("WORKER_LOCK_MS", 30000),
		PollInterval:    msEnv("WORKER_POLL_MS", 1000),
		MaxTasks:        5,
		RegisterBaseURLs: map[string]string{
			"hoofdregister": getenv("REGISTER_HOOFDREGISTER_URL", "http://localhost:8082"),
		},
	}

	ctx, cancel := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
	defer cancel()

	if err := worker.Run(ctx, cfg, logger); err != nil {
		logger.Error("worker fout", "err", err)
		os.Exit(1)
	}
}

func getenv(key, def string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return def
}

func msEnv(key string, defMS int) time.Duration {
	if v := os.Getenv(key); v != "" {
		if n, err := strconv.Atoi(v); err == nil && n > 0 {
			return time.Duration(n) * time.Millisecond
		}
	}
	return time.Duration(defMS) * time.Millisecond
}
