package httpapi

import (
	"encoding/json"
	"fmt"
	"net/http"
	"testing"

	"github.com/google/uuid"
)

// The previous server's query structs were inconsistent about naming: most
// carried `#[serde(rename_all = "camelCase")]`, but two did not, so Actix read
// their fields' snake_case names. The shipped clients were written against
// those names, and reading the camelCase spelling instead breaks them silently
// — the request 400s and the feature simply never shows anything.
//
// These tests drive the real handlers with the spellings the clients actually
// send, which is what the earlier route inventory could not catch: it asserted
// paths, methods and status codes, never query parameter names.

// TestMemoryContextAcceptsTheMobileClientsParameters covers
// GET /api/memory/context. The previous server read `memo_id` and `bot_id`
// (its ContextQuery had no rename attribute), and the mobile client sends
// exactly those, so a bot reply's reference records load.
func TestMemoryContextAcceptsTheMobileClientsParameters(t *testing.T) {
	server := newContractServer(t)

	memoID := uuid.New()
	botID := uuid.New()

	cases := []struct {
		name        string
		memoParam   string
		botParam    string
		wantSuccess bool
	}{
		{
			name:        "snake_case, as the shipped mobile client sends",
			memoParam:   "memo_id",
			botParam:    "bot_id",
			wantSuccess: true,
		},
		{
			name:        "camelCase, as the rest of the API is spelled",
			memoParam:   "memoId",
			botParam:    "botId",
			wantSuccess: true,
		},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			path := fmt.Sprintf("/api/memory/context?%s=%s&%s=%s",
				tc.memoParam, memoID, tc.botParam, botID)

			rec := doJSON(t, server.handler, http.MethodGet, path, "", server.userToken)
			if rec.Code != http.StatusOK {
				t.Fatalf("status = %d, want 200 (body %s)", rec.Code, rec.Body)
			}
		})
	}
}

// TestMemoryContextRejectsAMissingMemoID keeps the parameter required, so the
// endpoint cannot silently answer for the wrong memo.
func TestMemoryContextRejectsAMissingMemoID(t *testing.T) {
	server := newContractServer(t)

	path := fmt.Sprintf("/api/memory/context?bot_id=%s", uuid.New())
	rec := doJSON(t, server.handler, http.MethodGet, path, "", server.userToken)

	if rec.Code != http.StatusBadRequest {
		t.Fatalf("status = %d, want 400", rec.Code)
	}

	var body errorBody
	decodeBody(t, rec, &body)
	if body.Message == "" {
		t.Error("the rejection carried no message")
	}
}

// TestAdminUserListAcceptsTheAdminUIClientsPageSize covers
// GET /admin/api/users. The previous server read `page_size` (its
// ListUsersQuery had no rename attribute) and the admin UI sends that name, so
// the requested page size was silently replaced by the default.
func TestAdminUserListAcceptsTheAdminUIClientsPageSize(t *testing.T) {
	server := newContractServer(t)

	cases := []struct {
		name     string
		param    string
		value    int64
		wantSize int64
	}{
		{name: "snake_case, as the admin UI sends", param: "page_size", value: 7, wantSize: 7},
		{name: "camelCase", param: "pageSize", value: 3, wantSize: 3},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			path := fmt.Sprintf("/admin/api/users?page=1&%s=%d", tc.param, tc.value)
			rec := doJSON(t, server.handler, http.MethodGet, path, "", server.adminToken)

			if rec.Code != http.StatusOK {
				t.Fatalf("status = %d, want 200 (body %s)", rec.Code, rec.Body)
			}

			var body struct {
				PageSize int64 `json:"pageSize"`
			}
			if err := json.Unmarshal(rec.Body.Bytes(), &body); err != nil {
				t.Fatalf("decoding the response: %v", err)
			}
			if body.PageSize != tc.wantSize {
				t.Errorf("pageSize = %d, want %d; the requested size was ignored",
					body.PageSize, tc.wantSize)
			}
		})
	}
}
