// Package store holds the SQL access layer. Services depend on the interfaces
// they declare themselves, so persistence stays behind a seam that tests can
// replace with a fake.
package store

import (
	"context"
	"errors"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/crayonlu/mosaic/server-go/internal/domain"
)

const userColumns = `id, username, password_hash, avatar_url, role,
	must_change_password, is_active, created_at, updated_at`

// UserStore reads and writes the users table.
type UserStore struct {
	pool *pgxpool.Pool
}

func NewUserStore(pool *pgxpool.Pool) *UserStore {
	return &UserStore{pool: pool}
}

func scanUser(row pgx.Row) (domain.User, error) {
	var user domain.User
	err := row.Scan(
		&user.ID,
		&user.Username,
		&user.PasswordHash,
		&user.AvatarURL,
		&user.Role,
		&user.MustChangePassword,
		&user.IsActive,
		&user.CreatedAt,
		&user.UpdatedAt,
	)
	if errors.Is(err, pgx.ErrNoRows) {
		return domain.User{}, domain.ErrNoRows
	}
	return user, err
}

// ByUsername looks up an account by its login name.
func (s *UserStore) ByUsername(ctx context.Context, username string) (domain.User, error) {
	return scanUser(s.pool.QueryRow(ctx,
		`SELECT `+userColumns+` FROM users WHERE username = $1`, username))
}

// ByID looks up an account by identifier.
func (s *UserStore) ByID(ctx context.Context, id uuid.UUID) (domain.User, error) {
	return scanUser(s.pool.QueryRow(ctx,
		`SELECT `+userColumns+` FROM users WHERE id = $1`, id))
}

// ExistsByUsername reports whether a username is already taken.
func (s *UserStore) ExistsByUsername(ctx context.Context, username string) (bool, error) {
	var exists bool
	err := s.pool.QueryRow(ctx,
		`SELECT EXISTS (SELECT 1 FROM users WHERE username = $1)`, username).Scan(&exists)
	return exists, err
}

// Create inserts an account and returns the stored row.
func (s *UserStore) Create(
	ctx context.Context,
	username, passwordHash, role string,
	mustChangePassword bool,
	now int64,
) (domain.User, error) {
	return scanUser(s.pool.QueryRow(ctx,
		`INSERT INTO users (username, password_hash, role, must_change_password, is_active, created_at, updated_at)
		 VALUES ($1, $2, $3, $4, true, $5, $5)
		 RETURNING `+userColumns,
		username, passwordHash, role, mustChangePassword, now))
}

// SetPassword stores a new password hash and clears the change-password flag.
func (s *UserStore) SetPassword(ctx context.Context, id uuid.UUID, hash string, now int64) error {
	_, err := s.pool.Exec(ctx,
		`UPDATE users SET password_hash = $1, must_change_password = false, updated_at = $2
		 WHERE id = $3`, hash, now, id)
	return err
}

// SetAvatar stores a new avatar URL and returns the updated row.
func (s *UserStore) SetAvatar(
	ctx context.Context,
	id uuid.UUID,
	avatarURL string,
	now int64,
) (domain.User, error) {
	return scanUser(s.pool.QueryRow(ctx,
		`UPDATE users SET avatar_url = $1, updated_at = $2 WHERE id = $3
		 RETURNING `+userColumns, avatarURL, now, id))
}

// SetProfile updates the fields that are present and leaves the rest untouched.
func (s *UserStore) SetProfile(
	ctx context.Context,
	id uuid.UUID,
	username, avatarURL *string,
	now int64,
) (domain.User, error) {
	return scanUser(s.pool.QueryRow(ctx,
		`UPDATE users
		 SET username   = COALESCE($1, username),
		     avatar_url = COALESCE($2, avatar_url),
		     updated_at = $3
		 WHERE id = $4
		 RETURNING `+userColumns, username, avatarURL, now, id))
}

// EnsureAdminRole promotes an existing account to administrator.
func (s *UserStore) EnsureAdminRole(ctx context.Context, username string) error {
	_, err := s.pool.Exec(ctx,
		`UPDATE users SET role = 'admin' WHERE username = $1 AND role <> 'admin'`, username)
	return err
}
