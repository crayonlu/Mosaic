// Command baseline-sqlx records the migrations the previous Rust server already
// applied, so goose treats them as done instead of trying to run them again.
//
// It is a one-off cutover tool: run it once, after the Rust server has stopped
// and before the Go server starts. It only writes goose's bookkeeping table and
// never executes migration SQL.
package main

import (
	"context"
	"fmt"
	"log/slog"
	"os"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/jackc/pgx/v5/stdlib"
	"github.com/pressly/goose/v3"
	"github.com/pressly/goose/v3/database"

	"github.com/crayonlu/mosaic/server-go/internal/config"
	"github.com/crayonlu/mosaic/server-go/internal/db"
)

// sqlxMigrationsTable is the bookkeeping table the previous server used.
const sqlxMigrationsTable = "_sqlx_migrations"

const timeout = 2 * time.Minute

func main() {
	if err := run(); err != nil {
		slog.Error("baseline failed", "err", err)
		os.Exit(1)
	}
}

func run() error {
	slog.SetDefault(slog.New(slog.NewTextHandler(os.Stdout, nil)))

	cfg, err := config.Load()
	if err != nil {
		return err
	}

	ctx, cancel := context.WithTimeout(context.Background(), timeout)
	defer cancel()

	pool, err := db.Connect(ctx, cfg.DatabaseURL)
	if err != nil {
		return fmt.Errorf("connecting to database: %w", err)
	}
	defer pool.Close()

	applied, err := appliedInPreviousServer(ctx, pool)
	if err != nil {
		return err
	}
	if len(applied) == 0 {
		slog.Info("no applied migrations found in the previous server's table; nothing to baseline",
			"table", sqlxMigrationsTable)
		return nil
	}

	connConfig := pool.Config().ConnConfig.Copy()
	sqlDB := stdlib.OpenDB(*connConfig)
	defer sqlDB.Close()

	store, err := database.NewStore(goose.DialectPostgres, goose.DefaultTablename)
	if err != nil {
		return fmt.Errorf("preparing version store: %w", err)
	}

	exists, err := tableExists(ctx, pool, store.Tablename())
	if err != nil {
		return err
	}
	if !exists {
		if err := store.CreateVersionTable(ctx, sqlDB); err != nil {
			return err
		}
		// goose records version 0 whenever it creates the table itself.
		if err := store.Insert(ctx, sqlDB, database.InsertRequest{Version: 0}); err != nil {
			return err
		}
		slog.Info("created version table", "table", store.Tablename())
	}

	recorded, err := recordedVersions(ctx, pool, store.Tablename())
	if err != nil {
		return err
	}

	inserted := 0
	for _, version := range applied {
		if recorded[version] {
			continue
		}
		if err := store.Insert(ctx, sqlDB, database.InsertRequest{Version: version}); err != nil {
			return err
		}
		inserted++
	}

	slog.Info("baseline complete",
		"table", store.Tablename(),
		"appliedInPreviousServer", len(applied),
		"newlyRecorded", inserted,
		"alreadyRecorded", len(applied)-inserted)
	return nil
}

// appliedInPreviousServer reads the versions the Rust server recorded. A missing
// table means the database was never migrated by it.
func appliedInPreviousServer(ctx context.Context, pool *pgxpool.Pool) ([]int64, error) {
	exists, err := tableExists(ctx, pool, sqlxMigrationsTable)
	if err != nil {
		return nil, err
	}
	if !exists {
		return nil, nil
	}

	rows, err := pool.Query(ctx,
		`SELECT version FROM `+sqlxMigrationsTable+` WHERE success ORDER BY version`)
	if err != nil {
		return nil, fmt.Errorf("reading %s: %w", sqlxMigrationsTable, err)
	}
	defer rows.Close()

	versions, err := pgx.CollectRows(rows, pgx.RowTo[int64])
	if err != nil {
		return nil, fmt.Errorf("reading %s: %w", sqlxMigrationsTable, err)
	}
	return versions, nil
}

func recordedVersions(ctx context.Context, pool *pgxpool.Pool, table string) (map[int64]bool, error) {
	rows, err := pool.Query(ctx,
		fmt.Sprintf(`SELECT DISTINCT version_id FROM %s`, pgx.Identifier{table}.Sanitize()))
	if err != nil {
		return nil, fmt.Errorf("reading %s: %w", table, err)
	}
	defer rows.Close()

	versions, err := pgx.CollectRows(rows, pgx.RowTo[int64])
	if err != nil {
		return nil, fmt.Errorf("reading %s: %w", table, err)
	}

	recorded := make(map[int64]bool, len(versions))
	for _, version := range versions {
		recorded[version] = true
	}
	return recorded, nil
}

func tableExists(ctx context.Context, pool *pgxpool.Pool, name string) (bool, error) {
	var exists bool
	if err := pool.QueryRow(ctx, `SELECT to_regclass($1) IS NOT NULL`, name).Scan(&exists); err != nil {
		return false, fmt.Errorf("checking for %s: %w", name, err)
	}
	return exists, nil
}
