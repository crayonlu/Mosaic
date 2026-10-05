package service

import (
	"context"
	"strings"
	"testing"
	"time"

	"github.com/google/uuid"

	"github.com/crayonlu/mosaic/server-go/internal/domain"
)

func TestDateBounds(t *testing.T) {
	start, end, err := DateBounds("2026-02-24", time.UTC)
	if err != nil {
		t.Fatalf("DateBounds: %v", err)
	}
	wantStart := time.Date(2026, time.February, 24, 0, 0, 0, 0, time.UTC).UnixMilli()
	if start != wantStart {
		t.Errorf("start = %d, want %d", start, wantStart)
	}
	if end-start != int64(24*time.Hour/time.Millisecond) {
		t.Errorf("window = %d ms, want one day", end-start)
	}
}

func TestDateBoundsUsesLocation(t *testing.T) {
	shanghai, err := time.LoadLocation("Asia/Shanghai")
	if err != nil {
		t.Skipf("timezone data unavailable: %v", err)
	}
	start, _, err := DateBounds("2026-02-24", shanghai)
	if err != nil {
		t.Fatalf("DateBounds: %v", err)
	}
	want := time.Date(2026, time.February, 24, 0, 0, 0, 0, shanghai).UnixMilli()
	if start != want {
		t.Errorf("start = %d, want %d", start, want)
	}
}

func TestDateBoundsRejectsMalformedDate(t *testing.T) {
	_, _, err := DateBounds("24/02/2026", time.UTC)
	assertKind(t, err, domain.KindInvalidInput)
}

func TestExtractCSXTitle(t *testing.T) {
	cases := []struct {
		name string
		csx  string
		want string
		ok   bool
	}{
		{name: "quoted", csx: `(html (head (title "Hello World")) (body))`, want: "Hello World", ok: true},
		{name: "unquoted", csx: `(head (title Greetings))`, want: "Greetings", ok: true},
		{name: "nested", csx: `(title (span "Hi"))`, want: `(span "Hi")`, ok: true},
		{name: "absent", csx: `(html (body))`, ok: false},
		{name: "empty", csx: `(title "")`, ok: false},
		{name: "unbalanced", csx: `(title "Broken"`, ok: false},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			got, ok := ExtractCSXTitle(tc.csx)
			if ok != tc.ok {
				t.Fatalf("ok = %v, want %v", ok, tc.ok)
			}
			if got != tc.want {
				t.Errorf("title = %q, want %q", got, tc.want)
			}
		})
	}
}

func TestInitialRevision(t *testing.T) {
	memo := domain.Memo{
		ID:        uuid.New(),
		UserID:    uuid.New(),
		Content:   "first",
		Tags:      []string{"work"},
		CreatedAt: 1700000000000,
	}
	revision := InitialRevision(memo)

	if revision.RevisionNumber != domain.DefaultRevisionCount {
		t.Errorf("revision number = %d, want %d", revision.RevisionNumber, domain.DefaultRevisionCount)
	}
	if revision.MemoID != memo.ID || revision.Content != memo.Content {
		t.Errorf("revision does not mirror the memo: %+v", revision)
	}
	if revision.CreatedAt != memo.CreatedAt {
		t.Errorf("created at = %d, want %d", revision.CreatedAt, memo.CreatedAt)
	}
	if revision.Tags == nil {
		t.Error("tags should not be nil")
	}
}

func TestParseUUIDListSkipsMalformedIDs(t *testing.T) {
	valid := uuid.New()
	parsed := ParseUUIDList([]string{valid.String(), "not-a-uuid", ""})
	if len(parsed) != 1 || parsed[0] != valid {
		t.Fatalf("parsed = %v, want only %s", parsed, valid)
	}
}

type stubClipFetcher struct {
	article ClipArticle
	err     error
}

func (s stubClipFetcher) Fetch(context.Context, string) (ClipArticle, error) {
	return s.article, s.err
}

const clipStubReply = `[TITLE]
Refined Title
[/TITLE]

[SUMMARY]
Refined summary.
[/SUMMARY]

[CONTENT]
Refined body.
[/CONTENT]

[TAGS]
one, two
[/TAGS]`

func TestClipURL(t *testing.T) {
	completion := &stubClipCompletion{reply: clipStubReply}
	svc := NewMemoService(nil, nil, stubClipFetcher{
		article: ClipArticle{Title: "Page", Content: "body text"},
	}, time.UTC, NoPipeline{}, stubClipConfigs{}, completion, stubClipImages{})

	url := "https://example.com/a"
	result, err := svc.Clip(context.Background(), uuid.New().String(), ClipInput{
		ClipType: "url",
		URL:      &url,
	})
	if err != nil {
		t.Fatalf("Clip: %v", err)
	}

	// The refined fields come from the model; the source fields describe the
	// fetch that fed it.
	if result.Title != "Refined Title" || result.Content != "Refined body." {
		t.Errorf("the model's output was not returned: %+v", result)
	}
	if result.AiSummary != "Refined summary." || len(result.Tags) != 2 {
		t.Errorf("summary or tags wrong: %+v", result)
	}
	if result.SourceType != "url" || result.SourceURL == nil || *result.SourceURL != url {
		t.Errorf("source fields wrong: %+v", result)
	}
	if result.OriginalTitle == nil || *result.OriginalTitle != "Page" {
		t.Errorf("originalTitle = %v, want the fetched page's title", result.OriginalTitle)
	}

	// The fetched page reached the model.
	if len(completion.requests) != 1 {
		t.Fatalf("the model was called %d times, want 1", len(completion.requests))
	}
	if shown, _ := completion.requests[0].Messages[0].Content.(string); !strings.Contains(shown, "body text") {
		t.Errorf("the model was not shown the page body: %q", shown)
	}
}

func TestClipURLAppendsTheUserNote(t *testing.T) {
	completion := &stubClipCompletion{reply: clipStubReply}
	svc := NewMemoService(nil, nil, stubClipFetcher{
		article: ClipArticle{Title: "Page", Content: "body text"},
	}, time.UTC, NoPipeline{}, stubClipConfigs{}, completion, stubClipImages{})

	url := "https://example.com/a"
	note := "my own take"
	if _, err := svc.Clip(context.Background(), uuid.New().String(), ClipInput{
		ClipType: "url", URL: &url, UserNote: &note,
	}); err != nil {
		t.Fatalf("Clip: %v", err)
	}

	shown, _ := completion.requests[0].Messages[0].Content.(string)
	if !strings.Contains(shown, "User note: my own take") {
		t.Errorf("the user note was not appended: %q", shown)
	}
}

func TestClipImageAttachesTheResource(t *testing.T) {
	completion := &stubClipCompletion{reply: clipStubReply}
	images := stubClipImages{images: []ImageInput{{MimeType: "image/png", Data: []byte("png")}}}
	svc := NewMemoService(nil, nil, stubClipFetcher{}, time.UTC, NoPipeline{},
		stubClipConfigs{}, completion, images)

	resourceID := uuid.New().String()
	result, err := svc.Clip(context.Background(), uuid.New().String(), ClipInput{
		ClipType: "image", ResourceID: &resourceID,
	})
	if err != nil {
		t.Fatalf("Clip: %v", err)
	}
	if result.SourceType != "image" || result.Title != "Refined Title" {
		t.Errorf("unexpected result: %+v", result)
	}

	parts, ok := completion.requests[0].Messages[0].Content.([]any)
	if !ok || len(parts) != 2 {
		t.Fatalf("the image message has %d parts, want text + image", len(parts))
	}
	block, _ := parts[1].(map[string]any)
	imageURL, _ := block["image_url"].(map[string]any)
	if url, _ := imageURL["url"].(string); !strings.HasPrefix(url, "data:image/png;base64,") {
		t.Errorf("image part url = %q", url)
	}
}

func TestClipImageWithoutAResourceIsNotFound(t *testing.T) {
	svc := NewMemoService(nil, nil, stubClipFetcher{}, time.UTC, NoPipeline{},
		stubClipConfigs{}, &stubClipCompletion{reply: clipStubReply}, stubClipImages{})

	resourceID := uuid.New().String()
	_, err := svc.Clip(context.Background(), uuid.New().String(), ClipInput{
		ClipType: "image", ResourceID: &resourceID,
	})
	if err == nil {
		t.Fatal("clipping a missing image succeeded")
	}
}

func TestClipRejections(t *testing.T) {
	svc := NewMemoService(nil, nil, stubClipFetcher{}, time.UTC, NoPipeline{}, stubClipConfigs{}, &stubClipCompletion{}, stubClipImages{})
	userID := uuid.New().String()

	text := "hello"
	cases := []struct {
		name  string
		input ClipInput
	}{
		{name: "url without url", input: ClipInput{ClipType: "url"}},
		{name: "text without content", input: ClipInput{ClipType: "text"}},
		{name: "image unsupported", input: ClipInput{ClipType: "image"}},
		{name: "unknown type", input: ClipInput{ClipType: "video"}},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			_, err := svc.Clip(context.Background(), userID, tc.input)
			assertKind(t, err, domain.KindInvalidInput)
		})
	}

	if _, err := svc.Clip(context.Background(), "not-a-uuid", ClipInput{ClipType: "text", Content: &text}); err == nil {
		t.Error("malformed user id should be rejected")
	}
}

func TestClipTextReturnsTheRefinedContent(t *testing.T) {
	completion := &stubClipCompletion{reply: clipStubReply}
	svc := NewMemoService(nil, nil, stubClipFetcher{}, time.UTC, NoPipeline{},
		stubClipConfigs{}, completion, stubClipImages{})

	content := "a passage"
	result, err := svc.Clip(context.Background(), uuid.New().String(), ClipInput{
		ClipType: "text",
		Content:  &content,
	})
	if err != nil {
		t.Fatalf("Clip: %v", err)
	}
	if result.Content != "Refined body." || result.SourceType != "text" {
		t.Errorf("unexpected result: %+v", result)
	}
	if result.Title != "Refined Title" {
		t.Errorf("title = %q, want the model's", result.Title)
	}

	shown, _ := completion.requests[0].Messages[0].Content.(string)
	if shown != content {
		t.Errorf("the model was shown %q, want the passage", shown)
	}
}

func TestParseClipResponseFallsBackWhenFieldsAreMissing(t *testing.T) {
	bare := ParseClipResponse("just some text")
	if bare.Title != "Untitled" {
		t.Errorf("title = %q, want Untitled", bare.Title)
	}
	if bare.Content != "just some text" {
		t.Errorf("content = %q, want the whole reply", bare.Content)
	}
	if len(bare.Tags) != 0 {
		t.Errorf("tags = %v, want none", bare.Tags)
	}

	partial := ParseClipResponse("[TITLE]\nOnly a title\n[/TITLE]")
	if partial.Title != "Only a title" || partial.Content != "[TITLE]\nOnly a title\n[/TITLE]" {
		t.Errorf("unexpected partial parse: %+v", partial)
	}
}

func TestSplitClipTagsHandlesEverySeparator(t *testing.T) {
	got := splitClipTags("one, two，three four  ,  five")
	want := []string{"one", "two", "three", "four", "five"}
	if len(got) != len(want) {
		t.Fatalf("tags = %v, want %v", got, want)
	}
	for i := range want {
		if got[i] != want[i] {
			t.Fatalf("tags = %v, want %v", got, want)
		}
	}
}
