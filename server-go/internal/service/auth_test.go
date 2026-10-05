package service

import (
	"context"
	"testing"
	"time"

	"github.com/google/uuid"

	"github.com/crayonlu/mosaic/server-go/internal/auth"
	"github.com/crayonlu/mosaic/server-go/internal/domain"
)

const testSecret = "service-secret"

func TestLoginIssuesUsableTokens(t *testing.T) {
	user := newUser(t, "alice", "correct-horse", domain.RoleUser, true)
	authService := NewAuthService(newFakeUserStore(user), testSecret)

	result, err := authService.Login(context.Background(), "alice", "correct-horse")
	if err != nil {
		t.Fatalf("Login: %v", err)
	}
	if result.User.ID != user.ID {
		t.Errorf("user id = %s, want %s", result.User.ID, user.ID)
	}

	claims, err := auth.Verify(testSecret, result.AccessToken)
	if err != nil {
		t.Fatalf("access token does not verify: %v", err)
	}
	if claims.Subject != user.ID.String() {
		t.Errorf("subject = %q, want %q", claims.Subject, user.ID.String())
	}

	refreshClaims, err := auth.Verify(testSecret, result.RefreshToken)
	if err != nil {
		t.Fatalf("refresh token does not verify: %v", err)
	}
	if refreshClaims.ExpiresAt <= claims.ExpiresAt {
		t.Error("refresh token should outlive the access token")
	}
}

func TestLoginFailures(t *testing.T) {
	inactive := newUser(t, "dormant", "correct-horse", domain.RoleUser, false)
	authService := NewAuthService(
		newFakeUserStore(newUser(t, "alice", "correct-horse", domain.RoleUser, true), inactive),
		testSecret,
	)

	cases := []struct {
		name     string
		username string
		password string
		wantKind domain.Kind
	}{
		{name: "unknown user", username: "nobody", password: "whatever", wantKind: domain.KindUnauthorized},
		{name: "wrong password", username: "alice", password: "wrong", wantKind: domain.KindUnauthorized},
		{name: "disabled account", username: "dormant", password: "correct-horse", wantKind: domain.KindForbidden},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			_, err := authService.Login(context.Background(), tc.username, tc.password)
			assertKind(t, err, tc.wantKind)
		})
	}
}

func TestRefreshRejectsAccessTokenSignedByAnotherSecret(t *testing.T) {
	user := newUser(t, "alice", "correct-horse", domain.RoleUser, true)
	authService := NewAuthService(newFakeUserStore(user), testSecret)

	foreign, err := auth.Sign("some-other-secret", user.ID.String(), domain.RoleUser, false, time.Hour)
	if err != nil {
		t.Fatalf("Sign: %v", err)
	}

	_, err = authService.Refresh(context.Background(), foreign)
	assertKind(t, err, domain.KindInvalidToken)
}

func TestRefreshIssuesNewTokens(t *testing.T) {
	user := newUser(t, "alice", "correct-horse", domain.RoleUser, true)
	authService := NewAuthService(newFakeUserStore(user), testSecret)

	tokens, err := authService.Refresh(context.Background(), mustSign(t, user, time.Hour))
	if err != nil {
		t.Fatalf("Refresh: %v", err)
	}
	if _, err := auth.Verify(testSecret, tokens.AccessToken); err != nil {
		t.Errorf("refreshed access token does not verify: %v", err)
	}
}

func TestChangePassword(t *testing.T) {
	user := newUser(t, "alice", "old-password", domain.RoleUser, true)
	user.MustChangePassword = true
	users := newFakeUserStore(user)
	authService := NewAuthService(users, testSecret)

	tokens, err := authService.ChangePassword(
		context.Background(), user.ID.String(), "old-password", "new-password")
	if err != nil {
		t.Fatalf("ChangePassword: %v", err)
	}

	if !auth.VerifyPassword(users.password[user.ID], "new-password") {
		t.Error("stored hash does not match the new password")
	}

	claims, err := auth.Verify(testSecret, tokens.AccessToken)
	if err != nil {
		t.Fatalf("issued token does not verify: %v", err)
	}
	if claims.MustChangePassword {
		t.Error("issued token should no longer require a password change")
	}
}

func TestChangePasswordFailures(t *testing.T) {
	user := newUser(t, "alice", "old-password", domain.RoleUser, true)
	authService := NewAuthService(newFakeUserStore(user), testSecret)

	cases := []struct {
		name        string
		oldPassword string
		newPassword string
		wantKind    domain.Kind
	}{
		{
			name:        "wrong current password",
			oldPassword: "not-it",
			newPassword: "new-password",
			wantKind:    domain.KindUnauthorized,
		},
		{
			name:        "new password too short",
			oldPassword: "old-password",
			newPassword: "short",
			wantKind:    domain.KindInvalidInput,
		},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			_, err := authService.ChangePassword(
				context.Background(), user.ID.String(), tc.oldPassword, tc.newPassword)
			assertKind(t, err, tc.wantKind)
		})
	}
}

func TestEnsureAdminUser(t *testing.T) {
	t.Run("creates a missing account", func(t *testing.T) {
		users := newFakeUserStore()
		authService := NewAuthService(users, testSecret)

		if err := authService.EnsureAdminUser(context.Background(), "root", "bootstrap-password"); err != nil {
			t.Fatalf("EnsureAdminUser: %v", err)
		}

		created, ok := users.byUsername["root"]
		if !ok {
			t.Fatal("admin account was not created")
		}
		if created.Role != domain.RoleAdmin {
			t.Errorf("role = %q, want %q", created.Role, domain.RoleAdmin)
		}
		if created.MustChangePassword {
			t.Error("bootstrap account should not require a password change")
		}
	})

	t.Run("promotes an existing account", func(t *testing.T) {
		users := newFakeUserStore(newUser(t, "root", "bootstrap-password", domain.RoleUser, true))
		authService := NewAuthService(users, testSecret)

		if err := authService.EnsureAdminUser(context.Background(), "root", "bootstrap-password"); err != nil {
			t.Fatalf("EnsureAdminUser: %v", err)
		}

		if got := users.byUsername["root"].Role; got != domain.RoleAdmin {
			t.Errorf("role = %q, want %q", got, domain.RoleAdmin)
		}
	})
}

func assertKind(t *testing.T, err error, want domain.Kind) {
	t.Helper()
	domainErr, ok := err.(*domain.Error)
	if !ok {
		t.Fatalf("error = %v, want a *domain.Error", err)
	}
	if domainErr.Kind != want {
		t.Fatalf("error kind = %v, want %v", domainErr.Kind, want)
	}
}

func mustSign(t *testing.T, user domain.User, ttl time.Duration) string {
	t.Helper()
	token, err := auth.Sign(testSecret, user.ID.String(), user.Role, user.MustChangePassword, ttl)
	if err != nil {
		t.Fatalf("Sign: %v", err)
	}
	return token
}

func newUser(t *testing.T, username, password, role string, active bool) domain.User {
	t.Helper()
	hash, err := auth.HashPassword(password)
	if err != nil {
		t.Fatalf("HashPassword: %v", err)
	}
	now := time.Now().Unix()
	return domain.User{
		ID:           uuid.New(),
		Username:     username,
		PasswordHash: hash,
		Role:         role,
		IsActive:     active,
		CreatedAt:    now,
		UpdatedAt:    now,
	}
}

// fakeUserStore is an in-memory UserStore.
type fakeUserStore struct {
	byUsername map[string]domain.User
	password   map[uuid.UUID]string
}

func newFakeUserStore(users ...domain.User) *fakeUserStore {
	store := &fakeUserStore{
		byUsername: make(map[string]domain.User, len(users)),
		password:   make(map[uuid.UUID]string, len(users)),
	}
	for _, user := range users {
		store.byUsername[user.Username] = user
		store.password[user.ID] = user.PasswordHash
	}
	return store
}

func (f *fakeUserStore) ByUsername(_ context.Context, username string) (domain.User, error) {
	user, ok := f.byUsername[username]
	if !ok {
		return domain.User{}, domain.ErrNoRows
	}
	return user, nil
}

func (f *fakeUserStore) ByID(_ context.Context, id uuid.UUID) (domain.User, error) {
	for _, user := range f.byUsername {
		if user.ID == id {
			return user, nil
		}
	}
	return domain.User{}, domain.ErrNoRows
}

func (f *fakeUserStore) ExistsByUsername(_ context.Context, username string) (bool, error) {
	_, ok := f.byUsername[username]
	return ok, nil
}

func (f *fakeUserStore) Create(
	_ context.Context,
	username, passwordHash, role string,
	mustChangePassword bool,
	now int64,
) (domain.User, error) {
	user := domain.User{
		ID:                 uuid.New(),
		Username:           username,
		PasswordHash:       passwordHash,
		Role:               role,
		MustChangePassword: mustChangePassword,
		IsActive:           true,
		CreatedAt:          now,
		UpdatedAt:          now,
	}
	f.byUsername[username] = user
	f.password[user.ID] = passwordHash
	return user, nil
}

func (f *fakeUserStore) SetPassword(_ context.Context, id uuid.UUID, hash string, now int64) error {
	user, err := f.ByID(context.Background(), id)
	if err != nil {
		return err
	}
	f.password[id] = hash
	user.PasswordHash = hash
	user.MustChangePassword = false
	user.UpdatedAt = now
	f.byUsername[user.Username] = user
	return nil
}

func (f *fakeUserStore) SetAvatar(_ context.Context, id uuid.UUID, avatarURL string, now int64) (domain.User, error) {
	user, err := f.ByID(context.Background(), id)
	if err != nil {
		return domain.User{}, err
	}
	user.AvatarURL = &avatarURL
	user.UpdatedAt = now
	f.byUsername[user.Username] = user
	return user, nil
}

func (f *fakeUserStore) SetProfile(
	_ context.Context,
	id uuid.UUID,
	username, avatarURL *string,
	now int64,
) (domain.User, error) {
	user, err := f.ByID(context.Background(), id)
	if err != nil {
		return domain.User{}, err
	}
	if username != nil {
		delete(f.byUsername, user.Username)
		user.Username = *username
	}
	if avatarURL != nil {
		user.AvatarURL = avatarURL
	}
	user.UpdatedAt = now
	f.byUsername[user.Username] = user
	return user, nil
}

func (f *fakeUserStore) EnsureAdminRole(_ context.Context, username string) error {
	user, ok := f.byUsername[username]
	if !ok {
		return domain.ErrNoRows
	}
	user.Role = domain.RoleAdmin
	f.byUsername[username] = user
	return nil
}
