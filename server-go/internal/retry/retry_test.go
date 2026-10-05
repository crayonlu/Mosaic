package retry

import (
	"context"
	"errors"
	"testing"
	"time"
)

// testPolicy uses a no-wait sleep so retry behaviour can be asserted without
// real backoff delays.
func testPolicy(maxRetries int) Policy {
	policy := DefaultPolicy()
	policy.MaxRetries = maxRetries
	policy.Timeout = time.Second
	policy.Sleep = func(context.Context, time.Duration) error { return nil }
	return policy
}

func TestDoSucceedsWithoutRetrying(t *testing.T) {
	calls := 0
	err := Do(context.Background(), testPolicy(2), func(context.Context) error {
		calls++
		return nil
	})

	if err != nil {
		t.Fatalf("Do: %v", err)
	}
	if calls != 1 {
		t.Errorf("attempts = %d, want 1", calls)
	}
}

func TestDoRetriesUntilSuccess(t *testing.T) {
	calls := 0
	err := Do(context.Background(), testPolicy(2), func(context.Context) error {
		calls++
		if calls < 3 {
			return errors.New("transient")
		}
		return nil
	})

	if err != nil {
		t.Fatalf("Do: %v", err)
	}
	if calls != 3 {
		t.Errorf("attempts = %d, want 3", calls)
	}
}

func TestDoReturnsLastErrorAfterExhaustingRetries(t *testing.T) {
	sentinel := errors.New("still broken")
	calls := 0

	err := Do(context.Background(), testPolicy(2), func(context.Context) error {
		calls++
		return sentinel
	})

	if !errors.Is(err, sentinel) {
		t.Fatalf("err = %v, want the sentinel", err)
	}
	if calls != 3 {
		t.Errorf("attempts = %d, want 3 (initial + 2 retries)", calls)
	}
}

func TestDoReportsTimeoutSeparately(t *testing.T) {
	calls := 0
	err := Do(context.Background(), testPolicy(1), func(ctx context.Context) error {
		calls++
		<-ctx.Done()
		return ctx.Err()
	})

	if !errors.Is(err, ErrTimeout) {
		t.Fatalf("err = %v, want ErrTimeout", err)
	}
	if calls != 2 {
		t.Errorf("attempts = %d, want 2", calls)
	}
}

func TestDoStopsWhenContextIsCancelled(t *testing.T) {
	ctx, cancel := context.WithCancel(context.Background())

	calls := 0
	policy := testPolicy(3)
	policy.Sleep = func(context.Context, time.Duration) error {
		cancel()
		return ctx.Err()
	}

	err := Do(ctx, policy, func(context.Context) error {
		calls++
		return errors.New("transient")
	})

	if !errors.Is(err, context.Canceled) {
		t.Fatalf("err = %v, want context.Canceled", err)
	}
	if calls != 1 {
		t.Errorf("attempts = %d, want 1", calls)
	}
}

func TestDefaultBackoffDoublesEachAttempt(t *testing.T) {
	policy := DefaultPolicy()
	if got := policy.Backoff(1); got != 2*time.Second {
		t.Errorf("backoff(1) = %v, want 2s", got)
	}
	if got := policy.Backoff(2); got != 4*time.Second {
		t.Errorf("backoff(2) = %v, want 4s", got)
	}
}
