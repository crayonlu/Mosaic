package httpapi

import (
	"net/http"

	"github.com/go-chi/chi/v5"

	"github.com/crayonlu/mosaic/server-go/internal/service"
)

// syncPullRequest matches the body the previous server accepted. The cursor map
// is keyed by entity name; a missing entry means the client has never synced
// that entity.
type syncPullRequest struct {
	ClientID string           `json:"clientId" validate:"required"`
	Cursors  map[string]int64 `json:"cursors"`
}

func handleSyncPull(sync *service.SyncService) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		userID, err := callerID(r)
		if err != nil {
			writeError(w, r, err)
			return
		}

		var req syncPullRequest
		if err := decodeJSON(r, &req); err != nil {
			writeError(w, r, err)
			return
		}

		result, err := sync.Pull(r.Context(), userID, req.ClientID, req.Cursors)
		if err != nil {
			writeError(w, r, err)
			return
		}

		WriteJSON(w, http.StatusOK, result)
	}
}

func registerSyncRoutes(r chi.Router, sync *service.SyncService) {
	serve(r, "/sync/pull", map[string]http.HandlerFunc{
		http.MethodPost: handleSyncPull(sync),
	})
}
