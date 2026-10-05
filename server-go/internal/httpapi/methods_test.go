package httpapi

import (
	"net/http"
	"net/http/httptest"
	"testing"
)

// TestHealthAnswersHead is what the container healthcheck depends on: it runs
// `wget --spider`, which sends HEAD. The previous server answered it, so a
// regression here marks a healthy container unhealthy.
func TestHealthAnswersHead(t *testing.T) {
	router := New(Deps{Auth: newStubAuth(t), JWTSecret: routerSecret})

	rec := httptest.NewRecorder()
	router.ServeHTTP(rec, httptest.NewRequest(http.MethodHead, "/health", nil))

	if rec.Code != http.StatusOK {
		t.Fatalf("HEAD /health = %d, want 200", rec.Code)
	}
	// The body is asserted on the real server rather than here: httptest
	// records what the handler writes, while the HTTP server is what discards a
	// HEAD response body.
}

// TestGetRoutesAnswerHead generalises it: every GET route should accept HEAD,
// as the previous server's router did.
func TestGetRoutesAnswerHead(t *testing.T) {
	server := newContractServer(t)

	for _, route := range contractRoutes() {
		if route.method != http.MethodGet || route.scope == scopePublic {
			continue
		}

		req := httptest.NewRequest(http.MethodHead, route.path, nil)
		req.Header.Set("Authorization", "Bearer "+server.adminToken)

		rec := httptest.NewRecorder()
		server.handler.ServeHTTP(rec, req)

		if rec.Code == http.StatusMethodNotAllowed {
			t.Errorf("HEAD %s = 405; the route serves GET and must answer HEAD", route.path)
		}
	}
}
