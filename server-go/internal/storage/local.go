package storage

import (
	"context"
	"errors"
	"fmt"
	"os"
	"path/filepath"
	"strings"
	"time"

	"github.com/crayonlu/mosaic/server-go/internal/domain"
)

// downloadPrefix is the route that serves local blobs.
const downloadPrefix = "/api/resources/download/"

// LocalStorage keeps blobs on the local filesystem beneath a base directory.
type LocalStorage struct {
	basePath string
}

// NewLocalStorage creates the base directory when it is missing and resolves it
// to an absolute, symlink-free path so every later lookup can be checked
// against it.
func NewLocalStorage(basePath string) (*LocalStorage, error) {
	if err := os.MkdirAll(basePath, 0o755); err != nil {
		return nil, domain.Internal(fmt.Errorf("creating storage directory: %w", err))
	}
	abs, err := filepath.Abs(basePath)
	if err != nil {
		return nil, domain.Internal(fmt.Errorf("resolving storage directory: %w", err))
	}
	if resolved, err := filepath.EvalSymlinks(abs); err == nil {
		abs = resolved
	}
	return &LocalStorage{basePath: abs}, nil
}

// resolve joins path onto the base directory and rejects anything that escapes
// it, including absolute paths and ".." traversal. Paths that do not exist yet
// are normalised lexically, as the previous server did.
func (s *LocalStorage) resolve(path string) (string, error) {
	full := path
	if !filepath.IsAbs(path) {
		full = filepath.Join(s.basePath, path)
	}
	resolved, err := filepath.EvalSymlinks(full)
	if err != nil {
		resolved = filepath.Clean(full)
	}
	if !within(s.basePath, resolved) {
		return "", domain.InvalidInputf("path traversal detected: %s", path)
	}
	return resolved, nil
}

// within reports whether target is base itself or lies beneath it.
func within(base, target string) bool {
	rel, err := filepath.Rel(base, target)
	if err != nil {
		return false
	}
	return rel == "." || (rel != ".." && !strings.HasPrefix(rel, ".."+string(os.PathSeparator)))
}

// Put writes data to path, creating intermediate directories.
func (s *LocalStorage) Put(_ context.Context, path string, data []byte, _ string) error {
	full, err := s.resolve(path)
	if err != nil {
		return err
	}
	if err := os.MkdirAll(filepath.Dir(full), 0o755); err != nil {
		return blobError("creating blob directory", err)
	}
	if err := os.WriteFile(full, data, 0o644); err != nil {
		return blobError("writing blob", err)
	}
	return nil
}

// Get reads the blob at path.
func (s *LocalStorage) Get(_ context.Context, path string) ([]byte, error) {
	full, err := s.resolve(path)
	if err != nil {
		return nil, err
	}
	data, err := os.ReadFile(full)
	if err != nil {
		return nil, blobError("reading blob", err)
	}
	return data, nil
}

// Delete removes the blob at path.
func (s *LocalStorage) Delete(_ context.Context, path string) error {
	full, err := s.resolve(path)
	if err != nil {
		return err
	}
	if err := os.Remove(full); err != nil {
		return blobError("deleting blob", err)
	}
	return nil
}

// Exists reports whether a blob is present. A missing file reports
// (false, nil); a rejected or unreadable path reports an error.
func (s *LocalStorage) Exists(_ context.Context, path string) (bool, error) {
	full, err := s.resolve(path)
	if err != nil {
		return false, err
	}
	if _, err := os.Stat(full); err != nil {
		if errors.Is(err, os.ErrNotExist) {
			return false, nil
		}
		return false, blobError("checking blob", err)
	}
	return true, nil
}

// PresignedGetURL returns the local download route for path. Expiry is not
// meaningful for files served by this server.
func (s *LocalStorage) PresignedGetURL(_ context.Context, path string, _ time.Duration) (string, error) {
	return downloadPrefix + path, nil
}

// PresignedPutURL always fails: local blobs are written through the API, not
// uploaded directly by a client.
func (s *LocalStorage) PresignedPutURL(_ context.Context, _ string, _ time.Duration) (string, error) {
	return "", domain.InvalidInputf("direct upload not supported for local storage")
}

// blobError maps a filesystem failure onto a domain error, translating a
// missing file into a not-found result.
func blobError(action string, err error) *domain.Error {
	if errors.Is(err, os.ErrNotExist) {
		return domain.ResourceNotFound()
	}
	return domain.Internal(fmt.Errorf("%s: %w", action, err))
}
