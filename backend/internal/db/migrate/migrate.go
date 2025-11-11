package migrate

import (
	"context"
	"database/sql"
	"fmt"

	"planning-system/backend/internal/config"
	dbpkg "planning-system/backend/internal/db"

	_ "github.com/jackc/pgx/v5/stdlib"
	"github.com/rs/zerolog"

	"github.com/golang-migrate/migrate/v4"
	"github.com/golang-migrate/migrate/v4/database/postgres"
	"github.com/golang-migrate/migrate/v4/source/iofs"
)

func Up(ctx context.Context, cfg config.Config, logger zerolog.Logger) error {
	return run(ctx, cfg, logger, "up")
}

func Down(ctx context.Context, cfg config.Config, logger zerolog.Logger) error {
	return run(ctx, cfg, logger, "down")
}

func run(ctx context.Context, cfg config.Config, logger zerolog.Logger, direction string) error {
	db, err := sql.Open("pgx", cfg.DatabaseURL)
	if err != nil {
		return err
	}
	defer db.Close()

	driver, err := postgres.WithInstance(db, &postgres.Config{})
	if err != nil {
		return err
	}
	d, err := iofs.New(dbpkg.MigrationsFS, "migrations")
	if err != nil {
		return err
	}
	m, err := migrate.NewWithInstance("iofs", d, "postgres", driver)
	if err != nil {
		return err
	}
	switch direction {
	case "up":
		err = m.Up()
	case "down":
		err = m.Down()
	default:
		return fmt.Errorf("unknown direction: %s", direction)
	}
	if err != nil && err != migrate.ErrNoChange {
		return err
	}
	logger.Info().Str("direction", direction).Msg("migrations applied")
	return nil
}


