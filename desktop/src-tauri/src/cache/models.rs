use serde::{Deserialize, Serialize};
use sqlx::FromRow;
use uuid::Uuid;

#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct CachedMemo {
    pub id: String,
    pub content: String,
    pub tags: String,
    pub is_archived: bool,
    pub is_deleted: bool,
    pub diary_date: Option<String>,
    pub created_at: i64,
    pub updated_at: i64,
    pub synced_at: i64,
}

impl CachedMemo {
    pub fn from_memo_with_resources(memo: &crate::models::MemoWithResources) -> Self {
        Self {
            id: memo.id.to_string(),
            content: memo.content.clone(),
            tags: serde_json::to_string(&memo.tags).unwrap_or_default(),
            is_archived: memo.is_archived,
            is_deleted: false,
            diary_date: memo.diary_date.clone(),
            created_at: memo.created_at,
            updated_at: memo.updated_at,
            synced_at: chrono::Utc::now().timestamp_millis(),
        }
    }

    pub fn to_memo_with_resources(&self) -> crate::models::MemoWithResources {
        let tags: Vec<String> = serde_json::from_str(&self.tags).unwrap_or_default();

        crate::models::MemoWithResources {
            id: Uuid::parse_str(&self.id).unwrap_or_else(|_| Uuid::new_v4()),
            content: self.content.clone(),
            tags,
            is_archived: self.is_archived,
            diary_date: self.diary_date.clone(),
            created_at: self.created_at,
            updated_at: self.updated_at,
            resources: Vec::new(),
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct CachedDiary {
    pub date: String,
    pub summary: String,
    pub mood_key: String,
    pub mood_score: i32,
    pub cover_image_id: Option<String>,
    pub created_at: i64,
    pub updated_at: i64,
    pub synced_at: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct OfflineOperation {
    pub id: String,
    pub operation_type: String,
    pub entity_type: String,
    pub entity_id: String,
    pub payload: String,
    pub created_at: i64,
    pub retried_count: i32,
}
