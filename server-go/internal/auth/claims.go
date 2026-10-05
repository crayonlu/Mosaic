// Package auth issues and verifies the access tokens shared with the mobile
// client and the admin UI.
package auth

import (
	"errors"
	"time"

	"github.com/golang-jwt/jwt/v5"

	"github.com/crayonlu/mosaic/server-go/internal/domain"
)

// claimLeeway is the clock skew allowance applied when validating exp and nbf.
// The previous server used jsonwebtoken's 60 second default.
const claimLeeway = 60 * time.Second

// Claims is the access token payload. These JSON keys are part of the wire
// contract with already-installed clients and must not change while tokens
// signed by the previous server may still be presented.
type Claims struct {
	Subject string `json:"sub"`
	Role    string `json:"role"`
	// MustChangePassword travels under the legacy "mcp" key, kept for
	// compatibility with tokens already in circulation.
	MustChangePassword bool  `json:"mcp"`
	ExpiresAt          int64 `json:"exp"`
	IssuedAt           int64 `json:"iat"`
}

// GetExpirationTime reports exp. A zero value means the claim was absent, which
// the validator rejects as a missing required claim.
func (c *Claims) GetExpirationTime() (*jwt.NumericDate, error) {
	if c.ExpiresAt == 0 {
		return nil, nil
	}
	return jwt.NewNumericDate(time.Unix(c.ExpiresAt, 0)), nil
}

func (c *Claims) GetIssuedAt() (*jwt.NumericDate, error) {
	if c.IssuedAt == 0 {
		return nil, nil
	}
	return jwt.NewNumericDate(time.Unix(c.IssuedAt, 0)), nil
}

func (c *Claims) GetNotBefore() (*jwt.NumericDate, error) { return nil, nil }

func (c *Claims) GetIssuer() (string, error) { return "", nil }

func (c *Claims) GetSubject() (string, error) { return c.Subject, nil }

func (c *Claims) GetAudience() (jwt.ClaimStrings, error) { return nil, nil }

// Sign returns a signed HS256 access token.
func Sign(secret, userID, role string, mustChangePassword bool, ttl time.Duration) (string, error) {
	now := time.Now()
	claims := Claims{
		Subject:            userID,
		Role:               role,
		MustChangePassword: mustChangePassword,
		ExpiresAt:          now.Add(ttl).Unix(),
		IssuedAt:           now.Unix(),
	}

	token, err := jwt.NewWithClaims(jwt.SigningMethodHS256, &claims).SignedString([]byte(secret))
	if err != nil {
		return "", domain.Internal(err)
	}
	return token, nil
}

// Verify parses and validates a token, returning domain.InvalidToken or
// domain.TokenExpired so callers can decide how much detail to surface.
func Verify(secret, token string) (*Claims, error) {
	claims := &Claims{}
	parsed, err := jwt.ParseWithClaims(token, claims,
		func(*jwt.Token) (any, error) { return []byte(secret), nil },
		jwt.WithValidMethods([]string{jwt.SigningMethodHS256.Alg()}),
		jwt.WithLeeway(claimLeeway),
		jwt.WithExpirationRequired(),
	)
	if err != nil {
		if errors.Is(err, jwt.ErrTokenExpired) {
			return nil, domain.TokenExpired()
		}
		return nil, domain.InvalidToken()
	}
	if !parsed.Valid {
		return nil, domain.InvalidToken()
	}
	return claims, nil
}
