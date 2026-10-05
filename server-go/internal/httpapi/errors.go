package httpapi

import (
	"errors"
	"net/http"

	"github.com/crayonlu/mosaic/server-go/internal/domain"
)

// statusFor maps a domain error kind onto an HTTP status code. This is the only
// place in the codebase that makes that translation.
func statusFor(kind domain.Kind) int {
	switch kind {
	case domain.KindUnauthorized, domain.KindInvalidToken, domain.KindTokenExpired:
		return http.StatusUnauthorized
	case domain.KindNotFound:
		return http.StatusNotFound
	case domain.KindForbidden:
		return http.StatusForbidden
	case domain.KindInvalidInput:
		return http.StatusBadRequest
	default:
		return http.StatusInternalServerError
	}
}

// asDomainError normalises any error into a *domain.Error. Unrecognised errors
// are wrapped as internal failures so their detail never reaches a client.
func asDomainError(err error) *domain.Error {
	var domainErr *domain.Error
	if errors.As(err, &domainErr) {
		return domainErr
	}
	return domain.Internal(err)
}
