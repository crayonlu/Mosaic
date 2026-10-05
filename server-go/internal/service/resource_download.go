package service

import (
	"context"
	"errors"
	"log/slog"
	"strings"

	"github.com/google/uuid"

	"github.com/crayonlu/mosaic/server-go/internal/domain"
)

// DownloadVariant returns the requested rendition, falling back to the original
// when a derivative has not been produced.
func (s *ResourceService) DownloadVariant(
	ctx context.Context,
	userID string,
	resourceID uuid.UUID,
	variant string,
) (*Download, error) {
	resource, err := s.lookup(ctx, userID, resourceID)
	if err != nil {
		return nil, err
	}
	owner, ok := storageOwner(resource.StoragePath)
	if !ok {
		return nil, domain.ResourceNotFound()
	}

	switch variant {
	case "thumb":
		path := imageThumbnailPath(owner, resourceID)
		if s.blobs.Exists(ctx, path) {
			return s.getBlob(ctx, path, thumbnailMIMEType)
		}
		if path, mime, ok := s.ensureThumbnail(ctx, &resource); ok && s.blobs.Exists(ctx, path) {
			return s.getBlob(ctx, path, mime)
		}
	case "opt":
		path, mime := optimizedPath(owner, resourceID, resource.MimeType)
		if s.blobs.Exists(ctx, path) {
			return s.getBlob(ctx, path, mime)
		}
	}
	return s.getBlob(ctx, resource.StoragePath, resource.MimeType)
}

// DownloadThumbnail returns a resource thumbnail, falling back to the original
// bytes when no derivative was ever recorded.
func (s *ResourceService) DownloadThumbnail(
	ctx context.Context,
	userID string,
	resourceID uuid.UUID,
) (*Download, error) {
	resource, err := s.lookup(ctx, userID, resourceID)
	if err != nil {
		return nil, err
	}
	if owner, ok := storageOwner(resource.StoragePath); ok {
		path := imageThumbnailPath(owner, resourceID)
		if s.blobs.Exists(ctx, path) {
			return s.getBlob(ctx, path, thumbnailMIMEType)
		}
	}
	if path, mime, ok := s.ensureThumbnail(ctx, &resource); ok && s.blobs.Exists(ctx, path) {
		return s.getBlob(ctx, path, mime)
	}
	return s.getBlob(ctx, resource.StoragePath, resource.MimeType)
}

// ensureThumbnail records a video thumbnail, generating one lazily when the
// upload path did not already produce it.
func (s *ResourceService) ensureThumbnail(
	ctx context.Context,
	resource *domain.Resource,
) (string, string, bool) {
	if !strings.HasPrefix(resource.MimeType, "video/") {
		return "", "", false
	}
	if path, ok := domain.ThumbnailStoragePath(resource.Metadata); ok {
		mimeType, ok := domain.ThumbnailMimeType(resource.Metadata)
		if !ok {
			mimeType = thumbnailMIMEType
		}
		return path, mimeType, true
	}
	owner, ok := storageOwner(resource.StoragePath)
	if !ok {
		return "", "", false
	}
	original, err := s.blobs.Get(ctx, resource.StoragePath)
	if err != nil {
		return "", "", false
	}
	path, ok := s.generateVideoThumbnail(ctx, owner, resource.ID, original)
	if !ok {
		return "", "", false
	}
	resource.Metadata = domain.WithThumbnail(resource.Metadata, path, thumbnailMIMEType)
	if err := s.store.UpdateMetadata(ctx, resource.ID, resource.Metadata); err != nil {
		slog.Warn("recording video thumbnail", "resource", resource.ID, "err", err)
	}
	return path, thumbnailMIMEType, true
}

func (s *ResourceService) generateVideoThumbnail(
	ctx context.Context,
	owner string,
	resourceID uuid.UUID,
	data []byte,
) (string, bool) {
	thumbnail, err := s.videos.CreateThumbnail(ctx, data)
	if err != nil {
		slog.Warn("generating video thumbnail", "resource", resourceID, "err", err)
		return "", false
	}
	path := videoThumbnailPath(owner, resourceID)
	if _, err := s.blobs.Put(ctx, path, thumbnail, thumbnailMIMEType); err != nil {
		slog.Warn("storing video thumbnail", "resource", resourceID, "err", err)
		return "", false
	}
	return path, true
}

// deriveRenditions produces the thumbnails and optimized variants the download
// endpoints serve. It runs off the request path; failures are logged only.
func (s *ResourceService) deriveRenditions(owner string, resourceID uuid.UUID, mimeType string, data []byte) {
	ctx := context.Background()
	switch {
	case strings.HasPrefix(mimeType, "image/"):
		if thumbnail, err := s.images.CreateThumbnail(data); err == nil {
			s.putDerivative(ctx, imageThumbnailPath(owner, resourceID), thumbnail, thumbnailMIMEType)
		}
		if optimized, err := s.images.CreateOptimized(data); err == nil {
			s.putDerivative(ctx, optimizedImagePath(owner, resourceID), optimized, optimizedImageMIME)
		}
	case strings.HasPrefix(mimeType, "video/"):
		if thumbnail, err := s.videos.CreateThumbnail(ctx, data); err == nil {
			s.putDerivative(ctx, imageThumbnailPath(owner, resourceID), thumbnail, thumbnailMIMEType)
		}
		if optimized, err := s.videos.CreateOptimized(ctx, data); err == nil {
			s.putDerivative(ctx, optimizedVideoPath(owner, resourceID), optimized, optimizedVideoMIME)
		}
	}
}

func (s *ResourceService) putDerivative(ctx context.Context, path string, data []byte, mimeType string) {
	if _, err := s.blobs.Put(ctx, path, data, mimeType); err != nil {
		slog.Warn("storing resource derivative", "path", path, "err", err)
	}
}

func (s *ResourceService) lookup(ctx context.Context, userID string, resourceID uuid.UUID) (domain.Resource, error) {
	userUUID, err := uuid.Parse(userID)
	if err != nil {
		return domain.Resource{}, domain.InvalidUUID(err)
	}
	resource, err := s.store.ByIDForUser(ctx, userUUID, resourceID, true)
	if errors.Is(err, domain.ErrNoRows) {
		return domain.Resource{}, domain.ResourceNotFound()
	}
	if err != nil {
		return domain.Resource{}, move(err)
	}
	return resource, nil
}

func (s *ResourceService) getBlob(ctx context.Context, path, mimeType string) (*Download, error) {
	data, err := s.blobs.Get(ctx, path)
	if err != nil {
		return nil, move(err)
	}
	return &Download{Data: data, MimeType: mimeType}, nil
}
