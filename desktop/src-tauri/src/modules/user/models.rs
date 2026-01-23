use serde::{Deserialize, Serialize};
use uuid::Uuid;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct User {
    pub id: Uuid,
    pub username: String,
    pub avatar_path: Option<String>,
    pub avatar_url: Option<String>,
    pub created_at: i64,
    pub updated_at: i64,
}
