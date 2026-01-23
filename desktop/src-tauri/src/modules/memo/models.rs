use serde::{Deserialize, Serialize};
use uuid::Uuid;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Memo {
    pub id: Uuid,
    pub content: String,
    pub tags: Vec<String>,
    pub is_archived: bool,
    pub diary_date: Option<String>,
    pub created_at: i64,
    pub updated_at: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Resource {
    pub id: Uuid,
    pub memo_id: Uuid,
    pub filename: String,
    pub resource_type: String,
    pub mime_type: String,
    pub size: i64,
    pub storage_type: Option<String>,
    pub storage_path: Option<String>,
    pub created_at: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct MemoWithResources {
    pub id: Uuid,
    pub content: String,
    pub tags: Vec<String>,
    pub is_archived: bool,
    pub diary_date: Option<String>,
    pub created_at: i64,
    pub updated_at: i64,
    pub resources: Vec<Resource>,
}
