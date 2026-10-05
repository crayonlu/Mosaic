package store

import (
	"context"
	"encoding/json"
	"errors"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/crayonlu/mosaic/server-go/internal/domain"
)

const resourceSelectColumns = `r.id, r.memo_id, r.user_id, r.filename, r.resource_type, r.mime_type,
	r.file_size, r.storage_type, r.storage_path, r.metadata, r.is_deleted, r.ai_description,
	r.created_at, r.updated_at`

// resourceReturningColumns is the same list without the table alias, as an
// INSERT's RETURNING clause cannot reference an alias.
const resourceReturningColumns = `id, memo_id, user_id, filename, resource_type, mime_type,
	file_size, storage_type, storage_path, metadata, is_deleted, ai_description,
	created_at, updated_at`

// ResourceStore reads and writes the resources table.
type ResourceStore struct {
	pool *pgxpool.Pool
}

func NewResourceStore(pool *pgxpool.Pool) *ResourceStore {
	return &ResourceStore{pool: pool}
}

// scanResourceRow decodes a row into a domain.Resource. A missing row becomes
// domain.ErrNoRows so services never depend on pgx.
func scanResourceRow(row pgx.Row) (domain.Resource, error) {
	var (
		resource domain.Resource
		metadata []byte
	)
	err := row.Scan(
		&resource.ID,
		&resource.MemoID,
		&resource.UserID,
		&resource.Filename,
		&resource.Type,
		&resource.MimeType,
		&resource.FileSize,
		&resource.StorageType,
		&resource.StoragePath,
		&metadata,
		&resource.IsDeleted,
		&resource.AiDescription,
		&resource.CreatedAt,
		&resource.UpdatedAt,
	)
	if errors.Is(err, pgx.ErrNoRows) {
		return domain.Resource{}, domain.ErrNoRows
	}
	if err != nil {
		return domain.Resource{}, err
	}
	if len(metadata) > 0 {
		if err := json.Unmarshal(metadata, &resource.Metadata); err != nil {
			return domain.Resource{}, err
		}
	}
	if resource.Metadata == nil {
		resource.Metadata = map[string]any{}
	}
	return resource, nil
}

// MemoExists reports whether a memo belongs to the user.
func (s *ResourceStore) MemoExists(ctx context.Context, userID, memoID uuid.UUID) (bool, error) {
	var exists bool
	err := s.pool.QueryRow(ctx,
		`SELECT EXISTS (SELECT 1 FROM memos WHERE id = $1 AND user_id = $2)`,
		memoID, userID).Scan(&exists)
	return exists, err
}

// Create inserts a resource and returns the stored row.
func (s *ResourceStore) Create(ctx context.Context, resource domain.Resource) (domain.Resource, error) {
	metadata, err := json.Marshal(resource.Metadata)
	if err != nil {
		return domain.Resource{}, err
	}
	return scanResourceRow(s.pool.QueryRow(ctx,
		`INSERT INTO resources
			(id, memo_id, user_id, filename, resource_type, mime_type, file_size,
			 storage_type, storage_path, metadata, ai_description, created_at, updated_at)
		 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
		 RETURNING `+resourceReturningColumns,
		resource.ID, resource.MemoID, resource.UserID, resource.Filename, resource.Type,
		resource.MimeType, resource.FileSize, resource.StorageType, resource.StoragePath,
		metadata, resource.AiDescription, resource.CreatedAt, resource.UpdatedAt))
}

// ByIDForUser loads a resource the user may access, either through the memo it
// is attached to or through the ownership baked into its storage path.
func (s *ResourceStore) ByIDForUser(
	ctx context.Context,
	userID, resourceID uuid.UUID,
	liveOnly bool,
) (domain.Resource, error) {
	filter := ""
	if liveOnly {
		filter = " AND r.is_deleted = FALSE"
	}
	return scanResourceRow(s.pool.QueryRow(ctx,
		`SELECT `+resourceSelectColumns+`
		 FROM resources r
		 LEFT JOIN memos m ON m.id = r.memo_id
		 WHERE r.id = $1 AND (m.user_id = $2 OR r.storage_path LIKE $3)`+filter,
		resourceID, userID, resourceStoragePrefix(userID)))
}

// ByIDForMemoOwner loads a live resource that is attached to one of the user's
// memos. Orphan resources are not reachable this way.
func (s *ResourceStore) ByIDForMemoOwner(
	ctx context.Context,
	userID, resourceID uuid.UUID,
) (domain.Resource, error) {
	return scanResourceRow(s.pool.QueryRow(ctx,
		`SELECT `+resourceSelectColumns+`
		 FROM resources r
		 JOIN memos m ON m.id = r.memo_id
		 WHERE r.id = $1 AND m.user_id = $2 AND r.is_deleted = FALSE`,
		resourceID, userID))
}

// List returns the user's live resources, newest first, together with the
// total count for pagination.
func (s *ResourceStore) List(
	ctx context.Context,
	userID uuid.UUID,
	limit, offset int64,
) ([]domain.Resource, int64, error) {
	rows, err := s.pool.Query(ctx,
		`SELECT `+resourceSelectColumns+`
		 FROM resources r
		 JOIN memos m ON r.memo_id = m.id
		 WHERE m.user_id = $1 AND r.is_deleted = FALSE
		 ORDER BY r.created_at DESC
		 LIMIT $2 OFFSET $3`, userID, limit, offset)
	if err != nil {
		return nil, 0, err
	}
	defer rows.Close()

	resources := make([]domain.Resource, 0)
	for rows.Next() {
		resource, err := scanResourceRow(rows)
		if err != nil {
			return nil, 0, err
		}
		resources = append(resources, resource)
	}
	if err := rows.Err(); err != nil {
		return nil, 0, err
	}

	var total int64
	if err := s.pool.QueryRow(ctx,
		`SELECT COUNT(*)
		 FROM resources r
		 JOIN memos m ON r.memo_id = m.id
		 WHERE m.user_id = $1 AND r.is_deleted = FALSE`, userID).Scan(&total); err != nil {
		return nil, 0, err
	}
	return resources, total, nil
}

// UpdateMetadata replaces the resource metadata document.
func (s *ResourceStore) UpdateMetadata(
	ctx context.Context,
	resourceID uuid.UUID,
	metadata map[string]any,
) error {
	encoded, err := json.Marshal(metadata)
	if err != nil {
		return err
	}
	_, err = s.pool.Exec(ctx,
		`UPDATE resources SET metadata = $1 WHERE id = $2`, encoded, resourceID)
	return err
}

// SoftDelete marks a resource deleted so sync clients observe the removal.
func (s *ResourceStore) SoftDelete(ctx context.Context, resourceID uuid.UUID, now int64) error {
	_, err := s.pool.Exec(ctx,
		`UPDATE resources SET is_deleted = true, updated_at = $1 WHERE id = $2`,
		now, resourceID)
	return err
}

// resourceStoragePrefix matches the storage paths owned by a user.
func resourceStoragePrefix(userID uuid.UUID) string {
	return "resources/" + userID.String() + "/%"
}

// SetAIDescription stores a generated description, but only while the resource
// is live and carries none yet — the guard that makes a duplicate or late
// description harmless. It reports whether the write applied.
func (s *ResourceStore) SetAIDescription(
	ctx context.Context,
	resourceID, userID uuid.UUID,
	description string,
	now int64,
) (bool, error) {
	tag, err := s.pool.Exec(ctx,
		`UPDATE resources SET ai_description = $1, updated_at = $2
		 WHERE id = $3 AND user_id = $4 AND is_deleted = false AND ai_description IS NULL`,
		description, now, resourceID, userID)
	if err != nil {
		return false, err
	}
	return tag.RowsAffected() > 0, nil
}
