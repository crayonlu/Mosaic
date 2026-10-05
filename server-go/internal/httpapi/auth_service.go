package httpapi

import (
	"context"

	"github.com/crayonlu/mosaic/server-go/internal/domain"
	"github.com/crayonlu/mosaic/server-go/internal/service"
)

// AuthService is the behaviour the auth endpoints need. It is declared at the
// consumer, so handlers can be exercised without a database.
type AuthService interface {
	Login(ctx context.Context, username, password string) (*service.LoginResult, error)
	Refresh(ctx context.Context, refreshToken string) (*service.Tokens, error)
	CurrentUser(ctx context.Context, userID string) (domain.User, error)
	ChangePassword(ctx context.Context, userID, oldPassword, newPassword string) (*service.Tokens, error)
	UpdateAvatar(ctx context.Context, userID, avatarURL string) (domain.User, error)
	UpdateProfile(ctx context.Context, userID string, username, avatarURL *string) (domain.User, error)
}
