package service

import (
	"context"
	"errors"
	"time"

	"github.com/google/uuid"

	"github.com/crayonlu/mosaic/server-go/internal/config"
	"github.com/crayonlu/mosaic/server-go/internal/domain"
)

// UploadAvatar stores an avatar and records its URL on the account.
func (s *ResourceService) UploadAvatar(
	ctx context.Context,
	userID string,
	_ string,
	data []byte,
	mimeType string,
) (domain.User, error) {
	userUUID, err := uuid.Parse(userID)
	if err != nil {
		return domain.User{}, domain.InvalidUUID(err)
	}
	avatarID := uuid.New()
	storagePath := avatarStoragePath(userUUID, avatarID)
	if _, err := s.blobs.Put(ctx, storagePath, data, mimeType); err != nil {
		return domain.User{}, move(err)
	}

	url := domain.AvatarDownloadRoute(avatarID)
	if s.storageType == config.StorageR2 {
		url, err = s.blobs.PresignedGetURL(ctx, storagePath, avatarURLLifetime)
		if err != nil {
			return domain.User{}, move(err)
		}
	}

	user, err := s.avatars.SetAvatar(ctx, userUUID, url, time.Now().Unix())
	if errors.Is(err, domain.ErrNoRows) {
		return domain.User{}, domain.UserNotFound()
	}
	if err != nil {
		return domain.User{}, move(err)
	}
	return user, nil
}

// DownloadAvatar returns an avatar image by id.
func (s *ResourceService) DownloadAvatar(ctx context.Context, avatarID uuid.UUID) (*Download, error) {
	data, err := s.avatars.AvatarBlob(ctx, avatarID)
	if err != nil {
		return nil, move(err)
	}
	return &Download{Data: data, MimeType: thumbnailMIMEType}, nil
}
