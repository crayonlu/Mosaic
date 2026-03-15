use serde::{Deserialize, Serialize};
use serde_json::{Map, Value};
use sqlx::{FromRow, Row};
use uuid::Uuid;

pub const THUMBNAIL_STORAGE_PATH_KEY: &str = "thumbnailStoragePath";
pub const THUMBNAIL_MIME_TYPE_KEY: &str = "thumbnailMimeType";

pub fn build_download_route(resource_id: Uuid) -> String {
    format!("/api/resources/{}/download", resource_id)
}

pub fn build_thumbnail_route(resource_id: Uuid) -> String {
    format!("/api/resources/{}/thumbnail", resource_id)
}

pub fn thumbnail_storage_path(metadata: &Value) -> Option<&str> {
    metadata
        .as_object()?
        .get(THUMBNAIL_STORAGE_PATH_KEY)?
        .as_str()
}

pub fn thumbnail_mime_type(metadata: &Value) -> Option<&str> {
    metadata.as_object()?.get(THUMBNAIL_MIME_TYPE_KEY)?.as_str()
}

pub fn with_thumbnail_metadata(metadata: Value, storage_path: String, mime_type: String) -> Value {
    let mut map = match metadata {
        Value::Object(map) => map,
        _ => Map::new(),
    };

    map.insert(
        THUMBNAIL_STORAGE_PATH_KEY.to_string(),
        Value::String(storage_path),
    );
    map.insert(
        THUMBNAIL_MIME_TYPE_KEY.to_string(),
        Value::String(mime_type),
    );

    Value::Object(map)
}

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
    pub metadata: Value,
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
            metadata: row.try_get("metadata")?,
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
    pub thumbnail_url: Option<String>,
    pub metadata: Value,
    pub created_at: i64,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateResourceRequest {
    pub memo_id: Option<Uuid>,
    pub filename: String,
    pub mime_type: String,
    pub file_size: i64,
    pub metadata: Option<Value>,
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
