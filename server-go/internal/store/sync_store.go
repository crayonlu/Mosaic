package store

import (
	"context"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/crayonlu/mosaic/server-go/internal/domain"
)

// SyncStore reads the rows that changed since a cursor for each synced entity.
type SyncStore struct {
	pool *pgxpool.Pool
}

func NewSyncStore(pool *pgxpool.Pool) *SyncStore {
	return &SyncStore{pool: pool}
}

// MemoChanges returns memos updated since cursor, split into live rows and
// deletion markers.
func (s *SyncStore) MemoChanges(
	ctx context.Context,
	userID uuid.UUID,
	cursor int64,
) ([]domain.MemoChange, []uuid.UUID, error) {
	rows, err := s.pool.Query(ctx,
		`SELECT id, updated_at, is_deleted FROM memos
		 WHERE user_id = $1 AND updated_at > $2
		 ORDER BY updated_at ASC LIMIT $3`, userID, cursor, domain.SyncPageLimit)
	if err != nil {
		return nil, nil, err
	}

	type marker struct {
		id        uuid.UUID
		isDeleted bool
	}
	markers, err := collectMarkers(rows)
	if err != nil {
		return nil, nil, err
	}

	updatedIDs, deletedIDs := splitMarkers(markers)
	if len(updatedIDs) == 0 {
		return nil, deletedIDs, nil
	}

	full, err := s.pool.Query(ctx,
		`SELECT id, content, tags, is_archived, diary_date, ai_summary, created_at, updated_at
		 FROM memos WHERE id = ANY($1) AND is_deleted = FALSE`, updatedIDs)
	if err != nil {
		return nil, nil, err
	}
	defer full.Close()

	changes := make([]domain.MemoChange, 0, len(updatedIDs))
	for full.Next() {
		var (
			change domain.MemoChange
			tags   []byte
			diary  *time.Time
		)
		if err := full.Scan(&change.ID, &change.Content, &tags, &change.IsArchived,
			&diary, &change.AiSummary, &change.CreatedAt, &change.UpdatedAt); err != nil {
			return nil, nil, err
		}
		change.Tags = domain.TagListFromJSON(tags)
		change.DiaryDate = optionalDate(diary)
		changes = append(changes, change)
	}
	if err := full.Err(); err != nil {
		return nil, nil, err
	}
	return changes, deletedIDs, nil
}

// DiaryChanges returns diaries updated since cursor.
func (s *SyncStore) DiaryChanges(
	ctx context.Context,
	userID uuid.UUID,
	cursor int64,
) ([]domain.DiaryChange, []string, error) {
	rows, err := s.pool.Query(ctx,
		`SELECT date, updated_at, is_deleted FROM diaries
		 WHERE user_id = $1 AND updated_at > $2
		 ORDER BY updated_at ASC LIMIT $3`, userID, cursor, domain.SyncPageLimit)
	if err != nil {
		return nil, nil, err
	}

	defer rows.Close()

	var (
		deleted      []string
		updatedDates []time.Time
	)
	for rows.Next() {
		var (
			date      time.Time
			updatedAt int64
			isDeleted bool
		)
		if err := rows.Scan(&date, &updatedAt, &isDeleted); err != nil {
			return nil, nil, err
		}
		if isDeleted {
			deleted = append(deleted, domain.NewDate(date).String())
			continue
		}
		updatedDates = append(updatedDates, date)
	}
	if err := rows.Err(); err != nil {
		return nil, nil, err
	}

	if len(updatedDates) == 0 {
		return nil, deleted, nil
	}

	full, err := s.pool.Query(ctx,
		`SELECT date, summary, mood_key, mood_score, created_at, updated_at
		 FROM diaries WHERE user_id = $1 AND date = ANY($2) AND is_deleted = FALSE`,
		userID, updatedDates)
	if err != nil {
		return nil, nil, err
	}
	defer full.Close()

	changes := make([]domain.DiaryChange, 0, len(updatedDates))
	for full.Next() {
		var (
			change domain.DiaryChange
			date   time.Time
		)
		if err := full.Scan(&date, &change.Summary, &change.MoodKey, &change.MoodScore,
			&change.CreatedAt, &change.UpdatedAt); err != nil {
			return nil, nil, err
		}
		change.Date = domain.NewDate(date)
		changes = append(changes, change)
	}
	if err := full.Err(); err != nil {
		return nil, nil, err
	}
	return changes, deleted, nil
}

// ResourceChanges returns resources updated since cursor, scoped to the owner
// either through the memo they hang off or through their storage path.
func (s *SyncStore) ResourceChanges(
	ctx context.Context,
	userID uuid.UUID,
	cursor int64,
) ([]domain.ResourceChange, []uuid.UUID, error) {
	rows, err := s.pool.Query(ctx,
		`SELECT r.id, r.updated_at, r.is_deleted
		 FROM resources r
		 LEFT JOIN memos m ON r.memo_id = m.id
		 WHERE (m.user_id = $1 OR r.storage_path LIKE $2) AND r.updated_at > $3
		   AND (r.memo_id IS NULL OR m.is_deleted = FALSE)
		 ORDER BY r.updated_at ASC LIMIT $4`,
		userID, "resources/"+userID.String()+"/%", cursor, domain.SyncPageLimit)
	if err != nil {
		return nil, nil, err
	}

	markers, err := collectMarkers(rows)
	if err != nil {
		return nil, nil, err
	}
	updatedIDs, deletedIDs := splitMarkers(markers)
	if len(updatedIDs) == 0 {
		return nil, deletedIDs, nil
	}

	full, err := s.pool.Query(ctx,
		`SELECT id, memo_id, filename, resource_type, mime_type, file_size, storage_type, created_at
		 FROM resources WHERE id = ANY($1) AND is_deleted = FALSE`, updatedIDs)
	if err != nil {
		return nil, nil, err
	}
	defer full.Close()

	changes := make([]domain.ResourceChange, 0, len(updatedIDs))
	for full.Next() {
		var change domain.ResourceChange
		if err := full.Scan(&change.ID, &change.MemoID, &change.Filename, &change.ResourceType,
			&change.MimeType, &change.FileSize, &change.StorageType, &change.CreatedAt); err != nil {
			return nil, nil, err
		}
		changes = append(changes, change)
	}
	if err := full.Err(); err != nil {
		return nil, nil, err
	}
	return changes, deletedIDs, nil
}

// BotChanges returns bots updated since cursor.
func (s *SyncStore) BotChanges(
	ctx context.Context,
	userID uuid.UUID,
	cursor int64,
) ([]domain.BotChange, []uuid.UUID, error) {
	rows, err := s.pool.Query(ctx,
		`SELECT id, updated_at, is_deleted FROM bots
		 WHERE user_id = $1 AND updated_at > $2
		 ORDER BY updated_at ASC LIMIT $3`, userID, cursor, domain.SyncPageLimit)
	if err != nil {
		return nil, nil, err
	}

	markers, err := collectMarkers(rows)
	if err != nil {
		return nil, nil, err
	}
	updatedIDs, deletedIDs := splitMarkers(markers)
	if len(updatedIDs) == 0 {
		return nil, deletedIDs, nil
	}

	full, err := s.pool.Query(ctx,
		`SELECT id, name, avatar_url, description, tags, auto_reply, sort_order, created_at, updated_at
		 FROM bots WHERE id = ANY($1) AND is_deleted = FALSE`, updatedIDs)
	if err != nil {
		return nil, nil, err
	}
	defer full.Close()

	changes := make([]domain.BotChange, 0, len(updatedIDs))
	for full.Next() {
		var (
			change domain.BotChange
			tags   []byte
		)
		if err := full.Scan(&change.ID, &change.Name, &change.AvatarURL, &change.Description,
			&tags, &change.AutoReply, &change.SortOrder, &change.CreatedAt, &change.UpdatedAt); err != nil {
			return nil, nil, err
		}
		change.Tags = domain.TagListFromJSON(tags)
		changes = append(changes, change)
	}
	if err := full.Err(); err != nil {
		return nil, nil, err
	}
	return changes, deletedIDs, nil
}

// SaveCursor records how far a client has synced one entity.
func (s *SyncStore) SaveCursor(
	ctx context.Context,
	clientID string,
	userID uuid.UUID,
	entity string,
	at int64,
) error {
	_, err := s.pool.Exec(ctx,
		`INSERT INTO sync_cursors (client_id, user_id, entity_type, last_sync_at, created_at, updated_at)
		 VALUES ($1, $2, $3, $4, $5, $5)
		 ON CONFLICT (client_id, user_id, entity_type)
		 DO UPDATE SET last_sync_at = $4, updated_at = $5`,
		clientID, userID, entity, at, at)
	return err
}

type changeMarker struct {
	id        uuid.UUID
	isDeleted bool
}

func collectMarkers(rows pgx.Rows) ([]changeMarker, error) {
	defer rows.Close()

	var markers []changeMarker
	for rows.Next() {
		var marker changeMarker
		if err := rows.Scan(&marker.id, new(int64), &marker.isDeleted); err != nil {
			return nil, err
		}
		markers = append(markers, marker)
	}
	return markers, rows.Err()
}

func splitMarkers(markers []changeMarker) (updated, deleted []uuid.UUID) {
	for _, marker := range markers {
		if marker.isDeleted {
			deleted = append(deleted, marker.id)
			continue
		}
		updated = append(updated, marker.id)
	}
	return updated, deleted
}

func optionalDate(value *time.Time) *domain.Date {
	if value == nil {
		return nil
	}
	date := domain.NewDate(*value)
	return &date
}
