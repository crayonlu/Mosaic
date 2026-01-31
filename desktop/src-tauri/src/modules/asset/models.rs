use serde::Serialize;

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct UploadedResource {
    pub id: String,
    pub filename: String,
    pub size: i64,
    pub mime_type: String,
    pub resource_type: String,
    pub storage_type: Option<String>,
    pub storage_path: Option<String>,
}
