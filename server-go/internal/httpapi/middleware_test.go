package httpapi

import (
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/crayonlu/mosaic/server-go/internal/auth"
	"github.com/crayonlu/mosaic/server-go/internal/domain"
)

const middlewareSecret = "middleware-secret"

// Middleware rejections kept the previous server's plain text bodies, so these
// tests pin the body and content type rather than a JSON envelope.
func TestRequireAuthRejectionsArePlainText(t *testing.T) {
	cases := []struct {
		name       string
		authHeader string
		wantBody   string
	}{
		{name: "missing header", authHeader: "", wantBody: "Unauthorized"},
		{name: "missing bearer prefix", authHeader: "token-without-scheme", wantBody: "Unauthorized"},
		{name: "malformed token", authHeader: "Bearer not-a-jwt", wantBody: domain.InvalidToken().Message},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			handler := RequireAuth(middlewareSecret)(mustNotRun(t))

			req := httptest.NewRequest(http.MethodGet, "/api/auth/me", nil)
			if tc.authHeader != "" {
				req.Header.Set("Authorization", tc.authHeader)
			}

			rec := httptest.NewRecorder()
			handler.ServeHTTP(rec, req)

			if rec.Code != http.StatusUnauthorized {
				t.Errorf("status = %d, want %d", rec.Code, http.StatusUnauthorized)
			}
			if got := rec.Body.String(); got != tc.wantBody {
				t.Errorf("body = %q, want %q", got, tc.wantBody)
			}
			if got := rec.Header().Get("Content-Type"); got != "text/plain; charset=utf-8" {
				t.Errorf("Content-Type = %q, want text/plain; charset=utf-8", got)
			}
		})
	}
}

func TestRequireAuthAttachesClaims(t *testing.T) {
	token, err := auth.Sign(middlewareSecret, "user-1", domain.RoleUser, false, time.Hour)
	if err != nil {
		t.Fatalf("Sign: %v", err)
	}

	var subject string
	handler := RequireAuth(middlewareSecret)(http.HandlerFunc(func(_ http.ResponseWriter, r *http.Request) {
		claims, ok := ClaimsFrom(r.Context())
		if !ok {
			t.Fatal("claims missing from context")
		}
		subject = claims.Subject
	}))

	req := httptest.NewRequest(http.MethodGet, "/api/auth/me", nil)
	req.Header.Set("Authorization", "Bearer "+token)

	handler.ServeHTTP(httptest.NewRecorder(), req)

	if subject != "user-1" {
		t.Errorf("subject = %q, want %q", subject, "user-1")
	}
}

func TestRequirePasswordChanged(t *testing.T) {
	cases := []struct {
		name     string
		pending  bool
		wantCode int
		wantBody string
	}{
		{
			name:     "pending",
			pending:  true,
			wantCode: http.StatusForbidden,
			wantBody: "Password change required before accessing this resource",
		},
		{name: "resolved", pending: false, wantCode: http.StatusOK},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			token, err := auth.Sign(middlewareSecret, "user-1", domain.RoleUser, tc.pending, time.Hour)
			if err != nil {
				t.Fatalf("Sign: %v", err)
			}

			rec := httptest.NewRecorder()
			RequireAuth(middlewareSecret)(
				RequirePasswordChanged()(
					http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
						w.WriteHeader(http.StatusOK)
					}),
				),
			).ServeHTTP(rec, authedRequest(token))

			if rec.Code != tc.wantCode {
				t.Errorf("status = %d, want %d", rec.Code, tc.wantCode)
			}
			if tc.wantBody != "" && rec.Body.String() != tc.wantBody {
				t.Errorf("body = %q, want %q", rec.Body.String(), tc.wantBody)
			}
		})
	}
}

func TestRequirePasswordChangedWithoutClaims(t *testing.T) {
	rec := httptest.NewRecorder()
	RequirePasswordChanged()(mustNotRun(t)).
		ServeHTTP(rec, httptest.NewRequest(http.MethodGet, "/api/memos", nil))

	if rec.Code != http.StatusForbidden {
		t.Fatalf("status = %d, want %d", rec.Code, http.StatusForbidden)
	}
	if got, want := rec.Body.String(), "Authentication required before accessing this resource"; got != want {
		t.Errorf("body = %q, want %q", got, want)
	}
}

func TestRequireAdmin(t *testing.T) {
	cases := []struct {
		name     string
		role     string
		wantCode int
	}{
		{name: "admin", role: domain.RoleAdmin, wantCode: http.StatusOK},
		{name: "regular user", role: domain.RoleUser, wantCode: http.StatusForbidden},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			token, err := auth.Sign(middlewareSecret, "user-1", tc.role, false, time.Hour)
			if err != nil {
				t.Fatalf("Sign: %v", err)
			}

			rec := httptest.NewRecorder()
			RequireAuth(middlewareSecret)(RequireAdmin()(
				http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
					w.WriteHeader(http.StatusOK)
				}),
			)).ServeHTTP(rec, authedRequest(token))

			if rec.Code != tc.wantCode {
				t.Errorf("status = %d, want %d", rec.Code, tc.wantCode)
			}
		})
	}
}

func TestRequireAdminRejectsMissingClaims(t *testing.T) {
	rec := httptest.NewRecorder()
	RequireAdmin()(mustNotRun(t)).
		ServeHTTP(rec, httptest.NewRequest(http.MethodGet, "/admin/api/stats", nil))

	if rec.Code != http.StatusForbidden {
		t.Fatalf("status = %d, want %d", rec.Code, http.StatusForbidden)
	}
	if got, want := rec.Body.String(), "Admin access required"; got != want {
		t.Errorf("body = %q, want %q", got, want)
	}
}

func authedRequest(token string) *http.Request {
	req := httptest.NewRequest(http.MethodGet, "/api/memos", nil)
	req.Header.Set("Authorization", "Bearer "+token)
	return req
}

func mustNotRun(t *testing.T) http.HandlerFunc {
	t.Helper()
	return func(http.ResponseWriter, *http.Request) {
		t.Error("next handler ran but the request should have been rejected")
	}
}
