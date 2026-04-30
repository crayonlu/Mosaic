use crate::error::AppError;
use crate::models::{Memo, RelatedMemoContext};
use sqlx::PgPool;
use uuid::Uuid;

const RECENT_DAYS: i64 = 30;
const MAX_CANDIDATES: i64 = 30;
const MIN_SEMANTIC: f64 = 0.50;

#[derive(Clone)]
pub struct MemoryRetrievalService {
    pool: PgPool,
}

impl MemoryRetrievalService {
    pub fn new(pool: PgPool) -> Self {
        Self { pool }
    }

    pub async fn retrieve_related_memos(
        &self,
        user_id: Uuid,
        anchor_memo: &Memo,
        limit: i64,
    ) -> Result<Vec<RelatedMemoContext>, AppError> {
        let anchor_tags: Vec<String> =
            serde_json::from_value(anchor_memo.tags.clone()).unwrap_or_default();
        let now_ms = chrono::Utc::now().timestamp_millis();
        let recent_cutoff = now_ms - RECENT_DAYS * 86_400_000;

        #[derive(sqlx::FromRow)]
        struct CandidateRow {
            id: Uuid,
            tags: serde_json::Value,
            ai_summary: Option<String>,
            content: String,
            created_at: i64,
            similarity: Option<f64>,
        }

        let candidates = sqlx::query_as::<_, CandidateRow>(
            "SELECT m.id, m.tags, m.ai_summary, m.content, m.created_at,
                    CASE
                      WHEN me.embedding IS NOT NULL AND anchor.embedding IS NOT NULL
                           THEN 1.0 - (me.embedding <=> anchor.embedding)
                      ELSE NULL
                    END AS similarity
             FROM memos m
             LEFT JOIN memo_embeddings me ON me.memo_id = m.id
             LEFT JOIN memo_embeddings anchor ON anchor.memo_id = $2
             WHERE m.user_id = $1 AND m.is_deleted = false AND m.id <> $2
               AND (
                 (me.embedding IS NOT NULL AND anchor.embedding IS NOT NULL)
                 OR m.created_at >= $3
               )
             ORDER BY COALESCE(1.0 - (me.embedding <=> anchor.embedding), 0) DESC, m.created_at DESC
             LIMIT $4",
        )
        .bind(user_id)
        .bind(anchor_memo.id)
        .bind(recent_cutoff)
        .bind(MAX_CANDIDATES)
        .fetch_all(&self.pool)
        .await
        .map_err(AppError::Database)?;

        let mut scored: Vec<RelatedMemoContext> = candidates
            .into_iter()
            .filter(|c| {
                let semantic = c.similarity.unwrap_or(0.0);
                semantic >= MIN_SEMANTIC
            })
            .map(|c| {
                let candidate_tags: Vec<String> =
                    serde_json::from_value(c.tags.clone()).unwrap_or_default();

                let semantic = c.similarity.unwrap_or(0.0).max(0.0);
                let age_ms = (now_ms - c.created_at).max(0) as f64;
                let recency = (-age_ms / (30.0 * 86_400_000.0)).exp();
                let tag_overlap = if anchor_tags.is_empty() || candidate_tags.is_empty() {
                    0.0
                } else {
                    let overlap = anchor_tags
                        .iter()
                        .filter(|t| candidate_tags.contains(t))
                        .count();
                    overlap as f64 / anchor_tags.len().max(candidate_tags.len()) as f64
                };

                let final_score =
                    0.55 * semantic + 0.25 * recency + 0.20 * tag_overlap;

                let mut reasons = Vec::new();
                if semantic > 0.3 {
                    reasons.push("semantic");
                }
                if recency > 0.5 {
                    reasons.push("recent");
                }
                if tag_overlap > 0.0 {
                    reasons.push("tags");
                }

                RelatedMemoContext {
                    memo_id: c.id,
                    summary_excerpt: c
                        .ai_summary
                        .clone()
                        .unwrap_or_else(|| c.content.chars().take(120).collect()),
                    tags: candidate_tags,
                    created_at: c.created_at,
                    relevance_score: final_score,
                    reason: if reasons.is_empty() {
                        "recent".into()
                    } else {
                        reasons.join("+")
                    },
                }
            })
            .collect();

        scored.sort_by(|a, b| {
            b.relevance_score
                .partial_cmp(&a.relevance_score)
                .unwrap_or(std::cmp::Ordering::Equal)
        });
        scored.truncate(limit as usize);
        Ok(scored)
    }

    pub async fn retrieve_recent_memos(
        &self,
        user_id: Uuid,
        anchor_memo: &Memo,
        within_hours: i64,
        limit: i64,
    ) -> Result<Vec<RelatedMemoContext>, AppError> {
        let now_ms = chrono::Utc::now().timestamp_millis();
        let cutoff = now_ms - within_hours * 3_600_000;

        #[derive(sqlx::FromRow)]
        struct RecentRow {
            id: Uuid,
            tags: serde_json::Value,
            ai_summary: Option<String>,
            content: String,
            created_at: i64,
        }

        let rows = sqlx::query_as::<_, RecentRow>(
            "SELECT id, tags, ai_summary, content, created_at
             FROM memos
             WHERE user_id = $1 AND id <> $2 AND is_deleted = false
               AND created_at >= $3
             ORDER BY created_at DESC
             LIMIT $4",
        )
        .bind(user_id)
        .bind(anchor_memo.id)
        .bind(cutoff)
        .bind(limit)
        .fetch_all(&self.pool)
        .await
        .map_err(AppError::Database)?;

        let contexts: Vec<RelatedMemoContext> = rows
            .into_iter()
            .map(|r| {
                let tags: Vec<String> = serde_json::from_value(r.tags.clone()).unwrap_or_default();
                let age_ms = (now_ms - r.created_at).max(0) as f64;
                let recency = (-age_ms / (24.0 * 86_400_000.0)).exp();

                RelatedMemoContext {
                    memo_id: r.id,
                    summary_excerpt: r
                        .ai_summary
                        .clone()
                        .unwrap_or_else(|| r.content.chars().take(120).collect()),
                    tags,
                    created_at: r.created_at,
                    relevance_score: recency,
                    reason: "recent_24h".to_string(),
                }
            })
            .collect();

        Ok(contexts)
    }
}
