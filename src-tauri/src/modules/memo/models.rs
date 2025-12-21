use crate::database::schema::ResourceType;
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
    pub resource_type: ResourceType,
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
    pub tags: Option<String>,
    // call the upload interface first
    // and then submit the content + filenames
    pub resource_filenames: Vec<String>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ListMemosRequest {
    // page number, start from 1
    pub page: Option<u32>,
    // page size
    pub page_size: Option<u32>,
    // is archived
    pub is_archived: Option<bool>,
    // is deleted
    pub is_deleted: Option<bool>,
    // diary date
    pub diary_date: Option<String>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdateMemoRequest {
    pub id: String,
    pub content: Option<String>,
    pub tags: Option<String>,
    pub resource_filenames: Option<Vec<String>>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PaginatedResponse<T> {
    pub items: Vec<T>,
    pub total: i64,
    pub page: u32,
    pub page_size: u32,
    pub total_pages: u32,
}
