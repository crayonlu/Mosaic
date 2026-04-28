use crate::error::AppError;
use crate::models::Resource;
use crate::models::{
    Bot, BotMemoryContext, BotReplyResponse, BotResponse, BotSummary, BotThreadMessage,
    BotThreadResponse, CreateBotRequest, Memo, ReorderBotsRequest, ReplyToBotRequest,
    UpdateBotRequest,
};
use crate::services::{BotMemoryContextService, ServerAiConfigService};
use crate::storage::traits::Storage;
use base64::{engine::general_purpose, Engine as _};
use chrono::Utc;
use serde_json::json;
use sqlx::PgPool;
use std::sync::Arc;
use uuid::Uuid;

pub struct AiConfig {
    pub provider: String,
    pub base_url: String,
    pub api_key: String,
    pub model: String,
}

#[derive(Debug, Clone)]
struct AiReply {
    pub content: String,
    pub thinking_content: Option<String>,
}

#[derive(Clone)]
struct AiImageInput {
    mime_type: String,
    data: Vec<u8>,
}

#[derive(Clone)]
pub struct BotService {
    pool: PgPool,
    storage: Arc<dyn Storage>,
    memory_context_service: Option<BotMemoryContextService>,
    server_ai_config_service: Option<ServerAiConfigService>,
}

impl BotService {
    pub fn new(pool: PgPool, storage: Arc<dyn Storage>) -> Self {
        Self {
            pool,
            storage,
            memory_context_service: None,
            server_ai_config_service: None,
        }
    }

    pub fn with_memory_context_service(
        mut self,
        memory_context_service: BotMemoryContextService,
    ) -> Self {
        self.memory_context_service = Some(memory_context_service);
        self
    }

    pub fn with_server_ai_config_service(
        mut self,
        server_ai_config_service: ServerAiConfigService,
    ) -> Self {
        self.server_ai_config_service = Some(server_ai_config_service);
        self
    }

    pub async fn list_bots(&self, user_id: &str) -> Result<Vec<BotResponse>, AppError> {
        let user_uuid = Uuid::parse_str(user_id)
            .map_err(|e| AppError::InvalidInput(format!("Invalid user_id: {}", e)))?;

        let bots = sqlx::query_as::<_, Bot>(
            "SELECT id, user_id, name, avatar_url, description, tags, auto_reply, sort_order, model, ai_config, created_at, updated_at
             FROM bots WHERE user_id = $1 AND is_deleted = FALSE ORDER BY sort_order ASC, created_at ASC",
        )
        .bind(user_uuid)
        .fetch_all(&self.pool)
        .await
        .map_err(AppError::Database)?;

        Ok(bots.into_iter().map(BotResponse::from_bot).collect())
    }

    pub async fn create_bot(
        &self,
        user_id: &str,
        req: CreateBotRequest,
    ) -> Result<BotResponse, AppError> {
        let user_uuid = Uuid::parse_str(user_id)
            .map_err(|e| AppError::InvalidInput(format!("Invalid user_id: {}", e)))?;

        let now = Utc::now().timestamp_millis();
        let tags_json = json!(req.tags);

        let max_order: Option<i32> =
            sqlx::query_scalar("SELECT MAX(sort_order) FROM bots WHERE user_id = $1")
                .bind(user_uuid)
                .fetch_one(&self.pool)
                .await
                .map_err(AppError::Database)?;

        let sort_order = max_order.unwrap_or(-1) + 1;

        let bot = sqlx::query_as::<_, Bot>(
            "INSERT INTO bots (id, user_id, name, avatar_url, description, tags, auto_reply, sort_order, model, ai_config, created_at, updated_at)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
             RETURNING id, user_id, name, avatar_url, description, tags, auto_reply, sort_order, model, ai_config, created_at, updated_at",
        )
        .bind(Uuid::new_v4())
        .bind(user_uuid)
        .bind(&req.name)
        .bind(&req.avatar_url)
        .bind(&req.description)
        .bind(tags_json)
        .bind(req.auto_reply)
        .bind(sort_order)
        .bind(&req.model)
        .bind(&req.ai_config)
        .bind(now)
        .bind(now)
        .fetch_one(&self.pool)
        .await
        .map_err(AppError::Database)?;

        Ok(BotResponse::from_bot(bot))
    }

    pub async fn update_bot(
        &self,
        user_id: &str,
        bot_id: Uuid,
        req: UpdateBotRequest,
    ) -> Result<BotResponse, AppError> {
        let user_uuid = Uuid::parse_str(user_id)
            .map_err(|e| AppError::InvalidInput(format!("Invalid user_id: {}", e)))?;

        let existing = sqlx::query_as::<_, Bot>(
            "SELECT id, user_id, name, avatar_url, description, tags, auto_reply, sort_order, model, ai_config, created_at, updated_at
             FROM bots WHERE id = $1 AND user_id = $2",
        )
        .bind(bot_id)
        .bind(user_uuid)
        .fetch_optional(&self.pool)
        .await
        .map_err(AppError::Database)?
        .ok_or(AppError::NotFound("Bot not found".into()))?;

        let now = Utc::now().timestamp_millis();
        let name = req.name.unwrap_or(existing.name);
        let description = req.description.unwrap_or(existing.description);
        let auto_reply = req.auto_reply.unwrap_or(existing.auto_reply);
        let sort_order = req.sort_order.unwrap_or(existing.sort_order);

        let avatar_url = match req.avatar_url {
            Some(v) => v,
            None => existing.avatar_url,
        };

        let tags_json = match req.tags {
            Some(tags) => json!(tags),
            None => existing.tags,
        };

        let model = match req.model {
            Some(v) => v,
            None => existing.model,
        };

        let ai_config = match req.ai_config {
            Some(v) => v,
            None => existing.ai_config,
        };

        let bot = sqlx::query_as::<_, Bot>(
            "UPDATE bots SET name = $1, avatar_url = $2, description = $3, tags = $4,
             auto_reply = $5, sort_order = $6, model = $7, ai_config = $8, updated_at = $9
             WHERE id = $10 AND user_id = $11
             RETURNING id, user_id, name, avatar_url, description, tags, auto_reply, sort_order, model, ai_config, created_at, updated_at",
        )
        .bind(&name)
        .bind(&avatar_url)
        .bind(&description)
        .bind(tags_json)
        .bind(auto_reply)
        .bind(sort_order)
        .bind(&model)
        .bind(&ai_config)
        .bind(now)
        .bind(bot_id)
        .bind(user_uuid)
        .fetch_one(&self.pool)
        .await
        .map_err(AppError::Database)?;

        Ok(BotResponse::from_bot(bot))
    }

    pub async fn delete_bot(&self, user_id: &str, bot_id: Uuid) -> Result<(), AppError> {
        let user_uuid = Uuid::parse_str(user_id)
            .map_err(|e| AppError::InvalidInput(format!("Invalid user_id: {}", e)))?;

        let now = Utc::now().timestamp_millis();

        let result = sqlx::query(
            "UPDATE bots SET is_deleted = true, updated_at = $1 WHERE id = $2 AND user_id = $3",
        )
        .bind(now)
        .bind(bot_id)
        .bind(user_uuid)
        .execute(&self.pool)
        .await
        .map_err(AppError::Database)?;

        if result.rows_affected() == 0 {
            return Err(AppError::NotFound("Bot not found".into()));
        }

        Ok(())
    }

    pub async fn reorder_bots(
        &self,
        user_id: &str,
        req: ReorderBotsRequest,
    ) -> Result<(), AppError> {
        let user_uuid = Uuid::parse_str(user_id)
            .map_err(|e| AppError::InvalidInput(format!("Invalid user_id: {}", e)))?;

        let now = Utc::now().timestamp_millis();
        for (index, bot_id) in req.order.iter().enumerate() {
            sqlx::query(
                "UPDATE bots SET sort_order = $1, updated_at = $2 WHERE id = $3 AND user_id = $4",
            )
            .bind(index as i32)
            .bind(now)
            .bind(bot_id)
            .bind(user_uuid)
            .execute(&self.pool)
            .await
            .map_err(AppError::Database)?;
        }

        Ok(())
    }

    pub async fn get_bot_replies(
        &self,
        user_id: &str,
        memo_id: Uuid,
    ) -> Result<Vec<BotReplyResponse>, AppError> {
        let user_uuid = Uuid::parse_str(user_id)
            .map_err(|e| AppError::InvalidInput(format!("Invalid user_id: {}", e)))?;

        #[derive(sqlx::FromRow)]
        struct ReplyRow {
            id: Uuid,
            memo_id: Uuid,
            bot_id: Uuid,
            content: String,
            thinking_content: Option<String>,
            parent_reply_id: Option<Uuid>,
            user_question: Option<String>,
            created_at: i64,
            bot_name: String,
            bot_avatar_url: Option<String>,
            thread_count: i64,
            latest_reply_id: Uuid,
        }

        let rows = sqlx::query_as::<_, ReplyRow>(
            "SELECT br.id, br.memo_id, br.bot_id, br.content, br.thinking_content, br.parent_reply_id,
                    br.user_question, br.created_at,
                    b.name as bot_name, b.avatar_url as bot_avatar_url,
                    COUNT(*) OVER (PARTITION BY br.memo_id, br.bot_id) as thread_count,
                    FIRST_VALUE(br.id) OVER (PARTITION BY br.memo_id, br.bot_id ORDER BY br.created_at DESC) as latest_reply_id
             FROM bot_replies br
             JOIN bots b ON b.id = br.bot_id
             WHERE br.memo_id = $1 AND b.user_id = $2
             ORDER BY br.created_at ASC",
        )
        .bind(memo_id)
        .bind(user_uuid)
        .fetch_all(&self.pool)
        .await
        .map_err(AppError::Database)?;

        let all_replies: Vec<BotReplyResponse> = rows
            .into_iter()
            .map(|r| BotReplyResponse {
                id: r.id,
                memo_id: r.memo_id,
                bot: BotSummary {
                    id: r.bot_id,
                    name: r.bot_name,
                    avatar_url: r.bot_avatar_url,
                },
                content: r.content,
                thinking_content: r.thinking_content,
                parent_reply_id: r.parent_reply_id,
                user_question: r.user_question,
                created_at: r.created_at,
                children: vec![],
                thread_count: r.thread_count,
                latest_reply_id: r.latest_reply_id,
            })
            .collect();

        Ok(build_reply_tree(all_replies))
    }

    pub async fn get_bot_thread(
        &self,
        user_id: &str,
        reply_id: Uuid,
    ) -> Result<BotThreadResponse, AppError> {
        let user_uuid = Uuid::parse_str(user_id)
            .map_err(|e| AppError::InvalidInput(format!("Invalid user_id: {}", e)))?;

        let thread = self.load_thread(user_uuid, reply_id).await?;
        Ok(BotThreadResponse {
            memo_id: thread.memo_id,
            bot: BotSummary {
                id: thread.bot_id,
                name: thread.bot_name,
                avatar_url: thread.bot_avatar_url,
            },
            latest_reply_id: thread.latest_reply_id,
            messages: build_thread_messages(&thread.replies),
        })
    }

    pub async fn trigger_replies(
        &self,
        user_id: &str,
        memo_id: Uuid,
        _ai_config: AiConfig,
    ) -> Result<(), AppError> {
        let ai_config = self.load_server_ai_config("bot").await?;
        let user_uuid = Uuid::parse_str(user_id)
            .map_err(|e| AppError::InvalidInput(format!("Invalid user_id: {}", e)))?;

        let memo: Option<Memo> = sqlx::query_as::<_, Memo>(
            "SELECT id, user_id, content, tags, is_archived, is_deleted, diary_date, ai_summary, created_at, updated_at
             FROM memos WHERE id = $1 AND user_id = $2 AND is_deleted = FALSE",
        )
        .bind(memo_id)
        .bind(user_uuid)
        .fetch_optional(&self.pool)
        .await
        .map_err(AppError::Database)?;

        let memo = memo.ok_or(AppError::MemoNotFound)?;
        let memo_content = memo.content.clone();

        #[derive(sqlx::FromRow)]
        struct MoodRow {
            mood_key: String,
            mood_score: i32,
        }

        let mood_row: Option<MoodRow> = sqlx::query_as(
            "SELECT mood_key, mood_score FROM diaries
             WHERE user_id = $1 AND date = (
                 SELECT DATE(to_timestamp(created_at / 1000.0)) FROM memos WHERE id = $2
             )",
        )
        .bind(user_uuid)
        .bind(memo_id)
        .fetch_optional(&self.pool)
        .await
        .map_err(AppError::Database)?;

        let mood_info = mood_row.map(|r| (r.mood_key, r.mood_score));

        let bots = sqlx::query_as::<_, Bot>(
            "SELECT id, user_id, name, avatar_url, description, tags, auto_reply, sort_order, model, ai_config, created_at, updated_at
             FROM bots WHERE user_id = $1 AND auto_reply = TRUE AND is_deleted = FALSE",
        )
        .bind(user_uuid)
        .fetch_all(&self.pool)
        .await
        .map_err(AppError::Database)?;

        if bots.is_empty() {
            return Ok(());
        }

        let memo_images = self.load_memo_images(user_uuid, memo_id, 4).await?;

        let pool = self.pool.clone();
        let memo_content = memo_content.clone();
        let ai_config = std::sync::Arc::new(ai_config);
        let memory_context_service = self.memory_context_service.clone();
        let memo_for_context = memo.clone();

        tokio::spawn(async move {
            let mut handles = vec![];
            for bot in bots {
                let pool = pool.clone();
                let memo_content = memo_content.clone();
                let mood_info = mood_info.clone();
                let ai_config = ai_config.clone();
                let memo_images = memo_images.clone();
                let memory_context_service = memory_context_service.clone();
                let memo_for_context = memo_for_context.clone();

                handles.push(tokio::spawn(async move {
                    let memory_context = if let Some(service) = memory_context_service {
                        service
                            .build_for_memo(&memo_for_context, vec![], Some(bot.id))
                            .await
                            .ok()
                    } else {
                        None
                    };

                    if let Ok(reply) = call_ai_for_reply(
                        &ai_config,
                        &bot.name,
                        &bot.description,
                        &memo_content,
                        memory_context.as_ref(),
                        mood_info.as_ref(),
                        None,
                        None,
                        &memo_images,
                        bot.model.as_deref(),
                    )
                    .await
                    {
                        let now = Utc::now().timestamp_millis();
                        let _ = sqlx::query(
                            "INSERT INTO bot_replies (id, memo_id, bot_id, content, thinking_content, parent_reply_id, user_question, created_at)
                             VALUES ($1, $2, $3, $4, $5, NULL, NULL, $6)",
                        )
                        .bind(Uuid::new_v4())
                        .bind(memo_id)
                        .bind(bot.id)
                        .bind(&reply.content)
                        .bind(&reply.thinking_content)
                        .bind(now)
                        .execute(&pool)
                        .await;
                    }
                }));
            }

            for handle in handles {
                let _ = handle.await;
            }
        });

        Ok(())
    }

    pub async fn reply_to_bot(
        &self,
        user_id: &str,
        parent_reply_id: Uuid,
        req: ReplyToBotRequest,
        _ai_config: AiConfig,
    ) -> Result<BotReplyResponse, AppError> {
        let ai_config = self.load_server_ai_config("bot").await?;
        let user_uuid = Uuid::parse_str(user_id)
            .map_err(|e| AppError::InvalidInput(format!("Invalid user_id: {}", e)))?;

        #[derive(sqlx::FromRow)]
        struct ParentRow {
            memo_id: Uuid,
            bot_id: Uuid,
            memo_content: String,
            bot_name: String,
            bot_avatar_url: Option<String>,
            bot_description: String,
            bot_model: Option<String>,
        }

        let parent = sqlx::query_as::<_, ParentRow>(
            "SELECT br.memo_id, br.bot_id,
                    m.content as memo_content,
                    b.name as bot_name, b.avatar_url as bot_avatar_url, b.description as bot_description,
                    b.model as bot_model
             FROM bot_replies br
             JOIN bots b ON b.id = br.bot_id
             JOIN memos m ON m.id = br.memo_id
             WHERE br.id = $1 AND b.user_id = $2",
        )
        .bind(parent_reply_id)
        .bind(user_uuid)
        .fetch_optional(&self.pool)
        .await
        .map_err(AppError::Database)?
        .ok_or(AppError::NotFound("Bot reply not found".into()))?;

        let question_resources = if req.resource_ids.is_empty() {
            vec![]
        } else {
            self.load_owned_image_resources(user_uuid, &req.resource_ids, 4)
                .await?
        };

        let thread = self.load_thread(user_uuid, parent_reply_id).await?;
        let history = self
            .build_recent_thread_context(
                user_uuid,
                &thread.replies,
                8,
                8,
                true,
                ai_config.provider.as_str(),
            )
            .await?;

        let question_images = self
            .load_images_from_resources(question_resources.clone())
            .await?;

        let memory_context = if let Some(service) = &self.memory_context_service {
            let memo = Memo {
                id: parent.memo_id,
                user_id: user_uuid,
                content: parent.memo_content.clone(),
                tags: serde_json::json!([]),
                is_archived: false,
                is_deleted: false,
                diary_date: None,
                ai_summary: None,
                created_at: thread
                    .replies
                    .first()
                    .map(|reply| reply.created_at)
                    .unwrap_or_else(|| chrono::Utc::now().timestamp_millis()),
                updated_at: chrono::Utc::now().timestamp_millis(),
            };

            service
                .build_for_memo(&memo, history.clone(), Some(parent.bot_id))
                .await
                .ok()
        } else {
            None
        };

        let reply = call_ai_for_thread_reply(
            &ai_config,
            &parent.bot_name,
            &parent.bot_description,
            &parent.memo_content,
            memory_context.as_ref(),
            &history,
            &req.question,
            &question_images,
            parent.bot_model.as_deref(),
        )
        .await
        .map_err(|e| AppError::Internal(e.to_string()))?;

        let now = Utc::now().timestamp_millis();
        let new_id = Uuid::new_v4();

        sqlx::query(
            "INSERT INTO bot_replies (id, memo_id, bot_id, content, thinking_content, parent_reply_id, user_question, created_at)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8)",
        )
        .bind(new_id)
        .bind(parent.memo_id)
        .bind(parent.bot_id)
        .bind(&reply.content)
        .bind(&reply.thinking_content)
        .bind(parent_reply_id)
        .bind(&req.question)
        .bind(now)
        .execute(&self.pool)
        .await
        .map_err(AppError::Database)?;

        if !question_resources.is_empty() {
            for (index, resource) in question_resources.iter().enumerate() {
                sqlx::query(
                    "INSERT INTO bot_reply_resources (reply_id, resource_id, sort_order, created_at)
                     VALUES ($1, $2, $3, $4)
                     ON CONFLICT (reply_id, resource_id) DO NOTHING",
                )
                .bind(new_id)
                .bind(resource.id)
                .bind(index as i32)
                .bind(now)
                .execute(&self.pool)
                .await
                .map_err(AppError::Database)?;
            }
        }

        Ok(BotReplyResponse {
            id: new_id,
            memo_id: parent.memo_id,
            bot: BotSummary {
                id: parent.bot_id,
                name: parent.bot_name,
                avatar_url: parent.bot_avatar_url,
            },
            content: reply.content,
            thinking_content: reply.thinking_content,
            parent_reply_id: Some(parent_reply_id),
            user_question: Some(req.question),
            created_at: now,
            children: vec![],
            thread_count: thread.replies.len() as i64 + 1,
            latest_reply_id: new_id,
        })
    }

    async fn load_server_ai_config(&self, key: &str) -> Result<AiConfig, AppError> {
        let service = self.server_ai_config_service.as_ref().ok_or_else(|| {
            AppError::Internal("Server AI config service unavailable".to_string())
        })?;
        let config = service.get(key).await?;
        if config.api_key.trim().is_empty() || config.model.trim().is_empty() {
            return Err(AppError::InvalidInput(format!(
                "Server AI config '{}' is incomplete",
                key
            )));
        }
        Ok(AiConfig {
            provider: config.provider,
            base_url: config.base_url,
            api_key: config.api_key,
            model: config.model,
        })
    }

    async fn load_thread(&self, user_uuid: Uuid, reply_id: Uuid) -> Result<ThreadData, AppError> {
        #[derive(sqlx::FromRow)]
        struct ThreadSeed {
            memo_id: Uuid,
            bot_id: Uuid,
            bot_name: String,
            bot_avatar_url: Option<String>,
        }

        let seed = sqlx::query_as::<_, ThreadSeed>(
            "SELECT br.memo_id, br.bot_id, b.name as bot_name, b.avatar_url as bot_avatar_url
             FROM bot_replies br
             JOIN bots b ON b.id = br.bot_id
             WHERE br.id = $1 AND b.user_id = $2",
        )
        .bind(reply_id)
        .bind(user_uuid)
        .fetch_optional(&self.pool)
        .await
        .map_err(AppError::Database)?
        .ok_or(AppError::NotFound("Bot reply not found".into()))?;

        let replies = sqlx::query_as::<_, ThreadReplyRow>(
            "SELECT br.id, br.content, br.thinking_content, br.user_question,
                    COALESCE(
                        ARRAY_AGG(brr.resource_id ORDER BY brr.sort_order)
                            FILTER (WHERE brr.resource_id IS NOT NULL),
                        ARRAY[]::uuid[]
                    ) as resource_ids,
                    br.created_at
             FROM bot_replies br
             LEFT JOIN bot_reply_resources brr ON brr.reply_id = br.id
             WHERE br.memo_id = $1 AND br.bot_id = $2
             GROUP BY br.id, br.content, br.thinking_content, br.user_question, br.created_at
             ORDER BY br.created_at ASC",
        )
        .bind(seed.memo_id)
        .bind(seed.bot_id)
        .fetch_all(&self.pool)
        .await
        .map_err(AppError::Database)?;

        let latest_reply_id = replies
            .last()
            .map(|reply| reply.id)
            .ok_or(AppError::NotFound("Bot reply not found".into()))?;

        Ok(ThreadData {
            memo_id: seed.memo_id,
            bot_id: seed.bot_id,
            bot_name: seed.bot_name,
            bot_avatar_url: seed.bot_avatar_url,
            latest_reply_id,
            replies,
        })
    }

    async fn load_memo_images(
        &self,
        user_uuid: Uuid,
        memo_id: Uuid,
        limit: i64,
    ) -> Result<Vec<AiImageInput>, AppError> {
        let resources = sqlx::query_as::<_, Resource>(
            "SELECT r.id, r.memo_id, r.filename, r.resource_type, r.mime_type, r.file_size, r.storage_type, r.storage_path, r.metadata, r.is_deleted, r.created_at, r.updated_at
             FROM resources r
             JOIN memos m ON m.id = r.memo_id
             WHERE r.memo_id = $1 AND m.user_id = $2 AND r.resource_type = 'image' AND r.is_deleted = FALSE
             ORDER BY r.created_at ASC
             LIMIT $3",
        )
        .bind(memo_id)
        .bind(user_uuid)
        .bind(limit)
        .fetch_all(&self.pool)
        .await
        .map_err(AppError::Database)?;

        self.load_images_from_resources(resources).await
    }

    async fn load_owned_image_resources(
        &self,
        user_uuid: Uuid,
        resource_ids: &[Uuid],
        limit: i64,
    ) -> Result<Vec<Resource>, AppError> {
        if resource_ids.len() > limit as usize {
            return Err(AppError::InvalidInput(format!("最多添加 {} 张图片", limit)));
        }

        let resources = self
            .load_authorized_image_resources(user_uuid, resource_ids, limit as usize)
            .await?;

        if resources.len() != resource_ids.len() {
            return Err(AppError::InvalidInput(
                "图片不存在或没有访问权限".to_string(),
            ));
        }

        validate_ai_image_resources(&resources)?;

        Ok(resources)
    }

    async fn load_authorized_image_resources(
        &self,
        user_uuid: Uuid,
        resource_ids: &[Uuid],
        limit: usize,
    ) -> Result<Vec<Resource>, AppError> {
        if resource_ids.is_empty() || limit == 0 {
            return Ok(vec![]);
        }

        let limited_ids: Vec<Uuid> = resource_ids.iter().copied().take(limit).collect();
        let storage_prefix = format!("resources/{}/%", user_uuid);
        let resources = sqlx::query_as::<_, Resource>(
            "SELECT r.id, r.memo_id, r.filename, r.resource_type, r.mime_type, r.file_size, r.storage_type, r.storage_path, r.metadata, r.is_deleted, r.created_at, r.updated_at
             FROM resources r
             LEFT JOIN memos m ON m.id = r.memo_id
             WHERE r.id = ANY($1) AND r.resource_type = 'image' AND r.is_deleted = FALSE
               AND (m.user_id = $2 OR r.storage_path LIKE $3)",
        )
        .bind(&limited_ids)
        .bind(user_uuid)
        .bind(storage_prefix)
        .fetch_all(&self.pool)
        .await
        .map_err(AppError::Database)?;

        let mut by_id: std::collections::HashMap<Uuid, Resource> = resources
            .into_iter()
            .map(|resource| (resource.id, resource))
            .collect();
        let mut ordered = Vec::with_capacity(limited_ids.len());

        for resource_id in limited_ids {
            if let Some(resource) = by_id.remove(&resource_id) {
                ordered.push(resource);
            }
        }

        Ok(ordered)
    }

    async fn build_recent_thread_context(
        &self,
        user_uuid: Uuid,
        replies: &[ThreadReplyRow],
        max_replies: usize,
        max_images: usize,
        include_images: bool,
        provider: &str,
    ) -> Result<Vec<serde_json::Value>, AppError> {
        let start = replies.len().saturating_sub(max_replies);
        let mut messages = Vec::new();
        let mut remaining_images = max_images;

        for reply in &replies[start..] {
            if let Some(question) = &reply.user_question {
                let images = if include_images && remaining_images > 0 {
                    let resources = self
                        .load_authorized_image_resources(
                            user_uuid,
                            &reply.resource_ids,
                            remaining_images.min(4),
                        )
                        .await?;
                    let resources: Vec<Resource> = resources
                        .into_iter()
                        .filter(is_supported_ai_image_resource)
                        .collect();
                    remaining_images = remaining_images.saturating_sub(resources.len());
                    self.load_images_from_resources(resources).await?
                } else {
                    vec![]
                };

                messages.push(build_user_message(question, &images, provider));
            }
            messages.push(json!({ "role": "assistant", "content": reply.content }));
        }

        Ok(messages)
    }

    async fn load_images_from_resources(
        &self,
        resources: Vec<Resource>,
    ) -> Result<Vec<AiImageInput>, AppError> {
        let mut images = Vec::with_capacity(resources.len());

        for resource in resources {
            validate_ai_image_resources(std::slice::from_ref(&resource))?;

            let data = self
                .storage
                .download(&resource.storage_path)
                .await
                .map_err(|e| AppError::Storage(e.to_string()))?;

            images.push(AiImageInput {
                mime_type: resource.mime_type,
                data: data.to_vec(),
            });
        }

        Ok(images)
    }
}

fn validate_ai_image_resources(resources: &[Resource]) -> Result<(), AppError> {
    for resource in resources {
        if !is_supported_ai_image_resource(resource) {
            return Err(AppError::InvalidInput("不支持的图片格式".to_string()));
        }
    }

    Ok(())
}

fn is_supported_ai_image_resource(resource: &Resource) -> bool {
    matches!(
        resource.mime_type.as_str(),
        "image/jpeg" | "image/png" | "image/webp"
    ) && resource.file_size <= 10 * 1024 * 1024
}

fn build_reply_tree(replies: Vec<BotReplyResponse>) -> Vec<BotReplyResponse> {
    let mut roots: Vec<BotReplyResponse> = vec![];
    let mut children_map: std::collections::HashMap<Uuid, Vec<BotReplyResponse>> =
        std::collections::HashMap::new();

    for reply in replies {
        match reply.parent_reply_id {
            None => roots.push(reply),
            Some(parent_id) => {
                children_map.entry(parent_id).or_default().push(reply);
            }
        }
    }

    for root in &mut roots {
        if let Some(children) = children_map.remove(&root.id) {
            root.children = children;
        }
    }

    roots
}

#[derive(sqlx::FromRow, Clone)]
struct ThreadReplyRow {
    id: Uuid,
    content: String,
    thinking_content: Option<String>,
    user_question: Option<String>,
    resource_ids: Vec<Uuid>,
    created_at: i64,
}

struct ThreadData {
    memo_id: Uuid,
    bot_id: Uuid,
    bot_name: String,
    bot_avatar_url: Option<String>,
    latest_reply_id: Uuid,
    replies: Vec<ThreadReplyRow>,
}

fn build_thread_messages(replies: &[ThreadReplyRow]) -> Vec<BotThreadMessage> {
    let mut messages = Vec::new();

    for reply in replies {
        if let Some(question) = &reply.user_question {
            messages.push(BotThreadMessage {
                id: reply.id,
                role: "user".to_string(),
                content: question.clone(),
                thinking_content: None,
                resource_ids: reply.resource_ids.clone(),
                created_at: reply.created_at,
            });
        }

        messages.push(BotThreadMessage {
            id: reply.id,
            role: "assistant".to_string(),
            content: reply.content.clone(),
            thinking_content: reply.thinking_content.clone(),
            resource_ids: vec![],
            created_at: reply.created_at,
        });
    }

    messages
}

async fn call_ai_for_thread_reply(
    config: &AiConfig,
    bot_name: &str,
    bot_description: &str,
    memo_content: &str,
    memory_context: Option<&BotMemoryContext>,
    history: &[serde_json::Value],
    user_question: &str,
    images: &[AiImageInput],
    bot_model: Option<&str>,
) -> Result<AiReply, Box<dyn std::error::Error + Send + Sync>> {
    let system_prompt = format!(
        "你是 {}。{}\n\n你正在围绕同一条 Memo 和用户连续对话。请始终以这条 Memo 为上下文锚点，不要把它当成普通闲聊。请用中文回复，语言风格符合你的人格设定。",
        bot_name, bot_description
    );

    let mut messages = vec![json!({
        "role": "user",
        "content": format!("{}\n\n原始 Memo：\n{}", build_memory_prefix(memory_context), memo_content),
    })];
    messages.extend(history.iter().cloned());
    messages.push(build_user_message(
        user_question,
        images,
        config.provider.as_str(),
    ));

    send_ai_messages(config, system_prompt, messages, bot_model).await
}

async fn call_ai_for_reply(
    config: &AiConfig,
    bot_name: &str,
    bot_description: &str,
    memo_content: &str,
    memory_context: Option<&BotMemoryContext>,
    mood_info: Option<&(String, i32)>,
    previous_reply: Option<&str>,
    user_question: Option<&str>,
    images: &[AiImageInput],
    bot_model: Option<&str>,
) -> Result<AiReply, Box<dyn std::error::Error + Send + Sync>> {
    let mood_context = mood_info.map(|(key, score)| {
        format!(
            "\n\n用户当前的情绪状态：{}（强度 {}/100）。请在回复时自然地感知这个情绪，不需要直接点出情绪名称。",
            key, score
        )
    }).unwrap_or_default();

    let system_prompt = if previous_reply.is_none() {
        format!(
            "你是 {}。{}{}\n\n请用中文回复，语言风格符合你的人格设定。回复要简洁有力，100-200字为宜。",
            bot_name, bot_description, mood_context
        )
    } else {
        format!(
            "你是 {}。{}\n\n请用中文回复，语言风格符合你的人格设定。",
            bot_name, bot_description
        )
    };

    let empty_images: &[AiImageInput] = &[];
    let memo_images = if previous_reply.is_none() {
        images
    } else {
        empty_images
    };
    let mut messages = vec![build_user_message(
        &format!(
            "{}\n\n{}",
            build_memory_prefix(memory_context),
            memo_content
        ),
        memo_images,
        config.provider.as_str(),
    )];

    if let Some(reply) = previous_reply {
        messages.push(json!({ "role": "assistant", "content": reply }));
    }

    if let Some(question) = user_question {
        messages.push(build_user_message(
            question,
            images,
            config.provider.as_str(),
        ));
    }

    send_ai_messages(config, system_prompt, messages, bot_model).await
}

const MAX_MEMORY_PREFIX_CHARS: usize = 3000;

fn build_memory_prefix(memory_context: Option<&BotMemoryContext>) -> String {
    let Some(context) = memory_context else {
        return String::new();
    };

    let mut sections = Vec::new();
    let mut remaining = MAX_MEMORY_PREFIX_CHARS;

    if let Some(profile_summary) = &context.profile_summary {
        let truncated: String = profile_summary.chars().take(400).collect();
        let section = format!("[长期画像]\n{}", truncated);
        if section.len() <= remaining {
            remaining -= section.len();
            sections.push(section);
        }
    }

    if let Some(episode) = &context.selected_episode {
        let truncated: String = episode.summary.chars().take(500).collect();
        let section = format!("[当前事件线]\n{}", truncated);
        if section.len() <= remaining {
            remaining -= section.len();
            sections.push(section);
        }
    }

    if let Some(timeline_summary) = &context.timeline_summary {
        let truncated: String = timeline_summary.chars().take(600).collect();
        let section = format!("[相关时间线]\n{}", truncated);
        if section.len() <= remaining {
            remaining -= section.len();
            sections.push(section);
        }
    }

    if !context.related_memos.is_empty() {
        let mut items = Vec::new();
        for memo in context.related_memos.iter().take(5) {
            let item = format!(
                "- {}",
                memo.summary_excerpt.chars().take(100).collect::<String>()
            );
            if items.iter().map(|s: &String| s.len()).sum::<usize>() + item.len()
                > remaining.saturating_sub(20)
            {
                break;
            }
            items.push(item);
        }
        if !items.is_empty() {
            sections.push(format!("[相关历史 Memo]\n{}", items.join("\n")));
        }
    }

    sections.join("\n\n")
}

async fn send_ai_messages(
    config: &AiConfig,
    system_prompt: String,
    messages: Vec<serde_json::Value>,
    bot_model: Option<&str>,
) -> Result<AiReply, Box<dyn std::error::Error + Send + Sync>> {
    let client = reqwest::Client::new();
    let base_url = config.base_url.trim_end_matches('/');

    let target_model = bot_model.unwrap_or(&config.model);

    let (url, body) = match config.provider.as_str() {
        "anthropic" => {
            let url = format!("{}/messages", base_url);
            let body = json!({
                "model": target_model,
                "max_tokens": 512,
                "system": system_prompt,
                "messages": messages,
            });
            (url, body)
        }
        _ => {
            let url = format!("{}/chat/completions", base_url);
            let mut full_messages: Vec<serde_json::Value> =
                vec![json!({ "role": "system", "content": system_prompt })];
            full_messages.extend(messages);
            let body = json!({
                "model": target_model,
                "messages": full_messages,
                "max_tokens": 512,
                "temperature": 0.8,
            });
            (url, body)
        }
    };

    let mut request = client.post(&url).json(&body);

    request = match config.provider.as_str() {
        "anthropic" => request
            .header("x-api-key", &config.api_key)
            .header("anthropic-version", "2023-06-01")
            .header("content-type", "application/json"),
        _ => request
            .header("Authorization", format!("Bearer {}", config.api_key))
            .header("content-type", "application/json"),
    };

    let response = request.send().await?;
    let json: serde_json::Value = response.json().await?;

    let (content, thinking_content) = match config.provider.as_str() {
        "anthropic" => {
            let mut thinking_parts: Vec<String> = Vec::new();
            let mut text_content = String::new();
            if let Some(contents) = json["content"].as_array() {
                for item in contents {
                    match item["type"].as_str() {
                        Some("thinking") => {
                            if let Some(t) = item["thinking"].as_str() {
                                thinking_parts.push(t.to_string());
                            }
                        }
                        Some("text") => {
                            if let Some(t) = item["text"].as_str() {
                                text_content.push_str(t);
                            }
                        }
                        _ => {}
                    }
                }
            }
            (
                text_content,
                if thinking_parts.is_empty() {
                    None
                } else {
                    Some(thinking_parts.join("\n"))
                },
            )
        }
        _ => {
            let message = &json["choices"][0]["message"];
            let content = message["content"].as_str().unwrap_or_default().to_string();
            let thinking = message["reasoning_content"].as_str().map(|s| s.to_string());
            (content, thinking)
        }
    };

    Ok(AiReply {
        content,
        thinking_content,
    })
}

fn build_user_message(text: &str, images: &[AiImageInput], provider: &str) -> serde_json::Value {
    if images.is_empty() {
        return json!({ "role": "user", "content": text });
    }

    match provider {
        "anthropic" => {
            let mut content = vec![json!({ "type": "text", "text": text })];
            content.extend(images.iter().map(|image| {
                json!({
                    "type": "image",
                    "source": {
                        "type": "base64",
                        "media_type": image.mime_type,
                        "data": general_purpose::STANDARD.encode(&image.data),
                    }
                })
            }));
            json!({ "role": "user", "content": content })
        }
        _ => {
            let mut content = vec![json!({ "type": "text", "text": text })];
            content.extend(images.iter().map(|image| {
                let encoded = general_purpose::STANDARD.encode(&image.data);
                json!({
                    "type": "image_url",
                    "image_url": {
                        "url": format!("data:{};base64,{}", image.mime_type, encoded),
                    }
                })
            }));
            json!({ "role": "user", "content": content })
        }
    }
}
