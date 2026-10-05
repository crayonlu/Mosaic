// Package media derives smaller egress renditions from stored uploads. It ports
// the Rust image and video processors, matching their observable output.
package media

import (
	"bytes"
	"image"
	// Decoders registered so image.Decode can sniff the formats the previous
	// server accepted.
	_ "image/gif"
	"image/jpeg"
	_ "image/png"

	"github.com/HugoSmits86/nativewebp"
	"golang.org/x/image/draw"

	"github.com/crayonlu/mosaic/server-go/internal/domain"
)

// Thumbnail settings, unchanged from the previous server.
const (
	thumbnailWidth   = 320
	thumbnailQuality = 70
)

// ImageProcessor produces JPEG thumbnails and lossless WebP renditions.
type ImageProcessor struct{}

func NewImageProcessor() *ImageProcessor { return &ImageProcessor{} }

// CreateThumbnail decodes input, downscales it to thumbnailWidth when it is
// wider than that, and re-encodes it as a JPEG.
func (p *ImageProcessor) CreateThumbnail(input []byte) ([]byte, error) {
	img, err := decodeImage(input)
	if err != nil {
		return nil, err
	}

	resized := resizeToWidth(img, thumbnailWidth)

	var out bytes.Buffer
	if err := jpeg.Encode(&out, rgbImage(resized), &jpeg.Options{Quality: thumbnailQuality}); err != nil {
		return nil, domain.Internal(err)
	}
	return out.Bytes(), nil
}

// CreateOptimized decodes input and re-encodes it as a lossless WebP image at
// its original dimensions.
func (p *ImageProcessor) CreateOptimized(input []byte) ([]byte, error) {
	img, err := decodeImage(input)
	if err != nil {
		return nil, err
	}

	var out bytes.Buffer
	if err := nativewebp.Encode(&out, rgbImage(img), nil); err != nil {
		return nil, domain.Internal(err)
	}
	return out.Bytes(), nil
}

func decodeImage(input []byte) (image.Image, error) {
	img, _, err := image.Decode(bytes.NewReader(input))
	if err != nil {
		return nil, domain.Internal(err)
	}
	return img, nil
}

// resizeToWidth scales img to the target width and a proportional height, but
// only when the source is wider than the target; otherwise it is returned as is.
func resizeToWidth(img image.Image, targetWidth int) image.Image {
	b := img.Bounds()
	if targetWidth <= 0 || b.Dx() <= targetWidth {
		return img
	}

	// The previous server computed the height in f32, so the same arithmetic is
	// kept here to land on identical pixel dimensions after truncation.
	ratio := float32(targetWidth) / float32(b.Dx())
	height := int(float32(b.Dy()) * ratio)
	if height < 1 {
		height = 1
	}

	// golang.org/x/image/draw exports no Lanczos resampler. CatmullRom is its
	// closest high-quality cubic kernel, so it stands in for Lanczos3.
	dst := image.NewNRGBA(image.Rect(0, 0, targetWidth, height))
	draw.CatmullRom.Scale(dst, dst.Bounds(), img, b, draw.Src, nil)
	return dst
}

// rgbImage converts src to straight RGB, dropping any alpha channel to match
// the previous server's conversion to RGB8 before encoding.
func rgbImage(src image.Image) *image.NRGBA {
	b := src.Bounds()
	dst := image.NewNRGBA(image.Rect(0, 0, b.Dx(), b.Dy()))
	draw.Draw(dst, dst.Bounds(), src, b.Min, draw.Src)
	for i := 3; i < len(dst.Pix); i += 4 {
		dst.Pix[i] = 0xff
	}
	return dst
}
