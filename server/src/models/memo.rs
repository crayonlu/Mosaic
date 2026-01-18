use serde::{Deserialize, Serialize};
use sqlx::FromRow;
use uuid::Uuid;

#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct Memo {
    pub id: Uuid,
    pub user_id: Uuid,
    pub content: String,
    pub tags: serde_json::Value,
    pub is_archived: bool,
    pub is_deleted: bool,
    pub diary_date: Option<chrono::NaiveDate>,
    pub created_at: i64,
    pub updated_at: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MemoResponse {
    pub id: Uuid,
    pub content: String,
    pub tags: Vec<String>,
    pub is_archived: bool,
    pub diary_date: Option<chrono::NaiveDate>,
    pub created_at: i64,
    pub updated_at: i64,
}

#[derive(Debug, Deserialize)]
pub struct CreateMemoRequest {
    pub content: String,
    #[serde(default)]
    pub tags: Vec<String>,
    #[serde(default)]
    pub diary_date: Option<chrono::NaiveDate>,
}

#[derive(Debug, Deserialize)]
pub struct UpdateMemoRequest {
    pub content: Option<String>,
    pub tags: Option<Vec<String>>,
    pub is_archived: Option<bool>,
    pub diary_date: Option<Option<chrono::NaiveDate>>,
}

#[derive(Debug, Deserialize)]
pub struct MemoListQuery {
    pub page: Option<u32>,
    pub page_size: Option<u32>,
    pub archived: Option<bool>,
}

impl From<Memo> for MemoResponse {
    fn from(memo: Memo) -> Self {
        let tags: Vec<String> = serde_json::from_value(memo.tags).unwrap_or_default();
        MemoResponse {
            id: memo.id,
            content: memo.content,
            tags,
            is_archived: memo.is_archived,
            diary_date: memo.diary_date,
            created_at: memo.created_at,
            updated_at: memo.updated_at,
        }
    }
}
