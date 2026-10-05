package httpapi

import (
	"context"
	"net/http"
	"testing"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"

	"github.com/crayonlu/mosaic/server-go/internal/domain"
	"github.com/crayonlu/mosaic/server-go/internal/service"
)

// httpFakeAIConfigStore is an in-memory service.UserAIConfigStore.
type httpFakeAIConfigStore struct {
	configs map[uuid.UUID]domain.UserAIConfig
}

func newHTTPFakeAIConfigStore() *httpFakeAIConfigStore {
	return &httpFakeAIConfigStore{configs: map[uuid.UUID]domain.UserAIConfig{}}
}

func (f *httpFakeAIConfigStore) ByUser(_ context.Context, userID uuid.UUID) (domain.UserAIConfig, error) {
	config, ok := f.configs[userID]
	if !ok {
		return domain.UserAIConfig{}, domain.ErrNoRows
	}
	return config, nil
}

func (f *httpFakeAIConfigStore) Upsert(
	_ context.Context,
	userID uuid.UUID,
	config domain.AIConfig,
	now int64,
) (domain.UserAIConfig, error) {
	stored := domain.UserAIConfig{ID: uuid.New(), UserID: userID, AIConfig: config}
	if existing, ok := f.configs[userID]; ok {
		stored.ID = existing.ID
		stored.CreatedAt = existing.CreatedAt
	} else {
		stored.CreatedAt = now
	}
	stored.UpdatedAt = now
	f.configs[userID] = stored
	return stored, nil
}

func (f *httpFakeAIConfigStore) Delete(_ context.Context, userID uuid.UUID) error {
	delete(f.configs, userID)
	return nil
}

func newAIConfigTestRouter(t *testing.T, store *httpFakeAIConfigStore) (http.Handler, string) {
	t.Helper()
	return newAuthedTestRouter(t, uuid.New(), func(r chi.Router) {
		registerUserAIConfigRoutes(r, service.NewUserAIConfigService(store))
	})
}

func TestAIConfigHTTPPutAndGetMaskAPIKey(t *testing.T) {
	store := newHTTPFakeAIConfigStore()
	router, token := newAIConfigTestRouter(t, store)

	put := doJSON(t, router, http.MethodPut, "/ai-config",
		`{"provider":"openai","baseUrl":"https://api.example.com","apiKey":"sk-abcdefgh1234","model":"gpt-4o"}`,
		token)
	if put.Code != http.StatusOK {
		t.Fatalf("put status = %d, want 200 (body %s)", put.Code, put.Body)
	}
	var saved aiConfigResponse
	decodeBody(t, put, &saved)
	if saved.APIKey != "****1234" {
		t.Errorf("put apiKey = %q, want ****1234", saved.APIKey)
	}
	if saved.Provider != "openai" || saved.Model != "gpt-4o" || saved.UpdatedAt == 0 {
		t.Errorf("put response = %+v", saved)
	}

	got := doJSON(t, router, http.MethodGet, "/ai-config", "", token)
	if got.Code != http.StatusOK {
		t.Fatalf("get status = %d, want 200 (body %s)", got.Code, got.Body)
	}
	var fetched aiConfigResponse
	decodeBody(t, got, &fetched)
	if fetched.APIKey != "****1234" {
		t.Errorf("get apiKey = %q, want the masked key", fetched.APIKey)
	}
	if fetched.BaseURL != "https://api.example.com" {
		t.Errorf("get baseUrl = %q", fetched.BaseURL)
	}

	// The store keeps the raw key; only the response is masked.
	userID := uuid.UUID{}
	for id := range store.configs {
		userID = id
	}
	if raw := store.configs[userID].APIKey; raw != "sk-abcdefgh1234" {
		t.Errorf("stored apiKey = %q, want the raw value", raw)
	}
}

func TestAIConfigHTTPGetMissingIsNotFound(t *testing.T) {
	router, token := newAIConfigTestRouter(t, newHTTPFakeAIConfigStore())

	rec := doJSON(t, router, http.MethodGet, "/ai-config", "", token)
	if rec.Code != http.StatusNotFound {
		t.Fatalf("status = %d, want 404 (body %s)", rec.Code, rec.Body)
	}
	var body errorBody
	decodeBody(t, rec, &body)
	if body.Message != "Not found: AI configuration not set" {
		t.Errorf("message = %q", body.Message)
	}
}

func TestAIConfigHTTPDelete(t *testing.T) {
	store := newHTTPFakeAIConfigStore()
	router, token := newAIConfigTestRouter(t, store)

	put := doJSON(t, router, http.MethodPut, "/ai-config",
		`{"provider":"openai","baseUrl":"https://api.example.com","apiKey":"sk-abcdefgh1234","model":"gpt-4o"}`,
		token)
	if put.Code != http.StatusOK {
		t.Fatalf("put status = %d, want 200 (body %s)", put.Code, put.Body)
	}

	deleted := doJSON(t, router, http.MethodDelete, "/ai-config", "", token)
	if deleted.Code != http.StatusNoContent {
		t.Fatalf("delete status = %d, want 204 (body %s)", deleted.Code, deleted.Body)
	}
	if got := deleted.Body.String(); got != "" {
		t.Errorf("delete body = %q, want empty", got)
	}

	rec := doJSON(t, router, http.MethodGet, "/ai-config", "", token)
	if rec.Code != http.StatusNotFound {
		t.Errorf("get after delete = %d, want 404", rec.Code)
	}
}

func TestAIConfigHTTPPutValidatesRequiredFields(t *testing.T) {
	router, token := newAIConfigTestRouter(t, newHTTPFakeAIConfigStore())

	rec := doJSON(t, router, http.MethodPut, "/ai-config",
		`{"provider":"openai","baseUrl":"https://api.example.com","apiKey":"sk-abcdefgh1234"}`, token)
	if rec.Code != http.StatusBadRequest {
		t.Fatalf("status = %d, want 400 (body %s)", rec.Code, rec.Body)
	}
	var body errorBody
	decodeBody(t, rec, &body)
	if body.Message != "Invalid input: model is required" {
		t.Errorf("message = %q", body.Message)
	}
}
