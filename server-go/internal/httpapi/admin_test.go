package httpapi

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/crayonlu/mosaic/server-go/internal/domain"
)

func TestAdminAPIRoutesRequireTokenAndAdmin(t *testing.T) {
	env := newAdminTestEnv(t)
	router := newAdminTestRouter(env)

	rec := httptest.NewRecorder()
	router.ServeHTTP(rec, httptest.NewRequest(http.MethodGet, "/admin/api/health", nil))
	if rec.Code != http.StatusUnauthorized {
		t.Fatalf("no token: status = %d, want 401 (body %s)", rec.Code, rec.Body)
	}
	if got := rec.Body.String(); got != "Unauthorized" {
		t.Errorf("no token: body = %q, want %q", got, "Unauthorized")
	}

	nonAdmin := adminBearerToken(t, domain.RoleUser)
	rec = getWithToken(t, router, "/admin/api/health", nonAdmin)
	if rec.Code != http.StatusForbidden {
		t.Fatalf("non-admin: status = %d, want 403 (body %s)", rec.Code, rec.Body)
	}
	if got := rec.Body.String(); got != "Admin access required" {
		t.Errorf("non-admin: body = %q, want %q", got, "Admin access required")
	}

	rec = postJSON(t, router, "/admin/api/users", `{"username":"x","password":"password1"}`, "")
	if rec.Code != http.StatusUnauthorized {
		t.Errorf("write without token: status = %d, want 401", rec.Code)
	}
}

func TestAdminHealthReportsRuntime(t *testing.T) {
	env := newAdminTestEnv(t)
	router := newAdminTestRouter(env)

	rec := getWithToken(t, router, "/admin/api/health", adminBearerToken(t, domain.RoleAdmin))
	if rec.Code != http.StatusOK {
		t.Fatalf("status = %d, want 200 (body %s)", rec.Code, rec.Body)
	}

	var body adminHealthResponse
	decodeBody(t, rec, &body)
	if body.Uptime != "1d 2h" {
		t.Errorf("uptime = %q, want %q", body.Uptime, "1d 2h")
	}
	if body.StartedAt != time.Unix(1700000000, 0).UnixMilli() {
		t.Errorf("startedAt = %d", body.StartedAt)
	}
	if body.Version != "test-version" || body.StorageType != "local" {
		t.Errorf("version/storageType = %q/%q", body.Version, body.StorageType)
	}
	if body.StorageUsed != 2048 || body.StorageUsedFormatted != "2.0 KB" {
		t.Errorf("storageUsed = %d (%q)", body.StorageUsed, body.StorageUsedFormatted)
	}
	if body.DBSize != 4096 || body.DBSizeFormatted != "4.0 KB" {
		t.Errorf("dbSize = %d (%q)", body.DBSize, body.DBSizeFormatted)
	}
}

func TestAdminStatsAndConfig(t *testing.T) {
	env := newAdminTestEnv(t)
	router := newAdminTestRouter(env)
	admin := adminBearerToken(t, domain.RoleAdmin)

	rec := getWithToken(t, router, "/admin/api/stats", admin)
	if rec.Code != http.StatusOK {
		t.Fatalf("stats status = %d, want 200", rec.Code)
	}
	var stats adminStatsResponse
	decodeBody(t, rec, &stats)
	if stats.Memos.Total != 12 || stats.Memos.ThisMonth != 3 {
		t.Errorf("memos = %+v", stats.Memos)
	}
	if stats.Resources.TotalSizeFormatted != "2.0 KB" {
		t.Errorf("resources.totalSizeFormatted = %q", stats.Resources.TotalSizeFormatted)
	}
	if stats.Bots.TotalReplies != 7 || stats.ActiveDays != 9 || stats.LongestStreak != 0 {
		t.Errorf("bots/activeDays/streak = %+v %d %d", stats.Bots, stats.ActiveDays, stats.LongestStreak)
	}

	rec = getWithToken(t, router, "/admin/api/config", admin)
	var config adminConfigResponse
	decodeBody(t, rec, &config)
	if config.Port != 8080 || config.StorageType != "local" {
		t.Errorf("config = %+v", config)
	}
}

func TestAdminActivityNewestFirstAndBounded(t *testing.T) {
	env := newAdminTestEnv(t)
	router := newAdminTestRouter(env)
	for _, action := range []string{"one", "two", "three", "four", "five"} {
		env.activity.RecordInfo(action, "system", nil, "detail "+action)
	}

	rec := getWithToken(t, router, "/admin/api/activity?limit=10",
		adminBearerToken(t, domain.RoleAdmin))
	if rec.Code != http.StatusOK {
		t.Fatalf("status = %d, want 200", rec.Code)
	}

	var body adminActivityResponse
	decodeBody(t, rec, &body)
	if len(body.Entries) != 3 {
		t.Fatalf("len(entries) = %d, want 3 (bounded)", len(body.Entries))
	}
	want := []string{"five", "four", "three"}
	for i, action := range want {
		if body.Entries[i].Action != action {
			t.Errorf("entries[%d].action = %q, want %q", i, body.Entries[i].Action, action)
		}
		if body.Entries[i].Level != "info" || body.Entries[i].EntityType != "system" {
			t.Errorf("entries[%d] = %+v", i, body.Entries[i])
		}
	}

	rec = getWithToken(t, router, "/admin/api/activity?limit=1",
		adminBearerToken(t, domain.RoleAdmin))
	decodeBody(t, rec, &body)
	if len(body.Entries) != 1 || body.Entries[0].Action != "five" {
		t.Errorf("limit=1 entries = %+v, want only the newest", body.Entries)
	}
}

func TestAdminAIConfigDefaultsAndUpsert(t *testing.T) {
	env := newAdminTestEnv(t)
	router := newAdminTestRouter(env)
	admin := adminBearerToken(t, domain.RoleAdmin)

	rec := getWithToken(t, router, "/admin/api/ai-config", admin)
	var pair adminAIConfigResponse
	decodeBody(t, rec, &pair)
	if pair.Bot.Key != "bot" || pair.Bot.Provider != "openai" {
		t.Errorf("default bot = %+v", pair.Bot)
	}
	if pair.Embedding.Key != "embedding" {
		t.Errorf("default embedding = %+v", pair.Embedding)
	}

	rec = putJSON(t, router, "/admin/api/ai-config/embedding",
		`{"provider":"openai","baseUrl":"https://api.example.com","apiKey":"sk-secret",`+
			`"model":"text-embedding-3-small","embeddingDim":1536,"supportsVision":true}`,
		admin)
	if rec.Code != http.StatusOK {
		t.Fatalf("upsert embedding status = %d, want 200 (body %s)", rec.Code, rec.Body)
	}
	var embedding adminAIConfigDTO
	decodeBody(t, rec, &embedding)
	if embedding.Key != "embedding" || embedding.APIKey != "sk-secret" {
		t.Errorf("embedding = %+v", embedding)
	}
	if embedding.EmbeddingDim == nil || *embedding.EmbeddingDim != 1536 {
		t.Errorf("embeddingDim = %v, want 1536", embedding.EmbeddingDim)
	}
	if embedding.SupportsVision {
		t.Error("server config responses must clear runtime capability flags")
	}

	rec = putJSON(t, router, "/admin/api/ai-config/nope", `{}`, admin)
	if rec.Code != http.StatusBadRequest {
		t.Fatalf("bad key status = %d, want 400", rec.Code)
	}
	var errBody errorBody
	decodeBody(t, rec, &errBody)
	if errBody.Error != "Bad Request" || errBody.Message != "Unsupported AI config key" {
		t.Errorf("bad key body = %+v", errBody)
	}
}

func TestAdminUserAIConfigRoundTrip(t *testing.T) {
	env := newAdminTestEnv(t)
	router := newAdminTestRouter(env)
	admin := adminBearerToken(t, domain.RoleAdmin)
	target := "11111111-1111-1111-1111-111111111111"

	rec := putJSON(t, router, "/admin/api/users/"+target+"/ai-config",
		`{"provider":"anthropic","baseUrl":"https://api.anthropic.com","apiKey":"k","model":"claude"}`,
		admin)
	if rec.Code != http.StatusOK {
		t.Fatalf("upsert user config status = %d, want 200 (body %s)", rec.Code, rec.Body)
	}
	var stored adminAIConfigDTO
	decodeBody(t, rec, &stored)
	if stored.Key != "bot" || stored.Provider != "anthropic" || stored.APIKey != "k" {
		t.Errorf("stored = %+v", stored)
	}

	rec = getWithToken(t, router, "/admin/api/users/"+target+"/ai-config", admin)
	var reread adminAIConfigDTO
	decodeBody(t, rec, &reread)
	if reread.Provider != "anthropic" || reread.Model != "claude" {
		t.Errorf("reread = %+v", reread)
	}
}

func TestAdminSettingsRoundTrip(t *testing.T) {
	env := newAdminTestEnv(t)
	router := newAdminTestRouter(env)
	admin := adminBearerToken(t, domain.RoleAdmin)

	rec := getWithToken(t, router, "/admin/api/settings", admin)
	var settings adminSettingsPayload
	decodeBody(t, rec, &settings)
	if !settings.AutoTagEnabled || settings.AutoSummaryEnabled || !settings.AutoDiaryEnabled {
		t.Errorf("default toggles = %+v", settings)
	}
	if settings.AutoDiaryMinMemos != 2 || settings.AutoDiaryMinChars != 150 {
		t.Errorf("default thresholds = %+v", settings)
	}
	if settings.AppTimezone != "Asia/Shanghai" {
		t.Errorf("default timezone = %q", settings.AppTimezone)
	}

	updated := `{"autoTagEnabled":false,"autoSummaryEnabled":true,"autoDiaryEnabled":false,` +
		`"autoDiaryMinMemos":3,"autoDiaryMinChars":200,"appTimezone":"America/New_York"}`
	rec = putJSON(t, router, "/admin/api/settings", updated, admin)
	if rec.Code != http.StatusOK {
		t.Fatalf("update status = %d, want 200 (body %s)", rec.Code, rec.Body)
	}

	rec = getWithToken(t, router, "/admin/api/settings", admin)
	decodeBody(t, rec, &settings)
	if settings.AutoSummaryEnabled != true || settings.AutoDiaryMinMemos != 3 ||
		settings.AppTimezone != "America/New_York" {
		t.Errorf("reread settings = %+v", settings)
	}

	rec = putJSON(t, router, "/admin/api/settings",
		`{"autoDiaryMinMemos":0,"autoDiaryMinChars":10,"appTimezone":"UTC"}`, admin)
	if rec.Code != http.StatusBadRequest {
		t.Errorf("zero threshold status = %d, want 400", rec.Code)
	}
	rec = putJSON(t, router, "/admin/api/settings",
		`{"autoDiaryMinMemos":2,"autoDiaryMinChars":10,"appTimezone":"Not/AZone"}`, admin)
	if rec.Code != http.StatusBadRequest {
		t.Errorf("invalid timezone status = %d, want 400 (body %s)", rec.Code, rec.Body)
	}
}

func TestAdminBackfillRecordsActivity(t *testing.T) {
	env := newAdminTestEnv(t)
	router := newAdminTestRouter(env)

	rec := postJSON(t, router, "/admin/api/backfill-memory", "", adminBearerToken(t, domain.RoleAdmin))
	if rec.Code != http.StatusOK {
		t.Fatalf("status = %d, want 200 (body %s)", rec.Code, rec.Body)
	}
	var message adminMessageResponse
	decodeBody(t, rec, &message)
	if !strings.Contains(message.Message, "Backfill started") {
		t.Errorf("message = %q", message.Message)
	}

	select {
	case <-env.backfiller.done:
	case <-time.After(2 * time.Second):
		t.Fatal("backfill did not run")
	}

	deadline := time.Now().Add(2 * time.Second)
	for {
		if hasActivity(env, "backfill_memory_completed") {
			break
		}
		if time.Now().After(deadline) {
			t.Fatal("completion activity was not recorded")
		}
		time.Sleep(5 * time.Millisecond)
	}
	if !hasActivity(env, "backfill_memory_started") {
		t.Error("start activity was not recorded")
	}
}

func hasActivity(env *adminTestEnv, action string) bool {
	for _, entry := range env.activity.List(10, nil) {
		if entry.Action == action {
			return true
		}
	}
	return false
}

func TestAdminClearCache(t *testing.T) {
	env := newAdminTestEnv(t)
	router := newAdminTestRouter(env)

	rec := postJSON(t, router, "/admin/api/clear-cache", "", adminBearerToken(t, domain.RoleAdmin))
	if rec.Code != http.StatusOK {
		t.Fatalf("status = %d, want 200", rec.Code)
	}
	var message adminMessageResponse
	decodeBody(t, rec, &message)
	if message.Message != "Cache cleared" {
		t.Errorf("message = %q, want %q", message.Message, "Cache cleared")
	}
}

// Guard against the DTOs drifting into non-camelCase names.
func TestAdminDTOJSONShape(t *testing.T) {
	raw, err := json.Marshal(adminHealthResponse{})
	if err != nil {
		t.Fatalf("marshal: %v", err)
	}
	for _, field := range []string{`"startedAt"`, `"storageType"`, `"storageUsedFormatted"`, `"dbSizeFormatted"`} {
		if !strings.Contains(string(raw), field) {
			t.Errorf("health JSON %s is missing %s", raw, field)
		}
	}
}
