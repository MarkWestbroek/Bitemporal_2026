// Package main is het entrypoint van de Process Engine: één Go-binary die
// zowel de HTTP-gateway als de Operaton external-task workers host.
//
// Status: skeleton. De daadwerkelijke routing, workers en adapters worden
// stapsgewijs ingevuld volgens het plan in docs/plans/.
package main

import (
	"context"
	"log/slog"
	"os"
	"os/signal"
	"syscall"

	"github.com/MarkWestbroek/Bitemporal_2026/process_engine_v01/internal/gateway"
	"github.com/MarkWestbroek/Bitemporal_2026/process_engine_v01/internal/registers"
)

func main() {
	logger := slog.New(slog.NewTextHandler(os.Stdout, &slog.HandlerOptions{Level: slog.LevelInfo}))
	slog.SetDefault(logger)

	configPath := os.Getenv("PROCESS_ENGINE_CONFIG")
	if configPath == "" {
		configPath = "config/registers.yaml"
	}

	registry, err := registers.Load(configPath)
	if err != nil {
		slog.Error("kon register-configuratie niet laden", "pad", configPath, "fout", err)
		os.Exit(1)
	}
	slog.Info("register-configuratie geladen", "aantal", registry.Count())

	ctx, stop := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
	defer stop()

	srv := gateway.New(registry)
	if err := srv.Run(ctx); err != nil {
		slog.Error("gateway gestopt met fout", "fout", err)
		os.Exit(1)
	}
}
