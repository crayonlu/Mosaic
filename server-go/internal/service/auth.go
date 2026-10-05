// Package service holds the business rules. Every collaborator a service needs
// is a required constructor argument, so there is no partially wired state.
package service

import (
	"context"
	"errors"
	"time"

	"github.com/google/uuid"

	"github.com/crayonlu/mosaic/server-go/internal/auth"
	"github.com/crayonlu/mosaic/server-go/internal/domain"
)

// Access token lifetimes, unchanged from the previous server.
const (
	accessTokenTTL  = 7 * 24 * time.Hour
	refreshTokenTTL = 30 * 24 * time.Hour
)

// UserStore is the persistence the auth service depends on.
type UserStore interface {
	ByUsername(ctx context.Context, username string) (domain.User, error)
	ByID(ctx context.Context, id uuid.UUID) (domain.User, error)
	ExistsByUsername(ctx context.Context, username string) (bool, error)
	Create(ctx context.Context, username, passwordHash, role string, mustChangePassword bool, now int64) (domain.User, error)
	SetPassword(ctx context.Context, id uuid.UUID, hash string, now int64) error
	SetAvatar(ctx context.Context, id uuid.UUID, avatarURL string, now int64) (domain.User, error)
	SetProfile(ctx context.Context, id uuid.UUID, username, avatarURL *string, now int64) (domain.User, error)
	EnsureAdminRole(ctx context.Context, username string) error
}

// AuthService implements authentication and account self-service.
type AuthService struct {
	users     UserStore
	jwtSecret string
}

func NewAuthService(users UserStore, jwtSecret string) *AuthService {
	return &AuthService{users: users, jwtSecret: jwtSecret}
}

// Tokens is a freshly issued access/refresh pair.
type Tokens struct {
	AccessToken  string
	RefreshToken string
}

// LoginResult carries the tokens plus the account they belong to.
type LoginResult struct {
	Tokens
	User               domain.User
	MustChangePassword bool
}

// Login verifies credentials and issues tokens.
func (s *AuthService) Login(ctx context.Context, username, password string) (*LoginResult, error) {
	user, err := s.users.ByUsername(ctx, username)
	if errors.Is(err, domain.ErrNoRows) {
		return nil, domain.Unauthorized()
	}
	if err != nil {
		return nil, domain.Internal(err)
	}
	if !user.IsActive {
		return nil, domain.Forbidden("Account is disabled")
	}
	if !auth.VerifyPassword(user.PasswordHash, password) {
		return nil, domain.Unauthorized()
	}

	tokens, err := s.issueTokens(user)
	if err != nil {
		return nil, err
	}
	return &LoginResult{
		Tokens:             *tokens,
		User:               user,
		MustChangePassword: user.MustChangePassword,
	}, nil
}

// Refresh exchanges a refresh token for a new token pair.
func (s *AuthService) Refresh(ctx context.Context, refreshToken string) (*Tokens, error) {
	// Every refresh failure is reported as an invalid token, matching the
	// response the previous server produced.
	claims, err := auth.Verify(s.jwtSecret, refreshToken)
	if err != nil {
		return nil, domain.InvalidToken()
	}

	id, err := uuid.Parse(claims.Subject)
	if err != nil {
		return nil, domain.InvalidToken()
	}

	user, err := s.users.ByID(ctx, id)
	if errors.Is(err, domain.ErrNoRows) {
		return nil, domain.UserNotFound()
	}
	if err != nil {
		return nil, domain.Internal(err)
	}
	if !user.IsActive {
		return nil, domain.Forbidden("Account is disabled")
	}
	return s.issueTokens(user)
}

// ChangePassword verifies the current password, stores a new one, and returns
// fresh tokens that no longer carry the change-password requirement.
func (s *AuthService) ChangePassword(
	ctx context.Context,
	userID, oldPassword, newPassword string,
) (*Tokens, error) {
	id, err := uuid.Parse(userID)
	if err != nil {
		return nil, domain.InvalidUUID(err)
	}

	user, err := s.users.ByID(ctx, id)
	if errors.Is(err, domain.ErrNoRows) {
		return nil, domain.UserNotFound()
	}
	if err != nil {
		return nil, domain.Internal(err)
	}
	if !auth.VerifyPassword(user.PasswordHash, oldPassword) {
		return nil, domain.Unauthorized()
	}
	if len(newPassword) < domain.MinimumPasswordLength {
		return nil, domain.InvalidInput("Password must be at least 8 characters")
	}

	hash, err := auth.HashPassword(newPassword)
	if err != nil {
		return nil, err
	}
	if err := s.users.SetPassword(ctx, id, hash, time.Now().Unix()); err != nil {
		return nil, domain.Internal(err)
	}

	user.MustChangePassword = false
	return s.issueTokens(user)
}

// CurrentUser returns the account a verified token belongs to.
func (s *AuthService) CurrentUser(ctx context.Context, userID string) (domain.User, error) {
	id, err := uuid.Parse(userID)
	if err != nil {
		return domain.User{}, domain.InvalidUUID(err)
	}

	user, err := s.users.ByID(ctx, id)
	if errors.Is(err, domain.ErrNoRows) {
		return domain.User{}, domain.UserNotFound()
	}
	if err != nil {
		return domain.User{}, domain.Internal(err)
	}
	return user, nil
}

// UpdateAvatar replaces the avatar URL on an account.
func (s *AuthService) UpdateAvatar(ctx context.Context, userID, avatarURL string) (domain.User, error) {
	id, err := uuid.Parse(userID)
	if err != nil {
		return domain.User{}, domain.InvalidUUID(err)
	}

	user, err := s.users.SetAvatar(ctx, id, avatarURL, time.Now().Unix())
	if errors.Is(err, domain.ErrNoRows) {
		return domain.User{}, domain.UserNotFound()
	}
	if err != nil {
		return domain.User{}, domain.Internal(err)
	}
	return user, nil
}

// UpdateProfile applies whichever profile fields were supplied. A request with
// no fields returns the account unchanged.
func (s *AuthService) UpdateProfile(
	ctx context.Context,
	userID string,
	username, avatarURL *string,
) (domain.User, error) {
	id, err := uuid.Parse(userID)
	if err != nil {
		return domain.User{}, domain.InvalidUUID(err)
	}

	if username == nil && avatarURL == nil {
		return s.CurrentUser(ctx, userID)
	}

	user, err := s.users.SetProfile(ctx, id, username, avatarURL, time.Now().Unix())
	if errors.Is(err, domain.ErrNoRows) {
		return domain.User{}, domain.UserNotFound()
	}
	if err != nil {
		return domain.User{}, domain.Internal(err)
	}
	return user, nil
}

// EnsureAdminUser creates the bootstrap administrator when absent and otherwise
// makes sure it still holds the admin role.
func (s *AuthService) EnsureAdminUser(ctx context.Context, username, password string) error {
	exists, err := s.users.ExistsByUsername(ctx, username)
	if err != nil {
		return domain.Internal(err)
	}

	if exists {
		if err := s.users.EnsureAdminRole(ctx, username); err != nil {
			return domain.Internal(err)
		}
		return nil
	}

	hash, err := auth.HashPassword(password)
	if err != nil {
		return err
	}
	if _, err := s.users.Create(ctx, username, hash, domain.RoleAdmin, false, time.Now().Unix()); err != nil {
		return domain.Internal(err)
	}
	return nil
}

func (s *AuthService) issueTokens(user domain.User) (*Tokens, error) {
	accessToken, err := auth.Sign(
		s.jwtSecret, user.ID.String(), user.Role, user.MustChangePassword, accessTokenTTL)
	if err != nil {
		return nil, err
	}
	refreshToken, err := auth.Sign(
		s.jwtSecret, user.ID.String(), user.Role, user.MustChangePassword, refreshTokenTTL)
	if err != nil {
		return nil, err
	}
	return &Tokens{AccessToken: accessToken, RefreshToken: refreshToken}, nil
}
