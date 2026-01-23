use serde::{Deserialize, Serialize};
use sqlx::FromRow;
use uuid::Uuid;

#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct Resource {
    pub id: Uuid,
    pub memo_id: Uuid,
    pub filename: String,
    pub resource_type: String,
    pub mime_type: String,
    pub file_size: i64,
    pub storage_type: String,
    pub storage_path: String,
    pub created_at: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ResourceResponse {
    pub id: Uuid,
    pub memo_id: Uuid,
    pub filename: String,
    pub resource_type: String,
    pub mime_type: String,
    pub file_size: i64,
    pub storage_type: String,
    pub url: String,
    pub created_at: i64,
}

#[derive(Debug, Deserialize)]
pub struct CreateResourceRequest {
    pub memo_id: Uuid,
    pub filename: String,
    pub mime_type: String,
    pub file_size: i64,
}
