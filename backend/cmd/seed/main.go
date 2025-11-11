package main

import (
	"context"

	"planning-system/backend/internal/config"
	"planning-system/backend/internal/db"
	"planning-system/backend/internal/db/seed"
)

func main() {
	ctx := context.Background()
	cfg := config.Load()
	logger := config.NewLogger(cfg)
	pool, err := db.Connect(ctx, cfg, logger)
	if err != nil {
		logger.Fatal().Err(err).Msg("db connect failed")
	}
	defer pool.Close()
	if err := seed.Run(ctx, pool, logger); err != nil {
		logger.Fatal().Err(err).Msg("seed failed")
	}
	logger.Info().Msg("seed ok")
}


