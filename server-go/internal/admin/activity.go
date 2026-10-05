// Package admin holds cross-cutting support for the administrative dashboard.
// It depends on neither the HTTP layer nor the database, so both can share it.
package admin

import (
	"sync"
	"time"
)

// Entry is one recorded administrative action.
type Entry struct {
	Timestamp  int64
	Action     string
	EntityType string
	EntityID   *string
	Level      string
	Detail     string
}

// Counts is the aggregate dashboard tally, gathered by a single query.
type Counts struct {
	MemosTotal     int64
	MemosMonth     int64
	DiariesTotal   int64
	DiariesMonth   int64
	ResourcesTotal int64
	ResourcesSize  int64
	BotsTotal      int64
	BotsAutoReply  int64
	RepliesTotal   int64
	ActiveDays     int64
}

// ActivityLog is a bounded, concurrency-safe record of recent actions. The
// previous server kept the most recent 200 entries.
type ActivityLog struct {
	mu      sync.Mutex
	entries []Entry
	max     int
}

func NewActivityLog(max int) *ActivityLog {
	if max < 1 {
		max = 1
	}
	return &ActivityLog{entries: make([]Entry, 0, max), max: max}
}

// Record appends an entry, evicting the oldest once the log is full.
func (l *ActivityLog) Record(entry Entry) {
	l.mu.Lock()
	defer l.mu.Unlock()
	if len(l.entries) >= l.max {
		l.entries = l.entries[1:]
	}
	l.entries = append(l.entries, entry)
}

// RecordInfo records an info-level entry timestamped now.
func (l *ActivityLog) RecordInfo(action, entityType string, entityID *string, detail string) {
	l.Record(Entry{
		Timestamp:  time.Now().UnixMilli(),
		Action:     action,
		EntityType: entityType,
		EntityID:   entityID,
		Level:      "info",
		Detail:     detail,
	})
}

// List returns up to limit entries, newest first, optionally filtered to a
// single level.
func (l *ActivityLog) List(limit int, level *string) []Entry {
	l.mu.Lock()
	defer l.mu.Unlock()
	if limit <= 0 {
		return []Entry{}
	}
	out := make([]Entry, 0, min(limit, len(l.entries)))
	for i := len(l.entries) - 1; i >= 0 && len(out) < limit; i-- {
		entry := l.entries[i]
		if level != nil && entry.Level != *level {
			continue
		}
		out = append(out, entry)
	}
	return out
}
