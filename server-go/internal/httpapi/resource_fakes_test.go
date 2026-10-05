package httpapi

import (
	"context"
	"sort"
	"strings"
	"sync"
	"time"

	"github.com/google/uuid"

	"github.com/crayonlu/mosaic/server-go/internal/domain"
)

// fakeResourceStore is an in-memory service.ResourceStore.
type fakeResourceStore struct {
	mu        sync.Mutex
	resources map[uuid.UUID]domain.Resource
	memos     map[uuid.UUID]uuid.UUID
}

func newFakeResourceStore() *fakeResourceStore {
	return &fakeResourceStore{
		resources: map[uuid.UUID]domain.Resource{},
		memos:     map[uuid.UUID]uuid.UUID{},
	}
}

func (f *fakeResourceStore) MemoExists(_ context.Context, userID, memoID uuid.UUID) (bool, error) {
	f.mu.Lock()
	defer f.mu.Unlock()
	owner, ok := f.memos[memoID]
	return ok && owner == userID, nil
}

func (f *fakeResourceStore) Create(_ context.Context, resource domain.Resource) (domain.Resource, error) {
	f.mu.Lock()
	defer f.mu.Unlock()
	f.resources[resource.ID] = resource
	return resource, nil
}

func (f *fakeResourceStore) ByIDForUser(
	_ context.Context,
	userID, resourceID uuid.UUID,
	liveOnly bool,
) (domain.Resource, error) {
	f.mu.Lock()
	defer f.mu.Unlock()
	resource, ok := f.resources[resourceID]
	if !ok || (liveOnly && resource.IsDeleted) {
		return domain.Resource{}, domain.ErrNoRows
	}
	owned := resource.UserID == userID ||
		strings.HasPrefix(resource.StoragePath, "resources/"+userID.String()+"/")
	if !owned {
		return domain.Resource{}, domain.ErrNoRows
	}
	return resource, nil
}

func (f *fakeResourceStore) ByIDForMemoOwner(
	_ context.Context,
	userID, resourceID uuid.UUID,
) (domain.Resource, error) {
	f.mu.Lock()
	defer f.mu.Unlock()
	resource, ok := f.resources[resourceID]
	if !ok || resource.IsDeleted || resource.MemoID == nil {
		return domain.Resource{}, domain.ErrNoRows
	}
	if owner := f.memos[*resource.MemoID]; owner != userID {
		return domain.Resource{}, domain.ErrNoRows
	}
	return resource, nil
}

func (f *fakeResourceStore) List(
	_ context.Context,
	userID uuid.UUID,
	limit, offset int64,
) ([]domain.Resource, int64, error) {
	f.mu.Lock()
	defer f.mu.Unlock()

	owned := make([]domain.Resource, 0, len(f.resources))
	for _, resource := range f.resources {
		if resource.IsDeleted || resource.UserID != userID {
			continue
		}
		owned = append(owned, resource)
	}
	sort.Slice(owned, func(i, j int) bool { return owned[i].CreatedAt > owned[j].CreatedAt })

	total := int64(len(owned))
	if offset >= total {
		return []domain.Resource{}, total, nil
	}
	owned = owned[offset:]
	if limit < int64(len(owned)) {
		owned = owned[:limit]
	}
	return owned, total, nil
}

func (f *fakeResourceStore) UpdateMetadata(
	_ context.Context,
	resourceID uuid.UUID,
	metadata map[string]any,
) error {
	f.mu.Lock()
	defer f.mu.Unlock()
	resource, ok := f.resources[resourceID]
	if !ok {
		return domain.ErrNoRows
	}
	resource.Metadata = metadata
	f.resources[resourceID] = resource
	return nil
}

func (f *fakeResourceStore) SoftDelete(_ context.Context, resourceID uuid.UUID, now int64) error {
	f.mu.Lock()
	defer f.mu.Unlock()
	resource, ok := f.resources[resourceID]
	if !ok {
		return domain.ErrNoRows
	}
	resource.IsDeleted = true
	resource.UpdatedAt = now
	f.resources[resourceID] = resource
	return nil
}

// fakeBlobs is an in-memory service.BlobStore.
type fakeBlobs struct {
	mu      sync.Mutex
	objects map[string][]byte
}

func newFakeBlobs() *fakeBlobs {
	return &fakeBlobs{objects: map[string][]byte{}}
}

func (f *fakeBlobs) Put(_ context.Context, path string, data []byte, _ string) (string, error) {
	f.mu.Lock()
	defer f.mu.Unlock()
	stored := make([]byte, len(data))
	copy(stored, data)
	f.objects[path] = stored
	return path, nil
}

func (f *fakeBlobs) Get(_ context.Context, path string) ([]byte, error) {
	f.mu.Lock()
	defer f.mu.Unlock()
	data, ok := f.objects[path]
	if !ok {
		return nil, domain.ResourceNotFound()
	}
	stored := make([]byte, len(data))
	copy(stored, data)
	return stored, nil
}

func (f *fakeBlobs) Delete(_ context.Context, path string) error {
	f.mu.Lock()
	defer f.mu.Unlock()
	delete(f.objects, path)
	return nil
}

func (f *fakeBlobs) Exists(_ context.Context, path string) bool {
	f.mu.Lock()
	defer f.mu.Unlock()
	_, ok := f.objects[path]
	return ok
}

func (f *fakeBlobs) PresignedGetURL(_ context.Context, path string, _ time.Duration) (string, error) {
	return "https://r2.example/get/" + path, nil
}

func (f *fakeBlobs) PresignedPutURL(_ context.Context, path string, _ time.Duration) (string, error) {
	return "https://r2.example/put/" + path, nil
}

// paths returns the stored keys, used by the avatar fake to resolve a blob by id.
func (f *fakeBlobs) paths() []string {
	f.mu.Lock()
	defer f.mu.Unlock()
	keys := make([]string, 0, len(f.objects))
	for key := range f.objects {
		keys = append(keys, key)
	}
	return keys
}

// fakeImages is an in-memory service.ImageDeriver.
type fakeImages struct {
	err error
}

func (f fakeImages) CreateThumbnail(data []byte) ([]byte, error) {
	if f.err != nil {
		return nil, f.err
	}
	return []byte("image-thumbnail"), nil
}

func (f fakeImages) CreateOptimized(data []byte) ([]byte, error) {
	if f.err != nil {
		return nil, f.err
	}
	return []byte("image-optimized"), nil
}

// fakeVideos is an in-memory service.VideoDeriver.
type fakeVideos struct {
	err error
}

func (f fakeVideos) CreateThumbnail(_ context.Context, data []byte) ([]byte, error) {
	if f.err != nil {
		return nil, f.err
	}
	return []byte("video-thumbnail"), nil
}

func (f fakeVideos) CreateOptimized(_ context.Context, data []byte) ([]byte, error) {
	if f.err != nil {
		return nil, f.err
	}
	return []byte("video-optimized"), nil
}

// fakeAvatars is an in-memory service.AvatarStore backed by the shared blobs.
type fakeAvatars struct {
	mu    sync.Mutex
	users map[uuid.UUID]domain.User
	blobs *fakeBlobs
}

func newFakeAvatars(users ...domain.User) *fakeAvatars {
	f := &fakeAvatars{users: map[uuid.UUID]domain.User{}}
	for _, user := range users {
		f.users[user.ID] = user
	}
	return f
}

func (f *fakeAvatars) SetAvatar(
	_ context.Context,
	userID uuid.UUID,
	avatarURL string,
	now int64,
) (domain.User, error) {
	f.mu.Lock()
	defer f.mu.Unlock()
	user, ok := f.users[userID]
	if !ok {
		return domain.User{}, domain.ErrNoRows
	}
	user.AvatarURL = &avatarURL
	user.UpdatedAt = now
	f.users[userID] = user
	return user, nil
}

func (f *fakeAvatars) AvatarBlob(ctx context.Context, avatarID uuid.UUID) ([]byte, error) {
	if f.blobs != nil {
		for _, path := range f.blobs.paths() {
			if strings.HasSuffix(path, "/"+avatarID.String()) {
				return f.blobs.Get(ctx, path)
			}
		}
	}
	return nil, domain.ResourceNotFound()
}

// SetAIDescription mirrors the IS NULL guard the real store applies.
func (f *fakeResourceStore) SetAIDescription(
	_ context.Context,
	resourceID, _ uuid.UUID,
	description string,
	now int64,
) (bool, error) {
	f.mu.Lock()
	defer f.mu.Unlock()

	resource, ok := f.resources[resourceID]
	if !ok || resource.IsDeleted || resource.AiDescription != nil {
		return false, nil
	}
	resource.AiDescription = &description
	resource.UpdatedAt = now
	f.resources[resourceID] = resource
	return true, nil
}
