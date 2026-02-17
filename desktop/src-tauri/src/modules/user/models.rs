use serde::{Deserialize, Serialize};
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct User {
    pub id: String,
    pub username: String,
    pub avatar_url: Option<String>,
    pub created_at: i64,
    pub updated_at: i64,
}
