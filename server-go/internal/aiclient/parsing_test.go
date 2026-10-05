package aiclient

import (
	"errors"
	"reflect"
	"testing"

	"github.com/crayonlu/mosaic/server-go/internal/domain"
)

func TestExtractJSON(t *testing.T) {
	cases := []struct {
		name string
		raw  string
		want string
	}{
		{
			name: "bare object",
			raw:  `{"tags":["work"]}`,
			want: `{"tags":["work"]}`,
		},
		{
			name: "json fence",
			raw:  "```json\n{\"tags\":[\"work\"]}\n```",
			want: `{"tags":["work"]}`,
		},
		{
			name: "plain fence",
			raw:  "```\n[\"work\", \"health\"]\n```",
			want: `["work", "health"]`,
		},
		{
			name: "prose preamble",
			raw:  `Here are the tags: ["学习", "耳机"]`,
			want: `["学习", "耳机"]`,
		},
		{
			name: "uppercase json fence",
			raw:  "```JSON\n[\"a\"]\n```",
			want: `["a"]`,
		},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			got, err := ExtractJSON(tc.raw)
			if err != nil {
				t.Fatalf("ExtractJSON: %v", err)
			}
			if got != tc.want {
				t.Errorf("ExtractJSON = %q, want %q", got, tc.want)
			}
		})
	}
}

func TestExtractJSONRejectsEmpty(t *testing.T) {
	for _, raw := range []string{"", "   ", "```json\n```", "no json here"} {
		if _, err := ExtractJSON(raw); err == nil {
			t.Errorf("ExtractJSON(%q) succeeded, want an error", raw)
		}
	}
}

func TestParseTagList(t *testing.T) {
	cases := []struct {
		name string
		raw  string
		want []string
	}{
		{
			name: "json fence",
			raw:  "```json\n[\"work\", \"health\"]\n```",
			want: []string{"work", "health"},
		},
		{
			name: "prose preamble",
			raw:  `Here are the tags: ["学习", "耳机"]`,
			want: []string{"学习", "耳机"},
		},
		{
			name: "object with labels de-duplicates",
			raw:  `{"labels":["work","work","health"]}`,
			want: []string{"work", "health"},
		},
		{
			name: "delimited plain text",
			raw:  "work, health，travel",
			want: []string{"work", "health", "travel"},
		},
		{
			name: "semicolon delimiters and new lines",
			raw:  "work; health；\ntravel、food",
			want: []string{"work", "health", "travel", "food"},
		},
		{
			name: "normalises prefixes bullets and quotes",
			raw:  `["label: work", "tag:health", "- bullet", "\"quoted\""]`,
			want: []string{"work", "health", "bullet", "quoted"},
		},
		{
			name: "strips a leading hash",
			raw:  `["#hashtag"]`,
			want: []string{"hashtag"},
		},
		{
			name: "chinese label prefix",
			raw:  `["标签：学习", "标签: 耳机"]`,
			want: []string{"学习", "耳机"},
		},
		{
			name: "case-insensitive de-duplication keeps first spelling",
			raw:  `["Work", "work", "WORK"]`,
			want: []string{"Work"},
		},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			got, err := ParseTagList(tc.raw)
			if err != nil {
				t.Fatalf("ParseTagList: %v", err)
			}
			if !reflect.DeepEqual(got, tc.want) {
				t.Errorf("ParseTagList = %v, want %v", got, tc.want)
			}
		})
	}
}

func TestParseTagListBoundsToFour(t *testing.T) {
	got, err := ParseTagList(`["a","b","c","d","e","f"]`)
	if err != nil {
		t.Fatalf("ParseTagList: %v", err)
	}
	want := []string{"a", "b", "c", "d"}
	if !reflect.DeepEqual(got, want) {
		t.Errorf("ParseTagList = %v, want %v", got, want)
	}
}

func TestParseTagListMalformedInputs(t *testing.T) {
	for _, raw := range []string{"", "   ", "```json\n```", "[]", "[}"} {
		_, err := ParseTagList(raw)
		var domainErr *domain.Error
		if !errors.As(err, &domainErr) {
			t.Fatalf("ParseTagList(%q) error = %v, want *domain.Error", raw, err)
		}
	}
}

func TestBuildChatRequestPrependsSystemPrompt(t *testing.T) {
	req := BuildChatRequest("be nice", []Message{{Role: "user", Content: "hello"}}, "gpt", 0.5, 128)

	if req.Model != "gpt" || req.Temperature != 0.5 || req.MaxTokens != 128 {
		t.Errorf("request = %+v, want model gpt / temp 0.5 / max 128", req)
	}
	if len(req.Messages) != 2 {
		t.Fatalf("messages length = %d, want 2", len(req.Messages))
	}
	if req.Messages[0].Role != "system" || req.Messages[0].Content != "be nice" {
		t.Errorf("messages[0] = %+v, want system/be nice", req.Messages[0])
	}
	if req.Messages[1].Role != "user" || req.Messages[1].Content != "hello" {
		t.Errorf("messages[1] = %+v, want user/hello", req.Messages[1])
	}
}

func TestBuildEmbeddingRequest(t *testing.T) {
	req := BuildEmbeddingRequest("embed-model", "some text")
	if req.Model != "embed-model" || req.Input != "some text" {
		t.Errorf("request = %+v, want model/input", req)
	}
}

func TestParseEmbeddingResponse(t *testing.T) {
	got, err := ParseEmbeddingResponse([]byte(`{"data":[{"embedding":[0.5,1.5,-2]}]}`))
	if err != nil {
		t.Fatalf("ParseEmbeddingResponse: %v", err)
	}
	want := []float32{0.5, 1.5, -2}
	if !reflect.DeepEqual(got, want) {
		t.Errorf("vector = %v, want %v", got, want)
	}
}

func TestParseEmbeddingResponseTreatsNonNumbersAsZero(t *testing.T) {
	got, err := ParseEmbeddingResponse([]byte(`{"data":[{"embedding":[1,"oops",null]}]}`))
	if err != nil {
		t.Fatalf("ParseEmbeddingResponse: %v", err)
	}
	want := []float32{1, 0, 0}
	if !reflect.DeepEqual(got, want) {
		t.Errorf("vector = %v, want %v", got, want)
	}
}

func TestParseEmbeddingResponseRejectsMissingVector(t *testing.T) {
	for _, body := range []string{`{}`, `{"data":[]}`, `{"data":[{}]}`, `not json`} {
		if _, err := ParseEmbeddingResponse([]byte(body)); err == nil {
			t.Errorf("ParseEmbeddingResponse(%q) succeeded, want an error", body)
		}
	}
}
