use crate::error::AppError;
use crate::models::{
    AnchorMemoContext, BotMemoryContext, BotMemoryDebugContext, DiaryMemoryContext, EpisodeContext,
    Memo, MemoEpisode, UserMemoryProfile,
};
use crate::services::{EpisodeService, MemoryRetrievalService, TimelineMemoryService};
use sqlx::PgPool;
use uuid::Uuid;

#[derive(Clone)]
pub struct BotMemoryContextService {
    pool: PgPool,
    episode_service: EpisodeService,
    retrieval_service: MemoryRetrievalService,
    timeline_service: TimelineMemoryService,
}

impl BotMemoryContextService {
    pub fn new(
        pool: PgPool,
        episode_service: EpisodeService,
        retrieval_service: MemoryRetrievalService,
        timeline_service: TimelineMemoryService,
    ) -> Self {
        Self {
            pool,
            episode_service,
            retrieval_service,
            timeline_service,
        }
    }

    pub async fn build_for_memo(
        &self,
        memo: &Memo,
        thread_context: Vec<serde_json::Value>,
        bot_id: Option<Uuid>,
    ) -> Result<BotMemoryContext, AppError> {
        let anchor_memo = AnchorMemoContext {
            memo_id: memo.id,
            content: memo.content.clone(),
            ai_summary: memo.ai_summary.clone(),
            tags: serde_json::from_value(memo.tags.clone()).unwrap_or_default(),
            created_at: memo.created_at,
        };

        let diary_context = self.load_diary_context(memo).await?;
        let related_memos = self
            .retrieval_service
            .retrieve_related_memos(memo.user_id, memo, 6)
            .await?;
        let selected_episode = self.load_selected_episode(memo.id).await?;
        let timeline_summary = self.timeline_service.build_summary(&related_memos);
        let profile_summary = self.load_profile_summary(memo.user_id).await?;
        let selected_episode_id = selected_episode.as_ref().map(|episode| episode.episode_id);

        let estimated_chars = profile_summary.as_ref().map_or(0, |s| s.len())
            + selected_episode.as_ref().map_or(0, |e| e.summary.len())
            + timeline_summary.as_ref().map_or(0, |s| s.len())
            + related_memos
                .iter()
                .map(|m| m.summary_excerpt.len() + 4)
                .sum::<usize>();

        let debug = BotMemoryDebugContext {
            candidate_count: related_memos.len(),
            retrieved_memo_ids: related_memos.iter().map(|memo| memo.memo_id).collect(),
            selected_episode_id,
            prompt_chars: estimated_chars,
        };

        self.persist_debug_log(
            memo.user_id,
            memo.id,
            bot_id,
            selected_episode_id,
            &related_memos,
            &debug,
        )
        .await?;

        Ok(BotMemoryContext {
            anchor_memo,
            diary_context,
            thread_context,
            related_memos: related_memos.clone(),
            selected_episode,
            timeline_summary,
            profile_summary,
            debug,
        })
    }

    async fn load_diary_context(
        &self,
        memo: &Memo,
    ) -> Result<Option<DiaryMemoryContext>, AppError> {
        let diary = if let Some(date) = memo.diary_date {
            sqlx::query_as::<_, (chrono::NaiveDate, String, String, i32)>(
                "SELECT date, summary, mood_key, mood_score
                 FROM diaries
                 WHERE user_id = $1 AND date = $2",
            )
            .bind(memo.user_id)
            .bind(date)
            .fetch_optional(&self.pool)
            .await
            .map_err(AppError::Database)?
        } else {
            None
        };

        Ok(diary.map(|row| DiaryMemoryContext {
            date: row.0,
            summary: row.1,
            mood_key: row.2,
            mood_score: row.3,
        }))
    }

    async fn load_selected_episode(
        &self,
        memo_id: Uuid,
    ) -> Result<Option<EpisodeContext>, AppError> {
        let links = self.episode_service.get_episode_links(memo_id).await?;
        let Some(link) = links.first() else {
            return Ok(None);
        };

        let episode = sqlx::query_as::<_, MemoEpisode>(
            "SELECT id, user_id, title, status, summary, keywords, last_memo_id, start_at, end_at, updated_at
             FROM memo_episodes
             WHERE id = $1",
        )
        .bind(link.episode_id)
        .fetch_optional(&self.pool)
        .await
        .map_err(AppError::Database)?;

        Ok(episode.map(|episode| EpisodeContext {
            episode_id: episode.id,
            title: episode.title,
            status: episode.status,
            summary: episode.summary,
            keywords: serde_json::from_value(episode.keywords).unwrap_or_default(),
            start_at: episode.start_at,
            end_at: episode.end_at,
        }))
    }

    async fn load_profile_summary(&self, user_id: Uuid) -> Result<Option<String>, AppError> {
        let profile = sqlx::query_as::<_, UserMemoryProfile>(
            "SELECT user_id, profile_summary, topic_signals, mood_patterns, updated_at
             FROM user_memory_profiles
             WHERE user_id = $1",
        )
        .bind(user_id)
        .fetch_optional(&self.pool)
        .await
        .map_err(AppError::Database)?;

        Ok(profile.and_then(|profile| {
            if profile.profile_summary.trim().is_empty() {
                None
            } else {
                Some(profile.profile_summary)
            }
        }))
    }

    async fn persist_debug_log(
        &self,
        user_id: Uuid,
        memo_id: Uuid,
        bot_id: Option<Uuid>,
        selected_episode_id: Option<Uuid>,
        related_memos: &[crate::models::RelatedMemoContext],
        debug: &BotMemoryDebugContext,
    ) -> Result<(), AppError> {
        sqlx::query(
            "INSERT INTO bot_memory_debug_logs
             (id, user_id, memo_id, bot_id, mode, retrieved_memo_ids, selected_episode_ids, score_payload, prompt_size, created_at)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)",
        )
        .bind(Uuid::new_v4())
        .bind(user_id)
        .bind(memo_id)
        .bind(bot_id.unwrap_or(Uuid::nil()))
        .bind("context_build")
        .bind(serde_json::json!(debug.retrieved_memo_ids))
        .bind(serde_json::json!(selected_episode_id.into_iter().collect::<Vec<_>>()))
        .bind(serde_json::json!(related_memos.iter().map(|memo| {
            serde_json::json!({
                "memoId": memo.memo_id,
                "score": memo.relevance_score,
                "reason": memo.reason,
            })
        }).collect::<Vec<_>>()))
        .bind(debug.prompt_chars as i32)
        .bind(chrono::Utc::now().timestamp_millis())
        .execute(&self.pool)
        .await
        .map_err(AppError::Database)?;

        Ok(())
    }
}
