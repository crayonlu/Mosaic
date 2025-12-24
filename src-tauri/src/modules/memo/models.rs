use crate::database::schema::ResourceType;
use serde::{Deserialize, Deserializer, Serialize, Serializer};
use sqlx::FromRow;

// Helper function to serialize Vec<String> to JSON string
fn serialize_tags<S>(tags: &String, serializer: S) -> Result<S::Ok, S::Error>
where
    S: Serializer,
{
    let tags_vec: Vec<String> = serde_json::from_str(tags).unwrap_or_default();
    tags_vec.serialize(serializer)
}

// Helper function to deserialize JSON string to Vec<String>
fn deserialize_tags<'de, D>(deserializer: D) -> Result<String, D::Error>
where
    D: Deserializer<'de>,
{
    let tags_vec: Vec<String> = Vec::deserialize(deserializer)?;
    Ok(serde_json::to_string(&tags_vec).map_err(serde::de::Error::custom)?)
}

#[derive(Debug, FromRow)]
pub struct MemoRow {
    pub id: String,
    pub content: String,
    pub tags: String, // JSON string in database
    pub is_archived: bool,
    pub diary_date: Option<String>,
    pub created_at: i64,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Memo {
    pub id: String,
    pub content: String,
    #[serde(serialize_with = "serialize_tags")]
    pub tags: String, // Stored as JSON string, serialized as Vec<String>
    pub is_archived: bool,
    pub diary_date: Option<String>,
    pub created_at: i64,
}

impl From<MemoRow> for Memo {
    fn from(row: MemoRow) -> Self {
        Memo {
            id: row.id,
            content: row.content,
            tags: row.tags,
            is_archived: row.is_archived,
            diary_date: row.diary_date,
            created_at: row.created_at,
        }
    }
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
    pub tags: Option<Vec<String>>,
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
    pub tags: Option<Vec<String>>,
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
