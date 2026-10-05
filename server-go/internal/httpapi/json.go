// Package httpapi contains the HTTP layer: routing, middleware, request
// decoding, and response encoding. Domain and service packages never import it.
package httpapi

import (
	"encoding/json"
	"log/slog"
	"net/http"
	"strconv"
)

// WriteJSON renders v as a JSON body. The body is written without a trailing
// newline to stay byte-identical with responses from the previous server.
func WriteJSON(w http.ResponseWriter, status int, v any) {
	body, err := json.Marshal(v)
	if err != nil {
		slog.Error("encoding response body", "err", err)
		w.WriteHeader(http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	if _, err := w.Write(body); err != nil {
		slog.Error("writing response body", "err", err)
	}
}

// errorBody is the error envelope clients already parse.
type errorBody struct {
	Error   string `json:"error"`
	Message string `json:"message"`
}

// writeError renders err using the envelope and status mapping of the previous
// server. Errors that are not *domain.Error become a generic 500.
func writeError(w http.ResponseWriter, r *http.Request, err error) {
	domainErr := asDomainError(err)
	status := statusFor(domainErr.Kind)

	if status >= http.StatusInternalServerError {
		slog.ErrorContext(r.Context(), "request failed",
			"err", err, "method", r.Method, "path", r.URL.Path)
	}

	WriteJSON(w, status, errorBody{
		Error:   statusLine(status),
		Message: domainErr.Message,
	})
}

// writePlainRejection mirrors the plain-text body the previous server's
// middleware produced. Middleware rejections never used the JSON envelope.
func writePlainRejection(w http.ResponseWriter, status int, message string) {
	w.Header().Set("Content-Type", "text/plain; charset=utf-8")
	w.WriteHeader(status)
	if _, err := w.Write([]byte(message)); err != nil {
		slog.Error("writing rejection body", "err", err)
	}
}

// statusLine renders "400 Bad Request", matching the previous server's use of
// the HTTP status code's Display form in the "error" field.
func statusLine(status int) string {
	return strconv.Itoa(status) + " " + http.StatusText(status)
}
