package httpapi

import (
	"net/http"

	"github.com/crayonlu/mosaic/server-go/internal/domain"
)

func handleLogin(auth AuthService) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		var req loginRequest
		if err := decodeJSON(r, &req); err != nil {
			writeError(w, r, err)
			return
		}

		result, err := auth.Login(r.Context(), req.Username, req.Password)
		if err != nil {
			writeError(w, r, err)
			return
		}

		WriteJSON(w, http.StatusOK, loginResponse{
			AccessToken:        result.AccessToken,
			RefreshToken:       result.RefreshToken,
			User:               toUserResponse(result.User),
			MustChangePassword: result.MustChangePassword,
		})
	}
}

func handleRefresh(auth AuthService) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		var req refreshTokenRequest
		if err := decodeJSON(r, &req); err != nil {
			writeError(w, r, err)
			return
		}

		tokens, err := auth.Refresh(r.Context(), req.RefreshToken)
		if err != nil {
			writeError(w, r, err)
			return
		}

		WriteJSON(w, http.StatusOK, refreshTokenResponse{
			AccessToken:  tokens.AccessToken,
			RefreshToken: tokens.RefreshToken,
		})
	}
}

func handleMe(auth AuthService) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		userID, err := callerID(r)
		if err != nil {
			writeError(w, r, err)
			return
		}

		user, err := auth.CurrentUser(r.Context(), userID)
		if err != nil {
			writeError(w, r, err)
			return
		}

		WriteJSON(w, http.StatusOK, toUserResponse(user))
	}
}

func handleChangePassword(auth AuthService) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		userID, err := callerID(r)
		if err != nil {
			writeError(w, r, err)
			return
		}

		var req changePasswordRequest
		if err := decodeJSON(r, &req); err != nil {
			writeError(w, r, err)
			return
		}

		tokens, err := auth.ChangePassword(r.Context(), userID, req.OldPassword, req.NewPassword)
		if err != nil {
			writeError(w, r, err)
			return
		}

		WriteJSON(w, http.StatusOK, refreshTokenResponse{
			AccessToken:  tokens.AccessToken,
			RefreshToken: tokens.RefreshToken,
		})
	}
}

func handleUpdateUser(auth AuthService) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		userID, err := callerID(r)
		if err != nil {
			writeError(w, r, err)
			return
		}

		var req updateUserRequest
		if err := decodeJSON(r, &req); err != nil {
			writeError(w, r, err)
			return
		}

		user, err := auth.UpdateProfile(r.Context(), userID, req.Username, req.AvatarURL)
		if err != nil {
			writeError(w, r, err)
			return
		}

		WriteJSON(w, http.StatusOK, toUserResponse(user))
	}
}

func handleUpdateAvatar(auth AuthService) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		userID, err := callerID(r)
		if err != nil {
			writeError(w, r, err)
			return
		}

		var req updateAvatarRequest
		if err := decodeJSON(r, &req); err != nil {
			writeError(w, r, err)
			return
		}

		user, err := auth.UpdateAvatar(r.Context(), userID, req.AvatarURL)
		if err != nil {
			writeError(w, r, err)
			return
		}

		WriteJSON(w, http.StatusOK, toUserResponse(user))
	}
}

// callerID returns the subject of the verified token on the request.
func callerID(r *http.Request) (string, error) {
	claims, ok := ClaimsFrom(r.Context())
	if !ok {
		return "", domain.Unauthorized()
	}
	return claims.Subject, nil
}

func toUserResponse(user domain.User) userResponse {
	return userResponse{
		ID:                 user.ID.String(),
		Username:           user.Username,
		AvatarURL:          user.AvatarURL,
		Role:               user.Role,
		MustChangePassword: user.MustChangePassword,
		CreatedAt:          user.CreatedAt,
		UpdatedAt:          user.UpdatedAt,
	}
}
