package httpapi

// Request and response bodies for managed-user administration.

type createUserRequest struct {
	Username string `json:"username"`
	Password string `json:"password"`
}

type updateManagedUserRequest struct {
	IsActive      *bool   `json:"isActive"`
	Role          *string `json:"role"`
	ResetPassword *string `json:"resetPassword"`
}

type managedUserResponse struct {
	ID                 string  `json:"id"`
	Username           string  `json:"username"`
	AvatarURL          *string `json:"avatarUrl"`
	Role               string  `json:"role"`
	IsActive           bool    `json:"isActive"`
	MustChangePassword bool    `json:"mustChangePassword"`
	CreatedAt          int64   `json:"createdAt"`
	UpdatedAt          int64   `json:"updatedAt"`
}

type paginatedUsersResponse struct {
	Users    []managedUserResponse `json:"users"`
	Total    int64                 `json:"total"`
	Page     int64                 `json:"page"`
	PageSize int64                 `json:"pageSize"`
}
