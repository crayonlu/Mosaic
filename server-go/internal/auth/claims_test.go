package auth

import (
	"testing"
	"time"

	"github.com/golang-jwt/jwt/v5"

	"github.com/crayonlu/mosaic/server-go/internal/domain"
)

const testSecret = "test-secret"

func TestSignAndVerifyRoundTrip(t *testing.T) {
	token, err := Sign(testSecret, "user-1", domain.RoleAdmin, true, time.Hour)
	if err != nil {
		t.Fatalf("Sign: %v", err)
	}

	claims, err := Verify(testSecret, token)
	if err != nil {
		t.Fatalf("Verify: %v", err)
	}
	if claims.Subject != "user-1" {
		t.Errorf("Subject = %q, want %q", claims.Subject, "user-1")
	}
	if claims.Role != domain.RoleAdmin {
		t.Errorf("Role = %q, want %q", claims.Role, domain.RoleAdmin)
	}
	if !claims.MustChangePassword {
		t.Error("MustChangePassword = false, want true")
	}
}

// TestVerifyAcceptsTokenFromPreviousServer pins the claim names shared with
// tokens the Rust server already issued.
func TestVerifyAcceptsTokenFromPreviousServer(t *testing.T) {
	now := time.Now()
	token := signRawClaims(t, jwt.MapClaims{
		"sub":  "0f8fad5b-d9cb-469f-a165-70867728950e",
		"role": domain.RoleUser,
		"mcp":  true,
		"exp":  now.Add(time.Hour).Unix(),
		"iat":  now.Unix(),
	})

	claims, err := Verify(testSecret, token)
	if err != nil {
		t.Fatalf("Verify: %v", err)
	}
	if claims.Subject != "0f8fad5b-d9cb-469f-a165-70867728950e" {
		t.Errorf("Subject = %q", claims.Subject)
	}
	if !claims.MustChangePassword {
		t.Error(`"mcp" claim was not mapped onto MustChangePassword`)
	}
}

func TestVerifyRejectsExpiredToken(t *testing.T) {
	token, err := Sign(testSecret, "user-1", domain.RoleUser, false, -2*time.Hour)
	if err != nil {
		t.Fatalf("Sign: %v", err)
	}

	_, err = Verify(testSecret, token)
	var domainErr *domain.Error
	if !asDomain(err, &domainErr) || domainErr.Kind != domain.KindTokenExpired {
		t.Fatalf("Verify error = %v, want token expired", err)
	}
}

func TestVerifyRejectsTokenSignedWithAnotherSecret(t *testing.T) {
	token, err := Sign("other-secret", "user-1", domain.RoleUser, false, time.Hour)
	if err != nil {
		t.Fatalf("Sign: %v", err)
	}

	assertInvalidToken(t, token)
}

func TestVerifyRejectsTokenWithoutExpiry(t *testing.T) {
	token := signRawClaims(t, jwt.MapClaims{
		"sub":  "user-1",
		"role": domain.RoleUser,
		"iat":  time.Now().Unix(),
	})

	assertInvalidToken(t, token)
}

func TestVerifyRejectsUnsignedToken(t *testing.T) {
	token, err := jwt.NewWithClaims(jwt.SigningMethodNone, jwt.MapClaims{
		"sub": "user-1",
		"exp": time.Now().Add(time.Hour).Unix(),
	}).SignedString(jwt.UnsafeAllowNoneSignatureType)
	if err != nil {
		t.Fatalf("Sign: %v", err)
	}

	assertInvalidToken(t, token)
}

func signRawClaims(t *testing.T, claims jwt.MapClaims) string {
	t.Helper()
	token, err := jwt.NewWithClaims(jwt.SigningMethodHS256, claims).SignedString([]byte(testSecret))
	if err != nil {
		t.Fatalf("signing raw claims: %v", err)
	}
	return token
}

func assertInvalidToken(t *testing.T, token string) {
	t.Helper()
	_, err := Verify(testSecret, token)
	var domainErr *domain.Error
	if !asDomain(err, &domainErr) || domainErr.Kind != domain.KindInvalidToken {
		t.Fatalf("Verify error = %v, want invalid token", err)
	}
}

func asDomain(err error, target **domain.Error) bool {
	if err == nil {
		return false
	}
	domainErr, ok := err.(*domain.Error)
	if !ok {
		return false
	}
	*target = domainErr
	return true
}
