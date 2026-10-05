// Package db owns the connection pool and schema migrations.
package db

import (
	"context"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
)

// Pool limits match the previous server's connection settings.
const (
	maxConnections = 20
	connectTimeout = 30 * time.Second
)

// Connect opens a connection pool and verifies it with a round trip.
func Connect(ctx context.Context, databaseURL string) (*pgxpool.Pool, error) {
	cfg, err := pgxpool.ParseConfig(databaseURL)
	if err != nil {
		return nil, err
	}
	cfg.MaxConns = maxConnections
	cfg.ConnConfig.ConnectTimeout = connectTimeout

	pool, err := pgxpool.NewWithConfig(ctx, cfg)
	if err != nil {
		return nil, err
	}
	if err := pool.Ping(ctx); err != nil {
		pool.Close()
		return nil, err
	}
	return pool, nil
}
