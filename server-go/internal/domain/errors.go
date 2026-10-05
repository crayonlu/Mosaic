// Package domain holds the types and errors shared by the service and store
// layers. It imports nothing outside the standard library, so business rules
// stay independent of the web framework and the database driver.
package domain

import (
	"errors"
	"fmt"
)

// ErrNoRows reports that a lookup matched nothing. Stores translate their
// driver's sentinel into this value, so services never depend on a driver.
var ErrNoRows = errors.New("no rows")

// Kind classifies an error. The HTTP layer maps kinds to status codes; nothing
// in this package knows about HTTP.
type Kind int

const (
	KindInternal Kind = iota
	KindUnauthorized
	KindInvalidToken
	KindTokenExpired
	KindNotFound
	KindForbidden
	KindInvalidInput
)

// Error is the single error type returned across the service and store layers.
type Error struct {
	Kind    Kind
	Message string
	// Cause carries the underlying failure for logging. It is never sent to clients.
	Cause error
}

func (e *Error) Error() string { return e.Message }

func (e *Error) Unwrap() error { return e.Cause }

// Internal reports an unexpected failure. The message is replaced with a generic
// one before it reaches a client.
func Internal(cause error) *Error {
	return &Error{Kind: KindInternal, Message: "Internal server error", Cause: cause}
}

func Unauthorized() *Error { return newError(KindUnauthorized, "Authentication failed") }

func InvalidToken() *Error { return newError(KindInvalidToken, "Invalid token") }

func TokenExpired() *Error { return newError(KindTokenExpired, "Token expired") }

func UserNotFound() *Error { return newError(KindNotFound, "User not found") }

func MemoNotFound() *Error { return newError(KindNotFound, "Memo not found") }

func ResourceNotFound() *Error { return newError(KindNotFound, "Resource not found") }

func DiaryNotFound() *Error { return newError(KindNotFound, "Diary not found") }

func BotNotFound() *Error { return newError(KindNotFound, "Bot not found") }

func NotFound(what string) *Error { return newError(KindNotFound, "Not found: "+what) }

func Forbidden(detail string) *Error { return newError(KindForbidden, "Forbidden: "+detail) }

func InvalidInput(detail string) *Error {
	return newError(KindInvalidInput, "Invalid input: "+detail)
}

// InvalidUUID reports a malformed identifier in a request.
func InvalidUUID(cause error) *Error {
	return &Error{Kind: KindInvalidInput, Message: "Invalid input: Invalid UUID format", Cause: cause}
}

// InvalidInputf builds an InvalidInput error from a format string.
func InvalidInputf(format string, args ...any) *Error {
	return InvalidInput(fmt.Sprintf(format, args...))
}

func newError(kind Kind, message string) *Error {
	return &Error{Kind: kind, Message: message}
}
