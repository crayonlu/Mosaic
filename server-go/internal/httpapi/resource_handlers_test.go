package httpapi

import (
	"bytes"
	"context"
	"errors"
	"fmt"
	"mime/multipart"
	"net/http"
	"net/http/httptest"
	"net/textproto"
	"strings"
	"testing"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"

	"github.com/crayonlu/mosaic/server-go/internal/auth"
	"github.com/crayonlu/mosaic/server-go/internal/config"
	"github.com/crayonlu/mosaic/server-go/internal/domain"
	"github.com/crayonlu/mosaic/server-go/internal/service"
)

func TestResourceUploadListDeleteRoundTrip(t *testing.T) {
	userID := uuid.New()
	memoID := uuid.New()
	store := newFakeResourceStore()
	store.memos[memoID] = userID
	blobs := newFakeBlobs()
	resources := service.NewResourceService(
		store, blobs, fakeImages{}, fakeVideos{}, newFakeAvatars(), config.StorageLocal, fakeChatConfigs{}, fakeCompletion{})
	router := newResourceTestRouter(resources)
	token := resourceToken(t, userID)

	fileData := []byte("fake-video-bytes")
	rec := multipartUpload(t, router, "/resources/upload", token,
		map[string]string{"memoId": memoID.String()}, "clip.mp4", "video/mp4", fileData)
	if rec.Code != http.StatusOK {
		t.Fatalf("upload status = %d, want 200 (body %s)", rec.Code, rec.Body)
	}

	var created uploadedResourceResponse
	decodeBody(t, rec, &created)
	if created.ID == "" {
		t.Fatal("upload response has no id")
	}
	if created.Filename != "clip.mp4" {
		t.Errorf("filename = %q, want %q", created.Filename, "clip.mp4")
	}
	if created.FileSize != int64(len(fileData)) {
		t.Errorf("fileSize = %d, want %d", created.FileSize, len(fileData))
	}
	wantURL := "/api/resources/" + created.ID + "/download"
	if created.URL != wantURL {
		t.Errorf("url = %q, want %q", created.URL, wantURL)
	}
	wantThumb := "/api/resources/" + created.ID + "/thumbnail"
	if created.ThumbnailURL == nil || *created.ThumbnailURL != wantThumb {
		t.Errorf("thumbnailUrl = %v, want %q", created.ThumbnailURL, wantThumb)
	}

	listRec := getWithToken(t, router, "/resources", token)
	if listRec.Code != http.StatusOK {
		t.Fatalf("list status = %d, want 200 (body %s)", listRec.Code, listRec.Body)
	}
	var list listResourcesResponse
	decodeBody(t, listRec, &list)
	if len(list.Items) != 1 {
		t.Fatalf("list returned %d items, want 1", len(list.Items))
	}
	if list.Total != 1 || list.Page != 1 || list.PageSize != 100 {
		t.Errorf("pagination = total %d page %d size %d", list.Total, list.Page, list.PageSize)
	}
	item := list.Items[0]
	if item.ID != created.ID || item.Filename != created.Filename ||
		item.FileSize != created.FileSize || item.URL != created.URL {
		t.Errorf("list item does not round-trip the upload: %+v", item)
	}
	if item.ThumbnailURL == nil || *item.ThumbnailURL != wantThumb {
		t.Errorf("list thumbnailUrl = %v, want %q", item.ThumbnailURL, wantThumb)
	}

	deleted := doJSON(t, router, http.MethodDelete, "/resources/"+created.ID, "", token)
	if deleted.Code != http.StatusOK {
		t.Fatalf("delete status = %d, want 200 (body %s)", deleted.Code, deleted.Body)
	}

	afterRec := getWithToken(t, router, "/resources", token)
	var after listResourcesResponse
	decodeBody(t, afterRec, &after)
	if len(after.Items) != 0 {
		t.Errorf("list after delete returned %d items, want 0", len(after.Items))
	}
	storedPath := "resources/" + userID.String() + "/" + created.ID
	if blobs.Exists(context.Background(), storedPath) {
		t.Error("original blob was not removed on delete")
	}
}

func TestPresignedUploadAndConfirmFlow(t *testing.T) {
	userID := uuid.New()
	memoID := uuid.New()
	store := newFakeResourceStore()
	store.memos[memoID] = userID
	blobs := newFakeBlobs()
	resources := service.NewResourceService(
		store, blobs, fakeImages{}, fakeVideos{}, newFakeAvatars(), config.StorageR2, fakeChatConfigs{}, fakeCompletion{})
	router := newResourceTestRouter(resources)
	token := resourceToken(t, userID)

	body := fmt.Sprintf(
		`{"memoId":%q,"filename":"photo.png","mimeType":"image/png","fileSize":123,"metadata":{"width":4}}`,
		memoID.String())
	rec := postJSON(t, router, "/resources/presigned-upload", body, token)
	if rec.Code != http.StatusOK {
		t.Fatalf("presigned-upload status = %d, want 200 (body %s)", rec.Code, rec.Body)
	}

	var presigned presignedUploadResponse
	decodeBody(t, rec, &presigned)
	if presigned.ResourceID == "" {
		t.Fatal("presigned response has no resourceId")
	}
	wantPath := "resources/" + userID.String() + "/" + presigned.ResourceID
	if presigned.StoragePath != wantPath {
		t.Errorf("storagePath = %q, want %q", presigned.StoragePath, wantPath)
	}
	if presigned.UploadURL != "https://r2.example/put/"+wantPath {
		t.Errorf("uploadUrl = %q", presigned.UploadURL)
	}

	confirm := postJSON(t, router, "/resources/confirm-upload",
		fmt.Sprintf(`{"resourceId":%q}`, presigned.ResourceID), token)
	if confirm.Code != http.StatusOK {
		t.Fatalf("confirm-upload status = %d, want 200 (body %s)", confirm.Code, confirm.Body)
	}
	var stored uploadedResourceResponse
	decodeBody(t, confirm, &stored)
	if stored.ID != presigned.ResourceID {
		t.Errorf("confirmed id = %q, want %q", stored.ID, presigned.ResourceID)
	}
	if stored.Filename != "photo.png" || stored.FileSize != 123 {
		t.Errorf("confirmed resource = %+v", stored)
	}
	if stored.URL != "https://r2.example/get/"+wantPath {
		t.Errorf("confirmed url = %q", stored.URL)
	}
	if stored.StorageType != "r2" {
		t.Errorf("storageType = %q, want r2", stored.StorageType)
	}

	id := uuid.MustParse(presigned.ResourceID)
	if _, ok := store.resources[id]; !ok {
		t.Error("confirm-upload did not find a stored resource")
	}
}

func TestDownloadReturnsExactBytesAndContentType(t *testing.T) {
	userID := uuid.New()
	store := newFakeResourceStore()
	blobs := newFakeBlobs()
	resources := service.NewResourceService(
		store, blobs, fakeImages{}, fakeVideos{}, newFakeAvatars(), config.StorageLocal, fakeChatConfigs{}, fakeCompletion{})
	router := newResourceTestRouter(resources)
	token := resourceToken(t, userID)

	fileData := []byte("\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR\x00\x00\x00\x01")
	created := uploadImage(t, router, token, "photo.png", "image/png", fileData)

	rec := getWithToken(t, router, "/resources/"+created.ID+"/download", token)
	if rec.Code != http.StatusOK {
		t.Fatalf("download status = %d, want 200 (body %s)", rec.Code, rec.Body)
	}
	if !bytes.Equal(rec.Body.Bytes(), fileData) {
		t.Errorf("download body = %q, want %q", rec.Body.Bytes(), fileData)
	}
	if got := rec.Header().Get("Content-Type"); got != "image/png" {
		t.Errorf("Content-Type = %q, want image/png", got)
	}
	storedPath := "resources/" + userID.String() + "/" + created.ID
	if !blobs.Exists(context.Background(), storedPath) {
		t.Errorf("original not stored at %q", storedPath)
	}

	// A conditional request with the returned ETag is served from cache.
	conditional := httptest.NewRequest(http.MethodGet, "/resources/"+created.ID+"/download", nil)
	conditional.Header.Set("Authorization", "Bearer "+token)
	conditional.Header.Set("If-None-Match", rec.Header().Get("ETag"))
	conditionedRec := httptest.NewRecorder()
	router.ServeHTTP(conditionedRec, conditional)
	if conditionedRec.Code != http.StatusNotModified {
		t.Errorf("conditional status = %d, want 304", conditionedRec.Code)
	}
}

func TestThumbnailFallsBackToOriginalWhenNoDerivative(t *testing.T) {
	userID := uuid.New()
	store := newFakeResourceStore()
	blobs := newFakeBlobs()
	// Rendition generation fails, so no derivative is ever recorded.
	resources := service.NewResourceService(
		store, blobs,
		fakeImages{err: errors.New("no image processing")},
		fakeVideos{err: errors.New("no video processing")},
		newFakeAvatars(), config.StorageLocal, fakeChatConfigs{}, fakeCompletion{})
	router := newResourceTestRouter(resources)
	token := resourceToken(t, userID)

	fileData := []byte("\x89PNG\r\n\x1a\noriginal-image-bytes")
	created := uploadImage(t, router, token, "photo.png", "image/png", fileData)

	rec := getWithToken(t, router, "/resources/"+created.ID+"/thumbnail", token)
	if rec.Code != http.StatusOK {
		t.Fatalf("thumbnail status = %d, want 200 (body %s)", rec.Code, rec.Body)
	}
	if !bytes.Equal(rec.Body.Bytes(), fileData) {
		t.Errorf("thumbnail body = %q, want the original %q", rec.Body.Bytes(), fileData)
	}
	if got := rec.Header().Get("Content-Type"); got != "image/png" {
		t.Errorf("thumbnail Content-Type = %q, want image/png", got)
	}
}

func TestAvatarUploadAndDownload(t *testing.T) {
	userID := uuid.New()
	user := domain.User{ID: userID, Username: "alice", Role: domain.RoleUser, IsActive: true}
	blobs := newFakeBlobs()
	avatars := newFakeAvatars(user)
	avatars.blobs = blobs
	resources := service.NewResourceService(
		newFakeResourceStore(), blobs, fakeImages{}, fakeVideos{}, avatars, config.StorageLocal, fakeChatConfigs{}, fakeCompletion{})
	router := newResourceTestRouter(resources)
	token := resourceToken(t, userID)

	fileData := []byte("avatar-image-bytes")
	rec := multipartUpload(t, router, "/resources/upload-avatar", token, nil, "me.jpg", "image/jpeg", fileData)
	if rec.Code != http.StatusOK {
		t.Fatalf("upload-avatar status = %d, want 200 (body %s)", rec.Code, rec.Body)
	}

	var uploaded userResponse
	decodeBody(t, rec, &uploaded)
	if uploaded.AvatarURL == nil || !strings.HasPrefix(*uploaded.AvatarURL, "/api/avatars/") {
		t.Fatalf("avatarUrl = %v, want a local avatar route", uploaded.AvatarURL)
	}

	avatarID := strings.TrimSuffix(strings.TrimPrefix(*uploaded.AvatarURL, "/api/avatars/"), "/download")
	download := getWithToken(t, router, "/avatars/"+avatarID+"/download", token)
	if download.Code != http.StatusOK {
		t.Fatalf("avatar download status = %d, want 200 (body %s)", download.Code, download.Body)
	}
	if !bytes.Equal(download.Body.Bytes(), fileData) {
		t.Errorf("avatar download = %q, want %q", download.Body.Bytes(), fileData)
	}
	if got := download.Header().Get("Content-Type"); got != "image/jpeg" {
		t.Errorf("avatar Content-Type = %q, want image/jpeg", got)
	}
}

func TestPresignedUploadRejectedForLocalStorage(t *testing.T) {
	userID := uuid.New()
	resources := service.NewResourceService(
		newFakeResourceStore(), newFakeBlobs(), fakeImages{}, fakeVideos{},
		newFakeAvatars(), config.StorageLocal, fakeChatConfigs{}, fakeCompletion{})
	router := newResourceTestRouter(resources)

	rec := postJSON(t, router, "/resources/presigned-upload",
		`{"filename":"photo.png","mimeType":"image/png","fileSize":1}`, resourceToken(t, userID))
	if rec.Code != http.StatusBadRequest {
		t.Fatalf("status = %d, want 400 (body %s)", rec.Code, rec.Body)
	}
	var body errorBody
	decodeBody(t, rec, &body)
	if body.Message != "Invalid input: Direct upload only supported for R2 storage" {
		t.Errorf("message = %q", body.Message)
	}
}

func uploadImage(
	t *testing.T,
	router http.Handler,
	token, filename, contentType string,
	data []byte,
) uploadedResourceResponse {
	t.Helper()
	rec := multipartUpload(t, router, "/resources/upload", token, nil, filename, contentType, data)
	if rec.Code != http.StatusOK {
		t.Fatalf("upload status = %d, want 200 (body %s)", rec.Code, rec.Body)
	}
	var created uploadedResourceResponse
	decodeBody(t, rec, &created)
	return created
}

func newResourceTestRouter(resources *service.ResourceService) http.Handler {
	router := chi.NewRouter()
	router.Group(func(r chi.Router) {
		r.Use(RequireAuth(routerSecret))
		registerResourceRoutes(r, resources)
	})
	return router
}

func resourceToken(t *testing.T, userID uuid.UUID) string {
	t.Helper()
	token, err := auth.Sign(routerSecret, userID.String(), domain.RoleUser, false, time.Hour)
	if err != nil {
		t.Fatalf("Sign: %v", err)
	}
	return token
}

func multipartUpload(
	t *testing.T,
	handler http.Handler,
	path, token string,
	fields map[string]string,
	filename, contentType string,
	data []byte,
) *httptest.ResponseRecorder {
	t.Helper()

	var buf bytes.Buffer
	writer := multipart.NewWriter(&buf)
	for name, value := range fields {
		if err := writer.WriteField(name, value); err != nil {
			t.Fatalf("writing field %q: %v", name, err)
		}
	}

	header := textproto.MIMEHeader{}
	header.Set("Content-Disposition", fmt.Sprintf(`form-data; name="file"; filename=%q`, filename))
	header.Set("Content-Type", contentType)
	part, err := writer.CreatePart(header)
	if err != nil {
		t.Fatalf("creating file part: %v", err)
	}
	if _, err := part.Write(data); err != nil {
		t.Fatalf("writing file part: %v", err)
	}
	if err := writer.Close(); err != nil {
		t.Fatalf("closing multipart writer: %v", err)
	}

	req := httptest.NewRequest(http.MethodPost, path, &buf)
	req.Header.Set("Content-Type", writer.FormDataContentType())
	req.Header.Set("Authorization", "Bearer "+token)

	rec := httptest.NewRecorder()
	handler.ServeHTTP(rec, req)
	return rec
}
