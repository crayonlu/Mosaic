package media

import (
	"context"
	"fmt"
	"os"
	"os/exec"
	"path/filepath"

	"github.com/google/uuid"

	"github.com/crayonlu/mosaic/server-go/internal/domain"
)

// Video rendition settings, unchanged from the previous server.
const (
	videoThumbnailWidth = 640
	videoOptimizedWidth = 1280
	videoCRF            = "23"
	videoAudioBitrate   = "128k"
)

// VideoProcessor shells out to ffmpeg to derive a thumbnail and an optimized
// rendition. The binary path is injected so deployments can pin a build without
// touching the code.
type VideoProcessor struct {
	ffmpegBinary string
}

func NewVideoProcessor(ffmpegBinary string) *VideoProcessor {
	return &VideoProcessor{ffmpegBinary: ffmpegBinary}
}

// CreateThumbnail extracts the first frame and scales it to a 640-wide JPEG.
func (p *VideoProcessor) CreateThumbnail(ctx context.Context, input []byte) ([]byte, error) {
	return p.run(ctx, input, "thumb.jpg", []string{
		"-frames:v", "1",
		"-vf", fmt.Sprintf("scale=%d:-2", videoThumbnailWidth),
		"-q:v", "5",
	})
}

// CreateOptimized transcodes to H.265 at 1280 wide, CRF 23, with 128k AAC audio.
func (p *VideoProcessor) CreateOptimized(ctx context.Context, input []byte) ([]byte, error) {
	return p.run(ctx, input, "opt.mp4", []string{
		"-vf", fmt.Sprintf("scale=%d:-2", videoOptimizedWidth),
		"-c:v", "libx265",
		"-crf", videoCRF,
		"-c:a", "aac",
		"-b:a", videoAudioBitrate,
		"-movflags", "+faststart",
	})
}

// run writes the upload to a scratch file, invokes ffmpeg with the fixed leading
// flags, and returns the produced file. Scratch files are removed afterwards.
func (p *VideoProcessor) run(ctx context.Context, input []byte, suffix string, args []string) ([]byte, error) {
	id := uuid.NewString()
	inputPath := filepath.Join(os.TempDir(), "mosaic_"+id+"_input.mp4")
	outputPath := filepath.Join(os.TempDir(), "mosaic_"+id+"_"+suffix)

	if err := os.WriteFile(inputPath, input, 0o600); err != nil {
		return nil, domain.Internal(err)
	}
	defer os.Remove(inputPath)
	defer os.Remove(outputPath)

	full := append([]string{
		"-hide_banner", "-loglevel", "error", "-y",
		"-i", inputPath,
	}, args...)
	full = append(full, outputPath)

	out, err := exec.CommandContext(ctx, p.ffmpegBinary, full...).CombinedOutput()
	if err != nil {
		return nil, domain.Internal(fmt.Errorf("ffmpeg: %w: %s", err, out))
	}

	data, err := os.ReadFile(outputPath)
	if err != nil {
		return nil, domain.Internal(err)
	}
	return data, nil
}
