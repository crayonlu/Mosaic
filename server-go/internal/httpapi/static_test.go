package httpapi

import (
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"strings"
	"testing"

	"github.com/go-chi/chi/v5"
)

func TestAdminRedirectsToTrailingSlash(t *testing.T) {
	router := chi.NewRouter()
	registerStaticRoutes(router)

	rec := httptest.NewRecorder()
	router.ServeHTTP(rec, httptest.NewRequest(http.MethodGet, "/admin", nil))

	if rec.Code != http.StatusFound {
		t.Fatalf("status = %d, want 302", rec.Code)
	}
	if got := rec.Header().Get("Location"); got != "/admin/" {
		t.Errorf("Location = %q, want %q", got, "/admin/")
	}
}

func TestAdminFallbackReportsUnbuiltUI(t *testing.T) {
	router := chi.NewRouter()
	registerStaticRoutes(router)

	rec := httptest.NewRecorder()
	router.ServeHTTP(rec, httptest.NewRequest(http.MethodGet, "/admin/dashboard", nil))

	if rec.Code != http.StatusNotFound {
		t.Fatalf("status = %d, want 404 (body %s)", rec.Code, rec.Body)
	}
	if got, want := rec.Header().Get("Content-Type"), "application/json"; got != want {
		t.Errorf("Content-Type = %q, want %q", got, want)
	}
	if body := rec.Body.String(); !strings.Contains(body, "Admin UI not found") ||
		!strings.Contains(body, `"error"`) {
		t.Errorf("body = %q, want an explanation of the missing admin UI", body)
	}
}

func TestAdminServesSPAAndStaticAssets(t *testing.T) {
	dir := t.TempDir()
	t.Chdir(dir)

	adminDir := filepath.Join(dir, "static", "admin")
	if err := os.MkdirAll(adminDir, 0o755); err != nil {
		t.Fatalf("MkdirAll: %v", err)
	}
	if err := os.WriteFile(filepath.Join(adminDir, "index.html"),
		[]byte("<!doctype html><title>mosaic-admin</title>"), 0o644); err != nil {
		t.Fatalf("WriteFile index: %v", err)
	}
	if err := os.WriteFile(filepath.Join(adminDir, "app.js"), []byte("console.log(1)"), 0o644); err != nil {
		t.Fatalf("WriteFile asset: %v", err)
	}

	router := chi.NewRouter()
	registerStaticRoutes(router)

	rec := httptest.NewRecorder()
	router.ServeHTTP(rec, httptest.NewRequest(http.MethodGet, "/admin/dashboard", nil))
	if rec.Code != http.StatusOK {
		t.Fatalf("SPA status = %d, want 200 (body %s)", rec.Code, rec.Body)
	}
	if body := rec.Body.String(); !strings.Contains(body, "mosaic-admin") {
		t.Errorf("SPA body = %q, want the index contents", body)
	}

	rec = httptest.NewRecorder()
	router.ServeHTTP(rec, httptest.NewRequest(http.MethodGet, "/admin/static/app.js", nil))
	if rec.Code != http.StatusOK {
		t.Fatalf("asset status = %d, want 200 (body %s)", rec.Code, rec.Body)
	}
	if body := rec.Body.String(); !strings.Contains(body, "console.log") {
		t.Errorf("asset body = %q", body)
	}
}
