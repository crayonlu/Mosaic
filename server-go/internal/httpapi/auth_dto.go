package httpapi

// Request and response bodies for the auth endpoints. Field names are part of
// the wire contract with installed clients.

type loginRequest struct {
	Username string `json:"username" validate:"required"`
	Password string `json:"password" validate:"required"`
}

type refreshTokenRequest struct {
	RefreshToken string `json:"refreshToken" validate:"required"`
}

type changePasswordRequest struct {
	OldPassword string `json:"oldPassword" validate:"required"`
	NewPassword string `json:"newPassword" validate:"required"`
}

type updateUserRequest struct {
	Username  *string `json:"username"`
	AvatarURL *string `json:"avatarUrl"`
}

type updateAvatarRequest struct {
	AvatarURL string `json:"avatarUrl" validate:"required"`
}

type userResponse struct {
	ID                 string  `json:"id"`
	Username           string  `json:"username"`
	AvatarURL          *string `json:"avatarUrl"`
	Role               string  `json:"role"`
	MustChangePassword bool    `json:"mustChangePassword"`
	CreatedAt          int64   `json:"createdAt"`
	UpdatedAt          int64   `json:"updatedAt"`
}

type loginResponse struct {
	AccessToken        string       `json:"accessToken"`
	RefreshToken       string       `json:"refreshToken"`
	User               userResponse `json:"user"`
	MustChangePassword bool         `json:"mustChangePassword"`
}

type refreshTokenResponse struct {
	AccessToken  string `json:"accessToken"`
	RefreshToken string `json:"refreshToken"`
}
