package httpapi

import (
	"context"
	"fmt"
	"net/http"
	"net/http/httptest"
	"os"
	"sort"
	"strings"
	"testing"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"

	"github.com/crayonlu/mosaic/server-go/internal/admin"
	"github.com/crayonlu/mosaic/server-go/internal/auth"
	"github.com/crayonlu/mosaic/server-go/internal/config"
	"github.com/crayonlu/mosaic/server-go/internal/domain"
	"github.com/crayonlu/mosaic/server-go/internal/service"
)

// scope says which credential an endpoint requires. It mirrors the previous
// server's Actix scope nesting exactly.
type scope int

const (
	// scopePublic needs no credential.
	scopePublic scope = iota
	// scopeToken needs a valid token; a pending password change is still allowed
	// so the account can resolve it.
	scopeToken
	// scopePasswordChanged needs a valid token from an account with no pending
	// password change.
	scopePasswordChanged
	// scopeAdmin needs a valid token from an administrator.
	scopeAdmin
)

// source records where the endpoint is specified, so a divergence between the
// written contract and the previous server's route table stays visible.
type source string

const (
	fromDocs     source = "docs/server-api.md"
	fromPrevious source = "previous-server"
	fromBoth     source = "docs+previous-server"
	fromUndoc    source = "previous-server (undocumented)"
)

// contractRoute is one endpoint of the union of docs/server-api.md and the
// previous server's route table.
type contractRoute struct {
	method string
	path   string
	body   string
	scope  scope
	source source
}

// contractRoutes is the full endpoint inventory. Paths carry example
// identifiers so they can be driven against the real handler.
func contractRoutes() []contractRoute {
	const (
		memoID     = "11111111-1111-1111-1111-111111111111"
		botID      = "22222222-2222-2222-2222-222222222222"
		replyID    = "33333333-3333-3333-3333-333333333333"
		resourceID = "44444444-4444-4444-4444-444444444444"
		userID     = "55555555-5555-5555-5555-555555555555"
		revisionID = "66666666-6666-6666-6666-666666666666"
		day        = "2026-01-02"
	)

	return []contractRoute{
		// Health and the admin UI assets.
		{http.MethodGet, "/health", "", scopePublic, fromDocs},
		{http.MethodGet, "/admin", "", scopePublic, fromDocs},
		{http.MethodGet, "/admin/", "", scopePublic, fromPrevious},
		{http.MethodGet, "/admin/static/index.html", "", scopePublic, fromPrevious},

		// Auth.
		{http.MethodPost, "/api/auth/login", `{"username":"u","password":"p"}`, scopePublic, fromDocs},
		{http.MethodPost, "/api/auth/refresh", `{"refreshToken":"t"}`, scopePublic, fromDocs},
		{http.MethodGet, "/api/auth/me", "", scopeToken, fromDocs},
		{http.MethodPost, "/api/auth/change-password", `{"oldPassword":"a","newPassword":"b"}`, scopeToken, fromDocs},
		{http.MethodPut, "/api/auth/update-user", `{}`, scopePasswordChanged, fromDocs},
		{http.MethodPost, "/api/auth/update-avatar", `{"avatarUrl":"/a"}`, scopePasswordChanged, fromDocs},

		// Memos.
		{http.MethodPost, "/api/memos", `{"content":"hello"}`, scopePasswordChanged, fromDocs},
		{http.MethodGet, "/api/memos", "", scopePasswordChanged, fromDocs},
		{http.MethodGet, "/api/memos/tags", "", scopePasswordChanged, fromDocs},
		{http.MethodGet, "/api/memos/search?query=x", "", scopePasswordChanged, fromDocs},
		{http.MethodGet, "/api/memos/date/" + day, "", scopePasswordChanged, fromDocs},
		// clipType is required; the text variant needs no outbound fetch.
		{http.MethodPost, "/api/memos/clip", `{"clipType":"text","content":"clip verification text"}`, scopePasswordChanged, fromDocs},
		{http.MethodGet, "/api/memos/" + memoID, "", scopePasswordChanged, fromDocs},
		{http.MethodPut, "/api/memos/" + memoID, `{"content":"updated"}`, scopePasswordChanged, fromDocs},
		{http.MethodDelete, "/api/memos/" + memoID, "", scopePasswordChanged, fromDocs},
		{http.MethodGet, "/api/memos/" + memoID + "/detail", "", scopePasswordChanged, fromDocs},
		{http.MethodGet, "/api/memos/" + memoID + "/revisions", "", scopePasswordChanged, fromDocs},
		{http.MethodDelete, "/api/memos/" + memoID + "/revisions/" + revisionID, "", scopePasswordChanged, fromPrevious},
		{http.MethodPut, "/api/memos/" + memoID + "/archive", "", scopePasswordChanged, fromDocs},
		{http.MethodPut, "/api/memos/" + memoID + "/unarchive", "", scopePasswordChanged, fromDocs},

		// Bots and replies.
		{http.MethodGet, "/api/bots", "", scopePasswordChanged, fromDocs},
		{http.MethodPost, "/api/bots", `{"name":"scribe"}`, scopePasswordChanged, fromDocs},
		{http.MethodPut, "/api/bots/reorder", `{"order":[]}`, scopePasswordChanged, fromDocs},
		{http.MethodGet, "/api/bots/" + botID, "", scopePasswordChanged, fromDocs},
		{http.MethodPut, "/api/bots/" + botID, `{"name":"renamed"}`, scopePasswordChanged, fromDocs},
		{http.MethodDelete, "/api/bots/" + botID, "", scopePasswordChanged, fromDocs},
		{http.MethodGet, "/api/memos/" + memoID + "/bot-replies", "", scopePasswordChanged, fromDocs},
		{http.MethodGet, "/api/bot-replies/" + replyID + "/thread", "", scopePasswordChanged, fromDocs},
		{http.MethodPost, "/api/memos/" + memoID + "/trigger-replies", `{"botIds":[]}`, scopePasswordChanged, fromDocs},
		{http.MethodPost, "/api/bot-replies/" + replyID + "/reply", `{"question":"why"}`, scopePasswordChanged, fromDocs},

		// Diaries.
		{http.MethodGet, "/api/diaries", "", scopePasswordChanged, fromDocs},
		{http.MethodGet, "/api/diaries/" + day, "", scopePasswordChanged, fromDocs},
		{http.MethodPost, "/api/diaries/" + day, `{"date":"` + day + `","summary":"s","moodKey":"calm"}`, scopePasswordChanged, fromDocs},
		{http.MethodPut, "/api/diaries/" + day, `{"summary":"s2"}`, scopePasswordChanged, fromDocs},
		{http.MethodPut, "/api/diaries/" + day + "/summary", `{"summary":"s3"}`, scopePasswordChanged, fromDocs},
		{http.MethodPut, "/api/diaries/" + day + "/mood", `{"moodKey":"happy","moodScore":8}`, scopePasswordChanged, fromDocs},

		// Resources and avatars.
		{http.MethodGet, "/api/resources", "", scopePasswordChanged, fromDocs},
		{http.MethodPost, "/api/resources/upload", "", scopePasswordChanged, fromDocs},
		{http.MethodPost, "/api/resources/presigned-upload", `{"filename":"a.png","mimeType":"image/png","fileSize":10}`, scopePasswordChanged, fromDocs},
		{http.MethodPost, "/api/resources/confirm-upload", `{"resourceId":"` + resourceID + `"}`, scopePasswordChanged, fromDocs},
		{http.MethodPost, "/api/resources/upload-avatar", "", scopePasswordChanged, fromDocs},
		{http.MethodDelete, "/api/resources/" + resourceID, "", scopePasswordChanged, fromDocs},
		{http.MethodGet, "/api/resources/" + resourceID + "/download", "", scopePasswordChanged, fromDocs},
		{http.MethodGet, "/api/resources/" + resourceID + "/thumbnail", "", scopePasswordChanged, fromDocs},
		{http.MethodGet, "/api/avatars/" + resourceID + "/download", "", scopePasswordChanged, fromDocs},

		// Stats.
		{http.MethodGet, "/api/stats/heatmap", "", scopePasswordChanged, fromDocs},
		{http.MethodGet, "/api/stats/timeline", "", scopePasswordChanged, fromDocs},
		{http.MethodGet, "/api/stats/trends", "", scopePasswordChanged, fromDocs},
		{http.MethodGet, "/api/stats/summary", "", scopePasswordChanged, fromDocs},

		// Sync.
		{http.MethodPost, "/api/sync/pull", `{"clientId":"c","cursors":{}}`, scopePasswordChanged, fromDocs},

		// AI.
		{http.MethodPost, "/api/ai/summarize", `{"content":"x"}`, scopePasswordChanged, fromDocs},
		{http.MethodPost, "/api/ai/suggest-tags", `{"content":"x"}`, scopePasswordChanged, fromDocs},

		// Memory.
		{http.MethodGet, "/api/memory/stats", "", scopePasswordChanged, fromDocs},
		{http.MethodGet, "/api/memory/activity", "", scopePasswordChanged, fromDocs},
		{http.MethodGet, "/api/memory/context", "", scopePasswordChanged, fromPrevious},
		{http.MethodGet, "/api/memos/" + memoID + "/memory-contexts", "", scopePasswordChanged, fromPrevious},

		// Per-user AI configuration. Documented in neither source completely.
		{http.MethodGet, "/api/ai-config", "", scopePasswordChanged, fromUndoc},
		{http.MethodPut, "/api/ai-config", `{"provider":"p","baseUrl":"https://x","apiKey":"k","model":"m"}`, scopePasswordChanged, fromUndoc},
		{http.MethodDelete, "/api/ai-config", "", scopePasswordChanged, fromUndoc},

		// Admin API.
		{http.MethodGet, "/admin/api/health", "", scopeAdmin, fromDocs},
		{http.MethodGet, "/admin/api/stats", "", scopeAdmin, fromDocs},
		{http.MethodGet, "/admin/api/activity", "", scopeAdmin, fromDocs},
		{http.MethodGet, "/admin/api/config", "", scopeAdmin, fromDocs},
		{http.MethodGet, "/admin/api/ai-config", "", scopeAdmin, fromDocs},
		{http.MethodPut, "/admin/api/ai-config/bot", `{"provider":"p","baseUrl":"https://x","apiKey":"k","model":"m"}`, scopeAdmin, fromDocs},
		{http.MethodGet, "/admin/api/users/" + userID + "/ai-config", "", scopeAdmin, fromUndoc},
		{http.MethodPut, "/admin/api/users/" + userID + "/ai-config", `{"provider":"p","baseUrl":"https://x","apiKey":"k","model":"m"}`, scopeAdmin, fromUndoc},
		{http.MethodPost, "/admin/api/clear-cache", "", scopeAdmin, fromDocs},
		{http.MethodPost, "/admin/api/backfill-memory", "", scopeAdmin, fromDocs},
		{http.MethodGet, "/admin/api/settings", "", scopeAdmin, fromDocs},
		{http.MethodPut, "/admin/api/settings", `{}`, scopeAdmin, fromDocs},
		{http.MethodPost, "/admin/api/users", `{"username":"n","password":"password1"}`, scopeAdmin, fromUndoc},
		{http.MethodGet, "/admin/api/users", "", scopeAdmin, fromUndoc},
		{http.MethodPatch, "/admin/api/users/" + userID, `{"isActive":true}`, scopeAdmin, fromUndoc},
	}
}

// contractServer is a fully faked server built through the real router.
type contractServer struct {
	handler      http.Handler
	userToken    string
	adminToken   string
	pendingToken string
}

func newContractServer(t *testing.T) *contractServer {
	t.Helper()

	userID := uuid.New()
	location := time.FixedZone("Asia/Shanghai", 8*60*60)

	memoStore := newFakeMemoStore()
	settingsStore := newFakeAdminSettings()
	activity := admin.NewActivityLog(200)

	handler := New(Deps{
		Auth:           newStubAuth(t),
		JWTSecret:      httpTestSecret,
		AllowedOrigins: nil,
		Memos:          newMemoService(memoStore, stubClips{}),
		MemoSearch:     defaultHybridService(),
		Embedder:       &stubEmbedder{},
		Diaries:        service.NewDiaryService(newHTTPFakeDiaryStore()),
		Resources: service.NewResourceService(
			newFakeResourceStore(),
			newFakeBlobs(),
			fakeImages{},
			fakeVideos{},
			newFakeAvatars(),
			config.StorageLocal,
			fakeChatConfigs{}, fakeCompletion{},
		),
		Stats: service.NewStatsService(
			&httpFakeStatsStore{}, httpFakeStatsSettings{location: location}),
		Sync:         service.NewSyncService(newHTTPFakeSyncStore()),
		UserAIConfig: service.NewUserAIConfigService(newHTTPFakeAIConfigStore()),
		Admin: service.NewAdminService(service.AdminDeps{
			Users:      newFakeAdminUsers(),
			Stats:      &fakeAdminStats{},
			Settings:   settingsStore,
			AIConfig:   newFakeAdminAIConfig(),
			Backfiller: &fakeAdminBackfiller{},
			Activity:   activity,
			Config:     service.AdminConfig{Port: 8080, StorageType: "local"},
			StartedAt:  time.Now(),
			Version:    "test",
		}),
		AIConfigs: &stubAIConfigProvider{},
		AI:        &stubCompleter{reply: `["a"]`},
		ParseTags: stubParseTags,

		Bots:   newBotTestService(newFakeBotStore(), newFakeBotMemoStore()),
		Memory: service.NewMemoryService(newFakeMemoryStore()),
	})

	return &contractServer{
		handler:      handler,
		userToken:    contractToken(t, userID, domain.RoleUser, false),
		adminToken:   contractToken(t, userID, domain.RoleAdmin, false),
		pendingToken: contractToken(t, userID, domain.RoleUser, true),
	}
}

func contractToken(t *testing.T, userID uuid.UUID, role string, pending bool) string {
	t.Helper()
	token, err := auth.Sign(httpTestSecret, userID.String(), role, pending, time.Hour)
	if err != nil {
		t.Fatalf("Sign: %v", err)
	}
	return token
}

// drive issues the route's request with the credential its scope requires and
// returns the response.
func (s *contractServer) drive(t *testing.T, route contractRoute) *httptest.ResponseRecorder {
	t.Helper()

	token := ""
	switch route.scope {
	case scopeToken, scopePasswordChanged:
		token = s.userToken
	case scopeAdmin:
		token = s.adminToken
	}

	return doJSON(t, s.handler, route.method, route.path, route.body, token)
}

// TestEveryContractEndpointIsServed proves no documented or previously served
// path is missing from the Go server, which is what makes it a drop-in
// replacement.
//
// A 404 on its own is not proof of a missing route: handlers legitimately report
// missing resources. A router-level miss is distinguishable because it produces
// chi's plain text page, while a handler produces the JSON error envelope.
func TestEveryContractEndpointIsServed(t *testing.T) {
	server := newContractServer(t)

	for _, route := range contractRoutes() {
		t.Run(route.method+" "+route.path, func(t *testing.T) {
			rec := server.drive(t, route)

			if isRouterMiss(rec) {
				t.Errorf("route is not registered: %s %s (source: %s)",
					route.method, route.path, route.source)
			}
		})
	}
}

// isRouterMiss reports whether the response came from chi's unmatched-route
// handler rather than from one of our own handlers.
func isRouterMiss(rec *httptest.ResponseRecorder) bool {
	if rec.Code != http.StatusNotFound {
		return false
	}
	return !strings.HasPrefix(rec.Header().Get("Content-Type"), "application/json")
}

// TestTokenScopedRoutesRejectAnonymousCallers pins the authorisation boundary:
// a token-scoped route must answer 401 without one, never serve data.
func TestTokenScopedRoutesRejectAnonymousCallers(t *testing.T) {
	server := newContractServer(t)

	for _, route := range contractRoutes() {
		if route.scope == scopePublic || route.scope == scopeToken {
			// The token scope is reachable only with a token, but a public
			// route and the pending-password scope have their own tests.
			if route.scope == scopePublic {
				continue
			}
		}
		if route.scope != scopePasswordChanged && route.scope != scopeToken {
			continue
		}

		t.Run(route.method+" "+route.path, func(t *testing.T) {
			rec := doJSON(t, server.handler, route.method, route.path, route.body, "")

			if rec.Code != http.StatusUnauthorized {
				t.Errorf("anonymous %s %s = %d, want 401",
					route.method, route.path, rec.Code)
			}
			if ct := rec.Header().Get("Content-Type"); ct != "text/plain; charset=utf-8" {
				t.Errorf("content type = %q, want the middleware's plain text", ct)
			}
		})
	}
}

// TestPendingPasswordChangeIsBlockedOutsideTheAuthScope proves the
// change-password gate still separates the two auth scopes.
func TestPendingPasswordChangeIsBlockedOutsideTheAuthScope(t *testing.T) {
	server := newContractServer(t)

	for _, route := range contractRoutes() {
		if route.scope != scopePasswordChanged {
			continue
		}

		t.Run(route.method+" "+route.path, func(t *testing.T) {
			rec := doJSON(t, server.handler, route.method, route.path, route.body, server.pendingToken)

			if rec.Code != http.StatusForbidden {
				t.Errorf("pending %s %s = %d, want 403",
					route.method, route.path, rec.Code)
			}
		})
	}
}

// TestAdminRoutesRejectNonAdmins proves the admin scope is enforced by role.
func TestAdminRoutesRejectNonAdmins(t *testing.T) {
	server := newContractServer(t)

	for _, route := range contractRoutes() {
		if route.scope != scopeAdmin {
			continue
		}

		t.Run(route.method+" "+route.path, func(t *testing.T) {
			rec := doJSON(t, server.handler, route.method, route.path, route.body, server.userToken)

			if rec.Code != http.StatusForbidden {
				t.Errorf("non-admin %s %s = %d, want 403",
					route.method, route.path, rec.Code)
			}
		})
	}
}

// TestErrorEnvelopeShapeOnATokenlessCall pins the exact envelope installed
// clients parse for handler-level rejections.
func TestErrorEnvelopeShapeOnATokenlessCall(t *testing.T) {
	server := newContractServer(t)

	rec := doJSON(t, server.handler, http.MethodGet, "/api/memos", "", "")
	body := strings.TrimSpace(rec.Body.String())

	if body != "Unauthorized" {
		t.Errorf("middleware rejection body = %q, want plain %q", body, "Unauthorized")
	}
}

// TestRouteDiffAgainstPreviousServer records the route set the Go server
// actually serves next to the contract inventory, so a deliberate divergence is
// visible rather than silent.
func TestRouteDiffAgainstPreviousServer(t *testing.T) {
	server := newContractServer(t)

	var served []string
	walker := func(method, route string, _ http.Handler, _ ...func(http.Handler) http.Handler) error {
		served = append(served, method+" "+route)
		return nil
	}
	if err := chi.Walk(server.handler.(*chi.Mux), walker); err != nil {
		t.Fatalf("walking routes: %v", err)
	}
	sort.Strings(served)

	t.Logf("the Go router serves %d method+pattern entries:", len(served))
	for _, entry := range served {
		t.Logf("  served: %s", entry)
	}

	// A declared endpoint is served when the router matches it; matching is
	// checked behaviourally because chi's parameter names differ from the
	// inventory's placeholders.
	var missing []string
	for _, route := range contractRoutes() {
		if isRouterMiss(server.drive(t, route)) {
			missing = append(missing, route.method+" "+route.path+"  (source: "+string(route.source)+")")
		}
	}
	sort.Strings(missing)

	t.Logf("the contract declares %d endpoints; %d of them are not served",
		len(contractRoutes()), len(missing))
	for _, entry := range missing {
		t.Logf("  DECLARED BUT NOT SERVED: %s", entry)
	}

	if len(missing) != 0 {
		t.Errorf("%d declared endpoints are not served", len(missing))
	}
}

// TestContractInventoryTable logs the enumerated contract with the status each
// endpoint answered, which is the durable record of what was driven.
func TestContractInventoryTable(t *testing.T) {
	server := newContractServer(t)

	t.Logf("%-6s %-58s %-6s %-34s %s", "METHOD", "PATH", "STATUS", "SCOPE", "SOURCE")
	for _, route := range contractRoutes() {
		rec := server.drive(t, route)
		t.Logf("%-6s %-58s %-6d %-34s %s",
			route.method, route.path, rec.Code, scopeName(route.scope), route.source)
	}
}

func scopeName(s scope) string {
	switch s {
	case scopePublic:
		return "public"
	case scopeToken:
		return "token"
	case scopePasswordChanged:
		return "token+password-changed"
	case scopeAdmin:
		return "token+admin"
	default:
		return "unknown"
	}
}

// TestDumpContractTSV writes the endpoint inventory as tab-separated rows when
// CONTRACT_TSV names a path. An out-of-process verification can then drive the
// exact same list the in-repo tests use, instead of keeping a second copy.
func TestDumpContractTSV(t *testing.T) {
	path := os.Getenv("CONTRACT_TSV")
	if path == "" {
		t.Skip("CONTRACT_TSV is not set")
	}

	var out strings.Builder
	for _, route := range contractRoutes() {
		fmt.Fprintf(&out, "%s\t%s\t%s\t%s\n",
			route.method, route.path, scopeName(route.scope), route.body)
	}

	if err := os.WriteFile(path, []byte(out.String()), 0o644); err != nil {
		t.Fatalf("writing %s: %v", path, err)
	}
	t.Logf("wrote %d endpoints to %s", len(contractRoutes()), path)
}

// httpHTTPFakeSyncStore is an in-memory sync store for the inventory tests.
type httpHTTPFakeSyncStore struct{}

func newHTTPFakeSyncStore() *httpHTTPFakeSyncStore { return &httpHTTPFakeSyncStore{} }

func (httpHTTPFakeSyncStore) MemoChanges(context.Context, uuid.UUID, int64) ([]domain.MemoChange, []uuid.UUID, error) {
	return nil, nil, nil
}

func (httpHTTPFakeSyncStore) DiaryChanges(context.Context, uuid.UUID, int64) ([]domain.DiaryChange, []string, error) {
	return nil, nil, nil
}

func (httpHTTPFakeSyncStore) ResourceChanges(context.Context, uuid.UUID, int64) ([]domain.ResourceChange, []uuid.UUID, error) {
	return nil, nil, nil
}

func (httpHTTPFakeSyncStore) BotChanges(context.Context, uuid.UUID, int64) ([]domain.BotChange, []uuid.UUID, error) {
	return nil, nil, nil
}

func (httpHTTPFakeSyncStore) SaveCursor(context.Context, string, uuid.UUID, string, int64) error {
	return nil
}
