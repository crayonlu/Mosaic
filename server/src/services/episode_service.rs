use crate::error::AppError;
use crate::models::{Memo, MemoEpisodeLink};
use sqlx::PgPool;
use uuid::Uuid;

const EPISODE_THRESHOLD: f64 = 0.25;

#[derive(Clone)]
pub struct EpisodeService {
    pool: PgPool,
}

#[derive(sqlx::FromRow)]
#[allow(dead_code)]
struct EpisodeCandidateRow {
    id: Uuid,
    user_id: Uuid,
    title: String,
    status: String,
    summary: String,
    keywords: serde_json::Value,
    last_memo_id: Option<Uuid>,
    start_at: i64,
    end_at: Option<i64>,
    updated_at: i64,
    semantic_dist: Option<f64>,
}

impl EpisodeService {
    pub fn new(pool: PgPool) -> Self {
        Self { pool }
    }

    pub async fn assign_memo_to_episode(&self, memo: &Memo) -> Result<Option<Uuid>, AppError> {
        let memo_tags: Vec<String> = serde_json::from_value(memo.tags.clone()).unwrap_or_default();

        let candidates = sqlx::query_as::<_, EpisodeCandidateRow>(
            "SELECT e.id, e.user_id, e.title, e.status, e.summary, e.keywords,
                    e.last_memo_id, e.start_at, e.end_at, e.updated_at,
                    CASE
                      WHEN eme.embedding IS NOT NULL AND me.embedding IS NOT NULL
                           THEN (eme.embedding <=> me.embedding)
                      ELSE NULL
                    END AS semantic_dist
             FROM memo_episodes e
             LEFT JOIN memo_embeddings me ON me.memo_id = $2
             LEFT JOIN memo_embeddings eme ON eme.memo_id = e.last_memo_id
             WHERE e.user_id = $1 AND e.status <> 'resolved'
             ORDER BY e.updated_at DESC
             LIMIT 10",
        )
        .bind(memo.user_id)
        .bind(memo.id)
        .fetch_all(&self.pool)
        .await
        .map_err(AppError::Database)?;

        let mut best_episode: Option<(&EpisodeCandidateRow, f64)> = None;

        for candidate in &candidates {
            let semantic = candidate
                .semantic_dist
                .map(|d| (1.0 - d).max(0.0))
                .unwrap_or(0.0);

            let age_ms = (memo.created_at - candidate.updated_at).max(0) as f64;
            let recency = (-age_ms / (14.0 * 86_400_000.0)).exp();

            let ep_keywords: Vec<String> =
                serde_json::from_value(candidate.keywords.clone()).unwrap_or_default();
            let keyword_match = if ep_keywords.is_empty() || memo_tags.is_empty() {
                0.0
            } else {
                let overlap = memo_tags.iter().filter(|t| ep_keywords.contains(t)).count();
                overlap as f64 / memo_tags.len().max(ep_keywords.len()) as f64
            };

            let tag_overlap = keyword_match;

            let score =
                0.35 * semantic + 0.25 * recency + 0.20 * keyword_match + 0.20 * tag_overlap;

            if score > EPISODE_THRESHOLD {
                if best_episode.is_none() || score > best_episode.unwrap().1 {
                    best_episode = Some((candidate, score));
                }
            }
        }

        let now = chrono::Utc::now().timestamp_millis();

        let (episode_id, relevance) = match best_episode {
            Some((episode, score)) => {
                let title = self.derive_episode_title(memo);
                let summary = self.build_episode_summary(memo, Some(episode));
                let merged_keywords = self.merge_keywords(&episode.keywords, &memo.tags);
                sqlx::query(
                    "UPDATE memo_episodes
                     SET title = $1, summary = $2, keywords = $3, last_memo_id = $4, end_at = $5, updated_at = $6
                     WHERE id = $7",
                )
                .bind(title)
                .bind(summary)
                .bind(merged_keywords)
                .bind(memo.id)
                .bind(memo.created_at)
                .bind(now)
                .bind(episode.id)
                .execute(&self.pool)
                .await
                .map_err(AppError::Database)?;
                (episode.id, score)
            }
            None => {
                let new_id = Uuid::new_v4();
                sqlx::query(
                    "INSERT INTO memo_episodes (id, user_id, title, status, summary, keywords, last_memo_id, start_at, end_at, updated_at)
                     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)",
                )
                .bind(new_id)
                .bind(memo.user_id)
                .bind(self.derive_episode_title(memo))
                .bind("ongoing")
                .bind(self.build_episode_summary(memo, None))
                .bind(memo.tags.clone())
                .bind(memo.id)
                .bind(memo.created_at)
                .bind(Some(memo.created_at))
                .bind(now)
                .execute(&self.pool)
                .await
                .map_err(AppError::Database)?;
                (new_id, 1.0)
            }
        };

        sqlx::query(
            "INSERT INTO memo_episode_links (episode_id, memo_id, event_at, relevance_score, created_at)
             VALUES ($1, $2, $3, $4, $5)
             ON CONFLICT (episode_id, memo_id) DO UPDATE
             SET event_at = EXCLUDED.event_at,
                 relevance_score = EXCLUDED.relevance_score",
        )
        .bind(episode_id)
        .bind(memo.id)
        .bind(memo.created_at)
        .bind(relevance)
        .bind(now)
        .execute(&self.pool)
        .await
        .map_err(AppError::Database)?;

        Ok(Some(episode_id))
    }

    fn merge_keywords(
        &self,
        existing: &serde_json::Value,
        new_tags: &serde_json::Value,
    ) -> serde_json::Value {
        let mut all: Vec<String> = serde_json::from_value(existing.clone()).unwrap_or_default();
        let new: Vec<String> = serde_json::from_value(new_tags.clone()).unwrap_or_default();
        for tag in new {
            if !all.contains(&tag) {
                all.push(tag);
            }
        }
        serde_json::json!(all)
    }

    fn derive_episode_title(&self, memo: &Memo) -> String {
        memo.ai_summary
            .clone()
            .filter(|s| !s.trim().is_empty())
            .map(|s| s.chars().take(40).collect())
            .unwrap_or_else(|| memo.content.chars().take(40).collect())
    }

    fn build_episode_summary(&self, memo: &Memo, previous: Option<&EpisodeCandidateRow>) -> String {
        let current = memo
            .ai_summary
            .clone()
            .unwrap_or_else(|| memo.content.chars().take(140).collect());

        match previous {
            Some(ep) if !ep.summary.trim().is_empty() => {
                let prev_summary: String = ep.summary.chars().take(300).collect();
                format!("{}\n最新进展：{}", prev_summary, current)
            }
            _ => current,
        }
    }

    pub async fn get_episode_links(&self, memo_id: Uuid) -> Result<Vec<MemoEpisodeLink>, AppError> {
        sqlx::query_as::<_, MemoEpisodeLink>(
            "SELECT episode_id, memo_id, event_at, relevance_score, created_at
             FROM memo_episode_links
             WHERE memo_id = $1
             ORDER BY event_at DESC",
        )
        .bind(memo_id)
        .fetch_all(&self.pool)
        .await
        .map_err(AppError::Database)
    }
}
