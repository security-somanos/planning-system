package db

import (
	"context"
	"embed"
	"time"

	"planning-system/backend/internal/config"

	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/rs/zerolog"
)

//go:embed migrations/*.sql
var MigrationsFS embed.FS

func Connect(ctx context.Context, cfg config.Config, logger zerolog.Logger) (*pgxpool.Pool, error) {
	// Parse the connection string and configure pool settings
	config, err := pgxpool.ParseConfig(cfg.DatabaseURL)
	if err != nil {
		return nil, err
	}

	// Configure pool settings to prevent hanging
	config.MaxConns = 25                       // Maximum number of connections in pool
	config.MinConns = 2                        // Minimum number of connections to maintain
	config.MaxConnLifetime = 1 * time.Hour     // Close connections after 1 hour
	config.MaxConnIdleTime = 30 * time.Minute  // Close idle connections after 30 minutes
	config.HealthCheckPeriod = 1 * time.Minute // Health check every minute

	pool, err := pgxpool.NewWithConfig(ctx, config)
	if err != nil {
		return nil, err
	}

	// Simple ping to verify connection with timeout
	pingCtx, cancel := context.WithTimeout(ctx, 5*time.Second)
	defer cancel()
	if err := pool.Ping(pingCtx); err != nil {
		pool.Close()
		return nil, err
	}

	logger.Info().
		Int("max_conns", int(config.MaxConns)).
		Int("min_conns", int(config.MinConns)).
		Msg("database connected")
	return pool, nil
}
