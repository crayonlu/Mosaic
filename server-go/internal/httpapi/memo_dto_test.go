package httpapi

import (
	"net/http/httptest"
	"testing"
	"time"

	"github.com/google/uuid"

	"github.com/crayonlu/mosaic/server-go/internal/domain"
	"github.com/crayonlu/mosaic/server-go/internal/service"
)

func TestParseMemoSearchQuerySpellings(t *testing.T) {
	req := httptest.NewRequest("GET",
		"/memos/search?query=hi&tags=work&tags[]=api&start_date=2026-01-01&end_date=2026-02-01&is_archived=true&page=2&page_size=5",
		nil)

	query, err := parseMemoSearchQuery(req)
	if err != nil {
		t.Fatalf("parseMemoSearchQuery: %v", err)
	}
	if query.Query != "hi" {
		t.Errorf("query = %q, want hi", query.Query)
	}
	if len(query.Tags) != 2 || query.Tags[0] != "work" || query.Tags[1] != "api" {
		t.Errorf("tags = %v, want [work api]", query.Tags)
	}
	if query.StartDate == nil || *query.StartDate != "2026-01-01" {
		t.Errorf("start date = %v", query.StartDate)
	}
	if query.EndDate == nil || *query.EndDate != "2026-02-01" {
		t.Errorf("end date = %v", query.EndDate)
	}
	if query.IsArchived == nil || !*query.IsArchived {
		t.Errorf("is archived = %v", query.IsArchived)
	}
	if query.Page != 2 || query.PageSize != 5 {
		t.Errorf("paging = %d/%d, want 2/5", query.Page, query.PageSize)
	}
}

func TestParseMemoSearchQueryCamelCase(t *testing.T) {
	req := httptest.NewRequest("GET",
		"/memos/search?startDate=2026-01-01&endDate=2026-02-01&isArchived=false&pageSize=7", nil)

	query, err := parseMemoSearchQuery(req)
	if err != nil {
		t.Fatalf("parseMemoSearchQuery: %v", err)
	}
	if query.StartDate == nil || *query.StartDate != "2026-01-01" {
		t.Errorf("start date = %v", query.StartDate)
	}
	if query.IsArchived == nil || *query.IsArchived {
		t.Errorf("is archived = %v", query.IsArchived)
	}
	if query.PageSize != 7 {
		t.Errorf("page size = %d, want 7", query.PageSize)
	}
}

func TestParseMemoSearchQueryRejectsBadNumbers(t *testing.T) {
	req := httptest.NewRequest("GET", "/memos/search?page_size=abc", nil)
	if _, err := parseMemoSearchQuery(req); err == nil {
		t.Error("a malformed page size should be rejected")
	}

	req = httptest.NewRequest("GET", "/memos/search?is_archived=maybe", nil)
	if _, err := parseMemoSearchQuery(req); err == nil {
		t.Error("a malformed boolean should be rejected")
	}
}

func TestParseMemoListFilter(t *testing.T) {
	req := httptest.NewRequest("GET",
		"/memos?page=3&pageSize=15&archived=true&diaryDate=2026-02-24&search=notes", nil)

	filter, err := parseMemoListFilter(req)
	if err != nil {
		t.Fatalf("parseMemoListFilter: %v", err)
	}
	if filter.Page != 3 || filter.PageSize != 15 {
		t.Errorf("paging = %d/%d, want 3/15", filter.Page, filter.PageSize)
	}
	if filter.Archived == nil || !*filter.Archived {
		t.Errorf("archived = %v", filter.Archived)
	}
	if filter.DiaryDate == nil || filter.DiaryDate.String() != "2026-02-24" {
		t.Errorf("diary date = %v", filter.DiaryDate)
	}
	if filter.Search == nil || *filter.Search != "notes" {
		t.Errorf("search = %v", filter.Search)
	}
}

func TestUpdateMemoRequestDiaryDateTriState(t *testing.T) {
	date := "2026-02-24"
	absent, err := updateMemoRequest{}.toInput()
	if err != nil {
		t.Fatalf("absent: %v", err)
	}
	if absent.DiaryDate != nil || absent.ClearDiaryDate {
		t.Errorf("absent diary date should be a no-op: %+v", absent)
	}

	set, err := updateMemoRequest{DiaryDate: []byte(`"` + date + `"`)}.toInput()
	if err != nil {
		t.Fatalf("set: %v", err)
	}
	if set.DiaryDate == nil || set.DiaryDate.String() != date {
		t.Errorf("set diary date = %v, want %s", set.DiaryDate, date)
	}

	cleared, err := updateMemoRequest{DiaryDate: []byte(`null`)}.toInput()
	if err != nil {
		t.Fatalf("clear: %v", err)
	}
	if !cleared.ClearDiaryDate || cleared.DiaryDate != nil {
		t.Errorf("explicit null should clear the diary date: %+v", cleared)
	}
}

func TestToMemoResponseDefaultsEmptyCollections(t *testing.T) {
	response := toMemoResponse(service.MemoWithResources{
		Memo: domain.Memo{ID: uuid.New()},
	})
	if response.Tags == nil {
		t.Error("tags should serialize as an empty array, not null")
	}
	if response.Resources == nil {
		t.Error("resources should serialize as an empty array, not null")
	}
}

func TestToResourceResponseVideoGetsThumbnail(t *testing.T) {
	video := domain.Resource{ID: uuid.New(), MimeType: "video/mp4", StorageType: "local", StoragePath: "a.mp4", CreatedAt: time.Now().UnixMilli()}
	if toResourceResponse(video).ThumbnailURL == nil {
		t.Error("a video resource should carry a thumbnail route")
	}

	image := domain.Resource{ID: uuid.New(), MimeType: "image/png", StorageType: "local", StoragePath: "a.png", CreatedAt: time.Now().UnixMilli()}
	if toResourceResponse(image).ThumbnailURL != nil {
		t.Error("a non-video resource should not carry a thumbnail route")
	}
}
