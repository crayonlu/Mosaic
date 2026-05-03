use crate::error::AppError;
use crate::models::{Diary, Memo};
use crate::services::ai_client::AiConfig;
use crate::services::{AiClient, AppSettingsService, ServerAiConfigService};
use crate::storage::traits::Storage;
use chrono::{DateTime, Datelike, Duration, NaiveDate, TimeZone, Utc};
use chrono_tz::Tz;
use serde::Deserialize;
use sqlx::PgPool;
use std::sync::Arc;
use uuid::Uuid;

const ALLOWED_MOOD_KEYS: &[&str] = &[
    "joy", "calm", "neutral", "sadness", "anxiety", "anger", "focus", "tired",
];
const AI_DIARY_JOB_BATCH_SIZE: i64 = 16;
const AI_DIARY_RETRY_DELAY_MS: i64 = 5 * 60 * 1000;
const AUTO_DIARY_ENABLED_KEY: &str = "auto_diary_enabled";
const AUTO_DIARY_MIN_MEMOS_KEY: &str = "auto_diary_min_memos";
const AUTO_DIARY_MIN_CHARS_KEY: &str = "auto_diary_min_chars";

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct AiDiaryPayload {
    pub summary: String,
    pub mood_key: String,
    pub mood_score: i32,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct RawAiDiaryPayload {
    summary: String,
    mood_key: String,
    mood_score: i32,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
enum DiaryJobOutcome {
    Generated,
    Skipped,
}

#[derive(Clone)]
pub struct AiDiaryService {
    pool: PgPool,
    storage: Arc<dyn Storage>,
    server_ai_config_service: ServerAiConfigService,
    ai_client: AiClient,
    app_settings_service: AppSettingsService,
}

impl AiDiaryService {
    pub fn new(
        pool: PgPool,
        storage: Arc<dyn Storage>,
        server_ai_config_service: ServerAiConfigService,
        ai_client: AiClient,
        app_settings_service: AppSettingsService,
    ) -> Self {
        Self {
            pool,
            storage,
            server_ai_config_service,
            ai_client,
            app_settings_service,
        }
    }

    pub fn spawn_job_sweeper(&self) {
        let service = self.clone();
        tokio::spawn(async move {
            let mut interval = tokio::time::interval(std::time::Duration::from_secs(60));
            loop {
                interval.tick().await;
                if let Err(error) = service.process_due_jobs().await {
                    log::error!("[AiDiary] process_due_jobs failed: {}", error);
                }
            }
        });
    }

    pub async fn queue_job_for_memo(&self, memo: &Memo) -> Result<(), AppError> {
        let tz = self.app_settings_service.get_tz().await;
        let target_date = date_from_timestamp(memo.created_at, tz);
        let run_after_ms = Self::compute_run_after_ms(target_date, tz);
        let now = chrono::Utc::now().timestamp_millis();

        sqlx::query(
            "INSERT INTO ai_diary_jobs (user_id, target_date, run_after_ms, status, last_error, created_at, updated_at)
             VALUES ($1, $2, $3, 'pending', NULL, $4, $4)
             ON CONFLICT (user_id, target_date)
             DO UPDATE SET run_after_ms = EXCLUDED.run_after_ms,
                           status = CASE WHEN ai_diary_jobs.status = 'completed' THEN ai_diary_jobs.status ELSE 'pending' END,
                           last_error = NULL,
                           updated_at = EXCLUDED.updated_at",
        )
        .bind(memo.user_id)
        .bind(target_date)
        .bind(run_after_ms)
        .bind(now)
        .execute(&self.pool)
        .await?;

        Ok(())
    }

    pub async fn process_due_jobs(&self) -> Result<(), AppError> {
        let now = chrono::Utc::now().timestamp_millis();
        let mut tx = self.pool.begin().await?;
        let jobs = sqlx::query_as::<_, (Uuid, NaiveDate)>(
            "WITH due AS (
                SELECT user_id, target_date
                FROM ai_diary_jobs
                WHERE status = 'pending' AND run_after_ms <= $1
                ORDER BY run_after_ms ASC
                LIMIT $2
                FOR UPDATE SKIP LOCKED
             )
             UPDATE ai_diary_jobs AS jobs
             SET status = 'running', updated_at = $1, last_error = NULL
             FROM due
             WHERE jobs.user_id = due.user_id AND jobs.target_date = due.target_date
             RETURNING jobs.user_id, jobs.target_date",
        )
        .bind(now)
        .bind(AI_DIARY_JOB_BATCH_SIZE)
        .fetch_all(&mut *tx)
        .await?;
        tx.commit().await?;

        for (user_id, target_date) in jobs {
            match self.run_job(user_id, target_date).await {
                Ok(_) => self.complete_job(user_id, target_date).await?,
                Err(error) => {
                    log::error!(
                        "[AiDiary] run_job failed user_id={} date={}: {}",
                        user_id,
                        target_date,
                        error
                    );
                    self.retry_job(user_id, target_date, &error.to_string())
                        .await?;
                }
            }
        }

        Ok(())
    }

    async fn run_job(
        &self,
        user_id: Uuid,
        target_date: NaiveDate,
    ) -> Result<DiaryJobOutcome, AppError> {
        if !self
            .app_settings_service
            .get_bool(AUTO_DIARY_ENABLED_KEY, true)
            .await
        {
            return Ok(DiaryJobOutcome::Skipped);
        }

        let min_memos = self
            .app_settings_service
            .get_i32(AUTO_DIARY_MIN_MEMOS_KEY, 2)
            .await
            .max(1) as usize;
        let min_chars = self
            .app_settings_service
            .get_i32(AUTO_DIARY_MIN_CHARS_KEY, 150)
            .await
            .max(1) as usize;

        let existing_diary = self.load_existing_diary(user_id, target_date).await?;
        if existing_diary
            .as_ref()
            .map(|diary| diary.auto_generation_locked)
            .unwrap_or(false)
        {
            return Ok(DiaryJobOutcome::Skipped);
        }

        let tz = self.app_settings_service.get_tz().await;
        let memos = self.load_candidate_memos(user_id, target_date, tz).await?;
        let total_chars: usize = memos.iter().map(|memo| memo.content.chars().count()).sum();
        if !Self::should_generate_diary(memos.len(), total_chars, min_memos, min_chars) {
            return Ok(DiaryJobOutcome::Skipped);
        }

        let config = self.server_ai_config_service.get("bot").await?;
        if config.api_key.trim().is_empty()
            || config.model.trim().is_empty()
            || config.base_url.trim().is_empty()
        {
            return Err(AppError::Processing(
                "AI diary generation requires a configured bot AI model".to_string(),
            ));
        }

        let system_prompt = build_diary_system_prompt();
        let prompt = build_diary_prompt(target_date, &memos, tz);
        let message = AiClient::build_user_message(&prompt, &[], &config.provider);
        let ai_reply = self
            .ai_client
            .send_ai_messages(
                &AiConfig {
                    provider: config.provider.clone(),
                    base_url: config.base_url.clone(),
                    api_key: config.api_key.clone(),
                    model: config.model.clone(),
                    max_tokens: config.max_tokens,
                },
                system_prompt,
                vec![message],
                None,
            )
            .await
            .map_err(|error| AppError::Processing(error.to_string()))?;

        let payload = Self::parse_ai_diary_payload(&ai_reply.content)?;
        self.persist_generated_diary(user_id, target_date, &memos, payload)
            .await?;

        Ok(DiaryJobOutcome::Generated)
    }

    async fn load_existing_diary(
        &self,
        user_id: Uuid,
        target_date: NaiveDate,
    ) -> Result<Option<Diary>, AppError> {
        sqlx::query_as::<_, Diary>(
            "SELECT date, user_id, summary, mood_key, mood_score,
                    generation_source, auto_generation_locked, generated_from_memo_ids,
                    last_auto_generated_at, created_at, updated_at
             FROM diaries
             WHERE user_id = $1 AND date = $2",
        )
        .bind(user_id)
        .bind(target_date)
        .fetch_optional(&self.pool)
        .await
        .map_err(AppError::Database)
    }

    async fn load_candidate_memos(
        &self,
        user_id: Uuid,
        target_date: NaiveDate,
        tz: Tz,
    ) -> Result<Vec<Memo>, AppError> {
        let (start_ms, end_ms) = day_bounds(target_date, tz);
        sqlx::query_as::<_, Memo>(
            "SELECT id, user_id, content, tags, is_archived, is_deleted, diary_date, ai_summary, created_at, updated_at
             FROM memos
             WHERE user_id = $1
               AND is_deleted = false
               AND is_archived = false
               AND created_at >= $2
               AND created_at < $3
             ORDER BY created_at ASC",
        )
        .bind(user_id)
        .bind(start_ms)
        .bind(end_ms)
        .fetch_all(&self.pool)
        .await
        .map_err(AppError::Database)
    }

    async fn persist_generated_diary(
        &self,
        user_id: Uuid,
        target_date: NaiveDate,
        memos: &[Memo],
        payload: AiDiaryPayload,
    ) -> Result<(), AppError> {
        let now = chrono::Utc::now().timestamp_millis();
        let memo_ids: Vec<Uuid> = memos.iter().map(|memo| memo.id).collect();
        let memo_ids_json = serde_json::to_value(&memo_ids)
            .map_err(|error| AppError::Internal(error.to_string()))?;

        let mut tx = self.pool.begin().await?;
        sqlx::query(
            "INSERT INTO diaries (
                date, user_id, summary, mood_key, mood_score,
                generation_source, auto_generation_locked, generated_from_memo_ids,
                last_auto_generated_at, created_at, updated_at
             )
             VALUES ($1, $2, $3, $4, $5, 'ai', false, $6, $7, $7, $7)
             ON CONFLICT (date)
             DO UPDATE SET summary = EXCLUDED.summary,
                           mood_key = EXCLUDED.mood_key,
                           mood_score = EXCLUDED.mood_score,
                           generation_source = 'ai',
                           auto_generation_locked = false,
                           generated_from_memo_ids = EXCLUDED.generated_from_memo_ids,
                           last_auto_generated_at = EXCLUDED.last_auto_generated_at,
                           updated_at = EXCLUDED.updated_at
             WHERE diaries.user_id = EXCLUDED.user_id AND diaries.auto_generation_locked = false",
        )
        .bind(target_date)
        .bind(user_id)
        .bind(&payload.summary)
        .bind(&payload.mood_key)
        .bind(payload.mood_score)
        .bind(memo_ids_json)
        .bind(now)
        .execute(&mut *tx)
        .await?;

        sqlx::query(
            "UPDATE memos
             SET is_archived = true, diary_date = $1, updated_at = $2
             WHERE user_id = $3 AND id = ANY($4) AND is_deleted = false AND is_archived = false",
        )
        .bind(target_date)
        .bind(now)
        .bind(user_id)
        .bind(&memo_ids)
        .execute(&mut *tx)
        .await?;

        tx.commit().await?;
        Ok(())
    }

    async fn complete_job(&self, user_id: Uuid, target_date: NaiveDate) -> Result<(), AppError> {
        let now = chrono::Utc::now().timestamp_millis();
        sqlx::query(
            "UPDATE ai_diary_jobs
             SET status = 'completed', last_error = NULL, updated_at = $3
             WHERE user_id = $1 AND target_date = $2",
        )
        .bind(user_id)
        .bind(target_date)
        .bind(now)
        .execute(&self.pool)
        .await?;
        Ok(())
    }

    async fn retry_job(
        &self,
        user_id: Uuid,
        target_date: NaiveDate,
        error_message: &str,
    ) -> Result<(), AppError> {
        let now = chrono::Utc::now().timestamp_millis();
        sqlx::query(
            "UPDATE ai_diary_jobs
             SET status = 'pending',
                 last_error = $3,
                 run_after_ms = $4,
                 updated_at = $5
             WHERE user_id = $1 AND target_date = $2",
        )
        .bind(user_id)
        .bind(target_date)
        .bind(truncate_error(error_message))
        .bind(now + AI_DIARY_RETRY_DELAY_MS)
        .bind(now)
        .execute(&self.pool)
        .await?;
        Ok(())
    }

    pub fn should_generate_diary(
        memo_count: usize,
        total_chars: usize,
        min_memos: usize,
        min_chars: usize,
    ) -> bool {
        memo_count >= min_memos && (total_chars >= min_chars || memo_count > min_memos)
    }

    pub fn compute_run_after_ms(target_date: NaiveDate, tz: Tz) -> i64 {
        let next_day = target_date + Duration::days(1);
        tz.with_ymd_and_hms(next_day.year(), next_day.month(), next_day.day(), 0, 5, 0)
            .single()
            .unwrap()
            .timestamp_millis()
    }

    pub fn parse_ai_diary_payload(raw: &str) -> Result<AiDiaryPayload, AppError> {
        let json_slice = extract_json_object(raw)?;
        let payload: RawAiDiaryPayload = serde_json::from_str(json_slice)
            .map_err(|e| AppError::InvalidInput(format!("invalid AI diary JSON: {}", e)))?;

        let summary = payload.summary.trim().to_string();
        if summary.is_empty() {
            return Err(AppError::InvalidInput(
                "AI diary summary cannot be empty".to_string(),
            ));
        }

        if !ALLOWED_MOOD_KEYS.contains(&payload.mood_key.as_str()) {
            return Err(AppError::InvalidInput(
                "invalid AI diary mood key".to_string(),
            ));
        }

        if !(1..=10).contains(&payload.mood_score) {
            return Err(AppError::InvalidInput(
                "invalid AI diary mood score".to_string(),
            ));
        }

        Ok(AiDiaryPayload {
            summary,
            mood_key: payload.mood_key,
            mood_score: payload.mood_score,
        })
    }
}

fn build_diary_system_prompt() -> String {
    format!(
        "You are an insightful personal diary assistant. The user provides their day's memos with timestamps so you can understand the emotional flow of their day — when energy shifted, how ideas developed, what led to what.\n\n\
         Your job: write a concise, reflective daily summary. The timestamps are for YOUR understanding, not for the reader.\n\n\
         Rules:\n\
         1. Identify 2-3 themes or emotional threads that run through the day. Do not list events chronologically.\n\
         2. Notice connections: which ideas built on each other? where did the mood shift? what seems unresolved?\n\
         3. Write with warmth and insight — like a thoughtful friend who read everything and noticed patterns the user might have missed.\n\
         4. Stay grounded in the memos. If there's not enough material for a meaningful summary, be honest rather than padding.\n\
         5. Keep it concise: 2-3 paragraphs is ideal. Quality over quantity.\n\n\
         Return only valid JSON with keys summary, moodKey, moodScore.\n\
         moodKey must be one of: {}.\n\
         moodScore must be an integer from 1 to 10.",
        ALLOWED_MOOD_KEYS.join(", ")
    )
}

fn build_diary_prompt(target_date: NaiveDate, memos: &[Memo], tz: Tz) -> String {
    let memo_lines = memos
        .iter()
        .map(|memo| {
            let time = time_label(memo.created_at, tz);
            let summary = memo
                .ai_summary
                .as_ref()
                .map(|text| format!("\nAI摘要: {}", text.trim()))
                .unwrap_or_default();
            format!("- [{}] {}{}", time, memo.content.trim(), summary)
        })
        .collect::<Vec<_>>()
        .join("\n\n");

    format!(
        "Target date: {}\n\nMemos (timestamps for context — understand the rhythm, but don't replay chronologically):\n{}\n\nWrite a theme-based daily summary. Return JSON only.",
        target_date, memo_lines
    )
}

fn extract_json_object(raw: &str) -> Result<&str, AppError> {
    let start = raw.find('{').ok_or_else(|| {
        AppError::InvalidInput("AI diary response missing JSON object".to_string())
    })?;
    let end = raw.rfind('}').map(|idx| idx + 1).ok_or_else(|| {
        AppError::InvalidInput("AI diary response missing JSON object".to_string())
    })?;

    if start >= end {
        return Err(AppError::InvalidInput(
            "AI diary response missing JSON object".to_string(),
        ));
    }

    Ok(&raw[start..end])
}

fn date_from_timestamp(ts_ms: i64, tz: Tz) -> NaiveDate {
    let ts_secs = ts_ms / 1000;
    DateTime::from_timestamp(ts_secs, 0)
        .map(|dt| dt.with_timezone(&tz).date_naive())
        .unwrap_or_else(|| Utc::now().with_timezone(&tz).date_naive())
}

fn day_bounds(target_date: NaiveDate, tz: Tz) -> (i64, i64) {
    let start = tz
        .with_ymd_and_hms(
            target_date.year(),
            target_date.month(),
            target_date.day(),
            0,
            0,
            0,
        )
        .single()
        .unwrap();
    let end = start + Duration::days(1);
    (start.timestamp_millis(), end.timestamp_millis())
}

fn time_label(ts_ms: i64, tz: Tz) -> String {
    let ts_secs = ts_ms / 1000;
    DateTime::from_timestamp(ts_secs, 0)
        .map(|dt| dt.with_timezone(&tz).format("%H:%M").to_string())
        .unwrap_or_else(|| "00:00".to_string())
}

fn truncate_text(value: &str, max_chars: usize) -> String {
    let mut text = String::new();
    for (idx, ch) in value.chars().enumerate() {
        if idx >= max_chars {
            text.push_str("...");
            break;
        }
        text.push(ch);
    }
    text
}

fn truncate_error(value: &str) -> String {
    truncate_text(value, 500)
}
