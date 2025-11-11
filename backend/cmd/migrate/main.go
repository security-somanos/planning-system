package main

import (
	"context"
	"flag"
	"fmt"
	"os"

	"planning-system/backend/internal/config"
	dbmigrate "planning-system/backend/internal/db/migrate"
)

func main() {
	dir := flag.String("dir", "up", "direction: up or down")
	flag.Parse()

	cfg := config.Load()
	logger := config.NewLogger(cfg)
	ctx := context.Background()

	var err error
	switch *dir {
	case "up":
		err = dbmigrate.Up(ctx, cfg, logger)
	case "down":
		err = dbmigrate.Down(ctx, cfg, logger)
	default:
		fmt.Println("unknown direction:", *dir)
		os.Exit(2)
	}
	if err != nil {
		logger.Fatal().Err(err).Msg("migration failed")
	}
	logger.Info().Str("direction", *dir).Msg("migration done")
}


