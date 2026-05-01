use crate::error::AppError;
use crate::models::{BotMemoryContext, BotMemoryDebugContext, Memo};
use crate::services::MemoryRetrievalService;
use sqlx::PgPool;
use uuid::Uuid;

#[derive(Clone)]
pub struct BotMemoryContextService {
    pool: PgPool,
    retrieval_service: MemoryRetrievalService,
}

impl BotMemoryContextService {
    pub fn new(pool: PgPool, retrieval_service: MemoryRetrievalService) -> Self {
        Self {
            pool,
            retrieval_service,
        }
    }

    pub async fn build_for_memo(
        &self,
        memo: &Memo,
        bot_id: Option<Uuid>,
    ) -> Result<BotMemoryContext, AppError> {
        let similar_memos = self
            .retrieval_service
            .retrieve_related_memos(memo.user_id, memo, 12)
            .await?;

        let estimated_chars = similar_memos
            .iter()
            .map(|m| m.summary_excerpt.len() + 4)
            .sum::<usize>();

        let debug = BotMemoryDebugContext {
            candidate_count: similar_memos.len(),
            retrieved_memo_ids: similar_memos.iter().map(|m| m.memo_id).collect(),
            prompt_chars: estimated_chars,
        };

        self.persist_debug_log(memo.user_id, memo.id, bot_id, &similar_memos, &debug)
            .await?;

        Ok(BotMemoryContext {
            similar_memos,
            debug,
        })
    }

    async fn persist_debug_log(
        &self,
        user_id: Uuid,
        memo_id: Uuid,
        bot_id: Option<Uuid>,
        related_memos: &[crate::models::RelatedMemoContext],
        debug: &BotMemoryDebugContext,
    ) -> Result<(), AppError> {
        let Some(bot_id) = bot_id else {
            return Ok(());
        };

        sqlx::query(
            "INSERT INTO bot_memory_debug_logs
             (id, user_id, memo_id, bot_id, mode, retrieved_memo_ids, score_payload, prompt_size, created_at)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)",
        )
        .bind(Uuid::new_v4())
        .bind(user_id)
        .bind(memo_id)
        .bind(bot_id)
        .bind("context_build")
        .bind(serde_json::json!(debug.retrieved_memo_ids))
        .bind(serde_json::json!(related_memos
            .iter()
            .map(|memo| {
                serde_json::json!({
                    "memoId": memo.memo_id,
                    "score": memo.relevance_score,
                    "reason": memo.reason,
                })
            })
            .collect::<Vec<_>>()))
        .bind(debug.prompt_chars as i32)
        .bind(chrono::Utc::now().timestamp_millis())
        .execute(&self.pool)
        .await
        .map_err(AppError::Database)?;

        Ok(())
    }
}
