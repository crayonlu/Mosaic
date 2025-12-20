use serde::{Deserialize, Serialize};
use sqlx::FromRow;

#[derive(Debug, Serialize, FromRow)]
#[serde(rename_all = "camelCase")]
pub struct Memo {
    pub id: String,
    pub content: String,
    // JSON string
    pub tags: String,
    pub is_archived: bool,
    pub diary_date: Option<String>,
    pub created_at: i64,
}

#[derive(Debug, Serialize, FromRow)]
#[serde(rename_all = "camelCase")]
pub struct Resource {
    pub id: String,
    pub memo_id: String,
    // filename(e.g. "abc.jpg")
    pub filename: String,
    // 'image', 'voice', 'video'
    pub resource_type: String,
    // 'image/webp', 'audio/mp4'(for frontend display)
    pub mime_type: String,
    pub size: i64,
    pub created_at: i64,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct MemoWithResources {
    #[serde(flatten)]
    pub memo: Memo,
    pub resources: Vec<Resource>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateMemoRequest {
    pub content: String,
    // call the upload interface first
    // and then submit the content + filenames
    pub resource_filenames: Vec<String>, 
}