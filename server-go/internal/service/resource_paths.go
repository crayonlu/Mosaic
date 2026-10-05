package service

import (
	"errors"
	"strings"

	"github.com/google/uuid"

	"github.com/crayonlu/mosaic/server-go/internal/domain"
)

// Storage paths reproduce the previous server's layout verbatim; the sync
// module and the migration backfills both depend on them.
func resourceStoragePath(userID, resourceID uuid.UUID) string {
	return "resources/" + userID.String() + "/" + resourceID.String()
}

func videoThumbnailPath(owner string, resourceID uuid.UUID) string {
	return "resources/" + owner + "/thumbnails/" + resourceID.String() + ".jpg"
}

func imageThumbnailPath(owner string, resourceID uuid.UUID) string {
	return "resources/" + owner + "/" + resourceID.String() + "_thumb.jpg"
}

func optimizedImagePath(owner string, resourceID uuid.UUID) string {
	return "resources/" + owner + "/" + resourceID.String() + "_opt.webp"
}

func optimizedVideoPath(owner string, resourceID uuid.UUID) string {
	return "resources/" + owner + "/" + resourceID.String() + "_opt.mp4"
}

func optimizedPath(owner string, resourceID uuid.UUID, mimeType string) (string, string) {
	if strings.HasPrefix(mimeType, "image/") {
		return optimizedImagePath(owner, resourceID), optimizedImageMIME
	}
	return optimizedVideoPath(owner, resourceID), optimizedVideoMIME
}

func avatarStoragePath(userID, avatarID uuid.UUID) string {
	return "avatars/" + userID.String() + "/" + avatarID.String()
}

// storageOwner extracts the user id segment from a resource storage path.
func storageOwner(storagePath string) (string, bool) {
	segments := strings.Split(storagePath, "/")
	if len(segments) < 2 || segments[0] != "resources" {
		return "", false
	}
	return segments[1], true
}

// move normalises an error into a *domain.Error without hiding the domain
// errors a collaborator already produced. It returns the error interface so a
// nil cause stays a nil error rather than a typed-nil pointer.
func move(err error) error {
	if err == nil {
		return nil
	}
	var domainErr *domain.Error
	if errors.As(err, &domainErr) {
		return domainErr
	}
	return domain.Internal(err)
}
