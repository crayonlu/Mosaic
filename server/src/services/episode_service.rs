use crate::error::AppError;
use crate::models::{Memo, MemoEpisodeLink};
use crate::services::ServerAiConfigService;
use reqwest::Client;
use serde_json::json;
use sqlx::PgPool;
use uuid::Uuid;

// Only attach a memo to an episode if the best-matching memo inside
// that episode has similarity >= this threshold.
const EPISODE_THRESHOLD: f64 = 0.50;

#[derive(Clone)]
pub struct EpisodeService {
    pool: PgPool,
    server_ai_config_service: Option<ServerAiConfigService>,
    client: Client,
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
        Self {
            pool,
            server_ai_config_service: None,
            client: Client::builder()
                .timeout(std::time::Duration::from_secs(30))
                .build()
                .unwrap_or_default(),
        }
    }

    pub fn with_server_ai_config_service(
        mut self,
        server_ai_config_service: ServerAiConfigService,
    ) -> Self {
        self.server_ai_config_service = Some(server_ai_config_service);
        self
    }

    pub async fn assign_memo_to_episode(&self, memo: &Memo) -> Result<Option<Uuid>, AppError> {
        let memo_tags: Vec<String> = serde_json::from_value(memo.tags.clone()).unwrap_or_default();

        // Compare the new memo against the 5 most recent memos in each episode.
        // MIN distance = best semantic match inside that episode.
        let candidates = sqlx::query_as::<_, EpisodeCandidateRow>(
            "SELECT e.id, e.user_id, e.title, e.status, e.summary, e.keywords,
                    e.last_memo_id, e.start_at, e.end_at, e.updated_at,
                    (
                      SELECT MIN(me2.embedding <=> me_anchor.embedding)
                      FROM (
                        SELECT el.memo_id FROM memo_episode_links el
                        WHERE el.episode_id = e.id
                        ORDER BY el.event_at DESC
                        LIMIT 5
                      ) AS recent
                      JOIN memo_embeddings me2 ON me2.memo_id = recent.memo_id
                      JOIN memo_embeddings me_anchor ON me_anchor.memo_id = $2
                      WHERE me2.embedding IS NOT NULL AND me_anchor.embedding IS NOT NULL
                    ) AS semantic_dist
             FROM memo_episodes e
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
            // semantic_dist is cosine distance; convert to similarity
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

            let score = 0.45 * semantic + 0.20 * recency + 0.35 * keyword_match;

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
                let summary = self
                    .build_episode_summary(memo, &episode.summary)
                    .await;
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
                let initial_summary = memo
                    .ai_summary
                    .clone()
                    .unwrap_or_else(|| memo.content.chars().take(140).collect());
                sqlx::query(
                    "INSERT INTO memo_episodes (id, user_id, title, status, summary, keywords, last_memo_id, start_at, end_at, updated_at)
                     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)",
                )
                .bind(new_id)
                .bind(memo.user_id)
                .bind(self.derive_episode_title(memo))
                .bind("ongoing")
                .bind(initial_summary)
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

    /// Generate a coherent narrative summary via LLM, falling back to
    /// a capped linear append if the LLM call fails.
    async fn build_episode_summary(&self, memo: &Memo, existing_summary: &str) -> String {
        let new_content = memo
            .ai_summary
            .clone()
            .unwrap_or_else(|| memo.content.chars().take(140).collect());

        if existing_summary.trim().is_empty() {
            return new_content;
        }

        if let Some(llm_summary) = self.summarize_with_llm(existing_summary, &new_content).await {
            return llm_summary;
        }

        self.build_summary_fallback(existing_summary, &new_content)
    }

    fn build_summary_fallback(&self, existing: &str, new_content: &str) -> String {
        let new_entry = format!(
            "最新进展：{}",
            new_content.chars().take(100).collect::<String>()
        );

        let lines: Vec<&str> = existing.lines().collect();
        let opening = lines
            .iter()
            .find(|l| !l.starts_with("最新进展："))
            .copied()
            .unwrap_or_else(|| lines.first().copied().unwrap_or(""));

        // Collect all progress lines, then keep only the last 5
        let all_progress: Vec<&str> = lines
            .iter()
            .copied()
            .filter(|l| l.starts_with("最新进展："))
            .collect();
        let skip = all_progress.len().saturating_sub(5);
        let recent_progress = &all_progress[skip..];

        let mut parts = Vec::new();
        if !opening.is_empty() {
            parts.push(opening.to_string());
        }
        parts.extend(recent_progress.iter().map(|s| s.to_string()));
        parts.push(new_entry);
        parts.join("\n")
    }

    async fn summarize_with_llm(
        &self,
        existing_summary: &str,
        new_content: &str,
    ) -> Option<String> {
        let config_service = self.server_ai_config_service.as_ref()?;
        let config = config_service.get("bot").await.ok()?;

        if config.api_key.trim().is_empty()
            || config.model.trim().is_empty()
            || config.base_url.trim().is_empty()
        {
            return None;
        }

        let base_url = config.base_url.trim_end_matches('/');
        let url = format!("{}/chat/completions", base_url);

        let system = "你是一个事件线摘要助手。根据当前事件线摘要和新的记录，\
            生成一段简洁连贯的中文叙述（不超过 150 字）。\
            保留核心主题和关键进展，用自然语言叙述，\
            不要使用「最新进展」等格式词，直接描述发生了什么。";
        let user = format!(
            "当前摘要：\n{}\n\n新记录：\n{}",
            existing_summary.chars().take(400).collect::<String>(),
            new_content.chars().take(200).collect::<String>()
        );

        let response = self
            .client
            .post(&url)
            .header("Authorization", format!("Bearer {}", config.api_key))
            .json(&json!({
                "model": config.model,
                "messages": [
                    {"role": "system", "content": system},
                    {"role": "user", "content": user}
                ],
                "max_tokens": 300,
                "temperature": 0.3
            }))
            .send()
            .await
            .ok()?;

        if !response.status().is_success() {
            log::warn!(
                "[EpisodeService] LLM summarization failed: {}",
                response.status()
            );
            return None;
        }

        let payload: serde_json::Value = response.json().await.ok()?;
        let summary = payload["choices"][0]["message"]["content"]
            .as_str()?
            .trim()
            .to_string();

        if summary.is_empty() {
            None
        } else {
            Some(summary)
        }
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
        json!(all)
    }

    fn derive_episode_title(&self, memo: &Memo) -> String {
        memo.ai_summary
            .clone()
            .filter(|s| !s.trim().is_empty())
            .map(|s| s.chars().take(40).collect())
            .unwrap_or_else(|| memo.content.chars().take(40).collect())
    }

    /// Re-generate LLM summaries for all non-resolved episodes by replaying their memo history.
    pub async fn regenerate_all_episode_summaries(&self) -> Result<(u32, u32), AppError> {
        #[derive(sqlx::FromRow)]
        struct EpisodeRow {
            id: Uuid,
        }

        let episodes = sqlx::query_as::<_, EpisodeRow>(
            "SELECT id FROM memo_episodes WHERE status <> 'resolved' ORDER BY updated_at DESC",
        )
        .fetch_all(&self.pool)
        .await
        .map_err(AppError::Database)?;

        let mut ok = 0u32;
        let mut failed = 0u32;

        for ep in &episodes {
            match self.regenerate_episode_summary(ep.id).await {
                Ok(_) => ok += 1,
                Err(e) => {
                    log::error!("[EpisodeService] Summary regen failed for {}: {}", ep.id, e);
                    failed += 1;
                }
            }
        }

        Ok((ok, failed))
    }

    async fn regenerate_episode_summary(&self, episode_id: Uuid) -> Result<(), AppError> {
        #[derive(sqlx::FromRow)]
        struct MemoSummaryRow {
            ai_summary: Option<String>,
            content: String,
        }

        let memos = sqlx::query_as::<_, MemoSummaryRow>(
            "SELECT m.ai_summary, m.content
             FROM memo_episode_links el
             JOIN memos m ON m.id = el.memo_id
             WHERE el.episode_id = $1 AND m.is_deleted = false
             ORDER BY el.event_at ASC",
        )
        .bind(episode_id)
        .fetch_all(&self.pool)
        .await
        .map_err(AppError::Database)?;

        if memos.is_empty() {
            return Ok(());
        }

        // Replay in pairs: summarize incrementally
        let mut running_summary = String::new();
        for memo in &memos {
            let new_content = memo
                .ai_summary
                .clone()
                .filter(|s| !s.trim().is_empty())
                .unwrap_or_else(|| memo.content.chars().take(140).collect());

            if running_summary.is_empty() {
                running_summary = new_content;
                continue;
            }

            if let Some(llm) = self.summarize_with_llm(&running_summary, &new_content).await {
                running_summary = llm;
            } else {
                running_summary = self.build_summary_fallback(&running_summary, &new_content);
            }
        }

        sqlx::query("UPDATE memo_episodes SET summary = $1 WHERE id = $2")
            .bind(&running_summary)
            .bind(episode_id)
            .execute(&self.pool)
            .await
            .map_err(AppError::Database)?;

        log::info!(
            "[EpisodeService] Regenerated summary for episode {}: {} chars",
            episode_id,
            running_summary.len()
        );

        Ok(())
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
