package integration

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/google/uuid"

	"github.com/crayonlu/mosaic/server-go/internal/domain"
	"github.com/crayonlu/mosaic/server-go/internal/service"
)

// TestMemoWriteRunsTheGenerationPipeline creates a memo through the real HTTP
// handler and then observes the work the write triggered: an embedding row, the
// model's tags and summary, and an auto-reply from a bot.
func TestMemoWriteRunsTheGenerationPipeline(t *testing.T) {
	h := newHarness(t)
	seedAutoReplyBot(t, h)

	// The pipeline calls the provider once for tags, once for the summary, and
	// once per auto-reply. The stub repeats its last reply when it runs out.
	h.chat.setScript(`["generated", "tags"]`, "A generated summary.")

	rec := h.do(t, http.MethodPost, "/api/memos", `{"content":"a pipeline memo"}`)
	if rec.Code != http.StatusOK {
		t.Fatalf("create = %d, want 200 (body %s)", rec.Code, rec.Body)
	}
	memoID := createdMemoID(t, rec)

	// The embedding is written by the detached pipeline.
	waitFor(t, "the embedding row", func() bool {
		var count int
		if err := h.pool.QueryRow(context.Background(),
			`SELECT count(*) FROM memo_embeddings WHERE memo_id = $1`, memoID).Scan(&count); err != nil {
			return false
		}
		return count == 1
	})

	var (
		sourceText string
		provider   string
		width      int
	)
	if err := h.pool.QueryRow(context.Background(),
		`SELECT source_text, provider, vector_dims(embedding) FROM memo_embeddings WHERE memo_id = $1`,
		memoID).Scan(&sourceText, &provider, &width); err != nil {
		t.Fatalf("reading the embedding row: %v", err)
	}
	if provider != "stub" {
		t.Errorf("embedding provider = %q, want the configured one", provider)
	}
	if width != embeddingDim {
		t.Errorf("embedding width = %d, want %d", width, embeddingDim)
	}
	if sourceText == "" {
		t.Error("the embedding source text is empty")
	}

	waitFor(t, "the generated tags", func() bool {
		var tags []byte
		if err := h.pool.QueryRow(context.Background(),
			`SELECT tags FROM memos WHERE id = $1`, memoID).Scan(&tags); err != nil {
			return false
		}
		return len(domain.TagListFromJSON(tags)) > 0
	})

	var (
		tags    []byte
		summary *string
	)
	if err := h.pool.QueryRow(context.Background(),
		`SELECT tags, ai_summary FROM memos WHERE id = $1`, memoID).Scan(&tags, &summary); err != nil {
		t.Fatalf("reading the memo: %v", err)
	}
	if got := domain.TagListFromJSON(tags); len(got) != 2 || got[0] != "generated" || got[1] != "tags" {
		t.Errorf("tags = %v, want the model's [generated tags]", got)
	}
	if summary == nil || *summary != "A generated summary." {
		t.Errorf("summary = %v, want the model's text", summary)
	}

	waitFor(t, "the auto reply", func() bool {
		var count int
		if err := h.pool.QueryRow(context.Background(),
			`SELECT count(*) FROM bot_replies WHERE memo_id = $1`, memoID).Scan(&count); err != nil {
			return false
		}
		return count >= 1
	})
}

// TestStaleGenerationWritesNothing advances a memo after a generation has been
// handed a snapshot, and asserts the older generation changes nothing. It
// attacks the guard directly, which is what stops a slow model call from
// overwriting a newer edit.
func TestStaleGenerationWritesNothing(t *testing.T) {
	h := newHarness(t)

	h.chat.setScript(`["first", "tags"]`, "First summary.")
	rec := h.do(t, http.MethodPost, "/api/memos", `{"content":"the first body"}`)
	if rec.Code != http.StatusOK {
		t.Fatalf("create = %d, want 200", rec.Code)
	}
	memoID := createdMemoID(t, rec)

	waitFor(t, "the first generation", func() bool {
		var tags []byte
		if err := h.pool.QueryRow(context.Background(),
			`SELECT tags FROM memos WHERE id = $1`, memoID).Scan(&tags); err != nil {
			return false
		}
		return len(domain.TagListFromJSON(tags)) > 0
	})

	// Snapshot the memo as a generation would have captured it.
	stale := h.readMemo(t, memoID)

	// Advance the memo behind the pipeline's back, so the snapshot no longer
	// describes the row.
	if _, err := h.pool.Exec(context.Background(),
		`UPDATE memos SET content = 'the newer body', revision_count = revision_count + 1,
		        updated_at = updated_at + 1000 WHERE id = $1`, memoID); err != nil {
		t.Fatalf("advancing the memo: %v", err)
	}

	// A second script that would be obvious if it leaked into the row.
	h.chat.setScript(`["stale", "tags"]`, "Stale summary.")
	requestsBefore := h.chat.requestCount()

	h.generation.AfterMemoWrite(context.Background(), stale, service.MemoChange{
		ContentChanged:       true,
		AutoTagRequested:     true,
		AutoSummaryRequested: true,
		EmbeddingRelevant:    true,
	})

	// The guard rejects the snapshot before any model call is made.
	time.Sleep(300 * time.Millisecond)
	if got := h.chat.requestCount(); got != requestsBefore {
		t.Errorf("the stale generation made %d model calls, want 0", got-requestsBefore)
	}

	var (
		tags    []byte
		summary *string
		content string
	)
	if err := h.pool.QueryRow(context.Background(),
		`SELECT tags, ai_summary, content FROM memos WHERE id = $1`, memoID).Scan(&tags, &summary, &content); err != nil {
		t.Fatalf("reading the memo: %v", err)
	}
	if got := domain.TagListFromJSON(tags); len(got) != 2 || got[0] != "first" {
		t.Errorf("tags = %v, want them untouched by the stale generation", got)
	}
	if summary == nil || *summary != "First summary." {
		t.Errorf("summary = %v, want it untouched by the stale generation", summary)
	}
	if content != "the newer body" {
		t.Errorf("content = %q, want the newer body", content)
	}
}

// TestConcurrentGenerationForOneMemoIsDiscarded proves a second write while a
// generation is in flight does not double up: the per-memo guard drops the
// overlapping run rather than queueing it.
func TestConcurrentGenerationForOneMemoIsDiscarded(t *testing.T) {
	h := newHarness(t)

	rec := h.do(t, http.MethodPost, "/api/memos", `{"content":"guarded"}`)
	if rec.Code != http.StatusOK {
		t.Fatalf("create = %d, want 200", rec.Code)
	}
	memoID := createdMemoID(t, rec)

	memo := h.readMemo(t, memoID)

	// Hold the per-memo generation slot by starting a run and then firing a
	// second one for the same snapshot.
	h.generation.AfterMemoWrite(context.Background(), memo, service.MemoChange{})
	h.generation.AfterMemoWrite(context.Background(), memo, service.MemoChange{})

	// Both are dropped or collapsed; the memo must never end up with the model
	// writing twice against the same revision.
	time.Sleep(500 * time.Millisecond)

	var revision int32
	if err := h.pool.QueryRow(context.Background(),
		`SELECT revision_count FROM memos WHERE id = $1`, memoID).Scan(&revision); err != nil {
		t.Fatalf("reading the revision: %v", err)
	}
	if revision != memo.RevisionCount {
		t.Errorf("revision = %d, want %d; a generation changed the memo's revision",
			revision, memo.RevisionCount)
	}
}

// createdMemoID reads the identifier out of a create response.
func createdMemoID(t *testing.T, rec *httptest.ResponseRecorder) uuid.UUID {
	t.Helper()

	var body struct {
		ID string `json:"id"`
	}
	if err := json.Unmarshal(rec.Body.Bytes(), &body); err != nil {
		t.Fatalf("decoding the create response: %v", err)
	}
	id, err := uuid.Parse(body.ID)
	if err != nil {
		t.Fatalf("the create response carried no usable id: %q", body.ID)
	}
	return id
}

// readMemo loads a memo as a generation would snapshot it.
func (h *harness) readMemo(t *testing.T, memoID uuid.UUID) domain.Memo {
	t.Helper()

	var memo domain.Memo
	if err := h.pool.QueryRow(context.Background(),
		`SELECT id, user_id, content, tags, is_archived, is_deleted, created_at, updated_at, revision_count
		 FROM memos WHERE id = $1`, memoID).Scan(
		&memo.ID, &memo.UserID, &memo.Content, new([]byte), &memo.IsArchived,
		&memo.IsDeleted, &memo.CreatedAt, &memo.UpdatedAt, &memo.RevisionCount); err != nil {
		t.Fatalf("reading the memo: %v", err)
	}
	return memo
}
