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
    pub resource_type: ResourceType,
    pub mime_type: String,
    pub size: i64,
    pub created_at: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct MemoWithResources {
    #[serde(flatten)]
    pub memo: Memo,
    pub resources: Vec<Resource>,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum ResourceType {
    Image,
}
