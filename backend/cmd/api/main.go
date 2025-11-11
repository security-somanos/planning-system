package main

import (
	"context"
	"fmt"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"planning-system/backend/internal/config"
	"planning-system/backend/internal/db"
	dbmigrate "planning-system/backend/internal/db/migrate"
	"planning-system/backend/internal/db/seed"
	httprouter "planning-system/backend/internal/http"
	"planning-system/backend/pkg/respond"
)

func main() {
	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()

	cfg := config.Load()
	logger := config.NewLogger(cfg)

	// Database connection
	pool, err := db.Connect(ctx, cfg, logger)
	if err != nil {
		logger.Fatal().Err(err).Msg("failed to connect to database")
	}
	defer pool.Close()

	// Run migrations automatically
	if cfg.AutoMigrate {
		if err := dbmigrate.Up(ctx, cfg, logger); err != nil {
			logger.Fatal().Err(err).Msg("failed running migrations")
		}
	}

	// Dev seeding
	if cfg.Env == "dev" && cfg.AutoSeed {
		if err := seed.Run(ctx, pool, logger); err != nil {
			logger.Fatal().Err(err).Msg("failed running dev seed")
		}
	}

	// HTTP router
	router := httprouter.NewRouter(cfg, logger, pool)

	srv := &http.Server{
		Addr:         ":" + cfg.Port,
		Handler:      router,
		ReadTimeout:  15 * time.Second,
		WriteTimeout: 60 * time.Second,
		IdleTimeout:  60 * time.Second,
	}

	// Graceful shutdown
	done := make(chan os.Signal, 1)
	signal.Notify(done, os.Interrupt, syscall.SIGINT, syscall.SIGTERM)

	go func() {
		logger.Info().Str("port", cfg.Port).Msg("server starting")
		if err := srv.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			logger.Fatal().Err(err).Msg("server failed")
		}
	}()

	<-done
	logger.Info().Msg("server stopping")
	shutdownCtx, shutdownCancel := context.WithTimeout(ctx, 10*time.Second)
	defer shutdownCancel()
	if err := srv.Shutdown(shutdownCtx); err != nil {
		logger.Error().Err(err).Msg("graceful shutdown failed")
		_ = srv.Close()
	}
	fmt.Println("bye")
	respond.CloseIdleConnections()
}


