package httpapi

import (
	"net/http"
	"os"
	"path/filepath"

	"github.com/go-chi/chi/v5"
)

// adminStaticDir is where the admin UI build output is written, relative to the
// server's working directory. It is not embedded: the build step produces it.
const adminStaticDir = "static/admin"

// registerStaticRoutes mounts the admin UI assets at the router root, before
// any authentication. It reproduces the previous server's wiring: /admin
// redirects to /admin/, /admin/static/* serves files, and every other
// /admin/... path falls back to the SPA entry point.
func registerStaticRoutes(r chi.Router) {
	serve(r, "/admin", map[string]http.HandlerFunc{http.MethodGet: handleAdminRedirect})
	// chi's "/admin/*" does not match the bare "/admin/" path, so it is
	// registered explicitly; the previous server served it from the SPA
	// fallback.
	serve(r, "/admin/", map[string]http.HandlerFunc{http.MethodGet: handleAdminSPAFallback})
	r.Handle("/admin/static/*",
		http.StripPrefix("/admin/static/", http.FileServer(http.Dir(adminStaticDir))))
	serve(r, "/admin/*", map[string]http.HandlerFunc{http.MethodGet: handleAdminSPAFallback})
}

func handleAdminRedirect(w http.ResponseWriter, _ *http.Request) {
	w.Header().Set("Location", "/admin/")
	w.WriteHeader(http.StatusFound)
}

func handleAdminSPAFallback(w http.ResponseWriter, r *http.Request) {
	indexPath := filepath.Join(adminStaticDir, "index.html")
	file, err := os.Open(indexPath)
	if err != nil {
		writeAdminNotBuilt(w)
		return
	}
	defer file.Close()

	info, err := file.Stat()
	if err != nil || info.IsDir() {
		writeAdminNotBuilt(w)
		return
	}
	http.ServeContent(w, r, "index.html", info.ModTime(), file)
}

func writeAdminNotBuilt(w http.ResponseWriter) {
	WriteJSON(w, http.StatusNotFound, adminErrorResponse{
		Error: "Admin UI not found. Run `bun --filter admin-ui build` first.",
	})
}
