package integration

import (
	"context"
	"net/http"
	"testing"
	"time"
)

// TestTriggerRepliesIsSerialisedByADatabaseLock proves the guard on bot
// generation is the database's, not the process's. Two independent service
// instances sharing one database are asked to generate replies for the same
// memo at the same time; exactly one generation may run, so the stored replies
// must equal one generation's worth.
//
// It also observes the advisory lock in pg_locks while the generation is in
// flight, which is what distinguishes a database lock from in-process state.
func TestTriggerRepliesIsSerialisedByADatabaseLock(t *testing.T) {
	h := newHarness(t)

	// Create the memo before any auto-reply bot exists, so the write-triggered
	// pipeline does not race this test for the same generation slot.
	h.chat.setScript("unused by this test")
	rec := h.do(t, http.MethodPost, "/api/memos", `{"content":"a memo needing replies"}`)
	if rec.Code != http.StatusOK {
		t.Fatalf("create = %d, want 200 (body %s)", rec.Code, rec.Body)
	}
	memoID := createdMemoID(t, rec)

	seedAutoReplyBot(t, h)

	// Hold the model call open so the lock is observable.
	block := make(chan struct{})
	h.chat.block = block

	first := h.newBotService()
	second := h.newBotService()

	// The first trigger takes the lock and starts a generation that blocks.
	if err := first.TriggerReplies(context.Background(), h.userID.String(), memoID); err != nil {
		t.Fatalf("first trigger: %v", err)
	}

	waitFor(t, "the advisory lock to be held", func() bool {
		return advisoryLockCount(t, h) > 0
	})
	t.Logf("advisory locks held while generation is in flight: %d", advisoryLockCount(t, h))

	// The second trigger runs on a different service instance but the same
	// database, so it must be refused.
	if err := second.TriggerReplies(context.Background(), h.userID.String(), memoID); err != nil {
		t.Fatalf("second trigger: %v", err)
	}

	close(block)

	// Wait for the surviving generation to finish.
	waitFor(t, "the generated reply", func() bool {
		var count int
		if err := h.pool.QueryRow(context.Background(),
			`SELECT count(*) FROM bot_replies WHERE memo_id = $1`, memoID).Scan(&count); err != nil {
			return false
		}
		return count >= 1
	})

	// Give the refused trigger a chance to prove it did not also write.
	time.Sleep(400 * time.Millisecond)

	var replies int
	if err := h.pool.QueryRow(context.Background(),
		`SELECT count(*) FROM bot_replies WHERE memo_id = $1`, memoID).Scan(&replies); err != nil {
		t.Fatalf("counting replies: %v", err)
	}
	if replies != 1 {
		t.Errorf("stored %d replies, want exactly one generation's worth (1)", replies)
	}

	// The lock is released once the generation ends.
	waitFor(t, "the advisory lock to be released", func() bool {
		return advisoryLockCount(t, h) == 0
	})
}

// TestAdvisoryLockIsReleasedAfterFailure makes sure a failed generation cannot
// leave the lock held, which would block that memo forever.
func TestAdvisoryLockIsReleasedAfterFailure(t *testing.T) {
	h := newHarness(t)

	h.chat.setScript("unused")
	rec := h.do(t, http.MethodPost, "/api/memos", `{"content":"a memo whose generation fails"}`)
	if rec.Code != http.StatusOK {
		t.Fatalf("create = %d, want 200", rec.Code)
	}
	memoID := createdMemoID(t, rec)
	seedAutoReplyBot(t, h)

	h.chat.setError(context.DeadlineExceeded)

	svc := h.newBotService()
	if err := svc.TriggerReplies(context.Background(), h.userID.String(), memoID); err != nil {
		t.Fatalf("trigger: %v", err)
	}

	waitFor(t, "the advisory lock to be released after a failure", func() bool {
		return advisoryLockCount(t, h) == 0
	})

	// And the memo can be triggered again afterwards.
	h.chat.setError(nil)
	if err := svc.TriggerReplies(context.Background(), h.userID.String(), memoID); err != nil {
		t.Fatalf("retrigger after release: %v", err)
	}
	waitFor(t, "the retriggered reply", func() bool {
		var count int
		if err := h.pool.QueryRow(context.Background(),
			`SELECT count(*) FROM bot_replies WHERE memo_id = $1`, memoID).Scan(&count); err != nil {
			return false
		}
		return count >= 1
	})
}

// advisoryLockCount counts the granted advisory locks on the test database.
func advisoryLockCount(t *testing.T, h *harness) int {
	t.Helper()

	var count int
	if err := h.pool.QueryRow(context.Background(),
		`SELECT count(*) FROM pg_locks WHERE locktype = 'advisory' AND granted`).Scan(&count); err != nil {
		t.Fatalf("reading pg_locks: %v", err)
	}
	return count
}
