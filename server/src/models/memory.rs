use pgvector::Vector;
use serde::{Deserialize, Serialize};
use sqlx::FromRow;
use uuid::Uuid;

#[derive(Debug, Clone, FromRow)]
#[allow(dead_code)]
pub struct MemoEmbedding {
    pub memo_id: Uuid,
    pub source_text: String,
    pub provider: String,
    pub model: String,
    pub embedding: Vector,
    pub updated_at: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
#[serde(rename_all = "camelCase")]
#[allow(dead_code)]
pub struct BotMemoryDebugLog {
    pub id: Uuid,
    pub user_id: Uuid,
    pub memo_id: Uuid,
    pub bot_id: Uuid,
    pub mode: String,
    pub retrieved_memo_ids: serde_json::Value,
    pub score_payload: serde_json::Value,
    pub prompt_size: i32,
    pub created_at: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RelatedMemoContext {
    pub memo_id: Uuid,
    pub summary_excerpt: String,
    pub tags: Vec<String>,
    pub created_at: i64,
    pub relevance_score: f64,
    pub reason: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct BotMemoryDebugContext {
    pub candidate_count: usize,
    pub retrieved_memo_ids: Vec<Uuid>,
    pub prompt_chars: usize,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct MemoryStatsResponse {
    pub total_memos: i64,
    pub indexed_memos: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct BotMemoryContext {
    pub similar_memos: Vec<RelatedMemoContext>,
    pub debug: BotMemoryDebugContext,
}
