package media

import (
	"bytes"
	"errors"
	"image"
	"image/color"
	"image/jpeg"
	"image/png"
	"testing"

	"golang.org/x/image/webp"

	"github.com/crayonlu/mosaic/server-go/internal/domain"
)

// encodeSourcePNG builds an in-memory PNG of the requested size so the tests
// never depend on fixture files or the network.
func encodeSourcePNG(t *testing.T, width, height int) []byte {
	t.Helper()
	src := image.NewRGBA(image.Rect(0, 0, width, height))
	for y := 0; y < height; y++ {
		for x := 0; x < width; x++ {
			src.SetRGBA(x, y, color.RGBA{
				R: uint8(x),
				G: uint8(y),
				B: uint8(x ^ y),
				A: 255,
			})
		}
	}
	var buf bytes.Buffer
	if err := png.Encode(&buf, src); err != nil {
		t.Fatalf("encode source png: %v", err)
	}
	return buf.Bytes()
}

func TestCreateThumbnailResizesToTargetWidth(t *testing.T) {
	p := NewImageProcessor()

	out, err := p.CreateThumbnail(encodeSourcePNG(t, 800, 600))
	if err != nil {
		t.Fatalf("CreateThumbnail: %v", err)
	}

	img, err := jpeg.Decode(bytes.NewReader(out))
	if err != nil {
		t.Fatalf("decode thumbnail as jpeg: %v", err)
	}
	if got := img.Bounds().Dx(); got != 320 {
		t.Errorf("thumbnail width = %d, want 320", got)
	}
	// 800x600 scaled to 320 wide preserves the 4:3 ratio: height 240.
	if got := img.Bounds().Dy(); got != 240 {
		t.Errorf("thumbnail height = %d, want 240", got)
	}
}

func TestCreateThumbnailKeepsNarrowSource(t *testing.T) {
	p := NewImageProcessor()

	out, err := p.CreateThumbnail(encodeSourcePNG(t, 200, 120))
	if err != nil {
		t.Fatalf("CreateThumbnail: %v", err)
	}

	img, err := jpeg.Decode(bytes.NewReader(out))
	if err != nil {
		t.Fatalf("decode thumbnail as jpeg: %v", err)
	}
	if got := img.Bounds().Dx(); got != 200 {
		t.Errorf("thumbnail width = %d, want 200 (unchanged)", got)
	}
	if got := img.Bounds().Dy(); got != 120 {
		t.Errorf("thumbnail height = %d, want 120 (unchanged)", got)
	}
}

func TestCreateOptimizedProducesLosslessWebP(t *testing.T) {
	p := NewImageProcessor()

	out, err := p.CreateOptimized(encodeSourcePNG(t, 640, 480))
	if err != nil {
		t.Fatalf("CreateOptimized: %v", err)
	}
	if len(out) < 12 || string(out[0:4]) != "RIFF" || string(out[8:12]) != "WEBP" {
		t.Fatalf("output is not a RIFF/WEBP container: % x", out[:min(len(out), 12)])
	}

	img, err := webp.Decode(bytes.NewReader(out))
	if err != nil {
		t.Fatalf("decode optimized as webp: %v", err)
	}
	if got := img.Bounds().Dx(); got != 640 {
		t.Errorf("optimized width = %d, want 640", got)
	}
	if got := img.Bounds().Dy(); got != 480 {
		t.Errorf("optimized height = %d, want 480", got)
	}
}

func TestCreateThumbnailRejectsNonImage(t *testing.T) {
	p := NewImageProcessor()

	if _, err := p.CreateThumbnail([]byte("this is not an image")); err == nil {
		t.Fatal("CreateThumbnail succeeded on non-image input, want error")
	} else {
		var domainErr *domain.Error
		if !errors.As(err, &domainErr) {
			t.Fatalf("CreateThumbnail error = %T (%v), want *domain.Error", err, err)
		}
	}
}

func TestCreateOptimizedRejectsNonImage(t *testing.T) {
	p := NewImageProcessor()

	if _, err := p.CreateOptimized([]byte("this is not an image")); err == nil {
		t.Fatal("CreateOptimized succeeded on non-image input, want error")
	} else {
		var domainErr *domain.Error
		if !errors.As(err, &domainErr) {
			t.Fatalf("CreateOptimized error = %T (%v), want *domain.Error", err, err)
		}
	}
}
