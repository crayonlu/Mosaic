package admin

import (
	"testing"
)

func TestActivityLogBoundedAndNewestFirst(t *testing.T) {
	log := NewActivityLog(3)
	for _, action := range []string{"one", "two", "three", "four", "five"} {
		log.RecordInfo(action, "system", nil, "detail "+action)
	}

	entries := log.List(10, nil)
	if len(entries) != 3 {
		t.Fatalf("len(entries) = %d, want 3 (log must be bounded)", len(entries))
	}
	got := []string{entries[0].Action, entries[1].Action, entries[2].Action}
	want := []string{"five", "four", "three"}
	for i := range want {
		if got[i] != want[i] {
			t.Errorf("entries[%d].Action = %q, want %q", i, got[i], want[i])
		}
	}
}

func TestActivityLogLimitAndLevelFilter(t *testing.T) {
	log := NewActivityLog(10)
	log.RecordInfo("info-one", "system", nil, "d")
	id := "42"
	log.Record(Entry{Action: "warn-one", EntityType: "user", EntityID: &id, Level: "warn", Detail: "d"})
	log.RecordInfo("info-two", "system", nil, "d")

	limited := log.List(1, nil)
	if len(limited) != 1 || limited[0].Action != "info-two" {
		t.Errorf("limited = %+v, want the newest entry only", limited)
	}

	level := "warn"
	filtered := log.List(10, &level)
	if len(filtered) != 1 || filtered[0].Action != "warn-one" {
		t.Fatalf("filtered = %+v, want only the warn entry", filtered)
	}
	if filtered[0].EntityID == nil || *filtered[0].EntityID != id {
		t.Errorf("entity id = %v, want %q", filtered[0].EntityID, id)
	}
}
