package httpapi

import (
	"net/http"
	"strings"
	"testing"
	"time"

	"github.com/google/uuid"

	"github.com/crayonlu/mosaic/server-go/internal/auth"
	"github.com/crayonlu/mosaic/server-go/internal/domain"
)

func TestCreateUserReturnsManagedUserFields(t *testing.T) {
	env := newAdminTestEnv(t)
	router := newAdminTestRouter(env)
	admin := adminBearerToken(t, domain.RoleAdmin)

	rec := postJSON(t, router, "/admin/api/users",
		`{"username":"bob","password":"password1"}`, admin)
	if rec.Code != http.StatusCreated {
		t.Fatalf("status = %d, want 201 (body %s)", rec.Code, rec.Body)
	}

	// The wire names are camelCase; assert on the raw body too.
	raw := rec.Body.String()
	for _, field := range []string{`"mustChangePassword"`, `"isActive"`, `"createdAt"`, `"updatedAt"`, `"avatarUrl"`} {
		if !strings.Contains(raw, field) {
			t.Errorf("created user body %s is missing %s", raw, field)
		}
	}

	var created managedUserResponse
	decodeBody(t, rec, &created)
	if created.ID == "" || created.Username != "bob" {
		t.Errorf("created = %+v", created)
	}
	if created.Role != domain.RoleUser || !created.IsActive || !created.MustChangePassword {
		t.Errorf("created flags = %+v", created)
	}
	if created.CreatedAt == 0 || created.UpdatedAt == 0 {
		t.Errorf("created timestamps = %+v", created)
	}

	rejected := postJSON(t, router, "/admin/api/users",
		`{"username":"bob","password":"password1"}`, admin)
	if rejected.Code != http.StatusBadRequest {
		t.Errorf("duplicate status = %d, want 400", rejected.Code)
	}
	short := postJSON(t, router, "/admin/api/users",
		`{"username":"shorty","password":"short"}`, admin)
	if short.Code != http.StatusBadRequest {
		t.Errorf("short password status = %d, want 400", short.Code)
	}
}

func TestListUsersPaginationEnvelope(t *testing.T) {
	env := newAdminTestEnv(t)
	router := newAdminTestRouter(env)
	admin := adminBearerToken(t, domain.RoleAdmin)

	for _, name := range []string{"bob", "carol"} {
		rec := postJSON(t, router, "/admin/api/users",
			`{"username":"`+name+`","password":"password1"}`, admin)
		if rec.Code != http.StatusCreated {
			t.Fatalf("create %s status = %d (body %s)", name, rec.Code, rec.Body)
		}
	}

	rec := getWithToken(t, router, "/admin/api/users?page=1&pageSize=10", admin)
	if rec.Code != http.StatusOK {
		t.Fatalf("list status = %d, want 200 (body %s)", rec.Code, rec.Body)
	}

	raw := rec.Body.String()
	for _, field := range []string{`"users"`, `"total"`, `"page"`, `"pageSize"`} {
		if !strings.Contains(raw, field) {
			t.Errorf("list body %s is missing %s", raw, field)
		}
	}

	var page paginatedUsersResponse
	decodeBody(t, rec, &page)
	if page.Total != 2 || page.Page != 1 || page.PageSize != 10 {
		t.Errorf("envelope = %+v", page)
	}
	if len(page.Users) != 2 {
		t.Fatalf("users = %+v, want 2", page.Users)
	}
	if page.Users[0].Username != "bob" || page.Users[1].Username != "carol" {
		t.Errorf("user order = %q, %q", page.Users[0].Username, page.Users[1].Username)
	}
}

func TestPatchManagedUserVisibleOnReread(t *testing.T) {
	env := newAdminTestEnv(t)
	router := newAdminTestRouter(env)
	admin := adminBearerToken(t, domain.RoleAdmin)

	created := postJSON(t, router, "/admin/api/users",
		`{"username":"bob","password":"password1"}`, admin)
	var user managedUserResponse
	decodeBody(t, created, &user)

	patched := doJSON(t, router, http.MethodPatch, "/admin/api/users/"+user.ID,
		`{"isActive":false,"role":"admin"}`, admin)
	if patched.Code != http.StatusOK {
		t.Fatalf("patch status = %d, want 200 (body %s)", patched.Code, patched.Body)
	}
	var updated managedUserResponse
	decodeBody(t, patched, &updated)
	if updated.IsActive || updated.Role != domain.RoleAdmin {
		t.Errorf("patched = %+v", updated)
	}
	if !updated.MustChangePassword {
		t.Error("a role/active patch must not clear the change-password flag")
	}

	// Re-read through the list endpoint; the change must be persisted.
	rec := getWithToken(t, router, "/admin/api/users", admin)
	var page paginatedUsersResponse
	decodeBody(t, rec, &page)
	if len(page.Users) != 1 {
		t.Fatalf("users = %+v", page.Users)
	}
	reread := page.Users[0]
	if reread.IsActive || reread.Role != domain.RoleAdmin {
		t.Errorf("reread = %+v, want isActive=false role=admin", reread)
	}

	// The admin must not be able to demote or disable their own account.
	selfID := uuid.NewString()
	self, err := auth.Sign(adminTestSecret, selfID, domain.RoleAdmin, false, time.Hour)
	if err != nil {
		t.Fatalf("Sign: %v", err)
	}
	rec = doJSON(t, router, http.MethodPatch, "/admin/api/users/"+selfID,
		`{"role":"user"}`, self)
	if rec.Code != http.StatusBadRequest {
		t.Errorf("self-demote status = %d, want 400 (body %s)", rec.Code, rec.Body)
	}
	rec = doJSON(t, router, http.MethodPatch, "/admin/api/users/"+selfID,
		`{"isActive":false}`, self)
	if rec.Code != http.StatusBadRequest {
		t.Errorf("self-disable status = %d, want 400 (body %s)", rec.Code, rec.Body)
	}
}
