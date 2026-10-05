package httpapi

import (
	"net/http"
	"strings"
)

// CORS mirrors the previous server: permissive when ALLOWED_ORIGINS is empty,
// otherwise restricted to the listed origins with credentials allowed.
func CORS(allowedOrigins []string) func(http.Handler) http.Handler {
	permissive := len(allowedOrigins) == 0

	allowed := make(map[string]struct{}, len(allowedOrigins))
	for _, origin := range allowedOrigins {
		if trimmed := strings.TrimSpace(origin); trimmed != "" {
			allowed[trimmed] = struct{}{}
		}
	}

	const (
		allowMethods = "GET, POST, PUT, DELETE, OPTIONS"
		allowHeaders = "Authorization, Accept, Content-Type"
	)

	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			origin := r.Header.Get("Origin")
			if origin == "" {
				next.ServeHTTP(w, r)
				return
			}

			_, listed := allowed[origin]
			if permissive || listed {
				header := w.Header()
				header.Set("Access-Control-Allow-Origin", origin)
				header.Add("Vary", "Origin")
				if !permissive {
					header.Set("Access-Control-Allow-Credentials", "true")
				}
			}

			if r.Method == http.MethodOptions {
				header := w.Header()
				header.Set("Access-Control-Allow-Methods", allowMethods)
				header.Set("Access-Control-Allow-Headers", allowHeaders)
				header.Set("Access-Control-Max-Age", "3600")
				w.WriteHeader(http.StatusOK)
				return
			}

			next.ServeHTTP(w, r)
		})
	}
}
