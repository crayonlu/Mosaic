package store

import (
	"testing"
	"time"

	"github.com/crayonlu/mosaic/server-go/internal/domain"
)

func TestEnsureRevisionDeletable(t *testing.T) {
	if err := EnsureRevisionDeletable(2); err != nil {
		t.Errorf("two active revisions should be deletable: %v", err)
	}

	for _, active := range []int64{0, 1} {
		err := EnsureRevisionDeletable(active)
		domainErr, ok := err.(*domain.Error)
		if !ok || domainErr.Kind != domain.KindInvalidInput {
			t.Errorf("active=%d: error = %v, want invalid input", active, err)
		}
	}
}

func TestMarshalTags(t *testing.T) {
	if got := string(marshalTags(nil)); got != "[]" {
		t.Errorf("nil tags = %s, want []", got)
	}
	if got := string(marshalTags([]string{"work", "api"})); got != `["work","api"]` {
		t.Errorf("tags = %s, want [\"work\",\"api\"]", got)
	}
}

func TestDateArg(t *testing.T) {
	if dateArg(nil) != nil {
		t.Error("nil date should stay nil")
	}
	date := domain.NewDate(time.Date(2026, time.February, 24, 15, 0, 0, 0, time.UTC))
	if _, ok := dateArg(&date).(time.Time); !ok {
		t.Error("a set date should be passed as a time.Time")
	}
}
