use crate::error::AppError;
use crate::routes::sync as sync_types;
use chrono::Utc;
use serde_json::Value;
use sqlx::PgPool;
use std::collections::HashMap;
use uuid::Uuid;

#[derive(Clone)]
pub struct SyncService {
    pool: PgPool,
}

impl SyncService {
    pub fn new(pool: PgPool) -> Self {
        Self { pool }
    }

    pub async fn pull(
        &self,
        user_id: &str,
        client_id: &str,
        cursors: &HashMap<String, i64>,
    ) -> Result<sync_types::SyncPullResponse, AppError> {
        let user_uuid = Uuid::parse_str(user_id)
            .map_err(|e| AppError::InvalidInput(format!("Invalid user_id: {}", e)))?;
        let now = Utc::now().timestamp_millis();

        let memo_cursor = cursors.get("memo").copied().unwrap_or(0);
        let diary_cursor = cursors.get("diary").copied().unwrap_or(0);
        let resource_cursor = cursors.get("resource").copied().unwrap_or(0);
        let bot_cursor = cursors.get("bot").copied().unwrap_or(0);

        let memos = self.pull_memos(&user_uuid, memo_cursor).await?;
        let diaries = self.pull_diaries(&user_uuid, diary_cursor).await?;
        let resources = self.pull_resources(&user_uuid, resource_cursor).await?;
        let bots = self.pull_bots(&user_uuid, bot_cursor).await?;

        self.upsert_client_cursor(client_id, &user_uuid, "memo", now)
            .await?;
        self.upsert_client_cursor(client_id, &user_uuid, "diary", now)
            .await?;
        self.upsert_client_cursor(client_id, &user_uuid, "resource", now)
            .await?;
        self.upsert_client_cursor(client_id, &user_uuid, "bot", now)
            .await?;

        let mut result_cursors = HashMap::new();
        result_cursors.insert("memo".to_string(), now);
        result_cursors.insert("diary".to_string(), now);
        result_cursors.insert("resource".to_string(), now);
        result_cursors.insert("bot".to_string(), now);

        Ok(sync_types::SyncPullResponse {
            cursors: result_cursors,
            changes: sync_types::EntityChangesMap {
                memo: memos,
                diary: diaries,
                resource: resources,
                bot: bots,
            },
        })
    }

    async fn pull_memos(
        &self,
        user_uuid: &Uuid,
        cursor: i64,
    ) -> Result<sync_types::EntityChangeSet, AppError> {
        let rows: Vec<(Uuid, i64, bool)> = sqlx::query_as::<_, (Uuid, i64, bool)>(
            "SELECT id, updated_at, is_deleted FROM memos
             WHERE user_id = $1 AND updated_at > $2
             ORDER BY updated_at ASC LIMIT 200",
        )
        .bind(user_uuid)
        .bind(cursor)
        .fetch_all(&self.pool)
        .await?;

        let mut deleted_ids = Vec::new();
        let mut updated_ids = Vec::new();

        for (id, _updated_at, is_deleted) in &rows {
            if *is_deleted {
                deleted_ids.push(id.to_string());
            } else {
                updated_ids.push(*id);
            }
        }

        let mut updated = Vec::new();
        if !updated_ids.is_empty() {
            let full_memos: Vec<MemoRow> = sqlx::query_as::<_, MemoRow>(
                "SELECT id, content, tags, is_archived, diary_date, ai_summary, created_at, updated_at
                 FROM memos WHERE id = ANY($1) AND is_deleted = FALSE",
            )
            .bind(&updated_ids)
            .fetch_all(&self.pool)
            .await?;

            for m in full_memos {
                let tags: Vec<String> = serde_json::from_value(m.tags).unwrap_or_default();
                let diary_date = m.diary_date.map(|d| d.to_string());

                updated.push(serde_json::json!({
                    "id": m.id.to_string(),
                    "content": m.content,
                    "tags": tags,
                    "isArchived": m.is_archived,
                    "isDeleted": false,
                    "diaryDate": diary_date,
                    "aiSummary": m.ai_summary,
                    "createdAt": m.created_at,
                    "updatedAt": m.updated_at,
                }));
            }
        }

        Ok(sync_types::EntityChangeSet {
            updated,
            deleted_ids,
        })
    }

    async fn pull_diaries(
        &self,
        user_uuid: &Uuid,
        cursor: i64,
    ) -> Result<sync_types::EntityChangeSet, AppError> {
        let rows: Vec<(chrono::NaiveDate, i64, bool)> =
            sqlx::query_as::<_, (chrono::NaiveDate, i64, bool)>(
                "SELECT date, updated_at, is_deleted FROM diaries
             WHERE user_id = $1 AND updated_at > $2
             ORDER BY updated_at ASC LIMIT 200",
            )
            .bind(user_uuid)
            .bind(cursor)
            .fetch_all(&self.pool)
            .await?;

        let mut deleted_ids = Vec::new();
        let mut updated_dates = Vec::new();

        for (date_val, _, is_deleted) in &rows {
            if *is_deleted {
                deleted_ids.push(date_val.to_string());
            } else {
                updated_dates.push(*date_val);
            }
        }

        let mut updated = Vec::new();
        if !updated_dates.is_empty() {
            for date_val in &updated_dates {
                let diary: Option<DiaryRow> = sqlx::query_as::<_, DiaryRow>(
                    "SELECT date, summary, mood_key, mood_score, created_at, updated_at
                     FROM diaries WHERE user_id = $1 AND date = $2 AND is_deleted = FALSE",
                )
                .bind(user_uuid)
                .bind(date_val)
                .fetch_optional(&self.pool)
                .await?;

                if let Some(d) = diary {
                    updated.push(serde_json::json!({
                        "date": d.date.to_string(),
                        "summary": d.summary,
                        "moodKey": d.mood_key,
                        "moodScore": d.mood_score,
                        "createdAt": d.created_at,
                        "updatedAt": d.updated_at,
                    }));
                }
            }
        }

        Ok(sync_types::EntityChangeSet {
            updated,
            deleted_ids,
        })
    }

    async fn pull_resources(
        &self,
        user_uuid: &Uuid,
        cursor: i64,
    ) -> Result<sync_types::EntityChangeSet, AppError> {
        let rows: Vec<(Uuid, i64, bool)> = sqlx::query_as::<_, (Uuid, i64, bool)>(
            "SELECT r.id, r.updated_at, r.is_deleted
             FROM resources r
             LEFT JOIN memos m ON r.memo_id = m.id
             WHERE (m.user_id = $1 OR r.storage_path LIKE $2) AND r.updated_at > $3
               AND (r.memo_id IS NULL OR (m.is_deleted = FALSE))
             ORDER BY r.updated_at ASC LIMIT 200",
        )
        .bind(user_uuid)
        .bind(format!("resources/{}/%", user_uuid))
        .bind(cursor)
        .fetch_all(&self.pool)
        .await?;

        let mut deleted_ids = Vec::new();
        let mut updated_ids = Vec::new();

        for (id, _, is_deleted) in &rows {
            if *is_deleted {
                deleted_ids.push(id.to_string());
            } else {
                updated_ids.push(*id);
            }
        }

        let mut updated = Vec::new();
        if !updated_ids.is_empty() {
            let full: Vec<ResourceRow> = sqlx::query_as::<_, ResourceRow>(
                "SELECT id, memo_id, filename, resource_type, mime_type, file_size, storage_type, created_at
                 FROM resources WHERE id = ANY($1) AND is_deleted = FALSE",
            )
            .bind(&updated_ids)
            .fetch_all(&self.pool)
            .await?;

            for r in full {
                updated.push(serde_json::json!({
                    "id": r.id.to_string(),
                    "memoId": r.memo_id.map(|id| id.to_string()),
                    "filename": r.filename,
                    "resourceType": r.resource_type,
                    "mimeType": r.mime_type,
                    "fileSize": r.file_size,
                    "storageType": r.storage_type,
                    "createdAt": r.created_at,
                }));
            }
        }

        Ok(sync_types::EntityChangeSet {
            updated,
            deleted_ids,
        })
    }

    async fn pull_bots(
        &self,
        user_uuid: &Uuid,
        cursor: i64,
    ) -> Result<sync_types::EntityChangeSet, AppError> {
        let rows: Vec<(Uuid, i64, bool)> = sqlx::query_as::<_, (Uuid, i64, bool)>(
            "SELECT id, updated_at, is_deleted FROM bots
             WHERE user_id = $1 AND updated_at > $2
             ORDER BY updated_at ASC LIMIT 200",
        )
        .bind(user_uuid)
        .bind(cursor)
        .fetch_all(&self.pool)
        .await?;

        let mut deleted_ids = Vec::new();
        let mut updated_ids = Vec::new();

        for (id, _, is_deleted) in &rows {
            if *is_deleted {
                deleted_ids.push(id.to_string());
            } else {
                updated_ids.push(*id);
            }
        }

        let mut updated = Vec::new();
        if !updated_ids.is_empty() {
            let full: Vec<BotRow> = sqlx::query_as::<_, BotRow>(
                "SELECT id, name, avatar_url, description, tags, auto_reply, sort_order, created_at, updated_at
                 FROM bots WHERE id = ANY($1) AND is_deleted = FALSE",
            )
            .bind(&updated_ids)
            .fetch_all(&self.pool)
            .await?;

            for b in full {
                let tags: Vec<String> = serde_json::from_value(b.tags).unwrap_or_default();
                updated.push(serde_json::json!({
                    "id": b.id.to_string(),
                    "name": b.name,
                    "avatarUrl": b.avatar_url,
                    "description": b.description,
                    "tags": tags,
                    "autoReply": b.auto_reply,
                    "sortOrder": b.sort_order,
                    "createdAt": b.created_at,
                    "updatedAt": b.updated_at,
                }));
            }
        }

        Ok(sync_types::EntityChangeSet {
            updated,
            deleted_ids,
        })
    }

    async fn upsert_client_cursor(
        &self,
        client_id: &str,
        user_uuid: &Uuid,
        entity_type: &str,
        last_sync_at: i64,
    ) -> Result<(), AppError> {
        let now = Utc::now().timestamp_millis();
        sqlx::query(
            "INSERT INTO sync_cursors (client_id, user_id, entity_type, last_sync_at, created_at, updated_at)
             VALUES ($1, $2, $3, $4, $5, $5)
             ON CONFLICT (client_id, user_id, entity_type)
             DO UPDATE SET last_sync_at = $4, updated_at = $5",
        )
        .bind(client_id)
        .bind(user_uuid)
        .bind(entity_type)
        .bind(last_sync_at)
        .bind(now)
        .execute(&self.pool)
        .await?;

        Ok(())
    }
}

#[derive(sqlx::FromRow)]
struct MemoRow {
    id: Uuid,
    content: String,
    tags: Value,
    is_archived: bool,
    diary_date: Option<chrono::NaiveDate>,
    ai_summary: Option<String>,
    created_at: i64,
    updated_at: i64,
}

#[derive(sqlx::FromRow)]
struct DiaryRow {
    date: chrono::NaiveDate,
    summary: String,
    mood_key: String,
    mood_score: i32,
    created_at: i64,
    updated_at: i64,
}

#[derive(sqlx::FromRow)]
struct ResourceRow {
    id: Uuid,
    memo_id: Option<Uuid>,
    filename: String,
    resource_type: String,
    mime_type: String,
    file_size: i64,
    storage_type: String,
    created_at: i64,
}

#[derive(sqlx::FromRow)]
struct BotRow {
    id: Uuid,
    name: String,
    avatar_url: Option<String>,
    description: String,
    tags: Value,
    auto_reply: bool,
    sort_order: i32,
    created_at: i64,
    updated_at: i64,
}
