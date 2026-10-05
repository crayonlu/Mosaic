package integration

import (
	"bytes"
	"context"
	"encoding/json"
	"image"
	"image/color"
	"image/png"
	"mime/multipart"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"
)

// tinyPNG builds a real image so the upload path sees genuine bytes.
func tinyPNG(t *testing.T) []byte {
	t.Helper()

	img := image.NewRGBA(image.Rect(0, 0, 4, 4))
	for x := 0; x < 4; x++ {
		for y := 0; y < 4; y++ {
			img.Set(x, y, color.RGBA{R: 10, G: 200, B: 30, A: 255})
		}
	}

	var buffer bytes.Buffer
	if err := png.Encode(&buffer, img); err != nil {
		t.Fatalf("encoding the test image: %v", err)
	}
	return buffer.Bytes()
}

// uploadImage drives the real multipart upload handler.
func (h *harness) uploadImage(t *testing.T, filename string, data []byte) *httptest.ResponseRecorder {
	t.Helper()

	var body bytes.Buffer
	writer := multipart.NewWriter(&body)
	part, err := writer.CreateFormFile("file", filename)
	if err != nil {
		t.Fatalf("building the multipart body: %v", err)
	}
	if _, err := part.Write(data); err != nil {
		t.Fatalf("writing the image: %v", err)
	}
	if err := writer.Close(); err != nil {
		t.Fatalf("closing the multipart body: %v", err)
	}

	req := httptest.NewRequest(http.MethodPost, "/api/resources/upload", &body)
	req.Header.Set("Content-Type", writer.FormDataContentType())
	req.Header.Set("Authorization", "Bearer "+h.token)

	rec := httptest.NewRecorder()
	h.handler.ServeHTTP(rec, req)
	return rec
}

// TestImageUploadStoresAVisionDescription proves an uploaded image is described
// when the account's provider can see, and left alone when it cannot.
func TestImageUploadStoresAVisionDescription(t *testing.T) {
	h := newHarness(t)

	h.chat.setScript("A green square on a plain background.")
	h.configs.vision = true

	rec := h.uploadImage(t, "picture.png", tinyPNG(t))
	if rec.Code != http.StatusOK {
		t.Fatalf("upload = %d, want 200 (body %s)", rec.Code, rec.Body)
	}

	var uploaded struct {
		ID string `json:"id"`
	}
	if err := json.Unmarshal(rec.Body.Bytes(), &uploaded); err != nil {
		t.Fatalf("decoding the upload response: %v", err)
	}
	if uploaded.ID == "" {
		t.Fatal("the upload response carried no id")
	}

	waitFor(t, "the stored description", func() bool {
		var description *string
		if err := h.pool.QueryRow(context.Background(),
			`SELECT ai_description FROM resources WHERE id = $1`, uploaded.ID).Scan(&description); err != nil {
			return false
		}
		return description != nil && *description != ""
	})

	var description *string
	if err := h.pool.QueryRow(context.Background(),
		`SELECT ai_description FROM resources WHERE id = $1`, uploaded.ID).Scan(&description); err != nil {
		t.Fatalf("reading the description: %v", err)
	}
	if *description != "A green square on a plain background." {
		t.Errorf("description = %q, want the model's trimmed reply", *description)
	}

	// The request the provider saw must carry the image alongside the prompt.
	requests := h.chat.requestsSnapshot()
	if len(requests) == 0 {
		t.Fatal("the provider was never called")
	}
	last := requests[len(requests)-1]
	parts, ok := last.Messages[0].Content.([]any)
	if !ok || len(parts) != 2 {
		t.Fatalf("the description message has %d parts, want text + image", len(parts))
	}
	block, _ := parts[1].(map[string]any)
	imageURL, _ := block["image_url"].(map[string]any)
	if url, _ := imageURL["url"].(string); len(url) < 22 || url[:22] != "data:image/png;base64," {
		t.Errorf("image part url = %q, want a png data URL", url)
	}
}

// TestImageUploadWithoutVisionStoresNoDescription is the other half of the
// contract: a text-only provider must not be asked to describe an image.
func TestImageUploadWithoutVisionStoresNoDescription(t *testing.T) {
	h := newHarness(t)

	h.chat.setScript("this should never be stored")
	h.configs.vision = false

	before := h.chat.requestCount()

	rec := h.uploadImage(t, "picture.png", tinyPNG(t))
	if rec.Code != http.StatusOK {
		t.Fatalf("upload = %d, want 200 (body %s)", rec.Code, rec.Body)
	}

	var uploaded struct {
		ID string `json:"id"`
	}
	if err := json.Unmarshal(rec.Body.Bytes(), &uploaded); err != nil {
		t.Fatalf("decoding the upload response: %v", err)
	}

	// Give a stray goroutine time to prove it does nothing.
	time.Sleep(400 * time.Millisecond)

	var description *string
	if err := h.pool.QueryRow(context.Background(),
		`SELECT ai_description FROM resources WHERE id = $1`, uploaded.ID).Scan(&description); err != nil {
		t.Fatalf("reading the description: %v", err)
	}
	if description != nil {
		t.Errorf("description = %q, want none when vision is disabled", *description)
	}
	if got := h.chat.requestCount(); got != before {
		t.Errorf("the provider was called %d times with vision disabled, want 0", got-before)
	}
}
