// Package adapters bridges the concrete infrastructure packages to the narrow
// interfaces the service layer declares. It exists so nothing below the
// composition root has to import a package it does not need.
package adapters

import (
	"context"
	"errors"
	"log/slog"
	"net/http"
	"os"
	"path/filepath"
	"time"

	"github.com/google/uuid"

	"github.com/crayonlu/mosaic/server-go/internal/aiclient"
	"github.com/crayonlu/mosaic/server-go/internal/domain"
	"github.com/crayonlu/mosaic/server-go/internal/service"
	"github.com/crayonlu/mosaic/server-go/internal/storage"
)

// BlobStore presents a storage backend through the smaller interface the
// resource service declares.
type BlobStore struct {
	backend storage.Storage
}

func NewBlobStore(backend storage.Storage) *BlobStore {
	return &BlobStore{backend: backend}
}

// Put writes the bytes and reports the key they are stored under. The backend
// is addressed by the caller-supplied path, so that path is the result.
func (b *BlobStore) Put(
	ctx context.Context,
	path string,
	data []byte,
	mimeType string,
) (string, error) {
	if err := b.backend.Put(ctx, path, data, mimeType); err != nil {
		return "", err
	}
	return path, nil
}

func (b *BlobStore) Get(ctx context.Context, path string) ([]byte, error) {
	return b.backend.Get(ctx, path)
}

func (b *BlobStore) Delete(ctx context.Context, path string) error {
	return b.backend.Delete(ctx, path)
}

// Exists collapses the backend's error into a plain boolean, which is what the
// resource service contracts for. A failing probe is logged and reported as
// absent rather than silently treated as present.
func (b *BlobStore) Exists(ctx context.Context, path string) bool {
	exists, err := b.backend.Exists(ctx, path)
	if err != nil {
		slog.WarnContext(ctx, "probing blob existence", "path", path, "err", err)
		return false
	}
	return exists
}

func (b *BlobStore) PresignedGetURL(
	ctx context.Context,
	path string,
	expires time.Duration,
) (string, error) {
	return b.backend.PresignedGetURL(ctx, path, expires)
}

func (b *BlobStore) PresignedPutURL(
	ctx context.Context,
	path string,
	expires time.Duration,
) (string, error) {
	return b.backend.PresignedPutURL(ctx, path, expires)
}

// Avatars resolves avatars for download and records them on the account.
type Avatars struct {
	users     UserAvatarWriter
	localRoot string
	localOnly bool
}

// UserAvatarWriter is the account write the avatar flow needs.
type UserAvatarWriter interface {
	SetAvatar(ctx context.Context, id uuid.UUID, avatarURL string, now int64) (domain.User, error)
}

// NewAvatars builds the avatar store. localRoot is the storage root used to find
// avatar files; localOnly mirrors the previous server, which serves avatar
// downloads itself only for local storage and hands out presigned R2 URLs
// otherwise.
func NewAvatars(users UserAvatarWriter, localRoot string, localOnly bool) *Avatars {
	return &Avatars{users: users, localRoot: localRoot, localOnly: localOnly}
}

func (a *Avatars) SetAvatar(
	ctx context.Context,
	userID uuid.UUID,
	avatarURL string,
	now int64,
) (domain.User, error) {
	return a.users.SetAvatar(ctx, userID, avatarURL, now)
}

// AvatarBlob finds an avatar file by its identifier. The previous server stored
// avatars under avatars/{userID}/{avatarID} and located them by walking the
// per-user directories, which this reproduces.
func (a *Avatars) AvatarBlob(ctx context.Context, avatarID uuid.UUID) ([]byte, error) {
	if !a.localOnly {
		return nil, domain.ResourceNotFound()
	}

	base := filepath.Join(a.localRoot, "avatars")
	users, err := os.ReadDir(base)
	if err != nil {
		return nil, domain.ResourceNotFound()
	}

	wanted := avatarID.String()
	for _, user := range users {
		if !user.IsDir() {
			continue
		}
		candidate := filepath.Join(base, user.Name(), wanted)
		data, err := os.ReadFile(candidate)
		if err == nil {
			return data, nil
		}
		if !errors.Is(err, os.ErrNotExist) {
			slog.WarnContext(ctx, "reading avatar", "path", candidate, "err", err)
		}
	}
	return nil, domain.ResourceNotFound()
}

// Completer performs chat completions on behalf of the AI endpoints. A provider
// client is built per call from the caller's stored configuration, because the
// model, key and base URL are all per-user.
type Completer struct {
	http *http.Client
}

func NewCompleter(httpClient *http.Client) *Completer {
	return &Completer{http: httpClient}
}

func (c *Completer) Complete(
	ctx context.Context,
	config domain.AIConfig,
	systemPrompt, userMessage string,
) (string, error) {
	client, err := aiclient.New(c.http, aiclient.Config{
		Provider:    config.Provider,
		BaseURL:     config.BaseURL,
		APIKey:      config.APIKey,
		Model:       config.Model,
		Temperature: derefFloat(config.Temperature),
		MaxTokens:   int(derefInt32(config.MaxTokens)),
		Timeout:     secondsToDuration(config.TimeoutSeconds),
	})
	if err != nil {
		return "", err
	}

	reply, err := client.ChatCompletion(ctx, systemPrompt,
		[]aiclient.Message{{Role: "user", Content: userMessage}}, "")
	if err != nil {
		return "", err
	}
	return reply.Content, nil
}

// ChatConfigs reads the caller's stored provider settings.
type ChatConfigs struct {
	configs *service.UserAIConfigService
}

func NewChatConfigs(configs *service.UserAIConfigService) *ChatConfigs {
	return &ChatConfigs{configs: configs}
}

func (c *ChatConfigs) ChatConfig(ctx context.Context, userID uuid.UUID) (domain.AIConfig, error) {
	config, err := c.configs.Get(ctx, userID.String())
	if err != nil {
		return domain.AIConfig{}, err
	}
	if config == nil {
		return domain.AIConfig{}, domain.InvalidInput("AI configuration is not set")
	}
	return config.AIConfig, nil
}

func derefFloat(value *float64) float64 {
	if value == nil {
		return 0
	}
	return *value
}

func derefInt32(value *int32) int32 {
	if value == nil {
		return 0
	}
	return *value
}

func secondsToDuration(value *int32) time.Duration {
	if value == nil || *value <= 0 {
		return 0
	}
	return time.Duration(*value) * time.Second
}
