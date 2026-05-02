use crate::error::AppError;
use crate::models::{ServerAiConfig, ServerAiConfigPayload};
use serde::Deserialize;
use sqlx::PgPool;

#[derive(Clone)]
pub struct ServerAiConfigService {
    pool: PgPool,
}

#[derive(Deserialize)]
struct ModelsResponse {
    data: Option<Vec<ModelInfo>>,
}

#[derive(Deserialize)]
struct ModelInfo {
    id: String,
    #[serde(default)]
    input_modalities: Vec<String>,
    #[serde(default)]
    features: Vec<String>,
}

struct DetectedCapabilities {
    supports_vision: bool,
    supports_thinking: bool,
}

async fn detect_capabilities(base_url: &str, api_key: &str, model: &str) -> DetectedCapabilities {
    let fallback = DetectedCapabilities {
        supports_vision: false,
        supports_thinking: false,
    };
    if base_url.is_empty() || api_key.is_empty() || model.is_empty() {
        return fallback;
    }

    let url = format!("{}/models", base_url.trim_end_matches('/'));
    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(10))
        .build()
        .unwrap_or_default();

    let resp = match client
        .get(&url)
        .header("Authorization", format!("Bearer {}", api_key))
        .send()
        .await
    {
        Ok(r) if r.status().is_success() => r,
        _ => return fallback,
    };

    let body: ModelsResponse = match resp.json().await {
        Ok(b) => b,
        Err(_) => return fallback,
    };

    let models = body.data.unwrap_or_default();
    let info = match models.iter().find(|m| m.id == model) {
        Some(m) => m,
        None => return fallback,
    };

    DetectedCapabilities {
        supports_vision: info
            .input_modalities
            .iter()
            .any(|m| m == "image" || m == "video"),
        supports_thinking: info.features.iter().any(|f| f == "reasoning"),
    }
}

impl ServerAiConfigService {
    pub fn new(pool: PgPool) -> Self {
        Self { pool }
    }

    pub async fn get(&self, key: &str) -> Result<ServerAiConfig, AppError> {
        sqlx::query_as::<_, ServerAiConfig>(
            "SELECT key, provider, base_url, api_key, model, temperature, max_tokens, timeout_seconds, supports_vision, supports_thinking, embedding_dim, updated_at
             FROM server_ai_configs
             WHERE key = $1",
        )
        .bind(key)
        .fetch_optional(&self.pool)
        .await
        .map_err(AppError::Database)?
        .ok_or_else(|| AppError::NotFound(format!("Server AI config not found: {}", key)))
    }

    pub async fn update_embedding_dim(&self, key: &str, dim: i32) -> Result<(), AppError> {
        sqlx::query("UPDATE server_ai_configs SET embedding_dim = $1 WHERE key = $2")
            .bind(dim)
            .bind(key)
            .execute(&self.pool)
            .await
            .map_err(AppError::Database)?;
        Ok(())
    }

    pub async fn upsert(
        &self,
        key: &str,
        payload: ServerAiConfigPayload,
    ) -> Result<ServerAiConfig, AppError> {
        let auto_caps = detect_capabilities(&payload.base_url, &payload.api_key, &payload.model).await;
        let supports_vision = payload.supports_vision.unwrap_or(auto_caps.supports_vision);
        let supports_thinking = payload.supports_thinking.unwrap_or(auto_caps.supports_thinking);
        let now = chrono::Utc::now().timestamp_millis();
        sqlx::query_as::<_, ServerAiConfig>(
            "INSERT INTO server_ai_configs
             (key, provider, base_url, api_key, model, temperature, max_tokens, timeout_seconds, supports_vision, supports_thinking, embedding_dim, updated_at)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
             ON CONFLICT (key)
             DO UPDATE SET provider = EXCLUDED.provider,
                           base_url = EXCLUDED.base_url,
                           api_key = EXCLUDED.api_key,
                           model = EXCLUDED.model,
                           temperature = EXCLUDED.temperature,
                           max_tokens = EXCLUDED.max_tokens,
                           timeout_seconds = EXCLUDED.timeout_seconds,
                           supports_vision = EXCLUDED.supports_vision,
                           supports_thinking = EXCLUDED.supports_thinking,
                           embedding_dim = EXCLUDED.embedding_dim,
                           updated_at = EXCLUDED.updated_at
             RETURNING key, provider, base_url, api_key, model, temperature, max_tokens, timeout_seconds, supports_vision, supports_thinking, embedding_dim, updated_at",
        )
        .bind(key)
        .bind(payload.provider)
        .bind(payload.base_url)
        .bind(payload.api_key)
        .bind(payload.model)
        .bind(payload.temperature)
        .bind(payload.max_tokens)
        .bind(payload.timeout_seconds)
        .bind(supports_vision)
        .bind(supports_thinking)
        .bind(payload.embedding_dim)
        .bind(now)
        .fetch_one(&self.pool)
        .await
        .map_err(AppError::Database)
    }
}
