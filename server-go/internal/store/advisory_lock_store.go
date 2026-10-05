package store

import (
	"context"
	"sync"

	"github.com/jackc/pgx/v5/pgxpool"
)

// AdvisoryLockStore hands out PostgreSQL session-level advisory locks held on
// dedicated connections. Because the lock lives in the database and not in the
// process, the guard it provides holds across every server sharing that
// database.
type AdvisoryLockStore struct {
	pool *pgxpool.Pool
}

func NewAdvisoryLockStore(pool *pgxpool.Pool) *AdvisoryLockStore {
	return &AdvisoryLockStore{pool: pool}
}

// TryAcquire attempts to take the advisory lock derived from key. It reports
// whether the lock was taken and, when it was, returns the function that
// releases it.
//
// A false result means another holder — in this process or another one — is
// already running that key's work; the caller is expected to skip rather than
// queue, which is what the previous server did.
func (s *AdvisoryLockStore) TryAcquire(
	ctx context.Context,
	key string,
) (release func(), acquired bool, err error) {
	conn, err := s.pool.Acquire(ctx)
	if err != nil {
		return nil, false, err
	}

	var taken bool
	if err := conn.QueryRow(ctx,
		`SELECT pg_try_advisory_lock(hashtextextended($1::text, 0))`, key).Scan(&taken); err != nil {
		conn.Release()
		return nil, false, err
	}
	if !taken {
		conn.Release()
		return nil, false, nil
	}

	var once sync.Once
	release = func() {
		once.Do(func() {
			// The unlock has to run on the connection that holds the session
			// lock, and it must not be cancelled by the caller's context —
			// generation is detached from the request that started it.
			_, _ = conn.Exec(context.WithoutCancel(ctx),
				`SELECT pg_advisory_unlock(hashtextextended($1::text, 0))`, key)
			conn.Release()
		})
	}
	return release, true, nil
}
