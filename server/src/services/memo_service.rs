use crate::error::AppError;
use crate::models::{CreateMemoRequest, Memo, MemoResponse, PaginatedResponse, UpdateMemoRequest};
use chrono::Utc;
use serde_json::json;
use sqlx::PgPool;
use uuid::Uuid;

#[derive(Clone)]
pub struct MemoService {
    pool: PgPool,
}

impl MemoService {
    pub fn new(pool: PgPool) -> Self {
        Self { pool }
    }

    pub async fn create_memo(
        &self,
        user_id: &str,
        req: CreateMemoRequest,
    ) -> Result<MemoResponse, AppError> {
        let user_uuid = Uuid::parse_str(user_id)?;
        let tags_json = json!(req.tags);
        let now = Utc::now().timestamp();

        let memo = sqlx::query_as::<_, Memo>(
            "INSERT INTO memos (id, user_id, content, tags, is_archived, is_deleted, diary_date, created_at, updated_at)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
             RETURNING id, user_id, content, tags, is_archived, is_deleted, diary_date, created_at, updated_at",
        )
        .bind(Uuid::new_v4())
        .bind(user_uuid)
        .bind(&req.content)
        .bind(tags_json)
        .bind(false)
        .bind(false)
        .bind(req.diary_date)
        .bind(now)
        .bind(now)
        .fetch_one(&self.pool)
        .await?;

        Ok(MemoResponse::from(memo))
    }

    pub async fn get_memo(&self, user_id: &str, memo_id: Uuid) -> Result<MemoResponse, AppError> {
        let user_uuid = Uuid::parse_str(user_id)?;
        let memo = sqlx::query_as::<_, Memo>(
            "SELECT id, user_id, content, tags, is_archived, is_deleted, diary_date, created_at, updated_at
             FROM memos WHERE id = $1 AND user_id = $2 AND is_deleted = false",
        )
        .bind(memo_id)
        .bind(user_uuid)
        .fetch_optional(&self.pool)
        .await?
        .ok_or(AppError::MemoNotFound)?;

        Ok(MemoResponse::from(memo))
    }

    pub async fn list_memos(
        &self,
        user_id: &str,
        page: u32,
        page_size: u32,
        archived: Option<bool>,
        diary_date: Option<chrono::NaiveDate>,
    ) -> Result<PaginatedResponse<MemoResponse>, AppError> {
        let user_uuid = Uuid::parse_str(user_id)?;
        let offset = (page - 1) * page_size;

        let memos = if let Some(diary_date) = diary_date {
            sqlx::query_as::<_, Memo>(
                "SELECT id, user_id, content, tags, is_archived, is_deleted, diary_date, created_at, updated_at
                 FROM memos WHERE user_id = $1 AND is_deleted = false AND diary_date = $2
                 ORDER BY created_at DESC LIMIT $3 OFFSET $4",
            )
            .bind(user_uuid)
            .bind(diary_date)
            .bind(page_size as i64)
            .bind(offset as i64)
            .fetch_all(&self.pool)
            .await?
        } else {
            match archived {
                Some(true) => {
                    sqlx::query_as::<_, Memo>(
                        "SELECT id, user_id, content, tags, is_archived, is_deleted, diary_date, created_at, updated_at
                         FROM memos WHERE user_id = $1 AND is_deleted = false AND is_archived = true
                         ORDER BY created_at DESC LIMIT $2 OFFSET $3",
                    )
                    .bind(user_uuid)
                    .bind(page_size as i64)
                    .bind(offset as i64)
                    .fetch_all(&self.pool)
                    .await?
                }
                Some(false) => {
                    sqlx::query_as::<_, Memo>(
                        "SELECT id, user_id, content, tags, is_archived, is_deleted, diary_date, created_at, updated_at
                         FROM memos WHERE user_id = $1 AND is_deleted = false AND is_archived = false
                         ORDER BY created_at DESC LIMIT $2 OFFSET $3",
                    )
                    .bind(user_uuid)
                    .bind(page_size as i64)
                    .bind(offset as i64)
                    .fetch_all(&self.pool)
                    .await?
                }
                None => {
                    sqlx::query_as::<_, Memo>(
                        "SELECT id, user_id, content, tags, is_archived, is_deleted, diary_date, created_at, updated_at
                         FROM memos WHERE user_id = $1 AND is_deleted = false
                         ORDER BY created_at DESC LIMIT $2 OFFSET $3",
                    )
                    .bind(user_uuid)
                    .bind(page_size as i64)
                    .bind(offset as i64)
                    .fetch_all(&self.pool)
                    .await?
                }
            }
        };

        let total = if let Some(diary_date) = diary_date {
            let row = sqlx::query_as::<_, (i64,)>(
                "SELECT COUNT(*) as total
                 FROM memos WHERE user_id = $1 AND is_deleted = false AND diary_date = $2",
            )
            .bind(user_uuid)
            .bind(diary_date)
            .fetch_one(&self.pool)
            .await?;
            row.0
        } else {
            match archived {
                Some(true) => {
                    let row = sqlx::query_as::<_, (i64,)>(
                        "SELECT COUNT(*) as total
                         FROM memos WHERE user_id = $1 AND is_deleted = false AND is_archived = true",
                    )
                    .bind(user_uuid)
                    .fetch_one(&self.pool)
                    .await?;
                    row.0
                }
                Some(false) => {
                    let row = sqlx::query_as::<_, (i64,)>(
                        "SELECT COUNT(*) as total
                         FROM memos WHERE user_id = $1 AND is_deleted = false AND is_archived = false",
                    )
                    .bind(user_uuid)
                    .fetch_one(&self.pool)
                    .await?;
                    row.0
                }
                None => {
                    let row = sqlx::query_as::<_, (i64,)>(
                        "SELECT COUNT(*) as total
                         FROM memos WHERE user_id = $1 AND is_deleted = false",
                    )
                    .bind(user_uuid)
                    .fetch_one(&self.pool)
                    .await?;
                    row.0
                }
            }
        };

        let total_pages = ((total as f64) / (page_size as f64)).ceil() as u32;

        Ok(PaginatedResponse {
            items: memos.into_iter().map(MemoResponse::from).collect(),
            total,
            page,
            page_size,
            total_pages,
        })
    }

    pub async fn update_memo(
        &self,
        user_id: &str,
        memo_id: Uuid,
        req: UpdateMemoRequest,
    ) -> Result<MemoResponse, AppError> {
        let user_uuid = Uuid::parse_str(user_id)?;
        let now = Utc::now().timestamp();

        let mut query = String::from("UPDATE memos SET updated_at = $1");
        let mut param_count = 1;
        let mut params: Vec<String> = Vec::new();

        if let Some(content) = &req.content {
            param_count += 1;
            query.push_str(&format!(", content = ${}", param_count));
            params.push(format!("'{}'", content));
        }

        if let Some(tags) = &req.tags {
            param_count += 1;
            query.push_str(&format!(", tags = ${}", param_count));
            let tags_json = json!(tags);
            params.push(tags_json.to_string());
        }

        if let Some(is_archived) = req.is_archived {
            param_count += 1;
            query.push_str(&format!(", is_archived = ${}", param_count));
            params.push(is_archived.to_string());
        }

        if let Some(diary_date) = &req.diary_date {
            param_count += 1;
            query.push_str(&format!(", diary_date = ${}", param_count));
            match diary_date {
                Some(date) => params.push(format!("'{}'", date)),
                None => params.push("NULL".to_string()),
            }
        }

        param_count += 1;
        query.push_str(&format!(
            " WHERE id = ${} AND user_id = ${} RETURNING *",
            param_count,
            param_count + 1
        ));

        let memo = sqlx::query_as::<_, Memo>(&query)
            .bind(now)
            .bind(memo_id)
            .bind(user_uuid)
            .fetch_optional(&self.pool)
            .await?
            .ok_or(AppError::MemoNotFound)?;

        Ok(MemoResponse::from(memo))
    }

    pub async fn delete_memo(&self, user_id: &str, memo_id: Uuid) -> Result<(), AppError> {
        let user_uuid = Uuid::parse_str(user_id)?;
        let now = Utc::now().timestamp();

        let result = sqlx::query(
            "UPDATE memos SET is_deleted = true, updated_at = $1 WHERE id = $2 AND user_id = $3",
        )
        .bind(now)
        .bind(memo_id)
        .bind(user_uuid)
        .execute(&self.pool)
        .await?;

        if result.rows_affected() == 0 {
            return Err(AppError::MemoNotFound);
        }

        Ok(())
    }

    pub async fn search_memos(
        &self,
        user_id: &str,
        query: &str,
    ) -> Result<Vec<MemoResponse>, AppError> {
        let user_uuid = Uuid::parse_str(user_id)?;
        let search_pattern = format!("%{}%", query);

        let memos = sqlx::query_as::<_, Memo>(
            "SELECT id, user_id, content, tags, is_archived, is_deleted, diary_date, created_at, updated_at
             FROM memos WHERE user_id = $1 AND is_deleted = false 
             AND (content ILIKE $2 OR tags::text ILIKE $2)
             ORDER BY created_at DESC",
        )
        .bind(user_uuid)
        .bind(&search_pattern)
        .fetch_all(&self.pool)
        .await?;

        Ok(memos.into_iter().map(MemoResponse::from).collect())
    }
}
