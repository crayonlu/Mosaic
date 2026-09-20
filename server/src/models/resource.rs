use serde::{Deserialize, Serialize};
use serde_json::{Map, Value};
use sqlx::{FromRow, Row};
use uuid::Uuid;

pub const THUMBNAIL_STORAGE_PATH_KEY: &str = "thumbnailStoragePath";
pub const THUMBNAIL_MIME_TYPE_KEY: &str = "thumbnailMimeType";

pub fn resolve_mime_type(declared: &str, filename: &str, data: &[u8]) -> String {
    let sniffed = sniff_image_mime_type(data);
    if declared.starts_with("image/") {
        return sniffed.unwrap_or_else(|| declared.to_string());
    }

    if is_generic_mime_type(declared) {
        return sniffed
            .or_else(|| mime_type_from_extension(filename))
            .unwrap_or_else(|| declared.to_string());
    }

    declared.to_string()
}

fn is_generic_mime_type(mime_type: &str) -> bool {
    mime_type.is_empty()
        || mime_type.eq_ignore_ascii_case("application/octet-stream")
        || mime_type.eq_ignore_ascii_case("application/binary")
}

fn sniff_image_mime_type(data: &[u8]) -> Option<String> {
    if data.starts_with(&[0xff, 0xd8, 0xff]) {
        return Some("image/jpeg".to_string());
    }
    if data.starts_with(b"\x89PNG\r\n\x1a\n") {
        return Some("image/png".to_string());
    }
    if data.starts_with(b"GIF87a") || data.starts_with(b"GIF89a") {
        return Some("image/gif".to_string());
    }
    if data.len() >= 12 && &data[..4] == b"RIFF" && &data[8..12] == b"WEBP" {
        return Some("image/webp".to_string());
    }

    None
}

fn mime_type_from_extension(filename: &str) -> Option<String> {
    let extension = filename.rsplit('.').next()?.to_ascii_lowercase();
    match extension.as_str() {
        "jpg" | "jpeg" => Some("image/jpeg".to_string()),
        "png" => Some("image/png".to_string()),
        "gif" => Some("image/gif".to_string()),
        "webp" => Some("image/webp".to_string()),
        _ => None,
    }
}

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
    pub user_id: Uuid,
    pub filename: String,
    pub resource_type: String,
    pub mime_type: String,
    pub file_size: i64,
    pub storage_type: String,
    pub storage_path: String,
    pub metadata: Value,
    pub is_deleted: bool,
    pub ai_description: Option<String>,
    pub created_at: i64,
    pub updated_at: i64,
}

impl FromRow<'_, sqlx::postgres::PgRow> for Resource {
    fn from_row(row: &sqlx::postgres::PgRow) -> Result<Self, sqlx::Error> {
        Ok(Resource {
            id: row.try_get("id")?,
            memo_id: row.try_get("memo_id")?,
            user_id: row.try_get("user_id")?,
            filename: row.try_get("filename")?,
            resource_type: row.try_get("resource_type")?,
            mime_type: row.try_get("mime_type")?,
            file_size: row.try_get("file_size")?,
            storage_type: row.try_get("storage_type")?,
            storage_path: row.try_get("storage_path")?,
            metadata: row.try_get("metadata")?,
            is_deleted: row.try_get("is_deleted")?,
            ai_description: row.try_get("ai_description")?,
            created_at: row.try_get("created_at")?,
            updated_at: row.try_get("updated_at")?,
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
    pub ai_description: Option<String>,
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

#[cfg(test)]
mod tests {
    use super::resolve_mime_type;

    #[test]
    fn resolves_octet_stream_jpeg_from_file_signature() {
        let jpeg = [0xff, 0xd8, 0xff, 0xe0];

        assert_eq!(
            resolve_mime_type("application/octet-stream", "avatar.jpg", &jpeg),
            "image/jpeg"
        );
    }

    #[test]
    fn resolves_octet_stream_png_from_file_signature() {
        let png = b"\x89PNG\r\n\x1a\n";

        assert_eq!(
            resolve_mime_type("application/octet-stream", "avatar.png", png),
            "image/png"
        );
    }

    #[test]
    fn keeps_non_generic_declared_mime_type_for_non_images() {
        assert_eq!(
            resolve_mime_type("text/plain", "notes.txt", b"hello"),
            "text/plain"
        );
    }
}
