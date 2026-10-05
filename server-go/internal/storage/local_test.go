package storage

import (
	"bytes"
	"context"
	"errors"
	"testing"

	"github.com/crayonlu/mosaic/server-go/internal/domain"
)

func newLocal(t *testing.T) *LocalStorage {
	t.Helper()
	store, err := NewLocalStorage(t.TempDir())
	if err != nil {
		t.Fatalf("NewLocalStorage: %v", err)
	}
	return store
}

// mustExists fails the test unless Exists reports the expected value.
func mustExists(t *testing.T, store *LocalStorage, path string, want bool) {
	t.Helper()
	got, err := store.Exists(context.Background(), path)
	if err != nil {
		t.Fatalf("Exists(%q): %v", path, err)
	}
	if got != want {
		t.Errorf("Exists(%q) = %v, want %v", path, got, want)
	}
}

func TestLocalPutGetRoundTrip(t *testing.T) {
	store := newLocal(t)
	ctx := context.Background()
	want := []byte{0x00, 0x01, 0xfe, 0xff, 'h', 'i', '\n'}

	if err := store.Put(ctx, "blobs/one.bin", want, "application/octet-stream"); err != nil {
		t.Fatalf("Put: %v", err)
	}

	got, err := store.Get(ctx, "blobs/one.bin")
	if err != nil {
		t.Fatalf("Get: %v", err)
	}
	if !bytes.Equal(got, want) {
		t.Errorf("Get returned %v, want %v", got, want)
	}
}

func TestLocalNestedPathIsCreated(t *testing.T) {
	store := newLocal(t)
	ctx := context.Background()
	const nested = "a/b/c/deep.bin"

	if err := store.Put(ctx, nested, []byte("deep"), ""); err != nil {
		t.Fatalf("Put: %v", err)
	}
	mustExists(t, store, nested, true)
	got, err := store.Get(ctx, nested)
	if err != nil {
		t.Fatalf("Get: %v", err)
	}
	if string(got) != "deep" {
		t.Errorf("Get returned %q, want %q", got, "deep")
	}
}

func TestLocalExistsTracksDelete(t *testing.T) {
	store := newLocal(t)
	ctx := context.Background()
	const path = "gone.bin"

	if err := store.Put(ctx, path, []byte("x"), ""); err != nil {
		t.Fatalf("Put: %v", err)
	}
	mustExists(t, store, path, true)
	if err := store.Delete(ctx, path); err != nil {
		t.Fatalf("Delete: %v", err)
	}
	mustExists(t, store, path, false)
}

func TestLocalGetMissingReturnsDomainError(t *testing.T) {
	store := newLocal(t)

	_, err := store.Get(context.Background(), "missing.bin")
	var domainErr *domain.Error
	if !errors.As(err, &domainErr) {
		t.Fatalf("Get error = %v, want a *domain.Error", err)
	}
	if domainErr.Kind != domain.KindNotFound {
		t.Errorf("error kind = %v, want %v", domainErr.Kind, domain.KindNotFound)
	}
}

func TestLocalExistsMissingIsNotAnError(t *testing.T) {
	store := newLocal(t)

	exists, err := store.Exists(context.Background(), "never-written.bin")
	if err != nil {
		t.Fatalf("Exists: %v", err)
	}
	if exists {
		t.Fatal("Exists = true for a blob that was never written")
	}
}

func TestLocalPresignedURLSemantics(t *testing.T) {
	store := newLocal(t)
	ctx := context.Background()

	url, err := store.PresignedGetURL(ctx, "blobs/one.bin", 0)
	if err != nil {
		t.Fatalf("PresignedGetURL: %v", err)
	}
	if want := "/api/resources/download/blobs/one.bin"; url != want {
		t.Errorf("PresignedGetURL = %q, want %q", url, want)
	}

	if _, err := store.PresignedPutURL(ctx, "blobs/one.bin", 0); err == nil {
		t.Fatal("PresignedPutURL succeeded, want an error for local storage")
	} else {
		var domainErr *domain.Error
		if !errors.As(err, &domainErr) {
			t.Fatalf("PresignedPutURL error = %v, want a *domain.Error", err)
		}
	}
}
