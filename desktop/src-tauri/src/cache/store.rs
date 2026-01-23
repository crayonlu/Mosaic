use super::models::{CachedDiary, CachedMemo, OfflineOperation};
use crate::error::{AppError, AppResult};
use sqlx::{migrate::MigrateDatabase, sqlite::SqlitePoolOptions, Pool, Sqlite};
use std::path::PathBuf;

pub struct CacheStore {
    pub pool: Pool<Sqlite>,
}

impl CacheStore {
    pub async fn new(cache_dir: PathBuf) -> AppResult<Self> {
        let db_path = cache_dir.join("cache.db");
        let db_url = format!("sqlite:{}", db_path.display());

        std::fs::create_dir_all(&cache_dir)
            .map_err(|e| AppError::CacheError(format!("Failed to create cache dir: {}", e)))?;

        // Create database if it doesn't exist
        if !Sqlite::database_exists(&db_url).await.unwrap_or(false) {
            Sqlite::create_database(&db_url)
                .await
                .map_err(|e| AppError::CacheError(format!("Failed to create database: {}", e)))?;
        }

        let pool = SqlitePoolOptions::new()
            .max_connections(5)
            .connect(&db_url)
            .await
            .map_err(|e| AppError::CacheError(format!("Failed to connect to cache: {}", e)))?;

        // Run migrations
        sqlx::migrate!("./migrations")
            .run(&pool)
            .await
            .map_err(|e| AppError::CacheError(format!("Failed to run cache migration: {}", e)))?;

        Ok(Self { pool })
    }

    pub async fn upsert_memo(&self, memo: &CachedMemo) -> AppResult<()> {
        sqlx::query(
            r#"
            INSERT INTO cached_memos (id, content, tags, is_archived, is_deleted, diary_date, created_at, updated_at, synced_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(id) DO UPDATE SET
                content = excluded.content,
                tags = excluded.tags,
                is_archived = excluded.is_archived,
                is_deleted = excluded.is_deleted,
                diary_date = excluded.diary_date,
                updated_at = excluded.updated_at,
                synced_at = excluded.synced_at
            "#
        )
        .bind(&memo.id)
        .bind(&memo.content)
        .bind(&memo.tags)
        .bind(memo.is_archived)
        .bind(memo.is_deleted)
        .bind(&memo.diary_date)
        .bind(memo.created_at)
        .bind(memo.updated_at)
        .bind(memo.synced_at)
        .execute(&self.pool)
        .await
        .map_err(|e| AppError::CacheError(format!("Failed to upsert memo: {}", e)))?;

        Ok(())
    }

    pub async fn get_memo(&self, id: &str) -> AppResult<Option<CachedMemo>> {
        sqlx::query_as::<_, CachedMemo>("SELECT * FROM cached_memos WHERE id = ?")
            .bind(id)
            .fetch_optional(&self.pool)
            .await
            .map_err(|e| AppError::CacheError(format!("Failed to get memo: {}", e)))
    }

    pub async fn list_memos(
        &self,
        limit: i64,
        offset: i64,
        is_archived: Option<bool>,
    ) -> AppResult<Vec<CachedMemo>> {
        let query = if let Some(_archived) = is_archived {
            "SELECT * FROM cached_memos WHERE is_archived = ? AND is_deleted = 0 ORDER BY updated_at DESC LIMIT ? OFFSET ?"
        } else {
            "SELECT * FROM cached_memos WHERE is_deleted = 0 ORDER BY updated_at DESC LIMIT ? OFFSET ?"
        };

        let mut query_builder = sqlx::query_as::<_, CachedMemo>(query);

        if is_archived.is_some() {
            query_builder = query_builder.bind(is_archived.unwrap());
        }

        query_builder
            .bind(limit)
            .bind(offset)
            .fetch_all(&self.pool)
            .await
            .map_err(|e| AppError::CacheError(format!("Failed to list memos: {}", e)))
    }

    pub async fn delete_memo(&self, id: &str) -> AppResult<()> {
        sqlx::query("DELETE FROM cached_memos WHERE id = ?")
            .bind(id)
            .execute(&self.pool)
            .await
            .map_err(|e| AppError::CacheError(format!("Failed to delete memo: {}", e)))?;

        Ok(())
    }

    pub async fn upsert_diary(&self, diary: &CachedDiary) -> AppResult<()> {
        sqlx::query(
            r#"
            INSERT INTO cached_diaries (date, summary, mood_key, mood_score, cover_image_id, created_at, updated_at, synced_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(date) DO UPDATE SET
                summary = excluded.summary,
                mood_key = excluded.mood_key,
                mood_score = excluded.mood_score,
                cover_image_id = excluded.cover_image_id,
                updated_at = excluded.updated_at,
                synced_at = excluded.synced_at
            "#
        )
        .bind(&diary.date)
        .bind(&diary.summary)
        .bind(&diary.mood_key)
        .bind(diary.mood_score)
        .bind(&diary.cover_image_id)
        .bind(diary.created_at)
        .bind(diary.updated_at)
        .bind(diary.synced_at)
        .execute(&self.pool)
        .await
        .map_err(|e| AppError::CacheError(format!("Failed to upsert diary: {}", e)))?;

        Ok(())
    }

    pub async fn get_diary(&self, date: &str) -> AppResult<Option<CachedDiary>> {
        sqlx::query_as::<_, CachedDiary>("SELECT * FROM cached_diaries WHERE date = ?")
            .bind(date)
            .fetch_optional(&self.pool)
            .await
            .map_err(|e| AppError::CacheError(format!("Failed to get diary: {}", e)))
    }

    pub async fn list_diaries(&self, limit: i64, offset: i64) -> AppResult<Vec<CachedDiary>> {
        sqlx::query_as::<_, CachedDiary>(
            "SELECT * FROM cached_diaries ORDER BY date DESC LIMIT ? OFFSET ?",
        )
        .bind(limit)
        .bind(offset)
        .fetch_all(&self.pool)
        .await
        .map_err(|e| AppError::CacheError(format!("Failed to list diaries: {}", e)))
    }

    pub async fn add_offline_operation(&self, op: &OfflineOperation) -> AppResult<()> {
        sqlx::query(
            r#"
            INSERT INTO offline_operations (id, operation_type, entity_type, entity_id, payload, created_at, retried_count)
            VALUES (?, ?, ?, ?, ?, ?, ?)
            "#
        )
        .bind(&op.id)
        .bind(&op.operation_type)
        .bind(&op.entity_type)
        .bind(&op.entity_id)
        .bind(&op.payload)
        .bind(op.created_at)
        .bind(op.retried_count)
        .execute(&self.pool)
        .await
        .map_err(|e| AppError::CacheError(format!("Failed to add offline operation: {}", e)))?;

        Ok(())
    }

    pub async fn get_pending_operations(&self) -> AppResult<Vec<OfflineOperation>> {
        sqlx::query_as::<_, OfflineOperation>(
            "SELECT * FROM offline_operations ORDER BY created_at ASC",
        )
        .fetch_all(&self.pool)
        .await
        .map_err(|e| AppError::CacheError(format!("Failed to get pending operations: {}", e)))
    }

    pub async fn remove_operation(&self, id: &str) -> AppResult<()> {
        sqlx::query("DELETE FROM offline_operations WHERE id = ?")
            .bind(id)
            .execute(&self.pool)
            .await
            .map_err(|e| AppError::CacheError(format!("Failed to remove operation: {}", e)))?;

        Ok(())
    }
}
