package httpapi

import (
	"encoding/json"
	"errors"
	"io"
	"net/http"
	"strconv"
	"strings"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"

	"github.com/crayonlu/mosaic/server-go/internal/domain"
	"github.com/crayonlu/mosaic/server-go/internal/service"
)

func (req createMemoRequest) toInput() (service.CreateMemoInput, error) {
	input := service.CreateMemoInput{
		Content:     req.Content,
		Tags:        req.Tags,
		ResourceIDs: req.ResourceIDs,
		AiSummary:   req.AiSummary,
	}
	if req.DiaryDate != nil {
		date, err := domain.ParseDate(*req.DiaryDate)
		if err != nil {
			return input, err
		}
		input.DiaryDate = &date
	}
	return input, nil
}

func (req updateMemoRequest) toInput() (service.UpdateMemoInput, error) {
	input := service.UpdateMemoInput{
		Content:     req.Content,
		Tags:        req.Tags,
		ResourceIDs: req.ResourceIDs,
		IsArchived:  req.IsArchived,
		AiSummary:   req.AiSummary,
	}
	if len(req.DiaryDate) == 0 {
		return input, nil
	}

	if strings.TrimSpace(string(req.DiaryDate)) == "null" {
		input.ClearDiaryDate = true
		return input, nil
	}

	var raw string
	if err := json.Unmarshal(req.DiaryDate, &raw); err != nil {
		return input, domain.InvalidInput("diaryDate must be a date string or null")
	}
	date, err := domain.ParseDate(raw)
	if err != nil {
		return input, err
	}
	input.DiaryDate = &date
	return input, nil
}

func memoIDParam(r *http.Request) (uuid.UUID, error) {
	id, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		return uuid.UUID{}, domain.InvalidUUID(err)
	}
	return id, nil
}

func parseMemoListFilter(r *http.Request) (domain.MemoListFilter, error) {
	query := r.URL.Query()
	var filter domain.MemoListFilter

	page, err := parseOptionalUint(query.Get("page"), "page")
	if err != nil {
		return filter, err
	}
	filter.Page = page

	pageSize, err := parseOptionalUint(query.Get("pageSize"), "pageSize")
	if err != nil {
		return filter, err
	}
	filter.PageSize = pageSize

	archived, err := parseOptionalBool(query.Get("archived"), "archived")
	if err != nil {
		return filter, err
	}
	filter.Archived = archived

	if raw := query.Get("diaryDate"); raw != "" {
		date, err := domain.ParseDate(raw)
		if err != nil {
			return filter, err
		}
		filter.DiaryDate = &date
	}
	if raw := query.Get("search"); raw != "" {
		filter.Search = &raw
	}
	return filter, nil
}

// parseMemoSearchQuery reproduces the unusual key spellings the previous
// server accepted: tags and tags[], startDate/start_date, endDate/end_date,
// isArchived/is_archived, and pageSize/page_size.
func parseMemoSearchQuery(r *http.Request) (domain.MemoSearchQuery, error) {
	query := r.URL.Query()
	var search domain.MemoSearchQuery

	search.Query = query.Get("query")
	for _, raw := range append(query["tags"], query["tags[]"]...) {
		if raw != "" {
			search.Tags = append(search.Tags, raw)
		}
	}

	if raw := firstPresent(query, "startDate", "start_date"); raw != "" {
		search.StartDate = &raw
	}
	if raw := firstPresent(query, "endDate", "end_date"); raw != "" {
		search.EndDate = &raw
	}

	isArchived, err := parseOptionalBool(firstPresent(query, "isArchived", "is_archived"), "isArchived")
	if err != nil {
		return search, err
	}
	search.IsArchived = isArchived

	page, err := parseOptionalUint(query.Get("page"), "page")
	if err != nil {
		return search, err
	}
	search.Page = page

	pageSize, err := parseOptionalUint(firstPresent(query, "pageSize", "page_size"), "pageSize")
	if err != nil {
		return search, err
	}
	search.PageSize = pageSize

	return search, nil
}

func parseOptionalUint(raw, field string) (uint32, error) {
	if raw == "" {
		return 0, nil
	}
	value, err := strconv.ParseUint(raw, 10, 32)
	if err != nil {
		return 0, domain.InvalidInputf("%s must be a positive integer", field)
	}
	return uint32(value), nil
}

func parseOptionalBool(raw, field string) (*bool, error) {
	if raw == "" {
		return nil, nil
	}
	value, err := strconv.ParseBool(raw)
	if err != nil {
		return nil, domain.InvalidInputf("%s must be a boolean string (true/false)", field)
	}
	return &value, nil
}

func firstPresent(query map[string][]string, keys ...string) string {
	for _, key := range keys {
		if values, ok := query[key]; ok && len(values) > 0 {
			return values[0]
		}
	}
	return ""
}

func decodeOptionalJSON(r *http.Request, dst any) error {
	if r.Body == nil {
		return nil
	}
	if err := json.NewDecoder(r.Body).Decode(dst); err != nil && !errors.Is(err, io.EOF) {
		return domain.InvalidInput("Malformed JSON body")
	}
	return nil
}
