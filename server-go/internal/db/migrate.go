package db

import (
	"context"
	"fmt"
	"log/slog"
	"os"

	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/jackc/pgx/v5/stdlib"
	"github.com/pressly/goose/v3"
)

// Migrate applies pending migrations from dir using goose.
//
// It opens its own database/sql handle rather than wrapping the shared pool, so
// migration bookkeeping cannot interfere with the application's connections.
func Migrate(ctx context.Context, pool *pgxpool.Pool, dir string) error {
	connConfig := pool.Config().ConnConfig.Copy()
	sqlDB := stdlib.OpenDB(*connConfig)
	defer sqlDB.Close()

	provider, err := goose.NewProvider(goose.DialectPostgres, sqlDB, os.DirFS(dir))
	if err != nil {
		return fmt.Errorf("preparing migrations from %s: %w", dir, err)
	}

	applied, err := provider.Up(ctx)
	if err != nil {
		return fmt.Errorf("applying migrations from %s: %w", dir, err)
	}
	for _, result := range applied {
		slog.Info("migration applied",
			"version", result.Source.Version,
			"duration", result.Duration)
	}
	return nil
}
