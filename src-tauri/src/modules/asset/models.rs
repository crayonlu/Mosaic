use crate::database::schema::ResourceType;
use serde::Serialize;

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct UploadedResource {
    // UUID.webp
    pub filename: String,
    // file size(bytes)
    pub size: i64,
    // 'image/webp', 'audio/mp4'(for frontend display)
    pub mime_type: String,
    // 'image', 'voice', 'video'
    pub resource_type: ResourceType,
}
