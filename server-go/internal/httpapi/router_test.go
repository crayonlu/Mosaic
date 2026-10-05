package httpapi

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/google/uuid"

	"github.com/crayonlu/mosaic/server-go/internal/auth"
	"github.com/crayonlu/mosaic/server-go/internal/domain"
	"github.com/crayonlu/mosaic/server-go/internal/service"
)

const (
	routerSecret   = "router-secret"
	currentPasskey = "current-password"
)

// TestAuthFlowThroughRouter exercises the whole HTTP stack: routing, the
// middleware scopes, request decoding, and response encoding.
func TestAuthFlowThroughRouter(t *testing.T) {
	stub := newStubAuth(t)
	router := New(Deps{Auth: stub, JWTSecret: routerSecret})

	// 1. The bootstrap account starts with a password change pending.
	login := postJSON(t, router, "/api/auth/login",
		`{"username":"alice","password":"`+currentPasskey+`"}`, "")
	if login.Code != http.StatusOK {
		t.Fatalf("login status = %d, want 200 (body %s)", login.Code, login.Body)
	}

	var loggedIn loginResponse
	decodeBody(t, login, &loggedIn)
	if loggedIn.AccessToken == "" || loggedIn.RefreshToken == "" {
		t.Fatal("login did not return both tokens")
	}
	if !loggedIn.MustChangePassword {
		t.Error("login response should report the pending password change")
	}
	if loggedIn.User.Username != "alice" || loggedIn.User.Role != domain.RoleUser {
		t.Errorf("unexpected user payload: %+v", loggedIn.User)
	}

	pending := loggedIn.AccessToken

	// 2. A pending account can read itself and change its password.
	if rec := getWithToken(t, router, "/api/auth/me", pending); rec.Code != http.StatusOK {
		t.Errorf("GET /me while pending = %d, want 200 (body %s)", rec.Code, rec.Body)
	}

	// 3. A pending account is blocked from the rest of the API surface.
	blocked := putJSON(t, router, "/api/auth/update-user", `{"username":"bob"}`, pending)
	if blocked.Code != http.StatusForbidden {
		t.Fatalf("update-user while pending = %d, want 403", blocked.Code)
	}
	if got, want := blocked.Body.String(), "Password change required before accessing this resource"; got != want {
		t.Errorf("body = %q, want %q", got, want)
	}

	// 4. Changing the password returns tokens that carry the resolved flag.
	changed := postJSON(t, router, "/api/auth/change-password",
		`{"oldPassword":"`+currentPasskey+`","newPassword":"replacement-password"}`, pending)
	if changed.Code != http.StatusOK {
		t.Fatalf("change-password = %d, want 200 (body %s)", changed.Code, changed.Body)
	}

	var tokens refreshTokenResponse
	decodeBody(t, changed, &tokens)

	claims, err := auth.Verify(routerSecret, tokens.AccessToken)
	if err != nil {
		t.Fatalf("changed token does not verify: %v", err)
	}
	if claims.MustChangePassword {
		t.Error("changed token still requires a password change")
	}

	// 5. The same endpoint now succeeds with the refreshed token.
	updated := putJSON(t, router, "/api/auth/update-user", `{"username":"bob"}`, tokens.AccessToken)
	if updated.Code != http.StatusOK {
		t.Fatalf("update-user after change = %d, want 200 (body %s)", updated.Code, updated.Body)
	}

	var user userResponse
	decodeBody(t, updated, &user)
	if user.Username != "bob" {
		t.Errorf("username = %q, want %q", user.Username, "bob")
	}
}

func TestHealthEndpoint(t *testing.T) {
	router := New(Deps{Auth: newStubAuth(t), JWTSecret: routerSecret})

	rec := httptest.NewRecorder()
	router.ServeHTTP(rec, httptest.NewRequest(http.MethodGet, "/health", nil))

	if rec.Code != http.StatusOK {
		t.Fatalf("status = %d, want 200", rec.Code)
	}

	var body healthResponse
	decodeBody(t, rec, &body)
	if body.Status != "ok" {
		t.Errorf("status field = %q, want %q", body.Status, "ok")
	}
}

func TestLoginRejections(t *testing.T) {
	stub := newStubAuth(t)
	router := New(Deps{Auth: stub, JWTSecret: routerSecret})

	cases := []struct {
		name        string
		body        string
		wantStatus  int
		wantMessage string
	}{
		{
			name:        "wrong password",
			body:        `{"username":"alice","password":"wrong"}`,
			wantStatus:  http.StatusUnauthorized,
			wantMessage: "Authentication failed",
		},
		{
			name:        "malformed json",
			body:        `{"username":`,
			wantStatus:  http.StatusBadRequest,
			wantMessage: "Invalid input: Malformed JSON body",
		},
		{
			name:        "missing password",
			body:        `{"username":"alice"}`,
			wantStatus:  http.StatusBadRequest,
			wantMessage: "Invalid input: password is required",
		},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			stub.loginErr = nil
			if tc.name == "wrong password" {
				stub.loginErr = domain.Unauthorized()
			}

			rec := postJSON(t, router, "/api/auth/login", tc.body, "")
			if rec.Code != tc.wantStatus {
				t.Fatalf("status = %d, want %d (body %s)", rec.Code, tc.wantStatus, rec.Body)
			}

			var body errorBody
			decodeBody(t, rec, &body)
			if body.Message != tc.wantMessage {
				t.Errorf("message = %q, want %q", body.Message, tc.wantMessage)
			}
		})
	}
}

func TestProtectedRoutesWithoutToken(t *testing.T) {
	router := New(Deps{Auth: newStubAuth(t), JWTSecret: routerSecret})

	cases := []struct{ method, path string }{
		{http.MethodGet, "/api/auth/me"},
		{http.MethodPost, "/api/auth/change-password"},
		{http.MethodPut, "/api/auth/update-user"},
		{http.MethodPost, "/api/auth/update-avatar"},
	}

	for _, tc := range cases {
		rec := httptest.NewRecorder()
		router.ServeHTTP(rec, httptest.NewRequest(tc.method, tc.path, nil))

		if rec.Code != http.StatusUnauthorized {
			t.Errorf("%s %s status = %d, want 401", tc.method, tc.path, rec.Code)
		}
		if got, want := rec.Body.String(), "Unauthorized"; got != want {
			t.Errorf("%s %s body = %q, want %q", tc.method, tc.path, got, want)
		}
		if got, want := rec.Header().Get("Content-Type"), "text/plain; charset=utf-8"; got != want {
			t.Errorf("%s %s Content-Type = %q, want %q", tc.method, tc.path, got, want)
		}
	}
}

// A wrong method on an authenticated path is answered by the auth middleware,
// which runs before the method is considered — the order the previous server's
// Actix middleware chain produced.
func TestWrongMethodInsideAnAuthenticatedScopeIs401(t *testing.T) {
	router := New(Deps{Auth: newStubAuth(t), JWTSecret: routerSecret})

	rec := httptest.NewRecorder()
	router.ServeHTTP(rec, httptest.NewRequest(http.MethodGet, "/api/auth/change-password", nil))

	if rec.Code != http.StatusUnauthorized {
		t.Errorf("status = %d, want 401 (the middleware runs before the method check)", rec.Code)
	}
}

// With a valid token, the same request is answered by the router with 405.
func TestWrongMethodWithAValidTokenIs405(t *testing.T) {
	stub := newStubAuth(t)
	router := New(Deps{Auth: stub, JWTSecret: routerSecret})

	token, err := auth.Sign(routerSecret, uuid.New().String(), domain.RoleUser, false, time.Hour)
	if err != nil {
		t.Fatalf("Sign: %v", err)
	}

	rec := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodGet, "/api/auth/change-password", nil)
	req.Header.Set("Authorization", "Bearer "+token)
	router.ServeHTTP(rec, req)

	if rec.Code != http.StatusMethodNotAllowed {
		t.Errorf("status = %d, want 405", rec.Code)
	}
	if got, want := rec.Header().Get("Allow"), http.MethodPost; got != want {
		t.Errorf("Allow = %q, want %q", got, want)
	}
}

func TestUnknownRoute(t *testing.T) {
	router := New(Deps{Auth: newStubAuth(t), JWTSecret: routerSecret})

	rec := httptest.NewRecorder()
	router.ServeHTTP(rec, httptest.NewRequest(http.MethodGet, "/api/not-a-route", nil))

	// The /api scope's auth middleware runs before route matching, so an
	// unauthenticated caller sees 401 rather than 404 — the same order the
	// previous server's Actix middleware produced.
	if rec.Code != http.StatusUnauthorized {
		t.Errorf("status = %d, want 401", rec.Code)
	}
}

func TestUnknownRouteOutsideTheAPIScope(t *testing.T) {
	router := New(Deps{Auth: newStubAuth(t), JWTSecret: routerSecret})

	rec := httptest.NewRecorder()
	router.ServeHTTP(rec, httptest.NewRequest(http.MethodGet, "/not-a-route", nil))

	if rec.Code != http.StatusNotFound {
		t.Errorf("status = %d, want 404", rec.Code)
	}
}

func TestCORSPreflight(t *testing.T) {
	router := New(Deps{
		Auth:           newStubAuth(t),
		JWTSecret:      routerSecret,
		AllowedOrigins: []string{"https://app.example.com"},
	})

	req := httptest.NewRequest(http.MethodOptions, "/api/auth/login", nil)
	req.Header.Set("Origin", "https://app.example.com")
	req.Header.Set("Access-Control-Request-Method", "POST")

	rec := httptest.NewRecorder()
	router.ServeHTTP(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("preflight status = %d, want 200", rec.Code)
	}
	if got := rec.Header().Get("Access-Control-Allow-Origin"); got != "https://app.example.com" {
		t.Errorf("Allow-Origin = %q", got)
	}
	if got := rec.Header().Get("Access-Control-Allow-Credentials"); got != "true" {
		t.Errorf("Allow-Credentials = %q, want true", got)
	}
}

func TestCORSRejectsUnlistedOrigin(t *testing.T) {
	router := New(Deps{
		Auth:           newStubAuth(t),
		JWTSecret:      routerSecret,
		AllowedOrigins: []string{"https://app.example.com"},
	})

	req := httptest.NewRequest(http.MethodGet, "/health", nil)
	req.Header.Set("Origin", "https://evil.example.com")

	rec := httptest.NewRecorder()
	router.ServeHTTP(rec, req)

	if got := rec.Header().Get("Access-Control-Allow-Origin"); got != "" {
		t.Errorf("Allow-Origin = %q, want it absent for an unlisted origin", got)
	}
}

func postJSON(t *testing.T, handler http.Handler, path, body, token string) *httptest.ResponseRecorder {
	t.Helper()
	return doJSON(t, handler, http.MethodPost, path, body, token)
}

func putJSON(t *testing.T, handler http.Handler, path, body, token string) *httptest.ResponseRecorder {
	t.Helper()
	return doJSON(t, handler, http.MethodPut, path, body, token)
}

func doJSON(
	t *testing.T,
	handler http.Handler,
	method, path, body, token string,
) *httptest.ResponseRecorder {
	t.Helper()

	req := httptest.NewRequest(method, path, strings.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	if token != "" {
		req.Header.Set("Authorization", "Bearer "+token)
	}

	rec := httptest.NewRecorder()
	handler.ServeHTTP(rec, req)
	return rec
}

func getWithToken(t *testing.T, handler http.Handler, path, token string) *httptest.ResponseRecorder {
	t.Helper()

	req := httptest.NewRequest(http.MethodGet, path, nil)
	req.Header.Set("Authorization", "Bearer "+token)

	rec := httptest.NewRecorder()
	handler.ServeHTTP(rec, req)
	return rec
}

func decodeBody(t *testing.T, rec *httptest.ResponseRecorder, dst any) {
	t.Helper()
	if err := json.Unmarshal(rec.Body.Bytes(), dst); err != nil {
		t.Fatalf("decoding %q into %T: %v", rec.Body.String(), dst, err)
	}
}

// stubAuth is an in-memory AuthService.
type stubAuth struct {
	user     domain.User
	loginErr error
}

func newStubAuth(t *testing.T) *stubAuth {
	t.Helper()
	now := time.Now().Unix()
	return &stubAuth{user: domain.User{
		ID:                 uuid.New(),
		Username:           "alice",
		Role:               domain.RoleUser,
		MustChangePassword: true,
		IsActive:           true,
		CreatedAt:          now,
		UpdatedAt:          now,
	}}
}

func (s *stubAuth) Login(_ context.Context, username, password string) (*service.LoginResult, error) {
	if s.loginErr != nil {
		return nil, s.loginErr
	}
	if username != s.user.Username || password != currentPasskey {
		return nil, domain.Unauthorized()
	}

	tokens, err := s.issueTokens()
	if err != nil {
		return nil, err
	}
	return &service.LoginResult{
		Tokens:             *tokens,
		User:               s.user,
		MustChangePassword: s.user.MustChangePassword,
	}, nil
}

func (s *stubAuth) Refresh(_ context.Context, _ string) (*service.Tokens, error) {
	return s.issueTokens()
}

func (s *stubAuth) CurrentUser(_ context.Context, userID string) (domain.User, error) {
	if userID != s.user.ID.String() {
		return domain.User{}, domain.UserNotFound()
	}
	return s.user, nil
}

func (s *stubAuth) ChangePassword(
	_ context.Context,
	userID, oldPassword, newPassword string,
) (*service.Tokens, error) {
	if userID != s.user.ID.String() {
		return nil, domain.UserNotFound()
	}
	if oldPassword != currentPasskey {
		return nil, domain.Unauthorized()
	}
	if len(newPassword) < domain.MinimumPasswordLength {
		return nil, domain.InvalidInput("Password must be at least 8 characters")
	}

	s.user.MustChangePassword = false
	return s.issueTokens()
}

func (s *stubAuth) UpdateAvatar(_ context.Context, userID, avatarURL string) (domain.User, error) {
	if userID != s.user.ID.String() {
		return domain.User{}, domain.UserNotFound()
	}
	s.user.AvatarURL = &avatarURL
	return s.user, nil
}

func (s *stubAuth) UpdateProfile(
	_ context.Context,
	userID string,
	username, avatarURL *string,
) (domain.User, error) {
	if userID != s.user.ID.String() {
		return domain.User{}, domain.UserNotFound()
	}
	if username != nil {
		s.user.Username = *username
	}
	if avatarURL != nil {
		s.user.AvatarURL = avatarURL
	}
	return s.user, nil
}

func (s *stubAuth) issueTokens() (*service.Tokens, error) {
	accessToken, err := auth.Sign(
		routerSecret, s.user.ID.String(), s.user.Role, s.user.MustChangePassword, time.Hour)
	if err != nil {
		return nil, err
	}
	refreshToken, err := auth.Sign(
		routerSecret, s.user.ID.String(), s.user.Role, s.user.MustChangePassword, 24*time.Hour)
	if err != nil {
		return nil, err
	}
	return &service.Tokens{AccessToken: accessToken, RefreshToken: refreshToken}, nil
}
