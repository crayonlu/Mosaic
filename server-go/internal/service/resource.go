package service

import (
	"context"
	"errors"
	"log/slog"
	"strings"
	"time"

	"github.com/google/uuid"

	"github.com/crayonlu/mosaic/server-go/internal/config"
	"github.com/crayonlu/mosaic/server-go/internal/domain"
)

// Derivative MIME types and cache lifetimes, unchanged from the previous server.
const (
	presignedGetTTL    = 24 * time.Hour
	presignedPutTTL    = time.Hour
	avatarURLLifetime  = 365 * 24 * time.Hour
	thumbnailMIMEType  = "image/jpeg"
	optimizedImageMIME = "image/webp"
	optimizedVideoMIME = "video/mp4"
)

// ResourceStore is the persistence the resource service depends on.
type ResourceStore interface {
	MemoExists(ctx context.Context, userID, memoID uuid.UUID) (bool, error)
	Create(ctx context.Context, resource domain.Resource) (domain.Resource, error)
	ByIDForUser(ctx context.Context, userID, resourceID uuid.UUID, liveOnly bool) (domain.Resource, error)
	ByIDForMemoOwner(ctx context.Context, userID, resourceID uuid.UUID) (domain.Resource, error)
	SetAIDescription(ctx context.Context, resourceID, userID uuid.UUID, description string, now int64) (bool, error)
	List(ctx context.Context, userID uuid.UUID, limit, offset int64) ([]domain.Resource, int64, error)
	UpdateMetadata(ctx context.Context, resourceID uuid.UUID, metadata map[string]any) error
	SoftDelete(ctx context.Context, resourceID uuid.UUID, now int64) error
}

// BlobStore stores uploaded bytes. Its method set matches the storage backend
// the rest of the server wires in.
type BlobStore interface {
	Put(ctx context.Context, path string, data []byte, mimeType string) (string, error)
	Get(ctx context.Context, path string) ([]byte, error)
	Delete(ctx context.Context, path string) error
	Exists(ctx context.Context, path string) bool
	PresignedGetURL(ctx context.Context, path string, expires time.Duration) (string, error)
	PresignedPutURL(ctx context.Context, path string, expires time.Duration) (string, error)
}

// ImageDeriver produces image renditions and is satisfied by media.ImageProcessor.
type ImageDeriver interface {
	CreateThumbnail(data []byte) ([]byte, error)
	CreateOptimized(data []byte) ([]byte, error)
}

// VideoDeriver produces video renditions and is satisfied by media.VideoProcessor.
type VideoDeriver interface {
	CreateThumbnail(ctx context.Context, data []byte) ([]byte, error)
	CreateOptimized(ctx context.Context, data []byte) ([]byte, error)
}

// AvatarStore persists avatars and resolves them for download.
type AvatarStore interface {
	SetAvatar(ctx context.Context, userID uuid.UUID, avatarURL string, now int64) (domain.User, error)
	AvatarBlob(ctx context.Context, avatarID uuid.UUID) ([]byte, error)
}

// CreateResourceRequest is the metadata that accompanies an upload.
type CreateResourceRequest struct {
	MemoID   *uuid.UUID
	Filename string
	MimeType string
	FileSize int64
	Metadata map[string]any
}

// PresignedUploadResponse carries a direct-upload URL and the reserved row.
type PresignedUploadResponse struct {
	UploadURL   string
	ResourceID  uuid.UUID
	StoragePath string
}

// ResourceView is a resource plus the routes clients fetch it from.
type ResourceView struct {
	ID            uuid.UUID
	MemoID        *uuid.UUID
	Filename      string
	ResourceType  string
	MimeType      string
	FileSize      int64
	StorageType   string
	URL           string
	ThumbnailURL  *string
	Metadata      map[string]any
	AIDescription *string
	CreatedAt     int64
}

// Download is a stored blob together with the content type to serve it with.
type Download struct {
	Data     []byte
	MimeType string
}

// ResourceService implements resource upload, download, and deletion.
type ResourceService struct {
	store       ResourceStore
	blobs       BlobStore
	images      ImageDeriver
	videos      VideoDeriver
	avatars     AvatarStore
	storageType config.StorageType
	configs     ChatConfigProvider
	completions CompletionClient
}

// NewResourceService wires every collaborator the service needs. None is
// optional, so there is no partially configured state.
func NewResourceService(
	store ResourceStore,
	blobs BlobStore,
	images ImageDeriver,
	videos VideoDeriver,
	avatars AvatarStore,
	storageType config.StorageType,
	configs ChatConfigProvider,
	completions CompletionClient,
) *ResourceService {
	return &ResourceService{
		store:       store,
		blobs:       blobs,
		images:      images,
		videos:      videos,
		avatars:     avatars,
		storageType: storageType,
		configs:     configs,
		completions: completions,
	}
}

// UploadResource stores an uploaded file and returns the created resource.
func (s *ResourceService) UploadResource(
	ctx context.Context,
	userID string,
	req CreateResourceRequest,
	data []byte,
) (ResourceView, error) {
	userUUID, err := uuid.Parse(userID)
	if err != nil {
		return ResourceView{}, domain.InvalidUUID(err)
	}
	if req.MemoID != nil {
		exists, err := s.store.MemoExists(ctx, userUUID, *req.MemoID)
		if err != nil {
			return ResourceView{}, move(err)
		}
		if !exists {
			return ResourceView{}, domain.MemoNotFound()
		}
	}

	metadata := req.Metadata
	if metadata == nil {
		metadata = map[string]any{}
	}
	mimeType := domain.ResolveMimeType(req.MimeType, req.Filename, data)
	resourceID := uuid.New()
	storagePath := resourceStoragePath(userUUID, resourceID)

	if _, err := s.blobs.Put(ctx, storagePath, data, mimeType); err != nil {
		return ResourceView{}, move(err)
	}
	go s.deriveRenditions(userUUID.String(), resourceID, mimeType, data)

	if strings.HasPrefix(mimeType, "video/") {
		if path, ok := s.generateVideoThumbnail(ctx, userUUID.String(), resourceID, data); ok {
			metadata = domain.WithThumbnail(metadata, path, thumbnailMIMEType)
		}
	}

	now := time.Now().UnixMilli()
	created, err := s.store.Create(ctx, domain.Resource{
		ID:          resourceID,
		MemoID:      req.MemoID,
		UserID:      userUUID,
		Filename:    req.Filename,
		Type:        resourceTypeFor(mimeType),
		MimeType:    mimeType,
		FileSize:    req.FileSize,
		StorageType: s.storageName(),
		StoragePath: storagePath,
		Metadata:    metadata,
		CreatedAt:   now,
		UpdatedAt:   now,
	})
	if err != nil {
		return ResourceView{}, move(err)
	}

	// An uploaded image earns a best-effort description off the request path.
	if strings.HasPrefix(mimeType, "image/") {
		detached := context.WithoutCancel(ctx)
		go s.describeImage(detached, userUUID, resourceID, storagePath, mimeType)
	}

	return s.view(ctx, created)
}

// PresignedUpload reserves a resource row and hands back a direct-upload URL.
// It is only available on R2 storage, matching the previous server.
func (s *ResourceService) PresignedUpload(
	ctx context.Context,
	userID string,
	req CreateResourceRequest,
) (PresignedUploadResponse, error) {
	if s.storageType != config.StorageR2 {
		return PresignedUploadResponse{}, domain.InvalidInput("Direct upload only supported for R2 storage")
	}
	userUUID, err := uuid.Parse(userID)
	if err != nil {
		return PresignedUploadResponse{}, domain.InvalidUUID(err)
	}
	if req.MemoID == nil {
		return PresignedUploadResponse{}, domain.MemoNotFound()
	}
	exists, err := s.store.MemoExists(ctx, userUUID, *req.MemoID)
	if err != nil {
		return PresignedUploadResponse{}, move(err)
	}
	if !exists {
		return PresignedUploadResponse{}, domain.MemoNotFound()
	}

	resourceID := uuid.New()
	storagePath := resourceStoragePath(userUUID, resourceID)
	uploadURL, err := s.blobs.PresignedPutURL(ctx, storagePath, presignedPutTTL)
	if err != nil {
		return PresignedUploadResponse{}, move(err)
	}

	metadata := req.Metadata
	if metadata == nil {
		metadata = map[string]any{}
	}
	now := time.Now().UnixMilli()
	if _, err := s.store.Create(ctx, domain.Resource{
		ID:          resourceID,
		MemoID:      req.MemoID,
		UserID:      userUUID,
		Filename:    req.Filename,
		Type:        resourceTypeFor(req.MimeType),
		MimeType:    req.MimeType,
		FileSize:    req.FileSize,
		StorageType: string(config.StorageR2),
		StoragePath: storagePath,
		Metadata:    metadata,
		CreatedAt:   now,
		UpdatedAt:   now,
	}); err != nil {
		return PresignedUploadResponse{}, move(err)
	}

	return PresignedUploadResponse{
		UploadURL:   uploadURL,
		ResourceID:  resourceID,
		StoragePath: storagePath,
	}, nil
}

// ConfirmUpload returns a previously reserved resource.
func (s *ResourceService) ConfirmUpload(
	ctx context.Context,
	userID string,
	resourceID uuid.UUID,
) (ResourceView, error) {
	userUUID, err := uuid.Parse(userID)
	if err != nil {
		return ResourceView{}, domain.InvalidUUID(err)
	}
	resource, err := s.store.ByIDForMemoOwner(ctx, userUUID, resourceID)
	if errors.Is(err, domain.ErrNoRows) {
		return ResourceView{}, domain.ResourceNotFound()
	}
	if err != nil {
		return ResourceView{}, move(err)
	}
	return s.view(ctx, resource)
}

// ListResources returns a page of the user's resources.
func (s *ResourceService) ListResources(
	ctx context.Context,
	userID string,
	page, pageSize int64,
) ([]ResourceView, int64, error) {
	userUUID, err := uuid.Parse(userID)
	if err != nil {
		return nil, 0, domain.InvalidUUID(err)
	}
	resources, total, err := s.store.List(ctx, userUUID, pageSize, (page-1)*pageSize)
	if err != nil {
		return nil, 0, move(err)
	}
	views := make([]ResourceView, 0, len(resources))
	for _, resource := range resources {
		view, err := s.view(ctx, resource)
		if err != nil {
			return nil, 0, err
		}
		views = append(views, view)
	}
	return views, total, nil
}

// DeleteResource removes a resource's blobs and soft-deletes the row.
func (s *ResourceService) DeleteResource(ctx context.Context, userID string, resourceID uuid.UUID) error {
	userUUID, err := uuid.Parse(userID)
	if err != nil {
		return domain.InvalidUUID(err)
	}
	resource, err := s.store.ByIDForUser(ctx, userUUID, resourceID, false)
	if errors.Is(err, domain.ErrNoRows) {
		return domain.ResourceNotFound()
	}
	if err != nil {
		return move(err)
	}
	if err := s.blobs.Delete(ctx, resource.StoragePath); err != nil {
		return move(err)
	}
	if thumbnail, ok := domain.ThumbnailStoragePath(resource.Metadata); ok {
		if err := s.blobs.Delete(ctx, thumbnail); err != nil {
			slog.Warn("deleting resource thumbnail", "resource", resourceID, "err", err)
		}
	}
	return move(s.store.SoftDelete(ctx, resourceID, time.Now().UnixMilli()))
}

func (s *ResourceService) view(ctx context.Context, resource domain.Resource) (ResourceView, error) {
	url := domain.DownloadRoute(resource.ID)
	if s.storageType == config.StorageR2 {
		presigned, err := s.blobs.PresignedGetURL(ctx, resource.StoragePath, presignedGetTTL)
		if err != nil {
			return ResourceView{}, move(err)
		}
		url = presigned
	}
	var thumbnailURL *string
	if strings.HasPrefix(resource.MimeType, "video/") {
		route := domain.ThumbnailRoute(resource.ID)
		thumbnailURL = &route
	}
	return ResourceView{
		ID:            resource.ID,
		MemoID:        resource.MemoID,
		Filename:      resource.Filename,
		ResourceType:  resource.Type,
		MimeType:      resource.MimeType,
		FileSize:      resource.FileSize,
		StorageType:   resource.StorageType,
		URL:           url,
		ThumbnailURL:  thumbnailURL,
		Metadata:      resource.Metadata,
		AIDescription: resource.AiDescription,
		CreatedAt:     resource.CreatedAt,
	}, nil
}

func (s *ResourceService) storageName() string {
	if s.storageType == config.StorageR2 {
		return string(config.StorageR2)
	}
	return string(config.StorageLocal)
}

func resourceTypeFor(mimeType string) string {
	if strings.HasPrefix(mimeType, "video/") {
		return "video"
	}
	return "image"
}
