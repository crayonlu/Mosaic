package domain

import "github.com/google/uuid"

// Role values stored in users.role.
const (
	RoleAdmin = "admin"
	RoleUser  = "user"
)

// MinimumPasswordLength is enforced wherever a password is set.
const MinimumPasswordLength = 8

// User is an account. Timestamps are millisecond Unix values, as stored.
type User struct {
	ID                 uuid.UUID
	Username           string
	PasswordHash       string
	AvatarURL          *string
	Role               string
	MustChangePassword bool
	IsActive           bool
	CreatedAt          int64
	UpdatedAt          int64
}
