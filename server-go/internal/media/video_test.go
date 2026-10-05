package media

import (
	"context"
	"errors"
	"testing"

	"github.com/crayonlu/mosaic/server-go/internal/domain"
)

// TestVideoProcessorMissingBinary exercises the injection point and error
// mapping without requiring ffmpeg: a path that cannot be executed must surface
// as a *domain.Error rather than a raw error or a panic.
func TestVideoProcessorMissingBinary(t *testing.T) {
	p := NewVideoProcessor("definitely-not-a-real-ffmpeg-binary")

	if _, err := p.CreateThumbnail(context.Background(), []byte("not really a video")); err == nil {
		t.Fatal("CreateThumbnail succeeded with a missing ffmpeg binary, want error")
	} else {
		var domainErr *domain.Error
		if !errors.As(err, &domainErr) {
			t.Fatalf("CreateThumbnail error = %T (%v), want *domain.Error", err, err)
		}
	}

	if _, err := p.CreateOptimized(context.Background(), []byte("not really a video")); err == nil {
		t.Fatal("CreateOptimized succeeded with a missing ffmpeg binary, want error")
	} else {
		var domainErr *domain.Error
		if !errors.As(err, &domainErr) {
			t.Fatalf("CreateOptimized error = %T (%v), want *domain.Error", err, err)
		}
	}
}
