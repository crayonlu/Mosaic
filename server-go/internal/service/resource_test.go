package service

import (
	"testing"

	"github.com/google/uuid"

	"github.com/crayonlu/mosaic/server-go/internal/domain"
)

func TestResolveMimeType(t *testing.T) {
	jpeg := []byte{0xff, 0xd8, 0xff, 0xe0}
	png := []byte("\x89PNG\r\n\x1a\n")

	cases := []struct {
		name     string
		declared string
		data     []byte
		want     string
	}{
		{name: "octet-stream jpeg is sniffed", declared: "application/octet-stream", data: jpeg, want: "image/jpeg"},
		{name: "octet-stream png is sniffed", declared: "application/octet-stream", data: png, want: "image/png"},
		{name: "declared image wins over unrecognised bytes", declared: "image/png", data: []byte("not an image"), want: "image/png"},
		{name: "sniffed jpeg overrides a declared image type", declared: "image/png", data: jpeg, want: "image/jpeg"},
		{name: "non-generic declared type is kept", declared: "text/plain", data: []byte("hello"), want: "text/plain"},
		{name: "generic unrecognised falls back to octet-stream", declared: "application/octet-stream", data: []byte("not an image"), want: "application/octet-stream"},
		{name: "empty unrecognised falls back to octet-stream", declared: "", data: []byte("unknown"), want: "application/octet-stream"},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			if got := domain.ResolveMimeType(tc.declared, "file.bin", tc.data); got != tc.want {
				t.Errorf("ResolveMimeType(%q, ...) = %q, want %q", tc.declared, got, tc.want)
			}
		})
	}
}

func TestResourceStoragePaths(t *testing.T) {
	user := uuid.MustParse("11111111-1111-1111-1111-111111111111")
	resourceID := uuid.MustParse("22222222-2222-2222-2222-222222222222")
	avatarID := uuid.MustParse("33333333-3333-3333-3333-333333333333")
	owner := user.String()

	cases := []struct {
		name string
		got  string
		want string
	}{
		{"resource", resourceStoragePath(user, resourceID), "resources/" + owner + "/" + resourceID.String()},
		{"video thumbnail", videoThumbnailPath(owner, resourceID), "resources/" + owner + "/thumbnails/" + resourceID.String() + ".jpg"},
		{"image thumbnail", imageThumbnailPath(owner, resourceID), "resources/" + owner + "/" + resourceID.String() + "_thumb.jpg"},
		{"optimized image", optimizedImagePath(owner, resourceID), "resources/" + owner + "/" + resourceID.String() + "_opt.webp"},
		{"optimized video", optimizedVideoPath(owner, resourceID), "resources/" + owner + "/" + resourceID.String() + "_opt.mp4"},
		{"avatar", avatarStoragePath(user, avatarID), "avatars/" + owner + "/" + avatarID.String()},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			if tc.got != tc.want {
				t.Errorf("path = %q, want %q", tc.got, tc.want)
			}
		})
	}

	if path, mime := optimizedPath(owner, resourceID, "image/jpeg"); mime != optimizedImageMIME ||
		path != optimizedImagePath(owner, resourceID) {
		t.Errorf("optimizedPath(image) = %q, %q", path, mime)
	}
	if path, mime := optimizedPath(owner, resourceID, "video/mp4"); mime != optimizedVideoMIME ||
		path != optimizedVideoPath(owner, resourceID) {
		t.Errorf("optimizedPath(video) = %q, %q", path, mime)
	}
}

func TestStorageOwner(t *testing.T) {
	user := "11111111-1111-1111-1111-111111111111"
	if got, ok := storageOwner("resources/" + user + "/22222222-2222-2222-2222-222222222222"); !ok || got != user {
		t.Errorf("storageOwner(resource path) = %q, %v", got, ok)
	}
	if _, ok := storageOwner("avatars/" + user + "/id"); ok {
		t.Error("storageOwner should reject avatar paths")
	}
	if _, ok := storageOwner("resources"); ok {
		t.Error("storageOwner should reject a path without an owner segment")
	}
}
