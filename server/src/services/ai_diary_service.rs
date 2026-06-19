use crate::error::AppError;
use crate::models::{Diary, Memo, Resource};
use crate::services::ai_client::{AiConfig, AiImageInput};
use crate::services::bot_service::is_supported_ai_image_resource;
use crate::services::{AiClient, AppSettingsService, ServerAiConfigService, UserAiConfigService};
use crate::storage::traits::Storage;
use chrono::{DateTime, Datelike, Duration, NaiveDate, TimeZone, Utc};
use chrono_tz::Tz;
use serde::Deserialize;
use sqlx::PgPool;
use std::collections::HashMap;
use std::sync::Arc;
use uuid::Uuid;

const ALLOWED_MOOD_KEYS: &[&str] = &[
    "joy", "calm", "neutral", "sadness", "anxiety", "anger", "focus", "tired",
];
const AI_DIARY_JOB_BATCH_SIZE: i64 = 16;
const AI_DIARY_RETRY_DELAY_MS: i64 = 5 * 60 * 1000;
const AUTO_DIARY_ENABLED_KEY: &str = "auto_diary_enabled";
const AUTO_DIARY_MIN_MEMOS_KEY: &str = "auto_diary_min_memos";
const MAX_DIARY_IMAGES_PER_MEMO: usize = 2;
const MAX_DIARY_IMAGES_TOTAL: usize = 6;
const AUTO_DIARY_MIN_CHARS_KEY: &str = "auto_diary_min_chars";

/// An image that couldn't be sent inline due to budget limits.
/// Carries an optional stored AI description — when present, the diary service
/// uses it directly instead of calling the vision model on-demand.
#[derive(Debug, Clone)]
struct OverflowImage {
    memo_id: Uuid,
    storage_path: String,
    mime_type: String,
    filename: String,
    ai_description: Option<String>,
}

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
    #[allow(dead_code)]
    storage: Arc<dyn Storage>,
    server_ai_config_service: ServerAiConfigService,
    user_ai_config_service: Option<UserAiConfigService>,
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
            user_ai_config_service: None,
            ai_client,
            app_settings_service,
        }
    }

    pub fn with_user_ai_config_service(
        mut self,
        user_ai_config_service: UserAiConfigService,
    ) -> Self {
        self.user_ai_config_service = Some(user_ai_config_service);
        self
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

        let config = if let Some(svc) = &self.user_ai_config_service {
            let user_cfg = svc.get(&user_id).await?.ok_or(AppError::Processing(
                "AI diary generation requires a configured AI model".to_string(),
            ))?;
            crate::models::ServerAiConfig {
                key: "bot".to_string(),
                provider: user_cfg.provider,
                base_url: user_cfg.base_url,
                api_key: user_cfg.api_key,
                model: user_cfg.model,
                temperature: user_cfg.temperature,
                max_tokens: user_cfg.max_tokens,
                timeout_seconds: user_cfg.timeout_seconds,
                supports_vision: user_cfg.supports_vision,
                supports_thinking: user_cfg.supports_thinking,
                embedding_dim: None,
                updated_at: user_cfg.updated_at,
            }
        } else {
            self.server_ai_config_service.get("bot").await?
        };
        if config.api_key.trim().is_empty()
            || config.model.trim().is_empty()
            || config.base_url.trim().is_empty()
        {
            return Err(AppError::Processing(
                "AI diary generation requires a configured bot AI model".to_string(),
            ));
        }

        let ai_config = AiConfig {
            provider: config.provider.clone(),
            base_url: config.base_url.clone(),
            api_key: config.api_key.clone(),
            model: config.model.clone(),
            max_tokens: config.max_tokens,
        };

        // Load memo images: inline (sent as image blocks) + overflow (described as text)
        // inline_descriptions: stored ai_description from inline resources (used when vision off)
        let (inline_images, overflow_images, inline_descriptions) = self
            .load_diary_memo_images(&memos)
            .await
            .unwrap_or_else(|e| {
                log::warn!("[AiDiary] Failed to load memo images: {}", e);
                (HashMap::new(), vec![], HashMap::new())
            });

        // Build overflow descriptions: prefer stored ai_description, fall back to on-demand AI
        let mut overflow_descriptions: HashMap<Uuid, Vec<String>> = HashMap::new();
        let mut needs_ai: Vec<OverflowImage> = Vec::new();

        for img in overflow_images {
            if let Some(desc) = img.ai_description {
                overflow_descriptions
                    .entry(img.memo_id)
                    .or_default()
                    .push(desc);
            } else {
                needs_ai.push(img);
            }
        }

        // When vision is unavailable, merge inline descriptions as text context too
        if !config.supports_vision {
            for (memo_id, descs) in inline_descriptions {
                overflow_descriptions
                    .entry(memo_id)
                    .or_default()
                    .extend(descs);
            }
        }

        if config.supports_vision && !needs_ai.is_empty() {
            let ai_descriptions = self.describe_overflow_images(&ai_config, &needs_ai).await;
            for (memo_id, descs) in ai_descriptions {
                overflow_descriptions
                    .entry(memo_id)
                    .or_default()
                    .extend(descs);
            }
        }

        // Build per-memo messages: each memo gets its own user message with its inline images
        let messages = build_diary_messages(
            target_date,
            &memos,
            tz,
            &inline_images,
            &overflow_descriptions,
            &config.provider,
            config.supports_vision,
        );

        let system_prompt = build_diary_system_prompt();
        let ai_reply = self
            .ai_client
            .send_ai_messages(&ai_config, system_prompt, messages, None)
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
            "SELECT id, user_id, content, tags, is_archived, is_deleted, diary_date, ai_summary, created_at, updated_at, revision_count
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

    /// Loads image resources for all candidate memos, splitting into inline and overflow.
    ///
    /// Returns:
    /// - `inline_images`: downloaded image data, keyed by memo_id (for vision-capable providers)
    /// - `overflow_images`: resources that exceeded budget or failed inline download
    /// - `inline_descriptions`: stored ai_description from inline resources (used as text
    ///    context when vision is unavailable)
    async fn load_diary_memo_images(
        &self,
        memos: &[Memo],
    ) -> Result<
        (
            HashMap<Uuid, Vec<AiImageInput>>,
            Vec<OverflowImage>,
            HashMap<Uuid, Vec<String>>,
        ),
        AppError,
    > {
        if memos.is_empty() {
            return Ok((HashMap::new(), vec![], HashMap::new()));
        }

        let memo_ids: Vec<Uuid> = memos.iter().map(|m| m.id).collect();

        // Batch-load image resources for all memos with user ownership verification
        let resources = sqlx::query_as::<_, Resource>(
            "SELECT r.id, r.memo_id, r.user_id, r.filename, r.resource_type, r.mime_type, \
             r.file_size, r.storage_type, r.storage_path, r.metadata, r.is_deleted, \
             r.ai_description, r.created_at, r.updated_at
             FROM resources r
             JOIN memos m ON m.id = r.memo_id
             WHERE r.memo_id = ANY($1) AND r.resource_type = 'image' AND r.is_deleted = FALSE
             ORDER BY r.created_at ASC",
        )
        .bind(&memo_ids)
        .fetch_all(&self.pool)
        .await
        .map_err(AppError::Database)?;

        // Separate into inline (fits budget) and overflow (exceeds budget)
        let mut inline_resources: HashMap<Uuid, Vec<&Resource>> = HashMap::new();
        let mut overflow_resources: Vec<&Resource> = Vec::new();
        let mut total_inline = 0usize;

        for memo in memos {
            // Collect this memo's resources in original order
            let memo_resources: Vec<&Resource> = resources
                .iter()
                .filter(|r| r.memo_id == Some(memo.id))
                .collect();

            let mut memo_inline_count = 0usize;
            for resource in memo_resources {
                if memo_inline_count < MAX_DIARY_IMAGES_PER_MEMO
                    && total_inline < MAX_DIARY_IMAGES_TOTAL
                {
                    inline_resources.entry(memo.id).or_default().push(resource);
                    memo_inline_count += 1;
                    total_inline += 1;
                } else {
                    overflow_resources.push(resource);
                }
            }
        }

        // Download inline images from storage.
        // Resources that fail download or format checks are promoted to overflow
        // if they carry a stored ai_description — the text is still useful context.
        // Successful inline images' descriptions are also collected so they can
        // be used as text fallback when the provider lacks vision support.
        let mut promoted_to_overflow: Vec<&Resource> = Vec::new();
        let mut inline_images: HashMap<Uuid, Vec<AiImageInput>> = HashMap::new();
        let mut inline_descriptions: HashMap<Uuid, Vec<String>> = HashMap::new();
        for (memo_id, res_list) in &inline_resources {
            let mut images = Vec::with_capacity(res_list.len());
            for resource in res_list {
                // Collect stored description regardless of whether the image
                // can be sent inline — text context always works.
                if let Some(ref desc) = resource.ai_description {
                    inline_descriptions
                        .entry(*memo_id)
                        .or_default()
                        .push(desc.clone());
                }

                if !is_supported_ai_image_resource(resource) {
                    if resource.ai_description.is_some() {
                        promoted_to_overflow.push(resource);
                    }
                    continue;
                }
                match self.storage.download(&resource.storage_path).await {
                    Ok(data) => {
                        images.push(AiImageInput {
                            mime_type: resource.mime_type.clone(),
                            data: data.to_vec(),
                        });
                    }
                    Err(e) => {
                        log::warn!(
                            "[AiDiary] Failed to download inline image {} for memo {:?}: {}",
                            resource.id,
                            resource.memo_id,
                            e
                        );
                        if resource.ai_description.is_some() {
                            promoted_to_overflow.push(resource);
                        }
                    }
                }
            }
            if !images.is_empty() {
                inline_images.insert(*memo_id, images);
            }
        }
        // Build overflow list — include any resource that can contribute context:
        //   • Has stored ai_description → used directly (no AI call needed)
        //   • No description but format is AI-compatible → will get on-demand description
        //   • Neither → dropped (nothing to say)
        let overflow: Vec<OverflowImage> = overflow_resources
            .iter()
            .chain(promoted_to_overflow.iter())
            .filter(|r| r.ai_description.is_some() || is_supported_ai_image_resource(r))
            .map(|r| OverflowImage {
                memo_id: r.memo_id.unwrap_or_default(),
                storage_path: r.storage_path.clone(),
                mime_type: r.mime_type.clone(),
                filename: r.filename.clone(),
                ai_description: r.ai_description.clone(),
            })
            .collect();

        Ok((inline_images, overflow, inline_descriptions))
    }

    /// Downloads an overflow image from storage and asks the AI to describe it
    /// in 1-2 sentences.  Falls back to the filename on any failure.
    async fn describe_image(&self, config: &AiConfig, image: &OverflowImage) -> String {
        let data = match self.storage.download(&image.storage_path).await {
            Ok(d) => d,
            Err(e) => {
                log::warn!(
                    "[AiDiary] Failed to download overflow image {}: {}",
                    image.storage_path,
                    e
                );
                return format!("{} (image could not be downloaded)", image.filename);
            }
        };

        let ai_image = AiImageInput {
            mime_type: image.mime_type.clone(),
            data: data.to_vec(),
        };

        let prompt = "Describe this image in 1-2 sentences. \
            Focus on visible content and its likely context for a personal journal. \
            Be concise and objective.";

        let message = AiClient::build_user_message(prompt, &[ai_image], &config.provider);

        match self
            .ai_client
            .send_ai_messages(config, String::new(), vec![message], None)
            .await
        {
            Ok(reply) => {
                let desc = reply.content.trim().to_string();
                if desc.is_empty() {
                    format!("{} (no description produced)", image.filename)
                } else {
                    desc
                }
            }
            Err(e) => {
                log::warn!(
                    "[AiDiary] Failed to describe overflow image {}: {}",
                    image.storage_path,
                    e
                );
                format!("{} (image could not be described)", image.filename)
            }
        }
    }

    /// Describes all overflow images in parallel, grouping results by memo_id.
    /// Each image gets a separate vision call; failures fall back to filename-only.
    async fn describe_overflow_images(
        &self,
        config: &AiConfig,
        images: &[OverflowImage],
    ) -> HashMap<Uuid, Vec<String>> {
        let mut handles = Vec::with_capacity(images.len());
        for img in images {
            let memo_id = img.memo_id;
            let service = self.clone();
            let img = img.clone();
            let cfg = AiConfig {
                provider: config.provider.clone(),
                base_url: config.base_url.clone(),
                api_key: config.api_key.clone(),
                model: config.model.clone(),
                max_tokens: config.max_tokens,
            };
            handles.push(tokio::spawn(async move {
                let desc = service.describe_image(&cfg, &img).await;
                (memo_id, desc)
            }));
        }

        let mut map: HashMap<Uuid, Vec<String>> = HashMap::new();
        for handle in handles {
            match handle.await {
                Ok((memo_id, desc)) => {
                    map.entry(memo_id).or_default().push(desc);
                }
                Err(e) => {
                    log::warn!("[AiDiary] Overflow description task panicked: {}", e);
                }
            }
        }
        map
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
            .latest()
            .expect("invalid timezone transition for diary run time")
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
         CRITICAL RULE — Never violate: Write your response in the SAME LANGUAGE as the user's memos. If memos are in Chinese, write in Chinese. If in Japanese, write in Japanese. And so on.\n\n\
         Each memo is a separate message. Memo images are shown inline with their memo. When image limits were exceeded, text descriptions are substituted — treat these as equivalent context for the memo they accompany.\n\n\
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

/// Builds one user message per memo, each with its own inline images attached.
/// Overflow image descriptions are appended as text context to the corresponding memo.
fn build_diary_messages(
    target_date: NaiveDate,
    memos: &[Memo],
    tz: Tz,
    inline_images: &HashMap<Uuid, Vec<AiImageInput>>,
    overflow_descriptions: &HashMap<Uuid, Vec<String>>,
    provider: &str,
    supports_vision: bool,
) -> Vec<serde_json::Value> {
    let mut messages = Vec::with_capacity(memos.len() + 1);

    // Preamble: target date and instructions
    messages.push(serde_json::json!({
        "role": "user",
        "content": format!(
            "Target date: {}. Below are the day's memos, one per message. \
             Each may include inline images or text descriptions of images. \
             Write a theme-based daily summary. Return JSON only.",
            target_date
        )
    }));

    for memo in memos {
        let time = time_label(memo.created_at, tz);
        let summary = memo
            .ai_summary
            .as_ref()
            .map(|text| format!("\nAI Summary: {}", text.trim()))
            .unwrap_or_default();

        let mut text = format!("[{}] {}{}", time, memo.content.trim(), summary);

        // Append overflow image descriptions as text context
        if let Some(descs) = overflow_descriptions.get(&memo.id) {
            if !descs.is_empty() {
                text.push_str("\n[Additional image context:");
                for desc in descs {
                    text.push_str(&format!("\n • {}", desc));
                }
                text.push(']');
            }
        }

        // Get inline images for this memo
        let images = if supports_vision {
            inline_images
                .get(&memo.id)
                .map(|v| v.as_slice())
                .unwrap_or(&[])
        } else {
            &[]
        };

        messages.push(AiClient::build_user_message(&text, images, provider));
    }

    messages
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
        .latest()
        .expect("invalid timezone transition for diary bounds");
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
