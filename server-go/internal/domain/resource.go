package domain

import (
	"encoding/json"
	"strings"

	"github.com/google/uuid"
)

// Resource metadata keys used to remember a derivative.
const (
	ThumbnailStoragePathKey = "thumbnailStoragePath"
	ThumbnailMimeTypeKey    = "thumbnailMimeType"
)

// Resource is an uploaded file attached to a memo or used as an avatar.
type Resource struct {
	ID            uuid.UUID
	MemoID        *uuid.UUID
	UserID        uuid.UUID
	Filename      string
	Type          string
	MimeType      string
	FileSize      int64
	StorageType   string
	StoragePath   string
	Metadata      map[string]any
	IsDeleted     bool
	AiDescription *string
	CreatedAt     int64
	UpdatedAt     int64
}

// DownloadRoute is the API path clients fetch the original file from.
func DownloadRoute(id uuid.UUID) string {
	return "/api/resources/" + id.String() + "/download"
}

// ThumbnailRoute is the API path clients fetch the derivative from.
func ThumbnailRoute(id uuid.UUID) string {
	return "/api/resources/" + id.String() + "/thumbnail"
}

// AvatarDownloadRoute is the API path for an avatar image.
func AvatarDownloadRoute(id uuid.UUID) string {
	return "/api/avatars/" + id.String() + "/download"
}

// ThumbnailStoragePath reads the derivative's storage key, if one was recorded.
func ThumbnailStoragePath(metadata map[string]any) (string, bool) {
	value, ok := metadata[ThumbnailStoragePathKey].(string)
	return value, ok
}

// ThumbnailMimeType reads the derivative's content type.
func ThumbnailMimeType(metadata map[string]any) (string, bool) {
	value, ok := metadata[ThumbnailMimeTypeKey].(string)
	return value, ok
}

// WithThumbnail records a derivative on a copy of the metadata.
func WithThumbnail(metadata map[string]any, storagePath, mimeType string) map[string]any {
	updated := make(map[string]any, len(metadata)+2)
	for key, value := range metadata {
		updated[key] = value
	}
	updated[ThumbnailStoragePathKey] = storagePath
	updated[ThumbnailMimeTypeKey] = mimeType
	return updated
}

// ResolveMimeType reconciles a client-declared content type with the file's own
// signature. Declared image types are trusted over sniffing only when the bytes
// are unrecognised, and generic declarations are always replaced by a sniff.
func ResolveMimeType(declared, _ string, data []byte) string {
	sniffed, sniffedOK := sniffImageMimeType(data)

	if strings.HasPrefix(declared, "image/") {
		if sniffedOK {
			return sniffed
		}
		return declared
	}

	if isGenericMimeType(declared) {
		if sniffedOK {
			return sniffed
		}
		return "application/octet-stream"
	}

	return declared
}

func isGenericMimeType(mimeType string) bool {
	return mimeType == "" ||
		strings.EqualFold(mimeType, "application/octet-stream") ||
		strings.EqualFold(mimeType, "application/binary")
}

func sniffImageMimeType(data []byte) (string, bool) {
	switch {
	case len(data) >= 3 && data[0] == 0xff && data[1] == 0xd8 && data[2] == 0xff:
		return "image/jpeg", true
	case len(data) >= 8 && string(data[:8]) == "\x89PNG\r\n\x1a\n":
		return "image/png", true
	case len(data) >= 6 && (string(data[:6]) == "GIF87a" || string(data[:6]) == "GIF89a"):
		return "image/gif", true
	case len(data) >= 12 && string(data[:4]) == "RIFF" && string(data[8:12]) == "WEBP":
		return "image/webp", true
	default:
		return "", false
	}
}

func unmarshalStringList(data []byte, target *[]string) error {
	return json.Unmarshal(data, target)
}
