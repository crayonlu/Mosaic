use super::ai_client::build_ai_system_prompt;
use crate::error::AppError;
use crate::models::{
    CreateMemoRequest, Memo, MemoResourceResponse as ResourceResponse, MemoRevision,
    MemoRevisionResponse, MemoWithResources, PaginatedResponse, Resource, TagResponse,
    UpdateMemoRequest,
};
use crate::services::{
    AiClient, AiDiaryService, AppSettingsService, BotService, MemoryEmbeddingService,
    ServerAiConfigService, UserAiConfigService,
};
use chrono::{Datelike, NaiveDate, TimeZone, Utc};
use chrono_tz::Tz;
use serde_json::json;
use sqlx::PgPool;
use std::time::Duration;
use uuid::Uuid;

use crate::services::retry::with_retry;

#[derive(Clone)]
pub struct MemoService {
    pool: PgPool,
    memory_embedding_service: Option<MemoryEmbeddingService>,
    bot_service: Option<BotService>,
    server_ai_config_service: Option<ServerAiConfigService>,
    user_ai_config_service: Option<UserAiConfigService>,
    ai_client: Option<AiClient>,
    app_settings_service: Option<AppSettingsService>,
    ai_diary_service: Option<AiDiaryService>,
}

impl MemoService {
    pub fn new(pool: PgPool) -> Self {
        Self {
            pool,
            memory_embedding_service: None,
            bot_service: None,
            server_ai_config_service: None,
            user_ai_config_service: None,
            ai_client: None,
            app_settings_service: None,
            ai_diary_service: None,
        }
    }

    pub fn with_memory_services(
        mut self,
        memory_embedding_service: MemoryEmbeddingService,
    ) -> Self {
        self.memory_embedding_service = Some(memory_embedding_service);
        self
    }

    pub fn with_bot_service(mut self, bot_service: BotService) -> Self {
        self.bot_service = Some(bot_service);
        self
    }

    pub fn with_server_ai_config_service(
        mut self,
        server_ai_config_service: ServerAiConfigService,
    ) -> Self {
        self.server_ai_config_service = Some(server_ai_config_service);
        self
    }

    pub fn with_user_ai_config_service(
        mut self,
        user_ai_config_service: UserAiConfigService,
    ) -> Self {
        self.user_ai_config_service = Some(user_ai_config_service);
        self
    }

    pub fn with_ai_client(mut self, ai_client: AiClient) -> Self {
        self.ai_client = Some(ai_client);
        self
    }

    pub fn with_app_settings_service(mut self, app_settings_service: AppSettingsService) -> Self {
        self.app_settings_service = Some(app_settings_service);
        self
    }

    pub fn with_ai_diary_service(mut self, ai_diary_service: AiDiaryService) -> Self {
        self.ai_diary_service = Some(ai_diary_service);
        self
    }

    pub async fn create_memo(
        &self,
        user_id: &str,
        req: CreateMemoRequest,
    ) -> Result<MemoWithResources, AppError> {
        let content_preview = if req.content.len() <= 50 {
            req.content.clone()
        } else {
            let mut end_idx = 50;
            while end_idx > 0 && !req.content.is_char_boundary(end_idx) {
                end_idx -= 1;
            }
            format!("{}...", &req.content[..end_idx])
        };

        log::info!(
            "[MemoService] Creating memo for user: {}, content: {}, tags: {:?}, resource_ids: {:?}",
            user_id,
            content_preview,
            req.tags,
            req.resource_ids
        );

        let user_uuid = Uuid::parse_str(user_id).map_err(|e| {
            log::error!("[MemoService] Invalid user_id format: {}", e);
            AppError::InvalidInput(format!("Invalid user_id format: {}", e))
        })?;
        log::debug!("[MemoService] User UUID: {}", user_uuid);

        let tags_json = json!(req.tags);
        let now = Utc::now().timestamp_millis();

        let memo_id = Uuid::new_v4();
        // Atomically insert memo + initial revision so they can never diverge.
        let mut tx = self.pool.begin().await.map_err(AppError::Database)?;
        let memo = sqlx::query_as::<_, Memo>(
            "INSERT INTO memos (id, user_id, content, tags, is_archived, is_deleted, diary_date, ai_summary, created_at, updated_at, revision_count)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, 1)
             RETURNING id, user_id, content, tags, is_archived, is_deleted, diary_date, ai_summary, created_at, updated_at, revision_count",
        )
        .bind(memo_id)
        .bind(user_uuid)
        .bind(&req.content)
        .bind(&tags_json)
        .bind(false)
        .bind(false)
        .bind(req.diary_date)
        .bind(&req.ai_summary)
        .bind(now)
        .bind(now)
        .fetch_one(&mut *tx)
        .await
        .map_err(|e| {
            log::error!("[MemoService] Failed to insert memo: {}", e);
            AppError::Database(e)
        })?;
        log::info!("[MemoService] Memo created with ID: {}", memo.id);

        sqlx::query(
            "INSERT INTO memo_revisions (id, memo_id, user_id, revision_number, content, tags, ai_summary, is_deleted, created_at)
             VALUES ($1, $2, $3, 1, $4, $5, $6, false, $7)",
        )
        .bind(Uuid::new_v4())
        .bind(memo.id)
        .bind(user_uuid)
        .bind(&req.content)
        .bind(&tags_json)
        .bind(&req.ai_summary)
        .bind(now)
        .execute(&mut *tx)
        .await
        .map_err(|e| {
            log::error!("[MemoService] Failed to insert initial revision for memo {}: {}", memo.id, e);
            AppError::Database(e)
        })?;
        tx.commit().await.map_err(AppError::Database)?;

        // Update resources with the new memo_id if resource_ids are provided
        if !req.resource_ids.is_empty() {
            log::info!(
                "[MemoService] Associating {} resources with memo {}",
                req.resource_ids.len(),
                memo.id
            );
            for resource_id_str in &req.resource_ids {
                let resource_uuid = match Uuid::parse_str(resource_id_str) {
                    Ok(uuid) => uuid,
                    Err(e) => {
                        log::warn!(
                            "[MemoService] Invalid resource_id format: {} - {}",
                            resource_id_str,
                            e
                        );
                        continue;
                    }
                };
                log::debug!(
                    "[MemoService] Updating resource {} with memo_id {}",
                    resource_uuid,
                    memo.id
                );
                if let Err(e) = sqlx::query(
                    "UPDATE resources SET memo_id = $1 WHERE id = $2 AND memo_id IS NULL",
                )
                .bind(memo.id)
                .bind(resource_uuid)
                .execute(&self.pool)
                .await
                {
                    log::warn!(
                        "[MemoService] Failed to update resource {} with memo_id {}: {}",
                        resource_uuid,
                        memo.id,
                        e
                    );
                } else {
                    log::info!(
                        "[MemoService] Successfully associated resource {} with memo {}",
                        resource_uuid,
                        memo.id
                    );
                }
            }
        } else {
            log::debug!("[MemoService] No resource_ids to associate");
        }

        let resources = self.get_memo_resources(memo.id).await?;
        log::info!(
            "[MemoService] Memo {} has {} resources",
            memo.id,
            resources.len()
        );

        self.spawn_memory_refresh(memo.clone(), true);

        if let Some(ai_diary_service) = &self.ai_diary_service {
            if let Err(error) = ai_diary_service.queue_job_for_memo(&memo).await {
                log::error!(
                    "[MemoService] failed to queue AI diary job for memo {}: {}",
                    memo.id,
                    error
                );
            }
        }

        Ok(MemoWithResources::from_memo(memo, resources))
    }

    pub async fn get_all_tags(&self, user_id: &str) -> Result<Vec<TagResponse>, AppError> {
        let user_uuid = Uuid::parse_str(user_id)?;

        let tags = sqlx::query_as::<_, TagResponse>(
            "SELECT tag, COUNT(*)::bigint AS count
             FROM memos, jsonb_array_elements_text(tags) AS tag
             WHERE user_id = $1 AND is_deleted = false
             GROUP BY tag
             ORDER BY tag ASC",
        )
        .bind(user_uuid)
        .fetch_all(&self.pool)
        .await?;

        Ok(tags)
    }

    async fn get_memo_resources(&self, memo_id: Uuid) -> Result<Vec<ResourceResponse>, AppError> {
        log::debug!("[MemoService] Getting resources for memo {}", memo_id);
        let resources = sqlx::query_as::<_, Resource>(
            "SELECT id, memo_id, user_id, filename, resource_type, mime_type, file_size, storage_type, storage_path, metadata, is_deleted, created_at, updated_at
             FROM resources WHERE memo_id = $1 AND is_deleted = FALSE ORDER BY created_at ASC",
        )
        .bind(memo_id)
        .fetch_all(&self.pool)
        .await
        .map_err(|e| {
            log::error!("[MemoService] Failed to get resources for memo {}: {}", memo_id, e);
            e
        })?;

        log::debug!(
            "[MemoService] Found {} resources for memo {}",
            resources.len(),
            memo_id
        );
        Ok(resources
            .into_iter()
            .map(|r| {
                let url = format!("/api/resources/{}/download", r.id);
                let is_video = r.mime_type.starts_with("video/");
                ResourceResponse {
                    id: r.id,
                    memo_id: r.memo_id,
                    filename: r.filename,
                    resource_type: r.resource_type,
                    mime_type: r.mime_type,
                    size: r.file_size,
                    storage_type: Some(r.storage_type),
                    storage_path: Some(r.storage_path),
                    url,
                    thumbnail_url: if is_video {
                        Some(crate::models::build_thumbnail_route(r.id))
                    } else {
                        None
                    },
                    metadata: r.metadata,
                    created_at: r.created_at,
                }
            })
            .collect())
    }

    /// Batch-load resources for multiple memos in a single query, avoiding N+1.
    async fn get_batch_memo_resources(
        &self,
        memo_ids: &[Uuid],
    ) -> Result<std::collections::HashMap<Uuid, Vec<ResourceResponse>>, AppError> {
        use std::collections::HashMap;

        if memo_ids.is_empty() {
            return Ok(HashMap::new());
        }

        let resources = sqlx::query_as::<_, Resource>(
            "SELECT id, memo_id, user_id, filename, resource_type, mime_type, file_size, storage_type, storage_path, metadata, is_deleted, created_at, updated_at
             FROM resources WHERE memo_id = ANY($1) AND is_deleted = FALSE ORDER BY created_at ASC",
        )
        .bind(memo_ids)
        .fetch_all(&self.pool)
        .await?;

        let mut map: HashMap<Uuid, Vec<ResourceResponse>> = HashMap::new();
        for r in resources {
            let memo_id = r.memo_id.unwrap_or_default();
            let url = format!("/api/resources/{}/download", r.id);
            let is_video = r.mime_type.starts_with("video/");
            let response = ResourceResponse {
                id: r.id,
                memo_id: r.memo_id,
                filename: r.filename,
                resource_type: r.resource_type,
                mime_type: r.mime_type,
                size: r.file_size,
                storage_type: Some(r.storage_type),
                storage_path: Some(r.storage_path),
                url,
                thumbnail_url: if is_video {
                    Some(crate::models::build_thumbnail_route(r.id))
                } else {
                    None
                },
                metadata: r.metadata,
                created_at: r.created_at,
            };
            map.entry(memo_id).or_default().push(response);
        }

        Ok(map)
    }

    /// Convert a list of memos into MemoWithResources using batch resource loading.
    async fn attach_resources_batch(
        &self,
        memos: Vec<Memo>,
    ) -> Result<Vec<MemoWithResources>, AppError> {
        let memo_ids: Vec<Uuid> = memos.iter().map(|m| m.id).collect();
        let mut resource_map = self.get_batch_memo_resources(&memo_ids).await?;
        Ok(memos
            .into_iter()
            .map(|memo| {
                let resources = resource_map.remove(&memo.id).unwrap_or_default();
                MemoWithResources::from_memo(memo, resources)
            })
            .collect())
    }

    async fn load_revisions(pool: &PgPool, memo_id: Uuid) -> Vec<MemoRevision> {
        match sqlx::query_as::<_, MemoRevision>(
            "SELECT id, memo_id, user_id, revision_number, content, tags, ai_summary, is_deleted, created_at
             FROM memo_revisions WHERE memo_id = $1 AND is_deleted = false ORDER BY revision_number ASC",
        )
        .bind(memo_id)
        .fetch_all(pool)
        .await
        {
            Ok(rows) => rows,
            Err(e) => {
                log::error!("[MemoService] load_revisions failed for memo {}: {}", memo_id, e);
                vec![]
            }
        }
    }

    pub fn build_revision_context(revisions: &[MemoRevision]) -> String {
        if revisions.len() <= 1 {
            return revisions
                .first()
                .map(|r| r.content.clone())
                .unwrap_or_default();
        }

        let omit_placeholder;
        let selected: Vec<&MemoRevision> = if revisions.len() <= 10 {
            revisions.iter().collect()
        } else {
            omit_placeholder = MemoRevision {
                id: uuid::Uuid::nil(),
                memo_id: uuid::Uuid::nil(),
                user_id: uuid::Uuid::nil(),
                revision_number: -1,
                content: format!("[... {} earlier entries omitted ...]", revisions.len() - 10),
                tags: serde_json::Value::Array(vec![]),
                ai_summary: None,
                is_deleted: false,
                created_at: 0,
            };
            let mut v: Vec<&MemoRevision> = vec![&revisions[0], &omit_placeholder];
            v.extend(revisions[revisions.len() - 9..].iter());
            v
        };

        let total = selected.len();
        let mut parts = Vec::new();
        for (i, rev) in selected.iter().enumerate() {
            // Special-case the omit placeholder (revision_number = -1, created_at = 0)
            let is_placeholder = rev.revision_number == -1;

            let ts = if is_placeholder {
                String::new()
            } else {
                chrono::DateTime::from_timestamp_millis(rev.created_at)
                    .map(|dt| dt.format("%Y-%m-%d %H:%M").to_string())
                    .unwrap_or_else(|| rev.created_at.to_string())
            };

            let label = if is_placeholder {
                rev.content.clone()
            } else if i == total - 1 {
                format!("---Current entry ({})---", ts)
            } else {
                format!("---Entry #{} ({})---", rev.revision_number, ts)
            };

            let end_label = if is_placeholder {
                String::new()
            } else if i == total - 1 {
                "---End of current entry---".to_string()
            } else {
                format!("---End of entry #{}---", rev.revision_number)
            };

            if is_placeholder {
                parts.push(label);
            } else {
                parts.push(format!("{}\n{}\n{}", label, rev.content, end_label));
            }
        }

        parts.join("\n\n")
    }

    pub async fn get_revisions(
        &self,
        user_id: &str,
        memo_id: Uuid,
    ) -> Result<Vec<MemoRevisionResponse>, AppError> {
        let user_uuid = Uuid::parse_str(user_id)?;
        let revisions = sqlx::query_as::<_, MemoRevision>(
            "SELECT r.id, r.memo_id, r.user_id, r.revision_number, r.content, r.tags, r.ai_summary, r.is_deleted, r.created_at
             FROM memo_revisions r
             JOIN memos m ON m.id = r.memo_id
             WHERE r.memo_id = $1 AND m.user_id = $2 AND r.is_deleted = false
             ORDER BY r.revision_number ASC",
        )
        .bind(memo_id)
        .bind(user_uuid)
        .fetch_all(&self.pool)
        .await?;

        Ok(revisions
            .into_iter()
            .map(MemoRevisionResponse::from_revision)
            .collect())
    }

    pub async fn delete_revision(
        &self,
        user_id: &str,
        memo_id: Uuid,
        revision_id: Uuid,
    ) -> Result<(), AppError> {
        let user_uuid = Uuid::parse_str(user_id)?;
        let now = Utc::now().timestamp_millis();

        // Use a transaction to prevent race conditions when multiple
        // concurrent deletes could bring revision count below 1.
        let mut tx = self.pool.begin().await?;

        // Join memos to ensure the user owns this memo before locking its revisions.
        let count: (i64,) = sqlx::query_as(
            "SELECT COUNT(*)
             FROM memo_revisions mr
             INNER JOIN memos m ON m.id = mr.memo_id
             WHERE mr.memo_id = $1 AND m.user_id = $2 AND mr.is_deleted = false
             FOR UPDATE",
        )
        .bind(memo_id)
        .bind(user_uuid)
        .fetch_one(&mut *tx)
        .await?;

        if count.0 <= 1 {
            return Err(AppError::InvalidInput(
                "Cannot delete the last revision. Delete the memo instead.".to_string(),
            ));
        }

        let result = sqlx::query(
            "UPDATE memo_revisions SET is_deleted = true
             WHERE id = $1 AND memo_id = $2 AND user_id = $3",
        )
        .bind(revision_id)
        .bind(memo_id)
        .bind(user_uuid)
        .execute(&mut *tx)
        .await?;

        if result.rows_affected() == 0 {
            return Err(AppError::MemoNotFound);
        }

        // revision_count tracks the highest-ever revision_number (monotonic),
        // NOT the active revision count. Do not decrement it on soft-delete so
        // that future revision_number allocations remain collision-free.
        sqlx::query("UPDATE memos SET updated_at = $1 WHERE id = $2")
            .bind(now)
            .bind(memo_id)
            .execute(&mut *tx)
            .await?;

        tx.commit().await?;

        Ok(())
    }

    fn spawn_memory_refresh(&self, memo: Memo, content_changed: bool) {
        let Some(memory_embedding_service) = self.memory_embedding_service.clone() else {
            return;
        };
        let memo_id = memo.id;
        let user_id = memo.user_id;
        let user_id_str = user_id.to_string();
        let bot_service = self.bot_service.clone();
        let user_ai_config_service = self.user_ai_config_service.clone();
        let ai_client = self.ai_client.clone();
        let app_settings_service = self.app_settings_service.clone();
        let pool = self.pool.clone();

        tokio::spawn(async move {
            let result = tokio::time::timeout(std::time::Duration::from_secs(600), async {
                // Phase 1: Load data concurrently — one failure doesn't abort others
                let (memo_images, user_ai_cfg, client, (auto_tag, auto_summary), (revisions, revision_context)) = tokio::join!(
                    async {
                        if let Some(bot_svc) = &bot_service {
                            bot_svc
                                .load_memo_images(user_id, memo_id, 4)
                                .await
                                .unwrap_or_default()
                        } else {
                            vec![]
                        }
                    },
                    async {
                        match &user_ai_config_service {
                            Some(svc) => {
                                match svc.get(&user_id).await {
                                    Ok(config) => config,
                                    Err(e) => {
                                        log::error!("[MemoService] Failed to fetch user AI config: {}", e);
                                        None
                                    }
                                }
                            },
                            None => None,
                        }
                    },
                    async { ai_client.clone() },
                    async {
                        match &app_settings_service {
                            Some(svc) => {
                                let auto_tag = svc.get_bool("auto_tag_enabled", true).await;
                                let auto_summary = svc.get_bool("auto_summary_enabled", false).await;
                                (auto_tag, auto_summary)
                            }
                            None => (true, false),
                        }
                    },
                    async {
                        let revisions = MemoService::load_revisions(&pool, memo_id).await;
                        let revision_context = MemoService::build_revision_context(&revisions);
                        (revisions, revision_context)
                    },
                );

                let (Some(user_cfg), Some(client)) = (user_ai_cfg, client) else {
                    // No AI config or client: run embedding first, then bot replies.
                    // Bot replies must run AFTER embedding so the anchor embedding
                    // exists when the RAG similarity search executes.
                    let embed_result = with_retry(
                        || {
                            let me_svc = memory_embedding_service.clone();
                            let memo = memo.clone();
                            let rc = revision_context.clone();
                            async move {
                                me_svc
                                    .refresh_for_memo_with_context(&memo, Some(&rc))
                                    .await
                                    .map_err(|e| AppError::Internal(e.to_string()))
                            }
                        },
                        2,
                        Duration::from_secs(30),
                    ).await;
                    if let Err(e) = embed_result {
                        log::error!(
                            "[MemoryRefresh] embedding failed for memo {} after retries: {}",
                            memo_id,
                            e
                        );
                    }

                    if let Some(bot_svc) = &bot_service {
                        if let Err(error) = bot_svc.trigger_replies(&user_id_str, memo_id).await {
                            log::error!(
                                "[MemoryRefresh] bot trigger_replies failed for memo {}: {}",
                                memo_id,
                                error
                            );
                        }
                    }
                    return;
                };

                // Build a ServerAiConfig-like struct from user's config for generate_tags_ai/generate_summary_ai
                let user_server_config = crate::models::ServerAiConfig {
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
                    embedding_dim: user_cfg.embedding_dim,
                    updated_at: user_cfg.updated_at,
                };

                let needs_tags = content_changed
                    && memo
                        .tags
                        .as_array()
                        .map(|arr| arr.is_empty())
                        .unwrap_or(true);

                let auto_tag_enabled = auto_tag && needs_tags;
                let auto_summary_enabled = auto_summary && content_changed;

                // Phase 2: Run AI tasks concurrently with per-task retry
                let tag_fut = {
                    let pool = pool.clone();
                    let config = user_server_config.clone();
                    let client = client.clone();
                    let user_id_str = user_id_str.clone();
                    let memo = memo.clone();
                    let memo_images = memo_images.clone();
                    let revision_context = revision_context.clone();
                    let memo_id = memo_id;

                    async move {
                        if !auto_tag_enabled {
                            return (None, false);
                        }
                        let persist_pool = pool.clone();
                        let persist_uid = user_id_str.clone();
                        let result = with_retry(
                            move || {
                                let pool = pool.clone();
                                let config = config.clone();
                                let client = client.clone();
                                let user_id_str = user_id_str.clone();
                                let memo = memo.clone();
                                let memo_images = memo_images.clone();
                                let revision_context = revision_context.clone();
                                async move {
                                    MemoService::generate_tags_ai(
                                        &pool, &config, &client, &user_id_str,
                                        &memo, &memo_images, &revision_context,
                                    ).await
                                }
                            },
                            2,
                            Duration::from_secs(90),
                        ).await;

                        match result {
                            Ok(tags_json) => {
                                let user_uuid = match Uuid::parse_str(&persist_uid) {
                                    Ok(u) => u,
                                    Err(_) => return (Some(tags_json.clone()), false),
                                };
                                let now = chrono::Utc::now().timestamp_millis();
                                let _ = sqlx::query(
                                    "UPDATE memos SET tags = $1, updated_at = $2 WHERE id = $3 AND user_id = $4",
                                )
                                .bind(&tags_json)
                                .bind(now)
                                .bind(memo_id)
                                .bind(user_uuid)
                                .execute(&persist_pool)
                                .await;
                                if let Some(tag_list) = tags_json.as_array() {
                                    log::info!("[AutoTag] tagged memo {} with {:?}", memo_id, tag_list);
                                }
                                (Some(tags_json), true)
                            }
                            Err(e) => {
                                log::error!("[AutoTag] failed for memo {} after retries: {}", memo_id, e);
                                (None, false)
                            }
                        }
                    }
                };

                let summary_fut = {
                    let pool = pool.clone();
                    let config = user_server_config.clone();
                    let client = client.clone();
                    let memo = memo.clone();
                    let memo_images = memo_images.clone();
                    let revision_context = revision_context.clone();
                    let memo_id = memo_id;

                    async move {
                        if !auto_summary_enabled {
                            return (false, None);
                        }
                        let persist_pool = pool.clone();
                        let result = with_retry(
                            move || {
                                let pool = pool.clone();
                                let config = config.clone();
                                let client = client.clone();
                                let memo = memo.clone();
                                let memo_images = memo_images.clone();
                                let revision_context = revision_context.clone();
                                async move {
                                    MemoService::generate_summary_ai(
                                        &pool, &config, &client,
                                        &memo, &memo_images, &revision_context,
                                    ).await
                                }
                            },
                            2,
                            Duration::from_secs(90),
                        ).await;

                        match result {
                            Ok(summary) => {
                                let now = chrono::Utc::now().timestamp_millis();
                                let _ = sqlx::query(
                                    "UPDATE memos SET ai_summary = $1, updated_at = $2 WHERE id = $3",
                                )
                                .bind(&summary)
                                .bind(now)
                                .bind(memo_id)
                                .execute(&persist_pool)
                                .await;
                                log::info!("[AutoSummary] summarized memo {}", memo_id);
                                (true, Some(summary))
                            }
                            Err(e) => {
                                log::error!("[AutoSummary] failed for memo {} after retries: {}", memo_id, e);
                                (false, None)
                            }
                        }
                    }
                };

                let (_tag_result, _summary_result) = tokio::join!(tag_fut, summary_fut);

                // Only write back AI results to the revision on initial creation.
                // On edits the revision INSERT already captured a complete snapshot
                // (old content + old tags + old ai_summary). Overwriting it with
                // newly generated tags/summary would produce an inconsistent record.
                if revisions.len() == 1 && (auto_tag || auto_summary) {
                    MemoService::update_latest_revision_ai_results(&pool, memo_id).await;
                }

                // Re-read memo from DB so embedding uses the freshly generated
                // tags and summary (not the pre-AI stale values).
                let fresh_memo = sqlx::query_as::<_, Memo>(
                    "SELECT id, user_id, content, tags, is_archived, is_deleted, diary_date, ai_summary, created_at, updated_at, revision_count
                     FROM memos WHERE id = $1 AND is_deleted = false",
                )
                .bind(memo_id)
                .fetch_optional(&pool)
                .await
                .ok()
                .flatten()
                .unwrap_or(memo);

                // Phase 4: Embedding first, then bot replies (sequential).
                // Bot relies on anchor embedding for RAG similarity search —
                // running concurrently causes the bot to see a missing embedding
                // and fall back to recency-only candidates, all of which fail
                // the MIN_SEMANTIC threshold and return no related memos.
                let embed_result = with_retry(
                    || {
                        let me_svc = memory_embedding_service.clone();
                        let fm = fresh_memo.clone();
                        let rc = revision_context.clone();
                        async move {
                            me_svc
                                .refresh_for_memo_with_context(&fm, Some(&rc))
                                .await
                                .map_err(|e| AppError::Internal(e.to_string()))
                        }
                    },
                    2,
                    Duration::from_secs(30),
                ).await;
                if let Err(e) = embed_result {
                    log::error!(
                        "[MemoryRefresh] embedding failed for memo {} after retries: {}",
                        memo_id,
                        e
                    );
                }

                if content_changed {
                    if let Some(bot_svc) = &bot_service {
                        if let Err(error) = bot_svc.trigger_replies(&user_id_str, memo_id).await {
                            log::error!(
                                "[MemoryRefresh] bot trigger_replies failed for memo {}: {}",
                                memo_id,
                                error
                            );
                        }
                    }
                }
            })
            .await;

            if result.is_err() {
                log::error!("[MemoryRefresh] timed out for memo {}", memo_id);
            }
        });
    }

    async fn update_latest_revision_ai_results(pool: &PgPool, memo_id: Uuid) {
        let memo = match sqlx::query_as::<_, Memo>(
            "SELECT id, user_id, content, tags, is_archived, is_deleted, diary_date, ai_summary, created_at, updated_at, revision_count
             FROM memos WHERE id = $1",
        )
        .bind(memo_id)
        .fetch_optional(pool)
        .await
        {
            Ok(Some(m)) => m,
            _ => return,
        };

        let _ = sqlx::query(
            "UPDATE memo_revisions SET tags = $1, ai_summary = $2
             WHERE memo_id = $3 AND revision_number = $4",
        )
        .bind(&memo.tags)
        .bind(&memo.ai_summary)
        .bind(memo_id)
        .bind(memo.revision_count)
        .execute(pool)
        .await;
    }

    #[allow(dead_code)]
    async fn auto_generate_tags(
        pool: &PgPool,
        config: &crate::models::ServerAiConfig,
        ai_client: &AiClient,
        user_id: &str,
        memo: &Memo,
        images: &[crate::services::ai_client::AiImageInput],
        revision_context: &str,
    ) {
        match Self::generate_tags_ai(
            pool,
            config,
            ai_client,
            user_id,
            memo,
            images,
            revision_context,
        )
        .await
        {
            Ok(tags_json) => {
                let user_uuid = match Uuid::parse_str(user_id) {
                    Ok(u) => u,
                    Err(_) => return,
                };
                let now = chrono::Utc::now().timestamp_millis();
                if let Err(e) = sqlx::query(
                    "UPDATE memos SET tags = $1, updated_at = $2 WHERE id = $3 AND user_id = $4",
                )
                .bind(&tags_json)
                .bind(now)
                .bind(memo.id)
                .bind(user_uuid)
                .execute(pool)
                .await
                {
                    log::error!(
                        "[AutoTag] failed to update tags for memo {}: {}",
                        memo.id,
                        e
                    );
                } else {
                    if let Some(tags) = tags_json.as_array() {
                        log::info!("[AutoTag] tagged memo {} with {:?}", memo.id, tags);
                    }
                }
            }
            Err(e) => {
                log::warn!("[AutoTag] skipped (AI call failed): {}", e);
            }
        }
    }
}

impl MemoService {
    async fn generate_tags_ai(
        pool: &PgPool,
        config: &crate::models::ServerAiConfig,
        ai_client: &AiClient,
        user_id: &str,
        memo: &Memo,
        images: &[crate::services::ai_client::AiImageInput],
        revision_context: &str,
    ) -> Result<serde_json::Value, AppError> {
        if config.api_key.trim().is_empty()
            || config.model.trim().is_empty()
            || config.base_url.trim().is_empty()
        {
            return Err(AppError::Internal(
                "[AutoTag] AI config missing required fields (api_key, model, or base_url)"
                    .to_string(),
            ));
        }

        let user_uuid = Uuid::parse_str(user_id)
            .map_err(|e| AppError::Internal(format!("[AutoTag] invalid user_id: {}", e)))?;

        let existing_tags: Vec<String> = sqlx::query_scalar(
            "SELECT DISTINCT tag FROM memos, jsonb_array_elements_text(tags) AS tag
             WHERE user_id = $1 AND is_deleted = false AND jsonb_array_length(tags) > 0
             ORDER BY tag ASC",
        )
        .bind(user_uuid)
        .fetch_all(pool)
        .await
        .unwrap_or_default();

        let existing_tags_hint = if existing_tags.is_empty() {
            String::from("(no existing tags yet)")
        } else {
            existing_tags.join(", ")
        };

        let prompt = format!(
            "You are a tagging assistant for a personal journal app. \
             Generate 1-4 concise tags based on the user's complete record history below. \
             Focus on what is currently most relevant. \
             Prefer reusing tags from the existing tag list when they fit. \
             Only create new tags when none of the existing ones are appropriate. \
             Tags should be short (1-3 words), lowercase. \
             Use the same language as the provided content. \
             Respond with ONLY a JSON array of tag strings, e.g.: [\"work\", \"health\"]\n\n\
             Existing tags: {}\n\nMemo:\n{}",
            existing_tags_hint, revision_context
        );

        let ai_config = crate::services::ai_client::AiConfig {
            provider: config.provider.clone(),
            base_url: config.base_url.clone(),
            api_key: config.api_key.clone(),
            model: config.model.clone(),
            max_tokens: config.max_tokens,
        };

        let vision_images = if config.supports_vision { images } else { &[] };
        let user_message = AiClient::build_user_message(&prompt, vision_images, &config.provider);

        let reply = ai_client
            .send_ai_messages(
                &ai_config,
                build_ai_system_prompt(),
                vec![user_message],
                None,
            )
            .await
            .map_err(|e| {
                AppError::Internal(format!(
                    "[AutoTag] AI call failed for memo {}: {}",
                    memo.id, e
                ))
            })?;

        let raw = reply.content.trim().to_string();
        let raw = raw
            .trim_start_matches("```json")
            .trim_start_matches("```")
            .trim_end_matches("```")
            .trim();
        let start = raw.find('[').unwrap_or(0);
        let end = raw.rfind(']').map(|i| i + 1).unwrap_or(raw.len());
        let tags: Vec<String> = serde_json::from_str(&raw[start..end]).map_err(|e| {
            AppError::Internal(format!(
                "[AutoTag] failed to parse tags JSON for memo {}: {} — raw: {}",
                memo.id, e, raw
            ))
        })?;

        if tags.is_empty() {
            return Err(AppError::Internal(
                "[AutoTag] generated empty tags".to_string(),
            ));
        }

        Ok(serde_json::json!(tags))
    }

    #[allow(dead_code)]
    async fn auto_generate_summary(
        pool: &PgPool,
        config: &crate::models::ServerAiConfig,
        ai_client: &AiClient,
        memo: &Memo,
        images: &[crate::services::ai_client::AiImageInput],
        revision_context: &str,
    ) {
        match Self::generate_summary_ai(pool, config, ai_client, memo, images, revision_context)
            .await
        {
            Ok(summary) => {
                let now = chrono::Utc::now().timestamp_millis();
                if let Err(e) =
                    sqlx::query("UPDATE memos SET ai_summary = $1, updated_at = $2 WHERE id = $3")
                        .bind(&summary)
                        .bind(now)
                        .bind(memo.id)
                        .execute(pool)
                        .await
                {
                    log::error!(
                        "[AutoSummary] failed to update summary for memo {}: {}",
                        memo.id,
                        e
                    );
                } else {
                    log::info!("[AutoSummary] summarized memo {}", memo.id);
                }
            }
            Err(e) => {
                log::warn!("[AutoSummary] skipped (AI call failed): {}", e);
            }
        }
    }

    async fn generate_summary_ai(
        _pool: &PgPool,
        config: &crate::models::ServerAiConfig,
        ai_client: &AiClient,
        memo: &Memo,
        images: &[crate::services::ai_client::AiImageInput],
        revision_context: &str,
    ) -> Result<String, AppError> {
        if config.api_key.trim().is_empty()
            || config.model.trim().is_empty()
            || config.base_url.trim().is_empty()
        {
            return Err(AppError::Internal(
                "[AutoSummary] AI config missing required fields (api_key, model, or base_url)"
                    .to_string(),
            ));
        }

        let prompt = format!(
            "Summarize the following memo based on its complete record history in 1-2 sentences. \
             Focus on the current state. If there are meaningful changes across entries, briefly mention them. \
             Be concise and capture the key point. \
             Use the same language as the provided content. \
             Output only the summary, no extra text.\n\nMemo:\n{}",
            revision_context
        );

        let ai_config = crate::services::ai_client::AiConfig {
            provider: config.provider.clone(),
            base_url: config.base_url.clone(),
            api_key: config.api_key.clone(),
            model: config.model.clone(),
            max_tokens: config.max_tokens,
        };

        let vision_images = if config.supports_vision { images } else { &[] };
        let user_message = AiClient::build_user_message(&prompt, vision_images, &config.provider);

        let reply = ai_client
            .send_ai_messages(
                &ai_config,
                build_ai_system_prompt(),
                vec![user_message],
                None,
            )
            .await
            .map_err(|e| {
                AppError::Internal(format!(
                    "[AutoSummary] AI call failed for memo {}: {}",
                    memo.id, e
                ))
            })?;

        let summary = reply.content.trim().to_string();
        if summary.is_empty() {
            return Err(AppError::Internal(
                "[AutoSummary] generated empty summary".to_string(),
            ));
        }

        Ok(summary)
    }

    pub async fn get_memo(
        &self,
        user_id: &str,
        memo_id: Uuid,
    ) -> Result<MemoWithResources, AppError> {
        log::info!(
            "[MemoService] Getting memo {} for user {}",
            memo_id,
            user_id
        );
        let user_uuid = Uuid::parse_str(user_id).map_err(|e| {
            log::error!("[MemoService] Invalid user_id format: {}", e);
            e
        })?;
        let memo = sqlx::query_as::<_, Memo>(
            "SELECT id, user_id, content, tags, is_archived, is_deleted, diary_date, ai_summary, created_at, updated_at, revision_count
             FROM memos WHERE id = $1 AND user_id = $2 AND is_deleted = false",
        )
        .bind(memo_id)
        .bind(user_uuid)
        .fetch_optional(&self.pool)
        .await
        .map_err(|e| {
            log::error!("[MemoService] Failed to get memo: {}", e);
            e
        })?
        .ok_or(AppError::MemoNotFound)?;
        log::info!("[MemoService] Memo {} found", memo.id);

        let resources = self.get_memo_resources(memo.id).await?;
        log::debug!(
            "[MemoService] Memo {} has {} resources",
            memo.id,
            resources.len()
        );
        Ok(MemoWithResources::from_memo(memo, resources))
    }

    pub async fn get_memo_detail(
        &self,
        user_id: &str,
        memo_id: Uuid,
    ) -> Result<crate::models::MemoDetailResponse, AppError> {
        let memo = self.get_memo(user_id, memo_id).await?;
        let revisions = self.get_revisions(user_id, memo_id).await?;
        let bot_replies = if let Some(bot_service) = &self.bot_service {
            bot_service.get_bot_replies(user_id, memo_id).await?
        } else {
            vec![]
        };
        Ok(crate::models::MemoDetailResponse {
            memo,
            revisions,
            bot_replies,
        })
    }

    pub async fn list_memos(
        &self,
        user_id: &str,
        page: u32,
        page_size: u32,
        archived: Option<bool>,
        diary_date: Option<chrono::NaiveDate>,
        search: Option<String>,
    ) -> Result<PaginatedResponse<MemoWithResources>, AppError> {
        let user_uuid = Uuid::parse_str(user_id)?;
        let offset = (page - 1) * page_size;

        let search_pattern = search.map(|s| format!("%{}%", s));

        let memos = if let Some(ref search_pattern) = search_pattern {
            // Search mode: search in content and tags
            sqlx::query_as::<_, Memo>(
                "SELECT id, user_id, content, tags, is_archived, is_deleted, diary_date, ai_summary, created_at, updated_at, revision_count
                 FROM memos 
                 WHERE user_id = $1 
                   AND is_deleted = false 
                   AND (content ILIKE $2 OR tags::text ILIKE $2)
                 ORDER BY created_at DESC LIMIT $3 OFFSET $4",
            )
            .bind(user_uuid)
            .bind(search_pattern)
            .bind(page_size as i64)
            .bind(offset as i64)
            .fetch_all(&self.pool)
            .await?
        } else if let Some(diary_date) = diary_date {
            sqlx::query_as::<_, Memo>(
                "SELECT id, user_id, content, tags, is_archived, is_deleted, diary_date, ai_summary, created_at, updated_at, revision_count
                 FROM memos WHERE user_id = $1 AND is_deleted = false AND diary_date = $2 AND is_archived = true
                 ORDER BY created_at DESC LIMIT $3 OFFSET $4",
            )
            .bind(user_uuid)
            .bind(diary_date)
            .bind(page_size as i64)
            .bind(offset as i64)
            .fetch_all(&self.pool)
            .await?
        } else {
            match archived {
                Some(true) => {
                    sqlx::query_as::<_, Memo>(
                        "SELECT id, user_id, content, tags, is_archived, is_deleted, diary_date, ai_summary, created_at, updated_at, revision_count
                         FROM memos WHERE user_id = $1 AND is_deleted = false AND is_archived = true
                         ORDER BY created_at DESC LIMIT $2 OFFSET $3",
                    )
                    .bind(user_uuid)
                    .bind(page_size as i64)
                    .bind(offset as i64)
                    .fetch_all(&self.pool)
                    .await?
                }
                Some(false) => {
                    sqlx::query_as::<_, Memo>(
                        "SELECT id, user_id, content, tags, is_archived, is_deleted, diary_date, ai_summary, created_at, updated_at, revision_count
                         FROM memos WHERE user_id = $1 AND is_deleted = false AND is_archived = false
                         ORDER BY created_at DESC LIMIT $2 OFFSET $3",
                    )
                    .bind(user_uuid)
                    .bind(page_size as i64)
                    .bind(offset as i64)
                    .fetch_all(&self.pool)
                    .await?
                }
                None => {
                    sqlx::query_as::<_, Memo>(
                        "SELECT id, user_id, content, tags, is_archived, is_deleted, diary_date, ai_summary, created_at, updated_at, revision_count
                         FROM memos WHERE user_id = $1 AND is_deleted = false
                         ORDER BY created_at DESC LIMIT $2 OFFSET $3",
                    )
                    .bind(user_uuid)
                    .bind(page_size as i64)
                    .bind(offset as i64)
                    .fetch_all(&self.pool)
                    .await?
                }
            }
        };

        let total = if let Some(ref search_pattern) = search_pattern {
            let row = sqlx::query_as::<_, (i64,)>(
                "SELECT COUNT(*) as total
                 FROM memos 
                 WHERE user_id = $1 
                   AND is_deleted = false 
                   AND (content ILIKE $2 OR tags::text ILIKE $2)",
            )
            .bind(user_uuid)
            .bind(search_pattern)
            .fetch_one(&self.pool)
            .await?;
            row.0
        } else if let Some(diary_date) = diary_date {
            let row = sqlx::query_as::<_, (i64,)>(
                "SELECT COUNT(*) as total
                 FROM memos WHERE user_id = $1 AND is_deleted = false AND diary_date = $2",
            )
            .bind(user_uuid)
            .bind(diary_date)
            .fetch_one(&self.pool)
            .await?;
            row.0
        } else {
            match archived {
                Some(true) => {
                    let row = sqlx::query_as::<_, (i64,)>(
                        "SELECT COUNT(*) as total
                         FROM memos WHERE user_id = $1 AND is_deleted = false AND is_archived = true",
                    )
                    .bind(user_uuid)
                    .fetch_one(&self.pool)
                    .await?;
                    row.0
                }
                Some(false) => {
                    let row = sqlx::query_as::<_, (i64,)>(
                        "SELECT COUNT(*) as total
                         FROM memos WHERE user_id = $1 AND is_deleted = false AND is_archived = false",
                    )
                    .bind(user_uuid)
                    .fetch_one(&self.pool)
                    .await?;
                    row.0
                }
                None => {
                    let row = sqlx::query_as::<_, (i64,)>(
                        "SELECT COUNT(*) as total
                         FROM memos WHERE user_id = $1 AND is_deleted = false",
                    )
                    .bind(user_uuid)
                    .fetch_one(&self.pool)
                    .await?;
                    row.0
                }
            }
        };

        let total_pages = ((total as f64) / (page_size as f64)).ceil() as u32;

        let items = self.attach_resources_batch(memos).await?;

        Ok(PaginatedResponse {
            items,
            total,
            page,
            page_size,
            total_pages,
        })
    }

    pub async fn get_memos_by_created_date(
        &self,
        user_id: &str,
        date: &str,
        archived: Option<bool>,
    ) -> Result<Vec<MemoWithResources>, AppError> {
        let user_uuid = Uuid::parse_str(user_id)?;

        let tz: Tz = match &self.app_settings_service {
            Some(svc) => svc.get_tz().await,
            None => chrono_tz::Asia::Shanghai,
        };
        let (start_ms, end_ms) = date_str_to_ms_bounds(date, tz)?;

        let mut query = String::from(
            "SELECT id, user_id, content, tags, is_archived, is_deleted, diary_date, ai_summary, created_at, updated_at, revision_count
             FROM memos
             WHERE user_id = $1
                AND is_deleted = false
                AND created_at >= $2
                AND created_at < $3",
        );

        if let Some(is_archived) = archived {
            query.push_str(&format!(" AND is_archived = {}", is_archived));
        }

        query.push_str(" ORDER BY created_at DESC");

        let memos = sqlx::query_as::<_, Memo>(&query)
            .bind(user_uuid)
            .bind(start_ms)
            .bind(end_ms)
            .fetch_all(&self.pool)
            .await?;

        self.attach_resources_batch(memos).await
    }

    pub async fn update_memo(
        &self,
        user_id: &str,
        memo_id: Uuid,
        req: UpdateMemoRequest,
    ) -> Result<MemoWithResources, AppError> {
        let user_uuid = Uuid::parse_str(user_id)?;
        let now = Utc::now().timestamp_millis();

        let content_changed = req.content.is_some();
        let embedding_relevant_changed = req.content.is_some()
            || req.tags.is_some()
            || req.ai_summary.is_some()
            || req.resource_ids.is_some();

        // Start transaction to ensure atomicity between memo update and revision insert
        let mut tx = self.pool.begin().await.map_err(AppError::Database)?;

        let mut set_clauses = vec!["updated_at = $1".to_string()];
        let mut param_idx = 2;

        if req.content.is_some() {
            set_clauses.push(format!("content = ${}", param_idx));
            param_idx += 1;
        }

        if req.tags.is_some() {
            set_clauses.push(format!("tags = ${}", param_idx));
            param_idx += 1;
        }

        if req.is_archived.is_some() {
            set_clauses.push(format!("is_archived = ${}", param_idx));
            param_idx += 1;
        }

        if req.diary_date.is_some() {
            set_clauses.push(format!("diary_date = ${}", param_idx));
            param_idx += 1;
        }

        if req.ai_summary.is_some() {
            set_clauses.push(format!("ai_summary = ${}", param_idx));
            param_idx += 1;
        }

        if content_changed {
            set_clauses.push("revision_count = revision_count + 1".to_string());
        }

        let query = format!(
            "UPDATE memos SET {} WHERE id = ${} AND user_id = ${} RETURNING *",
            set_clauses.join(", "),
            param_idx,
            param_idx + 1
        );

        let mut query_builder = sqlx::query_as::<_, Memo>(&query).bind(now);

        if let Some(content) = &req.content {
            query_builder = query_builder.bind(content);
        }

        if let Some(tags) = &req.tags {
            let tags_json = json!(tags);
            query_builder = query_builder.bind(tags_json);
        }

        if let Some(is_archived) = req.is_archived {
            query_builder = query_builder.bind(is_archived);
        }

        if let Some(diary_date) = &req.diary_date {
            query_builder = query_builder.bind(*diary_date);
        }

        if let Some(ai_summary) = &req.ai_summary {
            query_builder = query_builder.bind(ai_summary);
        }

        let memo = query_builder
            .bind(memo_id)
            .bind(user_uuid)
            .fetch_optional(&mut *tx)
            .await?
            .ok_or(AppError::MemoNotFound)?;

        if content_changed {
            let tags_json =
                json!(serde_json::from_value::<Vec<String>>(memo.tags.clone()).unwrap_or_default());
            // revision_count was already incremented atomically in the UPDATE above.
            // Insert revision in the same transaction to prevent race conditions.
            // Include ai_summary so historical revisions are self-contained even when
            // the background refresh fails or auto-summary is disabled.
            sqlx::query(
                "INSERT INTO memo_revisions (id, memo_id, user_id, revision_number, content, tags, ai_summary, is_deleted, created_at)
                 VALUES ($1, $2, $3, $4, $5, $6, $7, false, $8)",
            )
            .bind(Uuid::new_v4())
            .bind(memo.id)
            .bind(user_uuid)
            .bind(memo.revision_count)
            .bind(&memo.content)
            .bind(&tags_json)
            .bind(&memo.ai_summary)
            .bind(now)
            .execute(&mut *tx)
            .await
            .map_err(|e| {
                log::error!("[MemoService] Failed to insert revision for memo {}: {}", memo.id, e);
                AppError::Database(e)
            })?;
        }

        // Commit transaction before spawning background tasks
        tx.commit().await.map_err(AppError::Database)?;

        if content_changed {
            self.spawn_memory_refresh(memo.clone(), true);

            if let Some(ai_diary_service) = &self.ai_diary_service {
                if let Err(error) = ai_diary_service.queue_job_for_memo(&memo).await {
                    log::error!(
                        "[MemoService] failed to queue AI diary job for memo {}: {}",
                        memo.id,
                        error
                    );
                }
            }
        }

        // Refresh embeddings/bot context when any field that feeds into the
        // embedding source text changes, not only on content changes.
        if !content_changed && embedding_relevant_changed {
            self.spawn_memory_refresh(memo.clone(), false);
        }

        if let Some(resource_ids) = &req.resource_ids {
            let parsed_resource_ids: Vec<Uuid> = resource_ids
                .iter()
                .filter_map(|resource_id| Uuid::parse_str(resource_id).ok())
                .collect();

            if parsed_resource_ids.is_empty() {
                sqlx::query("UPDATE resources SET memo_id = NULL WHERE memo_id = $1")
                    .bind(memo.id)
                    .execute(&self.pool)
                    .await?;
            } else {
                sqlx::query(
                    "UPDATE resources SET memo_id = NULL WHERE memo_id = $1 AND NOT (id = ANY($2))",
                )
                .bind(memo.id)
                .bind(&parsed_resource_ids)
                .execute(&self.pool)
                .await?;

                for (index, resource_id) in parsed_resource_ids.iter().enumerate() {
                    let ordered_created_at = now + index as i64;
                    sqlx::query(
                        "UPDATE resources
                         SET memo_id = $1, created_at = $2
                         WHERE id = $3 AND (memo_id IS NULL OR memo_id = $1)",
                    )
                    .bind(memo.id)
                    .bind(ordered_created_at)
                    .bind(resource_id)
                    .execute(&self.pool)
                    .await?;
                }
            }
        }

        let resources = self.get_memo_resources(memo.id).await?;
        Ok(MemoWithResources::from_memo(memo, resources))
    }

    pub async fn delete_memo(&self, user_id: &str, memo_id: Uuid) -> Result<(), AppError> {
        let user_uuid = Uuid::parse_str(user_id)?;
        let now = Utc::now().timestamp_millis();

        let result = sqlx::query(
            "UPDATE memos SET is_deleted = true, updated_at = $1 WHERE id = $2 AND user_id = $3",
        )
        .bind(now)
        .bind(memo_id)
        .bind(user_uuid)
        .execute(&self.pool)
        .await?;

        if result.rows_affected() == 0 {
            return Err(AppError::MemoNotFound);
        }

        Ok(())
    }

    pub async fn archive_memo(
        &self,
        user_id: &str,
        memo_id: Uuid,
        diary_date: Option<chrono::NaiveDate>,
    ) -> Result<(), AppError> {
        let user_uuid = Uuid::parse_str(user_id)?;
        let now = Utc::now().timestamp_millis();

        let result = if let Some(date) = diary_date {
            sqlx::query(
                "UPDATE memos SET is_archived = true, diary_date = $1, updated_at = $2 WHERE id = $3 AND user_id = $4 AND is_deleted = false",
            )
            .bind(date)
            .bind(now)
            .bind(memo_id)
            .bind(user_uuid)
            .execute(&self.pool)
            .await?
        } else {
            sqlx::query(
                "UPDATE memos SET is_archived = true, updated_at = $1 WHERE id = $2 AND user_id = $3 AND is_deleted = false",
            )
            .bind(now)
            .bind(memo_id)
            .bind(user_uuid)
            .execute(&self.pool)
            .await?
        };

        if result.rows_affected() == 0 {
            return Err(AppError::MemoNotFound);
        }

        Ok(())
    }

    pub async fn unarchive_memo(&self, user_id: &str, memo_id: Uuid) -> Result<(), AppError> {
        let user_uuid = Uuid::parse_str(user_id)?;
        let now = Utc::now().timestamp_millis();

        let result = sqlx::query(
            "UPDATE memos SET is_archived = false, updated_at = $1 WHERE id = $2 AND user_id = $3 AND is_deleted = false",
        )
        .bind(now)
        .bind(memo_id)
        .bind(user_uuid)
        .execute(&self.pool)
        .await?;

        if result.rows_affected() == 0 {
            return Err(AppError::MemoNotFound);
        }

        Ok(())
    }

    pub async fn search_memos(
        &self,
        user_id: &str,
        query: &str,
        tags: Option<Vec<String>>,
        start_date: Option<String>,
        end_date: Option<String>,
        is_archived: Option<bool>,
        page: u32,
        page_size: u32,
    ) -> Result<PaginatedResponse<MemoWithResources>, AppError> {
        let user_uuid = Uuid::parse_str(user_id)?;
        let search_pattern = format!("%{}%", query);
        let offset = (page - 1) * page_size;

        let mut query_str = String::from(
            "SELECT id, user_id, content, tags, is_archived, is_deleted, diary_date, ai_summary, created_at, updated_at, revision_count
             FROM memos WHERE user_id = $1 AND is_deleted = false",
        );

        let mut conditions = Vec::new();
        let mut param_count = 2;

        if !query.is_empty() {
            conditions.push(format!(
                "(content ILIKE ${} OR tags::text ILIKE ${})",
                param_count, param_count
            ));
            param_count += 1;
        }

        if is_archived.is_some() {
            conditions.push(format!("is_archived = ${}", param_count));
            param_count += 1;
        }

        if let Some(ref tag_filters) = tags {
            if !tag_filters.is_empty() {
                conditions.push(format!("tags ?& ${}::text[]", param_count));
                param_count += 1;
            }
        }

        let tz: Tz = match &self.app_settings_service {
            Some(svc) => svc.get_tz().await,
            None => chrono_tz::Asia::Shanghai,
        };

        let start_ms: Option<i64> = start_date
            .as_deref()
            .map(|d| date_str_to_ms_bounds(d, tz).map(|(s, _)| s))
            .transpose()?;
        let end_ms: Option<i64> = end_date
            .as_deref()
            .map(|d| date_str_to_ms_bounds(d, tz).map(|(_, e)| e))
            .transpose()?;

        if start_ms.is_some() {
            conditions.push(format!("created_at >= ${}", param_count));
            param_count += 1;
        }

        if end_ms.is_some() {
            conditions.push(format!("created_at < ${}", param_count));
            param_count += 1;
        }

        if !conditions.is_empty() {
            query_str.push_str(" AND ");
            query_str.push_str(&conditions.join(" AND "));
        }

        query_str.push_str(" ORDER BY created_at DESC");

        let count_query = format!(
            "SELECT COUNT(*) FROM memos WHERE user_id = $1 AND is_deleted = false{}",
            if conditions.is_empty() {
                String::new()
            } else {
                format!(" AND {}", conditions.join(" AND "))
            }
        );

        let mut count_builder = sqlx::query_scalar::<_, i64>(&count_query).bind(user_uuid);

        if !query.is_empty() {
            count_builder = count_builder.bind(&search_pattern);
        }
        if let Some(archived) = is_archived {
            count_builder = count_builder.bind(archived);
        }
        if let Some(ref tag_filters) = tags {
            if !tag_filters.is_empty() {
                count_builder = count_builder.bind(tag_filters);
            }
        }
        if let Some(ms) = start_ms {
            count_builder = count_builder.bind(ms);
        }
        if let Some(ms) = end_ms {
            count_builder = count_builder.bind(ms);
        }

        let total = count_builder.fetch_one(&self.pool).await?;

        query_str.push_str(&format!(
            " LIMIT ${} OFFSET ${}",
            param_count,
            param_count + 1
        ));

        let mut query_builder = sqlx::query_as::<_, Memo>(&query_str).bind(user_uuid);

        if !query.is_empty() {
            query_builder = query_builder.bind(&search_pattern);
        }
        if let Some(archived) = is_archived {
            query_builder = query_builder.bind(archived);
        }
        if let Some(ref tag_filters) = tags {
            if !tag_filters.is_empty() {
                query_builder = query_builder.bind(tag_filters);
            }
        }
        if let Some(ms) = start_ms {
            query_builder = query_builder.bind(ms);
        }
        if let Some(ms) = end_ms {
            query_builder = query_builder.bind(ms);
        }

        query_builder = query_builder.bind(page_size as i64).bind(offset as i64);

        let memos = query_builder.fetch_all(&self.pool).await?;

        let items = self.attach_resources_batch(memos).await?;

        let total_pages = ((total as f64) / (page_size as f64)).ceil() as u32;

        Ok(PaginatedResponse {
            items,
            total,
            page,
            page_size,
            total_pages,
        })
    }
}

fn date_str_to_ms_bounds(date: &str, tz: Tz) -> Result<(i64, i64), AppError> {
    let naive = NaiveDate::parse_from_str(date, "%Y-%m-%d")
        .map_err(|_| AppError::InvalidInput(format!("invalid date: {}", date)))?;
    let start = tz
        .with_ymd_and_hms(naive.year(), naive.month(), naive.day(), 0, 0, 0)
        .single()
        .ok_or_else(|| AppError::InvalidInput(format!("ambiguous or invalid date: {}", date)))?;
    let end = start + chrono::Duration::days(1);
    Ok((start.timestamp_millis(), end.timestamp_millis()))
}
