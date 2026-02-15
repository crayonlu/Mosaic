use crate::error::AppError;
use crate::models::{
    CreateDiaryRequest, Diary, DiaryResponse, MemoResourceResponse as ResourceResponse,
    MemoWithResources, PaginatedResponse, Resource, UpdateDiaryRequest,
};
use chrono::{NaiveDate, Utc};
use sqlx::PgPool;
use uuid::Uuid;

#[derive(Clone)]
pub struct DiaryService {
    pool: PgPool,
}

impl DiaryService {
    pub fn new(pool: PgPool) -> Self {
        Self { pool }
    }

    pub async fn create_diary(
        &self,
        user_id: &str,
        req: CreateDiaryRequest,
    ) -> Result<DiaryResponse, AppError> {
        let user_uuid = Uuid::parse_str(user_id)?;
        let now = Utc::now().timestamp_millis();

        let existing: Option<Diary> = sqlx::query_as(
            "SELECT date, user_id, summary, mood_key, mood_score, cover_image_id, created_at, updated_at
             FROM diaries WHERE date = $1 AND user_id = $2",
        )
        .bind(req.date)
        .bind(user_uuid)
        .fetch_optional(&self.pool)
        .await?;

        let diary = if let Some(_) = existing {
            sqlx::query_as::<_, Diary>(
                "UPDATE diaries SET
                 summary = $1,
                 mood_key = $2,
                 mood_score = $3,
                 cover_image_id = $4,
                 updated_at = $5
                 WHERE date = $6 AND user_id = $7
                 RETURNING *",
            )
            .bind(&req.summary)
            .bind(&req.mood_key)
            .bind(req.mood_score)
            .bind(req.cover_image_id)
            .bind(now)
            .bind(req.date)
            .bind(user_uuid)
            .fetch_one(&self.pool)
            .await?
        } else {
            sqlx::query_as::<_, Diary>(
                "INSERT INTO diaries (date, user_id, summary, mood_key, mood_score, cover_image_id, created_at, updated_at)
                 VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
                 RETURNING *",
            )
            .bind(req.date)
            .bind(user_uuid)
            .bind(&req.summary)
            .bind(&req.mood_key)
            .bind(req.mood_score)
            .bind(req.cover_image_id)
            .bind(now)
            .bind(now)
            .fetch_one(&self.pool)
            .await?
        };

        Ok(DiaryResponse::from(diary))
    }

    #[allow(dead_code)]
    pub async fn get_diary(
        &self,
        user_id: &str,
        date: NaiveDate,
    ) -> Result<DiaryResponse, AppError> {
        let user_uuid = Uuid::parse_str(user_id)?;
        let diary = sqlx::query_as::<_, Diary>(
            "SELECT date, user_id, summary, mood_key, mood_score, cover_image_id, created_at, updated_at
             FROM diaries WHERE date = $1 AND user_id = $2",
        )
        .bind(date)
        .bind(user_uuid)
        .fetch_optional(&self.pool)
        .await?
        .ok_or(AppError::DiaryNotFound)?;

        Ok(DiaryResponse::from(diary))
    }

    #[allow(dead_code)]
    pub async fn list_diaries(&self, user_id: &str) -> Result<Vec<DiaryResponse>, AppError> {
        let user_uuid = Uuid::parse_str(user_id)?;
        let diaries = sqlx::query_as::<_, Diary>(
            "SELECT date, user_id, summary, mood_key, mood_score, cover_image_id, created_at, updated_at
             FROM diaries WHERE user_id = $1 ORDER BY date DESC",
        )
        .bind(user_uuid)
        .fetch_all(&self.pool)
        .await?;

        Ok(diaries.into_iter().map(DiaryResponse::from).collect())
    }

    pub async fn list_diaries_paginated(
        &self,
        user_id: &str,
        page: u32,
        page_size: u32,
        start_date: Option<NaiveDate>,
        end_date: Option<NaiveDate>,
    ) -> Result<PaginatedResponse<DiaryResponse>, AppError> {
        let user_uuid = Uuid::parse_str(user_id)?;
        let offset = (page - 1) * page_size;

        let diaries = sqlx::query_as::<_, Diary>(
            "SELECT date, user_id, summary, mood_key, mood_score, cover_image_id, created_at, updated_at
             FROM diaries
             WHERE user_id = $1
             AND ($2::date IS NULL OR date >= $2)
             AND ($3::date IS NULL OR date <= $3)
             ORDER BY date DESC
             LIMIT $4 OFFSET $5",
        )
        .bind(user_uuid)
        .bind(start_date)
        .bind(end_date)
        .bind(page_size as i64)
        .bind(offset as i64)
        .fetch_all(&self.pool)
        .await?;

        let total = self.count_diaries(user_id, start_date, end_date).await?;
        let total_pages = ((total as f64) / (page_size as f64)).ceil() as u32;

        Ok(PaginatedResponse {
            items: diaries.into_iter().map(DiaryResponse::from).collect(),
            total,
            page,
            page_size,
            total_pages,
        })
    }

    pub async fn get_diary_with_memos(
        &self,
        user_id: &str,
        date: NaiveDate,
    ) -> Result<crate::models::DiaryWithMemosResponse, AppError> {
        let user_uuid = Uuid::parse_str(user_id)?;

        let diary = sqlx::query_as::<_, Diary>(
            "SELECT date, user_id, summary, mood_key, mood_score, cover_image_id, created_at, updated_at
             FROM diaries WHERE date = $1 AND user_id = $2",
        )
        .bind(date)
        .bind(user_uuid)
        .fetch_optional(&self.pool)
        .await?
        .ok_or(AppError::DiaryNotFound)?;

        let memos = sqlx::query_as::<_, crate::models::Memo>(
            "SELECT id, user_id, content, tags, is_archived, is_deleted, diary_date, created_at, updated_at
             FROM memos WHERE user_id = $1 AND diary_date = $2 AND is_deleted = false AND is_archived = true
             ORDER BY created_at ASC",
        )
        .bind(user_uuid)
        .bind(date)
        .fetch_all(&self.pool)
        .await?;

        let mut memo_responses: Vec<MemoWithResources> = Vec::new();
        for memo in memos {
            let resources = self.get_memo_resources(memo.id).await?;
            memo_responses.push(MemoWithResources::from_memo(memo, resources));
        }

        Ok(crate::models::DiaryWithMemosResponse {
            date: diary.date,
            summary: diary.summary,
            mood_key: diary.mood_key,
            mood_score: diary.mood_score,
            cover_image_id: diary.cover_image_id,
            created_at: diary.created_at,
            updated_at: diary.updated_at,
            memos: memo_responses,
        })
    }

    async fn get_memo_resources(&self, memo_id: Uuid) -> Result<Vec<ResourceResponse>, AppError> {
        let resources = sqlx::query_as::<_, Resource>(
            "SELECT id, memo_id, filename, resource_type, mime_type, file_size as size, storage_type, storage_path, created_at
             FROM resources WHERE memo_id = $1 ORDER BY created_at ASC",
        )
        .bind(memo_id)
        .fetch_all(&self.pool)
        .await?;

        Ok(resources
            .into_iter()
            .map(|r| ResourceResponse {
                id: r.id,
                memo_id: r.memo_id,
                filename: r.filename,
                resource_type: r.resource_type,
                mime_type: r.mime_type,
                size: r.file_size,
                storage_type: Some(r.storage_type),
                storage_path: Some(r.storage_path),
                url: format!("/api/resources/{}/download", r.id),
                created_at: r.created_at,
            })
            .collect())
    }

    pub async fn count_diaries(
        &self,
        user_id: &str,
        start_date: Option<NaiveDate>,
        end_date: Option<NaiveDate>,
    ) -> Result<i64, AppError> {
        let user_uuid = Uuid::parse_str(user_id)?;

        let row = sqlx::query_as::<_, (i64,)>(
            "SELECT COUNT(*) as total
             FROM diaries
             WHERE user_id = $1
             AND ($2::date IS NULL OR date >= $2)
             AND ($3::date IS NULL OR date <= $3)",
        )
        .bind(user_uuid)
        .bind(start_date)
        .bind(end_date)
        .fetch_one(&self.pool)
        .await?;

        Ok(row.0)
    }

    pub async fn update_diary(
        &self,
        user_id: &str,
        date: NaiveDate,
        req: UpdateDiaryRequest,
    ) -> Result<DiaryResponse, AppError> {
        let user_uuid = Uuid::parse_str(user_id)?;
        let now = Utc::now().timestamp_millis();

        let diary = sqlx::query_as::<_, Diary>(
            "UPDATE diaries SET 
             updated_at = $1,
             summary = COALESCE($2, summary),
             mood_key = COALESCE($3, mood_key),
             mood_score = COALESCE($4, mood_score),
             cover_image_id = CASE WHEN $5 THEN $6 ELSE cover_image_id END
             WHERE date = $7 AND user_id = $8
             RETURNING *",
        )
        .bind(now)
        .bind(&req.summary)
        .bind(&req.mood_key)
        .bind(req.mood_score)
        .bind(req.cover_image_id.is_some()) // Flag to indicate if cover_image_id should be updated
        .bind(req.cover_image_id.as_ref().and_then(|v| v.as_ref())) // The actual cover_image_id value
        .bind(date)
        .bind(user_uuid)
        .fetch_optional(&self.pool)
        .await?
        .ok_or(AppError::DiaryNotFound)?;

        Ok(DiaryResponse::from(diary))
    }

    pub async fn update_diary_summary(
        &self,
        user_id: &str,
        date: NaiveDate,
        summary: String,
    ) -> Result<DiaryResponse, AppError> {
        let user_uuid = Uuid::parse_str(user_id)?;
        let now = Utc::now().timestamp_millis();

        let diary = sqlx::query_as::<_, Diary>(
            "UPDATE diaries SET summary = $1, updated_at = $2
             WHERE date = $3 AND user_id = $4
             RETURNING *",
        )
        .bind(&summary)
        .bind(now)
        .bind(&date)
        .bind(user_uuid)
        .fetch_optional(&self.pool)
        .await?
        .ok_or(AppError::DiaryNotFound)?;

        Ok(DiaryResponse::from(diary))
    }

    pub async fn update_diary_mood(
        &self,
        user_id: &str,
        date: NaiveDate,
        mood_key: String,
        mood_score: i32,
    ) -> Result<DiaryResponse, AppError> {
        let user_uuid = Uuid::parse_str(user_id)?;
        let now = Utc::now().timestamp_millis();

        let diary = sqlx::query_as::<_, Diary>(
            "UPDATE diaries SET mood_key = $1, mood_score = $2, updated_at = $3
             WHERE date = $4 AND user_id = $5
             RETURNING *",
        )
        .bind(&mood_key)
        .bind(mood_score)
        .bind(now)
        .bind(&date)
        .bind(user_uuid)
        .fetch_optional(&self.pool)
        .await?
        .ok_or(AppError::DiaryNotFound)?;

        Ok(DiaryResponse::from(diary))
    }
}
