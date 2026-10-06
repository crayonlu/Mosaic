package httpapi

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"reflect"
	"regexp"
	"runtime"
	"strings"
	"testing"

	"github.com/go-chi/chi/v5"
)

func readOpenAPI(t *testing.T) map[string]any {
	t.Helper()
	var spec map[string]any
	if err := json.Unmarshal(openAPISpec, &spec); err != nil {
		t.Fatal(err)
	}
	return spec
}

func TestOpenAPIIsPublicAndSupportsHEAD(t *testing.T) {
	server := newContractServer(t)
	for _, method := range []string{http.MethodGet, http.MethodHead} {
		rec := httptest.NewRecorder()
		server.handler.ServeHTTP(rec, httptest.NewRequest(method, "/openapi.json", nil))
		if rec.Code != http.StatusOK || rec.Header().Get("Content-Type") != "application/json" {
			t.Fatalf("%s spec = %d %s", method, rec.Code, rec.Body)
		}
		if method == http.MethodGet && rec.Body.String() != string(openAPISpec) {
			t.Error("served spec differs from embedded source")
		}
		if method == http.MethodHead && rec.Body.Len() != 0 {
			t.Error("HEAD returned a body")
		}
	}
}

func TestOpenAPICoversActualAPIRoutes(t *testing.T) {
	spec := readOpenAPI(t)
	server := newContractServer(t)
	served := map[string]bool{}
	err := chi.Walk(server.handler.(*chi.Mux), func(method, path string, handler http.Handler, _ ...func(http.Handler) http.Handler) error {
		if function, ok := handler.(http.HandlerFunc); ok {
			name := runtime.FuncForPC(reflect.ValueOf(function).Pointer()).Name()
			if strings.Contains(name, ".serve.func") {
				return nil
			}
		}
		if strings.HasPrefix(path, "/api/") || strings.HasPrefix(path, "/admin/api/") || path == "/health" || path == "/openapi.json" {
			served[strings.ToLower(method)+" "+path] = true
		}
		return nil
	})
	if err != nil {
		t.Fatal(err)
	}
	documented := map[string]bool{}
	for path, value := range spec["paths"].(map[string]any) {
		for method := range value.(map[string]any) {
			documented[method+" "+path] = true
		}
	}
	for route := range served {
		if !documented[route] {
			t.Errorf("missing OpenAPI operation: %s", route)
		}
	}
	for route := range documented {
		if !served[route] {
			t.Errorf("OpenAPI operation has no registered route: %s", route)
		}
	}
}

func TestOpenAPIReferencesParametersAndSecurity(t *testing.T) {
	spec := readOpenAPI(t)
	if spec["openapi"] != "3.1.0" {
		t.Fatal("expected OpenAPI 3.1")
	}
	var walk func(any)
	walk = func(node any) {
		switch value := node.(type) {
		case map[string]any:
			if ref, ok := value["$ref"].(string); ok {
				var target any = spec
				for _, part := range strings.Split(strings.TrimPrefix(ref, "#/"), "/") {
					object, ok := target.(map[string]any)
					if !ok {
						t.Errorf("invalid reference %s", ref)
						break
					}
					target = object[part]
				}
				if target == nil {
					t.Errorf("unresolved reference %s", ref)
				}
			}
			for _, child := range value {
				walk(child)
			}
		case []any:
			for _, child := range value {
				walk(child)
			}
		}
	}
	walk(spec)
	ids := map[string]bool{}
	pattern := regexp.MustCompile(`\{([^}]+)\}`)
	for path, item := range spec["paths"].(map[string]any) {
		for method, value := range item.(map[string]any) {
			op := value.(map[string]any)
			id := op["operationId"].(string)
			if ids[id] {
				t.Errorf("duplicate operationId %s", id)
			}
			ids[id] = true
			params := map[string]bool{}
			if list, ok := op["parameters"].([]any); ok {
				for _, value := range list {
					p := value.(map[string]any)
					if p["in"] == "path" && p["required"] == true {
						params[p["name"].(string)] = true
					}
				}
			}
			for _, match := range pattern.FindAllStringSubmatch(path, -1) {
				if !params[match[1]] {
					t.Errorf("%s %s missing required path parameter %s", method, path, match[1])
				}
			}
			public := path == "/health" || path == "/openapi.json" || path == "/api/auth/login" || path == "/api/auth/refresh"
			security, override := op["security"]
			if public && (!override || len(security.([]any)) != 0) {
				t.Errorf("public operation requires auth: %s %s", method, path)
			}
			if !public && override {
				t.Errorf("protected operation overrides bearer auth: %s %s", method, path)
			}
		}
	}
}

func TestOpenAPISchemasMatchDTOFields(t *testing.T) {
	schemas := readOpenAPI(t)["components"].(map[string]any)["schemas"].(map[string]any)
	for name, dto := range map[string]any{
		"LoginResponse": loginResponse{}, "UserResponse": userResponse{},
		"MemoResponse": memoResponse{}, "MemoDetailResponse": memoDetailResponse{},
		"BotResponse": botResponse{}, "BotReplyNodeResponse": botReplyNodeResponse{},
		"BotThreadResponse": botThreadResponse{}, "MemoryContextResponse": memoryContextResponse{},
		"AiConfigResponse": aiConfigResponse{}, "AdminSettingsPayload": adminSettingsPayload{},
		"PaginatedUsersResponse": paginatedUsersResponse{}, "UploadedResourceResponse": uploadedResourceResponse{},
	} {
		t.Run(name, func(t *testing.T) {
			fields := map[string]bool{}
			typeOf := reflect.TypeOf(dto)
			for i := 0; i < typeOf.NumField(); i++ {
				key := strings.Split(typeOf.Field(i).Tag.Get("json"), ",")[0]
				if key != "" && key != "-" {
					fields[key] = true
				}
			}
			properties := schemas[name].(map[string]any)["properties"].(map[string]any)
			if len(properties) != len(fields) {
				t.Errorf("schema has %d fields, DTO has %d", len(properties), len(fields))
			}
			for key := range fields {
				if _, ok := properties[key]; !ok {
					t.Errorf("missing field %s", key)
				}
			}
		})
	}
}

func TestOpenAPIResponseContracts(t *testing.T) {
	spec := readOpenAPI(t)
	paths := spec["paths"].(map[string]any)
	schemaFor := func(path, method string) map[string]any {
		op := paths[path].(map[string]any)[method].(map[string]any)
		response := op["responses"].(map[string]any)["200"].(map[string]any)
		content := response["content"].(map[string]any)["application/json"].(map[string]any)
		return content["schema"].(map[string]any)
	}
	if schemaFor("/api/auth/change-password", "post")["$ref"] != "#/components/schemas/RefreshTokenResponse" {
		t.Error("password change must document replacement tokens")
	}
	tags := schemaFor("/api/memos/tags", "get")
	if tags["type"] != "array" || tags["items"].(map[string]any)["$ref"] != "#/components/schemas/TagCount" {
		t.Error("tags must document tag/count objects")
	}
	search := schemaFor("/api/memos/search", "get")
	variants := search["anyOf"].([]any)
	if len(variants) != 2 {
		t.Error("search must document keyword and hybrid responses")
	}
	for _, variant := range variants {
		ref := variant.(map[string]any)["$ref"]
		if ref != "#/components/schemas/SearchMemosResponse" && ref != "#/components/schemas/HybridSearchResponse" {
			t.Errorf("unexpected search schema %v", ref)
		}
	}
}
