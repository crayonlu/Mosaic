use crate::error::AppError;
use crate::models::user_ai_config::{UpsertUserAiConfigRequest, UserAiConfig};
use crate::services::ai_client::AiConfig;
use sqlx::PgPool;
use uuid::Uuid;

#[derive(Clone)]
pub struct UserAiConfigService {
    pool: PgPool,
}

impl UserAiConfigService {
    pub fn new(pool: PgPool) -> Self {
        Self { pool }
    }

    pub async fn get(&self, user_id: &Uuid) -> Result<Option<UserAiConfig>, AppError> {
        let config = sqlx::query_as::<_, UserAiConfig>(
            "SELECT id, user_id, provider, base_url, api_key, model, temperature, max_tokens,
                    timeout_seconds, supports_vision, supports_thinking,
                    created_at, updated_at
             FROM user_ai_configs WHERE user_id = $1",
        )
        .bind(user_id)
        .fetch_optional(&self.pool)
        .await?;

        Ok(config)
    }

    pub async fn get_required(&self, user_id: &Uuid) -> Result<UserAiConfig, AppError> {
        self.get(user_id).await?.ok_or_else(|| {
            AppError::InvalidInput(
                "AI configuration not set. Please configure your AI settings first.".to_string(),
            )
        })
    }

    pub async fn to_ai_config(&self, user_id: &Uuid) -> Result<AiConfig, AppError> {
        let config = self.get_required(user_id).await?;
        Ok(AiConfig {
            provider: config.provider,
            base_url: config.base_url,
            api_key: config.api_key,
            model: config.model,
            max_tokens: config.max_tokens,
        })
    }

    pub async fn upsert(
        &self,
        user_id: &Uuid,
        req: UpsertUserAiConfigRequest,
    ) -> Result<UserAiConfig, AppError> {
        let now = chrono::Utc::now().timestamp();

        let config = sqlx::query_as::<_, UserAiConfig>(
            "INSERT INTO user_ai_configs (user_id, provider, base_url, api_key, model, temperature, max_tokens,
                    timeout_seconds, supports_vision, supports_thinking, created_at, updated_at)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $11)
             ON CONFLICT (user_id) DO UPDATE SET
                provider = EXCLUDED.provider,
                base_url = EXCLUDED.base_url,
                api_key = EXCLUDED.api_key,
                model = EXCLUDED.model,
                temperature = EXCLUDED.temperature,
                max_tokens = EXCLUDED.max_tokens,
                timeout_seconds = EXCLUDED.timeout_seconds,
                supports_vision = EXCLUDED.supports_vision,
                supports_thinking = EXCLUDED.supports_thinking,
                updated_at = EXCLUDED.updated_at
             RETURNING id, user_id, provider, base_url, api_key, model, temperature, max_tokens,
                    timeout_seconds, supports_vision, supports_thinking,
                    created_at, updated_at",
        )
        .bind(user_id)
        .bind(&req.provider)
        .bind(&req.base_url)
        .bind(&req.api_key)
        .bind(&req.model)
        .bind(req.temperature)
        .bind(req.max_tokens)
        .bind(req.timeout_seconds)
        .bind(req.supports_vision.unwrap_or(false))
        .bind(req.supports_thinking.unwrap_or(false))
        .bind(now)
        .fetch_one(&self.pool)
        .await?;

        Ok(config)
    }

    pub async fn delete(&self, user_id: &Uuid) -> Result<(), AppError> {
        sqlx::query("DELETE FROM user_ai_configs WHERE user_id = $1")
            .bind(user_id)
            .execute(&self.pool)
            .await?;
        Ok(())
    }
}
