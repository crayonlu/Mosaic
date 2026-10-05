package httpapi

import (
	"fmt"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/google/uuid"

	"github.com/crayonlu/mosaic/server-go/internal/auth"
	"github.com/crayonlu/mosaic/server-go/internal/domain"
)

// expectation is what one credential should get on one endpoint.
type expectation struct {
	// allowed means the request must reach the handler: it is neither rejected
	// by the auth middleware nor lost to the router.
	allowed bool
	// status is the exact rejection status when allowed is false.
	status int
}

// matrixFor returns the required outcome for a scope and credential.
//
// The four credentials model the whole authorisation surface:
//
//	anonymous        no Authorization header at all
//	pendingPassword  a valid token whose account must change its password
//	user             a valid token for an ordinary active account
//	admin            a valid token for an administrator
//
// A pending account can still reach the two auth endpoints that resolve its
// state, which is why those sit in scopeToken rather than scopePasswordChanged.
func matrixFor(s scope, credential string) expectation {
	rejected := func(status int) expectation { return expectation{status: status} }
	reachable := expectation{allowed: true}

	switch credential {
	case "anonymous":
		if s == scopePublic {
			return reachable
		}
		return rejected(http.StatusUnauthorized)
	case "pendingPassword":
		if s == scopePasswordChanged || s == scopeAdmin {
			return rejected(http.StatusForbidden)
		}
		return reachable
	case "user":
		if s == scopeAdmin {
			return rejected(http.StatusForbidden)
		}
		return reachable
	case "admin":
		return reachable
	default:
		panic("unknown credential " + credential)
	}
}

// TestAuthorizationMatrix walks every endpoint in the contract against every
// credential, so a route that is missing a guard — or that has one too many —
// fails loudly instead of being discovered in production.
func TestAuthorizationMatrix(t *testing.T) {
	server := newContractServer(t)

	credentials := []struct {
		name  string
		token func() string
	}{
		{"anonymous", func() string { return "" }},
		{"pendingPassword", func() string { return server.pendingToken }},
		{"user", func() string { return server.userToken }},
		{"admin", func() string { return server.adminToken }},
	}

	violations := 0
	for _, route := range contractRoutes() {
		for _, credential := range credentials {
			want := matrixFor(route.scope, credential.name)

			rec := doJSON(t, server.handler, route.method, route.path, route.body, credential.token())
			got, detail := classify(rec)

			switch {
			case want.allowed && !got.allowed:
				violations++
				t.Errorf("%s %s: %s should reach the handler but was rejected (%s)",
					route.method, route.path, credential.name, detail)
			case !want.allowed && got.allowed:
				violations++
				t.Errorf("%s %s: %s should be rejected with %d but reached the handler (%s)",
					route.method, route.path, credential.name, want.status, detail)
			case !want.allowed && got.status != want.status:
				violations++
				t.Errorf("%s %s: %s rejected with %d, want %d",
					route.method, route.path, credential.name, got.status, want.status)
			}
		}
	}

	t.Logf("checked %d endpoints against %d credentials (%d requests); %d violations",
		len(contractRoutes()), len(credentials),
		len(contractRoutes())*len(credentials), violations)
}

// classify reports whether a response reached a handler, or was rejected by the
// auth middleware, together with the status and a short description.
//
// A 401 or 403 only means the middleware intervened when the body is plain
// text. Handlers answer the same statuses with the JSON envelope — a login with
// wrong credentials, for instance — and those count as reaching the handler.
func classify(rec *httptest.ResponseRecorder) (expectation, string) {
	if isRouterMiss(rec) {
		return expectation{allowed: false, status: http.StatusNotFound},
			"router has no such route"
	}

	rejected := rec.Code == http.StatusUnauthorized || rec.Code == http.StatusForbidden
	jsonBody := strings.HasPrefix(rec.Header().Get("Content-Type"), "application/json")

	if rejected && !jsonBody {
		return expectation{allowed: false, status: rec.Code},
			fmt.Sprintf("middleware HTTP %d %q", rec.Code, strings.TrimSpace(rec.Body.String()))
	}
	return expectation{allowed: true}, fmt.Sprintf("handler HTTP %d", rec.Code)
}

// TestRejectionsUseTheMiddlewareBodyShape pins the body of every auth
// rejection: the previous server's middleware answered in plain text, unlike
// the JSON envelope handlers use.
func TestRejectionsUseTheMiddlewareBodyShape(t *testing.T) {
	server := newContractServer(t)

	for _, route := range contractRoutes() {
		if route.scope == scopePublic {
			continue
		}

		rec := doJSON(t, server.handler, route.method, route.path, route.body, "")
		if rec.Code != http.StatusUnauthorized {
			continue
		}

		if got := rec.Header().Get("Content-Type"); got != "text/plain; charset=utf-8" {
			t.Errorf("%s %s: anonymous rejection Content-Type = %q, want plain text",
				route.method, route.path, got)
		}
		if strings.HasPrefix(rec.Body.String(), "{") {
			t.Errorf("%s %s: anonymous rejection used the JSON envelope: %q",
				route.method, route.path, rec.Body.String())
		}
	}
}

// TestPendingPasswordRejectionsArePlainText covers the second middleware's body.
func TestPendingPasswordRejectionsArePlainText(t *testing.T) {
	server := newContractServer(t)

	var seen int
	for _, route := range contractRoutes() {
		if route.scope != scopePasswordChanged {
			continue
		}

		rec := doJSON(t, server.handler, route.method, route.path, route.body, server.pendingToken)
		if rec.Code != http.StatusForbidden {
			t.Errorf("%s %s: pending token = %d, want 403", route.method, route.path, rec.Code)
			continue
		}
		seen++

		if got := rec.Header().Get("Content-Type"); got != "text/plain; charset=utf-8" {
			t.Errorf("%s %s: pending rejection Content-Type = %q, want plain text",
				route.method, route.path, got)
		}
		if body := rec.Body.String(); body != "Password change required before accessing this resource" {
			t.Errorf("%s %s: pending rejection body = %q", route.method, route.path, body)
		}
	}

	if seen == 0 {
		t.Fatal("no password-changed routes were exercised")
	}
}

// TestAdminRejectionsArePlainText covers the admin middleware's body.
func TestAdminRejectionsArePlainText(t *testing.T) {
	server := newContractServer(t)

	var seen int
	for _, route := range contractRoutes() {
		if route.scope != scopeAdmin {
			continue
		}

		rec := doJSON(t, server.handler, route.method, route.path, route.body, server.userToken)
		if rec.Code != http.StatusForbidden {
			t.Errorf("%s %s: non-admin = %d, want 403", route.method, route.path, rec.Code)
			continue
		}
		seen++

		if body := rec.Body.String(); body != "Admin access required" {
			t.Errorf("%s %s: non-admin rejection body = %q", route.method, route.path, body)
		}
	}

	if seen == 0 {
		t.Fatal("no admin routes were exercised")
	}
}

// TestWrongMethodIsRejectedWith405 checks that a known path called with the
// wrong verb is answered by the router rather than falling through, and that
// the rejection carries the Allow header RFC 7231 requires.
func TestWrongMethodIsRejectedWith405(t *testing.T) {
	server := newContractServer(t)

	cases := []struct{ method, path, allow string }{
		// Plain method mismatches.
		{http.MethodPatch, "/api/memos", "GET, POST"},
		{http.MethodDelete, "/api/memos", "GET, POST"},
		{http.MethodPost, "/api/auth/me", "GET"},
		{http.MethodGet, "/api/sync/pull", "POST"},
		{http.MethodDelete, "/api/diaries/2026-01-02", "GET, POST, PUT"},
		{http.MethodPost, "/api/stats/summary", "GET"},
		{http.MethodPatch, "/api/bots", "GET, POST"},
		{http.MethodPost, "/api/resources", "GET"},

		// Literal paths shadowed by a parameterised sibling. Without the 405
		// shim these fall through to /memos/{id} and answer 400 instead.
		{http.MethodPut, "/api/memos/tags", "GET"},
		{http.MethodDelete, "/api/memos/tags", "GET"},
		{http.MethodPut, "/api/memos/search", "GET"},
		{http.MethodGet, "/api/memos/clip", "POST"},
		{http.MethodGet, "/api/bots/reorder", "PUT"},
		{http.MethodDelete, "/api/bots/reorder", "PUT"},
		{http.MethodGet, "/api/resources/upload", "POST"},
		{http.MethodDelete, "/api/resources/upload", "POST"},
		{http.MethodGet, "/api/resources/upload-avatar", "POST"},
	}

	for _, tc := range cases {
		rec := doJSON(t, server.handler, tc.method, tc.path, "", server.adminToken)

		if rec.Code != http.StatusMethodNotAllowed {
			t.Errorf("%s %s = %d, want 405 (body %q)",
				tc.method, tc.path, rec.Code, strings.TrimSpace(rec.Body.String()))
			continue
		}
		if got := rec.Header().Get("Allow"); got != tc.allow {
			t.Errorf("%s %s: Allow = %q, want %q", tc.method, tc.path, got, tc.allow)
		}
	}
}

// TestMethodNotAllowedIsNotAppliedToPublicPaths makes sure the 405 shim only
// covers the verbs a route does not serve, leaving the served verbs intact.
func TestMethodNotAllowedIsNotAppliedToPublicPaths(t *testing.T) {
	server := newContractServer(t)

	rec := doJSON(t, server.handler, http.MethodGet, "/api/memos/tags", "", server.adminToken)
	if rec.Code == http.StatusMethodNotAllowed {
		t.Fatalf("GET /api/memos/tags = 405; the served verb must still work")
	}

	rec = doJSON(t, server.handler, http.MethodPost, "/api/memos/clip",
		`{"url":"https://example.com"}`, server.adminToken)
	if rec.Code == http.StatusMethodNotAllowed {
		t.Fatalf("POST /api/memos/clip = 405; the served verb must still work")
	}

	rec = doJSON(t, server.handler, http.MethodPut, "/api/bots/reorder", `{"order":[]}`, server.adminToken)
	if rec.Code == http.StatusMethodNotAllowed {
		t.Fatalf("PUT /api/bots/reorder = 405; the served verb must still work")
	}
}

// TestUnknownPathsAreNotServed checks the router does not silently accept paths
// outside the contract.
func TestUnknownPathsAreNotServed(t *testing.T) {
	server := newContractServer(t)

	for _, path := range []string{
		"/api/nope", "/api/memos/nope/extra", "/admin/api/nope", "/api/bot", "/healthz",
	} {
		rec := doJSON(t, server.handler, http.MethodGet, path, "", server.adminToken)
		if rec.Code == http.StatusOK {
			t.Errorf("GET %s answered 200; it is not part of the contract", path)
		}
	}
}

// TestExpiredAndForgedTokensAreRejected closes the loop on token validation.
func TestExpiredAndForgedTokensAreRejected(t *testing.T) {
	server := newContractServer(t)

	cases := []struct{ name, token string }{
		{"garbage", "not-a-jwt"},
		{"empty bearer", "Bearer "},
		{"two segments", "aaa.bbb"},
		{"signed with another secret", forgeToken(t, "another-secret")},
		{"truncated", server.adminToken[:len(server.adminToken)-4]},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			rec := doJSON(t, server.handler, http.MethodGet, "/api/memos", "", tc.token)
			if rec.Code != http.StatusUnauthorized {
				t.Errorf("token %q = %d, want 401", tc.name, rec.Code)
			}
			if body := strings.TrimSpace(rec.Body.String()); body == "" || strings.HasPrefix(body, "{") {
				t.Errorf("rejection body = %q, want the middleware's plain text", body)
			}
		})
	}
}

// TestRoleClaimControlsTheAdminScope proves the admin gate reads the token's
// role claim rather than anything ambient.
func TestRoleClaimControlsTheAdminScope(t *testing.T) {
	server := newContractServer(t)

	rec := doJSON(t, server.handler, http.MethodGet, "/admin/api/stats", "", server.userToken)
	if rec.Code != http.StatusForbidden {
		t.Fatalf("ordinary account on the admin API = %d, want 403", rec.Code)
	}

	rec = doJSON(t, server.handler, http.MethodGet, "/admin/api/stats", "", server.adminToken)
	if rec.Code != http.StatusOK {
		t.Fatalf("administrator on the admin API = %d, want 200", rec.Code)
	}
}

// TestTheOwnersOwnPasswordGate is a guard against accidentally allowing a
// pending account through the change-password gate.
func TestTheOwnersOwnPasswordGate(t *testing.T) {
	server := newContractServer(t)

	rec := doJSON(t, server.handler, http.MethodGet, "/api/auth/me", "", server.pendingToken)
	if rec.Code == http.StatusForbidden {
		t.Error("/api/auth/me with a pending token = 403; the account must be able to inspect itself")
	}
}

// forgeToken signs a token with a secret the server does not use.
func forgeToken(t *testing.T, secret string) string {
	t.Helper()
	token, err := auth.Sign(secret, uuid.New().String(), domain.RoleAdmin, false, time.Hour)
	if err != nil {
		t.Fatalf("Sign: %v", err)
	}
	return token
}
