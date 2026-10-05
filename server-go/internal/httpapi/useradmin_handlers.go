package httpapi

import (
	"net/http"

	"github.com/go-chi/chi/v5"

	"github.com/crayonlu/mosaic/server-go/internal/domain"
	"github.com/crayonlu/mosaic/server-go/internal/service"
)

func handleAdminCreateUser(adminSvc *service.AdminService) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		adminID, err := callerID(r)
		if err != nil {
			writeError(w, r, err)
			return
		}

		var req createUserRequest
		if err := decodeJSON(r, &req); err != nil {
			writeError(w, r, err)
			return
		}

		user, err := adminSvc.CreateUser(r.Context(), adminID, req.Username, req.Password)
		if err != nil {
			writeError(w, r, err)
			return
		}
		WriteJSON(w, http.StatusCreated, toManagedUserResponse(user))
	}
}

func handleAdminListUsers(adminSvc *service.AdminService) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		query := r.URL.Query()
		page := int64(queryInt(query.Get("page"), 1))
		pageSize := int64(queryInt(query.Get("pageSize"), 50))

		users, total, err := adminSvc.ListUsers(r.Context(), int(page), int(pageSize))
		if err != nil {
			writeError(w, r, err)
			return
		}

		out := make([]managedUserResponse, 0, len(users))
		for _, user := range users {
			out = append(out, toManagedUserResponse(user))
		}
		WriteJSON(w, http.StatusOK, paginatedUsersResponse{
			Users:    out,
			Total:    total,
			Page:     page,
			PageSize: pageSize,
		})
	}
}

func handleAdminUpdateUser(adminSvc *service.AdminService) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		adminID, err := callerID(r)
		if err != nil {
			writeError(w, r, err)
			return
		}

		var req updateManagedUserRequest
		if err := decodeJSON(r, &req); err != nil {
			writeError(w, r, err)
			return
		}

		user, err := adminSvc.UpdateManagedUser(
			r.Context(), adminID, chi.URLParam(r, "id"),
			service.ManagedUserUpdate{
				IsActive:      req.IsActive,
				Role:          req.Role,
				ResetPassword: req.ResetPassword,
			})
		if err != nil {
			writeError(w, r, err)
			return
		}
		WriteJSON(w, http.StatusOK, toManagedUserResponse(user))
	}
}

func toManagedUserResponse(user domain.User) managedUserResponse {
	return managedUserResponse{
		ID:                 user.ID.String(),
		Username:           user.Username,
		AvatarURL:          user.AvatarURL,
		Role:               user.Role,
		IsActive:           user.IsActive,
		MustChangePassword: user.MustChangePassword,
		CreatedAt:          user.CreatedAt,
		UpdatedAt:          user.UpdatedAt,
	}
}
