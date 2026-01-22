use crate::modules::memo::models::ResourceType;
use serde::Serialize;

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct UploadedResource {
    pub filename: String,
    pub size: i64,
    pub mime_type: String,
    pub resource_type: ResourceType,
}
