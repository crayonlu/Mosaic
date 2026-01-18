use crate::error::AppError;
use crate::models::{CreateDiaryRequest, Diary, DiaryResponse, UpdateDiaryRequest};
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
        let now = Utc::now().timestamp();

        let diary = sqlx::query_as::<_, Diary>(
            "INSERT INTO diaries (date, user_id, summary, mood_key, mood_score, cover_image_id, created_at, updated_at)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
             ON CONFLICT (date) DO UPDATE SET
             summary = EXCLUDED.summary,
             mood_key = EXCLUDED.mood_key,
             mood_score = EXCLUDED.mood_score,
             cover_image_id = EXCLUDED.cover_image_id,
             updated_at = $8
             RETURNING *",
        )
        .bind(req.date)
        .bind(user_uuid)
        .bind(&req.summary)
        .bind(&req.mood_key)
        .bind(req.mood_score)
        .bind(req.cover_image_id)
        .bind(0)
        .bind(now)
        .bind(now)
        .fetch_one(&self.pool)
        .await?;

        Ok(DiaryResponse::from(diary))
    }

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

    pub async fn update_diary(
        &self,
        user_id: &str,
        date: NaiveDate,
        req: UpdateDiaryRequest,
    ) -> Result<DiaryResponse, AppError> {
        let user_uuid = Uuid::parse_str(user_id)?;
        let now = Utc::now().timestamp();

        let mut query = String::from("UPDATE diaries SET updated_at = $1");
        let mut param_count = 1;
        let mut params: Vec<String> = Vec::new();

        if let Some(summary) = &req.summary {
            param_count += 1;
            query.push_str(&format!(", summary = ${}", param_count));
            params.push(format!("\'{}\'", summary));
        }

        if let Some(mood_key) = &req.mood_key {
            param_count += 1;
            query.push_str(&format!(", mood_key = ${}", param_count));
            params.push(format!("\'{}\'", mood_key));
        }

        if let Some(mood_score) = req.mood_score {
            param_count += 1;
            query.push_str(&format!(", mood_score = ${}", param_count));
            params.push(mood_score.to_string());
        }

        if let Some(cover_image_id) = &req.cover_image_id {
            param_count += 1;
            query.push_str(&format!(", cover_image_id = ${}", param_count));
            match cover_image_id {
                Some(id) => params.push(format!("\'{}\'", id)),
                None => params.push("NULL".to_string()),
            }
        }

        param_count += 1;
        query.push_str(&format!(
            " WHERE date = ${} AND user_id = ${} RETURNING *",
            param_count,
            param_count + 1
        ));

        let diary = sqlx::query_as::<_, Diary>(&query)
            .bind(now)
            .bind(date)
            .bind(user_uuid)
            .fetch_optional(&self.pool)
            .await?
            .ok_or(AppError::DiaryNotFound)?;

        Ok(DiaryResponse::from(diary))
    }
}
