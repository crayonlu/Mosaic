package auth

import (
	"golang.org/x/crypto/bcrypt"

	"github.com/crayonlu/mosaic/server-go/internal/domain"
)

// BCryptCost matches the cost factor the previous server used, so password
// strength stays the same when a user changes an existing password.
const BCryptCost = 12

// HashPassword hashes a plaintext password for storage.
func HashPassword(plaintext string) (string, error) {
	hash, err := bcrypt.GenerateFromPassword([]byte(plaintext), BCryptCost)
	if err != nil {
		return "", domain.Internal(err)
	}
	return string(hash), nil
}

// VerifyPassword reports whether plaintext matches the stored bcrypt hash.
// Hashes produced by the previous server verify unchanged, at any cost factor.
func VerifyPassword(hash, plaintext string) bool {
	return bcrypt.CompareHashAndPassword([]byte(hash), []byte(plaintext)) == nil
}
