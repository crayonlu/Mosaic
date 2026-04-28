use crate::error::AppError;
use crate::models::Memo;
use crate::services::ServerAiConfigService;
use pgvector::Vector;
use reqwest::Client;
use serde_json::json;
use sqlx::PgPool;
use std::time::Duration;

const EXPECTED_DIM: usize = 1536;
const EMBEDDING_TIMEOUT: Duration = Duration::from_secs(30);

#[derive(Clone)]
pub struct MemoryEmbeddingService {
    pool: PgPool,
    client: Client,
    server_ai_config_service: ServerAiConfigService,
}

impl MemoryEmbeddingService {
    pub fn new(pool: PgPool, server_ai_config_service: ServerAiConfigService) -> Self {
        Self {
            pool,
            client: Client::builder()
                .timeout(EMBEDDING_TIMEOUT)
                .build()
                .unwrap_or_default(),
            server_ai_config_service,
        }
    }

    pub fn build_source_text(&self, memo: &Memo) -> String {
        let tags: Vec<String> = serde_json::from_value(memo.tags.clone()).unwrap_or_default();
        let content_excerpt = memo.content.chars().take(500).collect::<String>();
        let summary = memo.ai_summary.clone().unwrap_or_default();
        let tags_text = if tags.is_empty() {
            String::new()
        } else {
            tags.join(", ")
        };

        format!(
            "summary: {}\ncontent: {}\ntags: {}",
            summary, content_excerpt, tags_text
        )
    }

    pub async fn refresh_for_memo(&self, memo: &Memo) -> Result<(), AppError> {
        let source_text = self.build_source_text(memo);
        let now = chrono::Utc::now().timestamp_millis();
        let config = self.server_ai_config_service.get("embedding").await.ok();
        let embedding = self
            .generate_embedding(&source_text, config.as_ref())
            .await?;
        let provider = config
            .as_ref()
            .map(|config| config.provider.clone())
            .unwrap_or_else(|| "local".to_string());
        let model = config
            .as_ref()
            .map(|config| config.model.clone())
            .unwrap_or_else(|| "fallback".to_string());

        sqlx::query(
            "INSERT INTO memo_embeddings (memo_id, source_text, provider, model, embedding, updated_at)
             VALUES ($1, $2, $3, $4, $5, $6)
             ON CONFLICT (memo_id)
             DO UPDATE SET source_text = EXCLUDED.source_text,
                           provider = EXCLUDED.provider,
                           model = EXCLUDED.model,
                           embedding = EXCLUDED.embedding,
                           updated_at = EXCLUDED.updated_at",
        )
        .bind(memo.id)
        .bind(source_text)
        .bind(provider)
        .bind(model)
        .bind(Vector::from(embedding))
        .bind(now)
        .execute(&self.pool)
        .await
        .map_err(AppError::Database)?;

        Ok(())
    }

    async fn generate_embedding(
        &self,
        text: &str,
        config: Option<&crate::models::ServerAiConfig>,
    ) -> Result<Vec<f32>, AppError> {
        let Some(config) = config else {
            return Ok(vec![0.0_f32; EXPECTED_DIM]);
        };

        let base_url = config.base_url.as_str();
        let api_key = config.api_key.as_str();
        let model = config.model.as_str();

        if api_key.trim().is_empty() || model.trim().is_empty() || base_url.trim().is_empty() {
            return Ok(vec![0.0_f32; EXPECTED_DIM]);
        }

        let url = format!("{}/embeddings", base_url.trim_end_matches('/'));
        let response = self
            .client
            .post(url)
            .header("Authorization", format!("Bearer {}", api_key))
            .json(&json!({
                "model": model,
                "input": text,
            }))
            .send()
            .await
            .map_err(|e| AppError::Internal(format!("Embedding request failed: {}", e)))?;

        if !response.status().is_success() {
            let status = response.status();
            let body = response.text().await.unwrap_or_default();
            return Err(AppError::Internal(format!(
                "Embedding API returned {}: {}",
                status,
                body.chars().take(200).collect::<String>()
            )));
        }

        let payload: serde_json::Value = response
            .json()
            .await
            .map_err(|e| AppError::Internal(format!("Embedding response parse failed: {}", e)))?;

        let values = payload["data"][0]["embedding"]
            .as_array()
            .ok_or_else(|| AppError::Internal("Embedding payload missing vector".to_string()))?;

        let mut embedding: Vec<f32> = values
            .iter()
            .map(|value| value.as_f64().unwrap_or_default() as f32)
            .collect();

        if embedding.len() != EXPECTED_DIM {
            log::warn!(
                "[MemoryEmbeddingService] Dimension mismatch: got {}, expected {}. Padding/truncating.",
                embedding.len(),
                EXPECTED_DIM
            );
            embedding.resize(EXPECTED_DIM, 0.0);
        }

        Ok(embedding)
    }
}
