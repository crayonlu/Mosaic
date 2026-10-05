package httpapi

import (
	"encoding/json"
	"errors"
	"io"
	"mime/multipart"
	"net/http"
	"strconv"
	"strings"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"

	"github.com/crayonlu/mosaic/server-go/internal/domain"
	"github.com/crayonlu/mosaic/server-go/internal/service"
)

const (
	maxUploadBytes  = 100 * 1024 * 1024
	maxAvatarBytes  = 10 * 1024 * 1024
	defaultPageSize = 100
)

// sizeLimitError reports an upload that exceeded its endpoint's cap. It is
// rendered with the previous server's 413 body rather than the error envelope.
type sizeLimitError struct{ message string }

func (e *sizeLimitError) Error() string { return e.message }

func handleListResources(resources *service.ResourceService) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		userID, err := callerID(r)
		if err != nil {
			writeError(w, r, err)
			return
		}

		page := intQuery(r, "page", 1)
		pageSize := intQuery(r, "pageSize", defaultPageSize)
		if page < 1 {
			page = 1
		}
		if pageSize < 1 {
			pageSize = defaultPageSize
		}

		views, total, err := resources.ListResources(r.Context(), userID, page, pageSize)
		if err != nil {
			writeError(w, r, err)
			return
		}

		items := make([]uploadedResourceResponse, 0, len(views))
		for _, view := range views {
			items = append(items, toUploadedResourceResponse(view))
		}
		WriteJSON(w, http.StatusOK, listResourcesResponse{
			Items:    items,
			Total:    total,
			Page:     page,
			PageSize: pageSize,
		})
	}
}

func handleUploadResource(resources *service.ResourceService) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		userID, err := callerID(r)
		if err != nil {
			writeError(w, r, err)
			return
		}

		form, err := readUploadForm(r, uploadDefaults{
			maxBytes:        maxUploadBytes,
			defaultFilename: "unnamed",
			defaultMime:     "application/octet-stream",
			tooLarge:        "File too large, maximum size is 100MB",
		})
		if err != nil {
			writeUploadError(w, r, err)
			return
		}

		view, err := resources.UploadResource(r.Context(), userID, service.CreateResourceRequest{
			MemoID:   form.memoID,
			Filename: form.filename,
			MimeType: form.mimeType,
			FileSize: int64(len(form.data)),
			Metadata: form.metadata,
		}, form.data)
		if err != nil {
			writeError(w, r, err)
			return
		}
		WriteJSON(w, http.StatusOK, toUploadedResourceResponse(view))
	}
}

func handlePresignedUpload(resources *service.ResourceService) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		userID, err := callerID(r)
		if err != nil {
			writeError(w, r, err)
			return
		}

		var req createResourceRequest
		if err := decodeJSON(r, &req); err != nil {
			writeError(w, r, err)
			return
		}
		memoID, err := parseOptionalUUID(req.MemoID)
		if err != nil {
			writeError(w, r, err)
			return
		}

		result, err := resources.PresignedUpload(r.Context(), userID, service.CreateResourceRequest{
			MemoID:   memoID,
			Filename: req.Filename,
			MimeType: req.MimeType,
			FileSize: req.FileSize,
			Metadata: req.Metadata,
		})
		if err != nil {
			writeError(w, r, err)
			return
		}
		WriteJSON(w, http.StatusOK, presignedUploadResponse{
			UploadURL:   result.UploadURL,
			ResourceID:  result.ResourceID.String(),
			StoragePath: result.StoragePath,
		})
	}
}

func handleConfirmUpload(resources *service.ResourceService) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		userID, err := callerID(r)
		if err != nil {
			writeError(w, r, err)
			return
		}

		var req confirmUploadRequest
		if err := decodeJSON(r, &req); err != nil {
			writeError(w, r, err)
			return
		}
		resourceID, err := uuid.Parse(req.ResourceID)
		if err != nil {
			writeError(w, r, domain.InvalidUUID(err))
			return
		}

		view, err := resources.ConfirmUpload(r.Context(), userID, resourceID)
		if err != nil {
			writeError(w, r, err)
			return
		}
		WriteJSON(w, http.StatusOK, toUploadedResourceResponse(view))
	}
}

func handleUploadAvatar(resources *service.ResourceService) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		userID, err := callerID(r)
		if err != nil {
			writeError(w, r, err)
			return
		}

		form, err := readUploadForm(r, uploadDefaults{
			maxBytes:        maxAvatarBytes,
			defaultFilename: "avatar",
			defaultMime:     "image/jpeg",
			tooLarge:        "Avatar too large, maximum size is 10MB",
		})
		if err != nil {
			writeUploadError(w, r, err)
			return
		}

		user, err := resources.UploadAvatar(r.Context(), userID, form.filename, form.data, form.mimeType)
		if err != nil {
			writeError(w, r, err)
			return
		}
		WriteJSON(w, http.StatusOK, toUserResponse(user))
	}
}

func handleDeleteResource(resources *service.ResourceService) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		userID, err := callerID(r)
		if err != nil {
			writeError(w, r, err)
			return
		}
		resourceID, err := resourceIDParam(r)
		if err != nil {
			writeError(w, r, err)
			return
		}
		if err := resources.DeleteResource(r.Context(), userID, resourceID); err != nil {
			writeError(w, r, err)
			return
		}
		w.WriteHeader(http.StatusOK)
	}
}

// uploadDefaults bounds and names the multipart fields an upload endpoint accepts.
type uploadDefaults struct {
	maxBytes        int64
	defaultFilename string
	defaultMime     string
	tooLarge        string
}

type uploadForm struct {
	memoID   *uuid.UUID
	filename string
	mimeType string
	metadata map[string]any
	data     []byte
}

// readUploadForm streams a multipart body, keeping only the file in memory.
func readUploadForm(r *http.Request, defaults uploadDefaults) (uploadForm, error) {
	form := uploadForm{
		filename: defaults.defaultFilename,
		mimeType: defaults.defaultMime,
		metadata: map[string]any{},
	}
	reader, err := r.MultipartReader()
	if err != nil {
		return form, domain.InvalidInput("Invalid multipart form")
	}

	for {
		part, err := reader.NextPart()
		if errors.Is(err, io.EOF) {
			break
		}
		if err != nil {
			return form, domain.InvalidInput("Invalid multipart form")
		}

		switch part.FormName() {
		case "file":
			if name := part.FileName(); name != "" {
				form.filename = name
			}
			if contentType := part.Header.Get("Content-Type"); contentType != "" {
				form.mimeType = contentType
			}
			data, exceeded, readErr := readPart(part, defaults.maxBytes)
			part.Close()
			if readErr != nil {
				return form, domain.Internal(readErr)
			}
			if exceeded {
				return form, &sizeLimitError{message: defaults.tooLarge}
			}
			form.data = data
		case "memoId":
			if id, ok := readUUIDPart(part); ok {
				form.memoID = &id
			}
		case "metadata":
			raw, _ := io.ReadAll(io.LimitReader(part, 1<<20))
			part.Close()
			if strings.TrimSpace(string(raw)) != "" {
				if err := json.Unmarshal(raw, &form.metadata); err != nil {
					return form, domain.InvalidInput("Invalid metadata JSON")
				}
			}
		default:
			part.Close()
		}
	}
	if form.filename == "" {
		form.filename = defaults.defaultFilename
	}
	return form, nil
}

func readPart(part *multipart.Part, limit int64) ([]byte, bool, error) {
	data, err := io.ReadAll(io.LimitReader(part, limit+1))
	if err != nil {
		return nil, false, err
	}
	if int64(len(data)) > limit {
		return nil, true, nil
	}
	return data, false, nil
}

func readUUIDPart(part *multipart.Part) (uuid.UUID, bool) {
	raw, _ := io.ReadAll(io.LimitReader(part, 64))
	part.Close()
	id, err := uuid.Parse(strings.TrimSpace(string(raw)))
	if err != nil {
		return uuid.Nil, false
	}
	return id, true
}

func parseOptionalUUID(raw *string) (*uuid.UUID, error) {
	if raw == nil {
		return nil, nil
	}
	id, err := uuid.Parse(*raw)
	if err != nil {
		return nil, domain.InvalidUUID(err)
	}
	return &id, nil
}

func resourceIDParam(r *http.Request) (uuid.UUID, error) {
	id, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		return uuid.Nil, domain.InvalidUUID(err)
	}
	return id, nil
}

func intQuery(r *http.Request, name string, fallback int64) int64 {
	raw := r.URL.Query().Get(name)
	if raw == "" {
		return fallback
	}
	value, err := strconv.ParseInt(raw, 10, 64)
	if err != nil {
		return fallback
	}
	return value
}

func toUploadedResourceResponse(view service.ResourceView) uploadedResourceResponse {
	var memoID *string
	if view.MemoID != nil {
		id := view.MemoID.String()
		memoID = &id
	}
	return uploadedResourceResponse{
		ID:            view.ID.String(),
		MemoID:        memoID,
		Filename:      view.Filename,
		ResourceType:  view.ResourceType,
		MimeType:      view.MimeType,
		FileSize:      view.FileSize,
		StorageType:   view.StorageType,
		URL:           view.URL,
		ThumbnailURL:  view.ThumbnailURL,
		Metadata:      view.Metadata,
		AIDescription: view.AIDescription,
		CreatedAt:     view.CreatedAt,
	}
}

func writeUploadError(w http.ResponseWriter, r *http.Request, err error) {
	var tooLarge *sizeLimitError
	if errors.As(err, &tooLarge) {
		WriteJSON(w, http.StatusRequestEntityTooLarge, map[string]string{"error": tooLarge.Error()})
		return
	}
	writeError(w, r, err)
}
