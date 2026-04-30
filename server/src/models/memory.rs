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
pub struct MemoEpisode {
    pub id: Uuid,
    pub user_id: Uuid,
    pub title: String,
    pub status: String,
    pub summary: String,
    pub keywords: serde_json::Value,
    pub last_memo_id: Option<Uuid>,
    pub start_at: i64,
    pub end_at: Option<i64>,
    pub updated_at: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
#[serde(rename_all = "camelCase")]
pub struct MemoEpisodeLink {
    pub episode_id: Uuid,
    pub memo_id: Uuid,
    pub event_at: i64,
    pub relevance_score: f64,
    pub created_at: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
#[serde(rename_all = "camelCase")]
pub struct UserMemoryProfile {
    pub user_id: Uuid,
    pub profile_summary: String,
    pub topic_signals: serde_json::Value,
    pub mood_patterns: serde_json::Value,
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
    pub selected_episode_ids: serde_json::Value,
    pub score_payload: serde_json::Value,
    pub prompt_size: i32,
    pub created_at: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DiaryMemoryContext {
    pub date: chrono::NaiveDate,
    pub summary: String,
    pub mood_key: String,
    pub mood_score: i32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AnchorMemoContext {
    pub memo_id: Uuid,
    pub content: String,
    pub ai_summary: Option<String>,
    pub tags: Vec<String>,
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

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct EpisodeContext {
    pub episode_id: Uuid,
    pub title: String,
    pub status: String,
    pub summary: String,
    pub keywords: Vec<String>,
    pub start_at: i64,
    pub end_at: Option<i64>,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct BotMemoryDebugContext {
    pub candidate_count: usize,
    pub retrieved_memo_ids: Vec<Uuid>,
    pub selected_episode_id: Option<Uuid>,
    pub prompt_chars: usize,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct MemoryStatsResponse {
    pub total_memos: i64,
    pub indexed_memos: i64,
    pub ongoing_episodes: i64,
    pub resolved_episodes: i64,
    pub profile_summary: Option<String>,
    pub profile_topic_count: i64,
    pub profile_updated_at: Option<i64>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct BotMemoryContext {
    pub anchor_memo: AnchorMemoContext,
    pub diary_context: Option<DiaryMemoryContext>,
    pub thread_context: Vec<serde_json::Value>,
    pub related_memos: Vec<RelatedMemoContext>,
    pub selected_episode: Option<EpisodeContext>,
    pub timeline_summary: Option<String>,
    pub profile_summary: Option<String>,
    pub debug: BotMemoryDebugContext,
}
