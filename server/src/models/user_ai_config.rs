use serde::{Deserialize, Serialize};
use sqlx::FromRow;
use uuid::Uuid;

#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
#[serde(rename_all = "camelCase")]
pub struct UserAiConfig {
    pub id: Uuid,
    pub user_id: Uuid,
    pub provider: String,
    pub base_url: String,
    pub api_key: String,
    pub model: String,
    pub temperature: Option<f64>,
    pub max_tokens: Option<i32>,
    pub timeout_seconds: Option<i32>,
    pub supports_vision: bool,
    pub supports_thinking: bool,
    pub embedding_model: Option<String>,
    pub embedding_dim: Option<i32>,
    pub created_at: i64,
    pub updated_at: i64,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UpsertUserAiConfigRequest {
    pub provider: String,
    pub base_url: String,
    pub api_key: String,
    pub model: String,
    pub temperature: Option<f64>,
    pub max_tokens: Option<i32>,
    pub timeout_seconds: Option<i32>,
    pub supports_vision: Option<bool>,
    pub supports_thinking: Option<bool>,
    pub embedding_model: Option<String>,
    pub embedding_dim: Option<i32>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct UserAiConfigResponse {
    pub provider: String,
    pub base_url: String,
    pub api_key: String,
    pub model: String,
    pub temperature: Option<f64>,
    pub max_tokens: Option<i32>,
    pub timeout_seconds: Option<i32>,
    pub supports_vision: bool,
    pub supports_thinking: bool,
    pub embedding_model: Option<String>,
    pub embedding_dim: Option<i32>,
    pub updated_at: i64,
}

impl From<UserAiConfig> for UserAiConfigResponse {
    fn from(c: UserAiConfig) -> Self {
        // Mask the stored API key — show only last 4 chars prefixed with "****"
        let masked_key = if c.api_key.len() > 4 {
            format!("****{}", &c.api_key[c.api_key.len() - 4..])
        } else {
            "****".to_string()
        };
        UserAiConfigResponse {
            provider: c.provider,
            base_url: c.base_url,
            api_key: masked_key,
            model: c.model,
            temperature: c.temperature,
            max_tokens: c.max_tokens,
            timeout_seconds: c.timeout_seconds,
            supports_vision: c.supports_vision,
            supports_thinking: c.supports_thinking,
            embedding_model: c.embedding_model,
            embedding_dim: c.embedding_dim,
            updated_at: c.updated_at,
        }
    }
}
