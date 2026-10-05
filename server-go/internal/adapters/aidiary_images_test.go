package adapters

import (
	"context"
	"encoding/base64"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/google/uuid"

	"github.com/crayonlu/mosaic/server-go/internal/domain"
	"github.com/crayonlu/mosaic/server-go/internal/service"
)

// TestAIDiaryRequestCarriesImageParts drives the real adapter against a stub
// provider and asserts the request body it produced carries an image part
// alongside the text, which is what lets the diary describe the day's photos.
func TestAIDiaryRequestCarriesImageParts(t *testing.T) {
	captured := make(chan map[string]any, 1)
	provider := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		var body map[string]any
		_ = json.NewDecoder(r.Body).Decode(&body)
		captured <- body

		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(`{"choices":[{"message":{"content":"{}"}}]}`))
	}))
	defer provider.Close()

	memoID := uuid.New()
	imageBytes := []byte("fake-png-bytes")

	// Build the messages with the shipped builder, then send them through the
	// shipped adapter: both halves of the path are the real ones.
	messages := service.BuildDiaryMessagesWithImages(
		domain.NewDate(time.Date(2026, 4, 11, 0, 0, 0, 0, time.UTC)),
		[]domain.Memo{{
			ID:        memoID,
			Content:   "a day with a photo",
			CreatedAt: time.Now().UnixMilli(),
		}},
		map[uuid.UUID][]service.ImageInput{
			memoID: {{MimeType: "image/png", Data: imageBytes}},
		},
		time.UTC,
	)

	chat := NewAIDiaryChat(provider.Client())
	if _, err := chat.Complete(context.Background(), service.AIDiaryCompletionRequest{
		Config: domain.AIConfig{
			Provider: "stub",
			BaseURL:  provider.URL,
			APIKey:   "key",
			Model:    "model",
		},
		SystemPrompt: "system",
		Messages:     messages,
	}); err != nil {
		t.Fatalf("Complete: %v", err)
	}

	body := <-captured
	encoded, err := json.Marshal(body)
	if err != nil {
		t.Fatalf("re-encoding the captured body: %v", err)
	}
	text := string(encoded)

	if !strings.Contains(text, "a day with a photo") {
		t.Errorf("the request does not carry the memo text: %s", text)
	}
	if !strings.Contains(text, "image_url") {
		t.Fatalf("the request carries no image part: %s", text)
	}

	want := "data:image/png;base64," + base64.StdEncoding.EncodeToString(imageBytes)
	if !strings.Contains(text, want) {
		t.Errorf("the image part does not carry the expected data URL")
	}

	// The provider request is the system prompt, then the day's preamble, then
	// one message per memo. The image belongs to the memo's own message.
	raw, _ := body["messages"].([]any)
	if len(raw) != 3 {
		t.Fatalf("the request has %d messages, want system + preamble + one memo", len(raw))
	}
	system, _ := raw[0].(map[string]any)
	if system["role"] != "system" {
		t.Errorf("the first message role is %v, want system", system["role"])
	}
	memoMessage, _ := raw[2].(map[string]any)
	parts, ok := memoMessage["content"].([]any)
	if !ok || len(parts) != 2 {
		t.Fatalf("the memo message has %d parts, want text + image", len(parts))
	}
	first, _ := parts[0].(map[string]any)
	if first["type"] != "text" {
		t.Errorf("the first part is %v, want the text block", first["type"])
	}
	second, _ := parts[1].(map[string]any)
	if second["type"] != "image_url" {
		t.Errorf("the second part is %v, want the image block", second["type"])
	}
}

// TestAIDiaryMessagesStayTextOnlyWithoutImages keeps the plain path unchanged.
func TestAIDiaryMessagesStayTextOnlyWithoutImages(t *testing.T) {
	messages := service.BuildDiaryMessagesWithImages(
		domain.NewDate(time.Date(2026, 4, 11, 0, 0, 0, 0, time.UTC)),
		[]domain.Memo{{ID: uuid.New(), Content: "no photos today"}},
		nil,
		time.UTC,
	)

	for _, message := range messages {
		if len(message.Images) != 0 {
			t.Errorf("message %q carries %d images, want none", message.Content, len(message.Images))
		}
	}
}

// TestDiaryImagesRespectTheByteBudget proves an oversized image is skipped
// rather than truncated into the request.
func TestDiaryImagesRespectTheByteBudget(t *testing.T) {
	small := uuid.New()
	huge := uuid.New()

	oversized := make([]byte, 5<<20) // beyond the budget
	messages := service.BuildDiaryMessagesWithImages(
		domain.NewDate(time.Date(2026, 4, 11, 0, 0, 0, 0, time.UTC)),
		[]domain.Memo{
			{ID: small, Content: "first"},
			{ID: huge, Content: "second"},
		},
		map[uuid.UUID][]service.ImageInput{
			small: {{MimeType: "image/png", Data: []byte("small")}},
			huge:  {{MimeType: "image/png", Data: oversized}},
		},
		time.UTC,
	)

	// The preamble is first, then one message per memo in order.
	if got := len(messages[1].Images); got != 1 {
		t.Errorf("the small image was not attached: %d", got)
	}
	if got := len(messages[2].Images); got != 0 {
		t.Errorf("the oversized image was attached (%d), want it skipped", got)
	}
}
