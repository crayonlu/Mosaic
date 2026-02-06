use serde::{Deserialize, Serialize};
use sqlx::{FromRow, Row};
use uuid::Uuid;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Resource {
    pub id: Uuid,
    pub memo_id: Option<Uuid>,
    pub filename: String,
    pub resource_type: String,
    pub mime_type: String,
    pub file_size: i64,
    pub storage_type: String,
    pub storage_path: String,
    pub created_at: i64,
}

impl FromRow<'_, sqlx::postgres::PgRow> for Resource {
    fn from_row(row: &sqlx::postgres::PgRow) -> Result<Self, sqlx::Error> {
        Ok(Resource {
            id: row.try_get("id")?,
            memo_id: row.try_get("memo_id")?,
            filename: row.try_get("filename")?,
            resource_type: row.try_get("resource_type")?,
            mime_type: row.try_get("mime_type")?,
            file_size: row.try_get("file_size")?,
            storage_type: row.try_get("storage_type")?,
            storage_path: row.try_get("storage_path")?,
            created_at: row.try_get("created_at")?,
        })
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ResourceResponse {
    pub id: Uuid,
    pub memo_id: Option<Uuid>,
    pub filename: String,
    pub resource_type: String,
    pub mime_type: String,
    pub file_size: i64,
    pub storage_type: String,
    pub url: String,
    pub created_at: i64,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateResourceRequest {
    pub memo_id: Option<Uuid>,
    pub filename: String,
    pub mime_type: String,
    pub file_size: i64,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PresignedUploadResponse {
    pub upload_url: String,
    pub resource_id: Uuid,
    pub storage_path: String,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ConfirmUploadRequest {
    pub resource_id: Uuid,
}
