// Package retry runs an operation again after a failure, with exponential
// backoff and a per-attempt timeout.
package retry

import (
	"context"
	"errors"
	"log/slog"
	"time"
)

// ErrTimeout reports that every attempt exceeded the per-attempt timeout.
var ErrTimeout = errors.New("operation timed out")

// Policy controls how many times an operation is retried and how long each
// attempt may take.
type Policy struct {
	// MaxRetries is the number of retries AFTER the initial attempt, so the
	// total number of attempts is MaxRetries+1.
	MaxRetries int
	// Timeout bounds a single attempt.
	Timeout time.Duration
	// Backoff returns how long to wait before the given attempt number, which
	// starts at 1 for the first retry.
	Backoff func(attempt int) time.Duration
	// Sleep is injectable so tests do not wait on the clock.
	Sleep func(ctx context.Context, d time.Duration) error
}

// DefaultPolicy mirrors the previous server's defaults: two retries, a 60 second
// per-attempt timeout, and a 2^attempt second backoff.
func DefaultPolicy() Policy {
	return Policy{
		MaxRetries: 2,
		Timeout:    60 * time.Second,
		Backoff: func(attempt int) time.Duration {
			return time.Duration(1<<uint(attempt)) * time.Second
		},
		Sleep: sleepContext,
	}
}

// Do runs op until it succeeds, the retries are exhausted, or ctx is cancelled.
// It returns the last error from op, or ErrTimeout when the final attempt
// exceeded the per-attempt timeout.
func Do(ctx context.Context, p Policy, op func(ctx context.Context) error) error {
	if p.MaxRetries < 0 {
		p.MaxRetries = 0
	}

	totalAttempts := p.MaxRetries + 1
	var lastErr error

	for attempt := 0; attempt < totalAttempts; attempt++ {
		if attempt > 0 {
			if err := p.Sleep(ctx, p.Backoff(attempt)); err != nil {
				return err
			}
		}

		attemptCtx, cancel := context.WithTimeout(ctx, p.Timeout)
		err := op(attemptCtx)
		cancel()

		if err == nil {
			return nil
		}

		if errors.Is(err, context.DeadlineExceeded) && ctx.Err() == nil {
			slog.WarnContext(ctx, "retry attempt timed out",
				"attempt", attempt+1, "of", totalAttempts, "timeout", p.Timeout)
			lastErr = ErrTimeout
			continue
		}

		slog.WarnContext(ctx, "retry attempt failed",
			"attempt", attempt+1, "of", totalAttempts, "err", err)
		lastErr = err
	}

	if lastErr == nil {
		return ErrTimeout
	}
	return lastErr
}

func sleepContext(ctx context.Context, d time.Duration) error {
	timer := time.NewTimer(d)
	defer timer.Stop()

	select {
	case <-ctx.Done():
		return ctx.Err()
	case <-timer.C:
		return nil
	}
}
