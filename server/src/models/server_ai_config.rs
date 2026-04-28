use serde::{Deserialize, Serialize};
use sqlx::FromRow;

#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
#[serde(rename_all = "camelCase")]
pub struct ServerAiConfig {
    pub key: String,
    pub provider: String,
    pub base_url: String,
    pub api_key: String,
    pub model: String,
    pub temperature: Option<f64>,
    pub max_tokens: Option<i32>,
    pub timeout_seconds: Option<i32>,
    pub supports_vision: bool,
    pub supports_thinking: bool,
    pub embedding_dim: Option<i32>,
    pub updated_at: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ServerAiConfigPayload {
    pub provider: String,
    pub base_url: String,
    pub api_key: String,
    pub model: String,
    pub temperature: Option<f64>,
    pub max_tokens: Option<i32>,
    pub timeout_seconds: Option<i32>,
    pub embedding_dim: Option<i32>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ServerAiConfigResponse {
    pub key: String,
    pub provider: String,
    pub base_url: String,
    pub api_key: String,
    pub model: String,
    pub temperature: Option<f64>,
    pub max_tokens: Option<i32>,
    pub timeout_seconds: Option<i32>,
    pub supports_vision: bool,
    pub supports_thinking: bool,
    pub embedding_dim: Option<i32>,
    pub updated_at: i64,
}

impl ServerAiConfigResponse {
    pub fn from_config(config: ServerAiConfig) -> Self {
        Self {
            key: config.key,
            provider: config.provider,
            base_url: config.base_url,
            api_key: config.api_key,
            model: config.model,
            temperature: config.temperature,
            max_tokens: config.max_tokens,
            timeout_seconds: config.timeout_seconds,
            supports_vision: config.supports_vision,
            supports_thinking: config.supports_thinking,
            embedding_dim: config.embedding_dim,
            updated_at: config.updated_at,
        }
    }
}
