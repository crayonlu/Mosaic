// Package storage abstracts blob persistence behind a small interface so the
// rest of the server can write files to the local filesystem during development
// and to an S3-compatible bucket (Cloudflare R2) in production.
package storage

import (
	"context"
	"time"

	"github.com/crayonlu/mosaic/server-go/internal/domain"
)

// Backend names a blob storage implementation.
type Backend string

const (
	// BackendLocal stores blobs on the local filesystem.
	BackendLocal Backend = "local"
	// BackendR2 stores blobs in an S3-compatible bucket.
	BackendR2 Backend = "r2"
)

// Config selects and configures a backend. It carries the storage-related
// values without depending on the config package.
type Config struct {
	Backend   Backend
	LocalPath string
	S3        S3Config
}

// Storage stores and serves blobs addressed by opaque, slash-separated paths.
// It mirrors the previous server's storage trait.
type Storage interface {
	// Put writes data under path. mimeType is recorded by backends that support
	// object metadata and ignored otherwise.
	Put(ctx context.Context, path string, data []byte, mimeType string) error
	// Get reads the blob stored at path.
	Get(ctx context.Context, path string) ([]byte, error)
	// Delete removes the blob stored at path.
	Delete(ctx context.Context, path string) error
	// Exists reports whether a blob is present. A missing blob reports
	// (false, nil); only backend failures report an error.
	Exists(ctx context.Context, path string) (bool, error)
	// PresignedGetURL returns a time-limited download URL for path.
	PresignedGetURL(ctx context.Context, path string, expires time.Duration) (string, error)
	// PresignedPutURL returns a time-limited upload URL for path. Backends that
	// cannot be written to directly return an error.
	PresignedPutURL(ctx context.Context, path string, expires time.Duration) (string, error)
}

// New builds the backend selected by cfg. An empty backend selects local
// storage, matching the previous server's default.
func New(cfg Config) (Storage, error) {
	switch cfg.Backend {
	case "", BackendLocal:
		return NewLocalStorage(cfg.LocalPath)
	case BackendR2:
		return NewS3Storage(cfg.S3)
	default:
		return nil, domain.InvalidInputf("unknown storage backend %q", cfg.Backend)
	}
}
