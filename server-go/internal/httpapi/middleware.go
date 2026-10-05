package httpapi

import (
	"context"
	"net/http"
	"strings"

	"github.com/crayonlu/mosaic/server-go/internal/auth"
	"github.com/crayonlu/mosaic/server-go/internal/domain"
)

type claimsCtxKey struct{}

// ClaimsFrom returns the verified token claims attached by RequireAuth.
func ClaimsFrom(ctx context.Context) (*auth.Claims, bool) {
	claims, ok := ctx.Value(claimsCtxKey{}).(*auth.Claims)
	return claims, ok
}

// RequireAuth verifies the bearer token and attaches its claims to the request
// context. Rejections repeat the previous server's behaviour: a plain text 401
// that does not distinguish an expired token from a malformed one.
func RequireAuth(secret string) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			token, found := strings.CutPrefix(r.Header.Get("Authorization"), "Bearer ")
			if !found {
				writePlainRejection(w, http.StatusUnauthorized, "Unauthorized")
				return
			}

			claims, err := auth.Verify(secret, token)
			if err != nil {
				writePlainRejection(w, http.StatusUnauthorized, domain.InvalidToken().Message)
				return
			}

			next.ServeHTTP(w, r.WithContext(context.WithValue(r.Context(), claimsCtxKey{}, claims)))
		})
	}
}

// RequirePasswordChanged blocks accounts that must change their password before
// using the rest of the API.
func RequirePasswordChanged() func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			claims, ok := ClaimsFrom(r.Context())
			if !ok {
				writePlainRejection(w, http.StatusForbidden,
					"Authentication required before accessing this resource")
				return
			}
			if claims.MustChangePassword {
				writePlainRejection(w, http.StatusForbidden,
					"Password change required before accessing this resource")
				return
			}
			next.ServeHTTP(w, r)
		})
	}
}

// RequireAdmin restricts a scope to administrator accounts.
func RequireAdmin() func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			claims, ok := ClaimsFrom(r.Context())
			if !ok || claims.Role != "admin" {
				writePlainRejection(w, http.StatusForbidden, "Admin access required")
				return
			}
			next.ServeHTTP(w, r)
		})
	}
}
