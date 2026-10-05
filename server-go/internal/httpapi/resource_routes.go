package httpapi

import (
	"github.com/go-chi/chi/v5"
	"net/http"

	"github.com/crayonlu/mosaic/server-go/internal/service"
)

// registerResourceRoutes mounts the resource endpoints. The caller is
// responsible for placing them inside an authenticated /api scope.
func registerResourceRoutes(r chi.Router, resources *service.ResourceService) {
	serve(r, "/resources", map[string]http.HandlerFunc{
		http.MethodGet: handleListResources(resources),
	})
	serve(r, "/resources/upload", map[string]http.HandlerFunc{
		http.MethodPost: handleUploadResource(resources),
	})
	serve(r, "/resources/presigned-upload", map[string]http.HandlerFunc{
		http.MethodPost: handlePresignedUpload(resources),
	})
	serve(r, "/resources/confirm-upload", map[string]http.HandlerFunc{
		http.MethodPost: handleConfirmUpload(resources),
	})
	serve(r, "/resources/upload-avatar", map[string]http.HandlerFunc{
		http.MethodPost: handleUploadAvatar(resources),
	})
	serve(r, "/resources/{id}", map[string]http.HandlerFunc{
		http.MethodDelete: handleDeleteResource(resources),
	})
	serve(r, "/resources/{id}/download", map[string]http.HandlerFunc{
		http.MethodGet: handleDownloadResource(resources),
	})
	serve(r, "/resources/{id}/thumbnail", map[string]http.HandlerFunc{
		http.MethodGet: handleDownloadThumbnail(resources),
	})
	serve(r, "/avatars/{id}/download", map[string]http.HandlerFunc{
		http.MethodGet: handleDownloadAvatar(resources),
	})
}
