use crate::error::AppError;
use crate::models::{
    Bot, BotReplyResponse, BotResponse, BotSummary, CreateBotRequest, ReorderBotsRequest,
    ReplyToBotRequest, UpdateBotRequest,
};
use chrono::Utc;
use serde_json::json;
use sqlx::PgPool;
use uuid::Uuid;

pub struct AiConfig {
    pub provider: String,
    pub base_url: String,
    pub api_key: String,
    pub model: String,
}

#[derive(Clone)]
pub struct BotService {
    pool: PgPool,
}

impl BotService {
    pub fn new(pool: PgPool) -> Self {
        Self { pool }
    }

    pub async fn list_bots(&self, user_id: &str) -> Result<Vec<BotResponse>, AppError> {
        let user_uuid = Uuid::parse_str(user_id)
            .map_err(|e| AppError::InvalidInput(format!("Invalid user_id: {}", e)))?;

        let bots = sqlx::query_as::<_, Bot>(
            "SELECT id, user_id, name, avatar_url, description, tags, auto_reply, sort_order, created_at, updated_at
             FROM bots WHERE user_id = $1 ORDER BY sort_order ASC, created_at ASC",
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
            "INSERT INTO bots (id, user_id, name, avatar_url, description, tags, auto_reply, sort_order, created_at, updated_at)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
             RETURNING id, user_id, name, avatar_url, description, tags, auto_reply, sort_order, created_at, updated_at",
        )
        .bind(Uuid::new_v4())
        .bind(user_uuid)
        .bind(&req.name)
        .bind(&req.avatar_url)
        .bind(&req.description)
        .bind(tags_json)
        .bind(req.auto_reply)
        .bind(sort_order)
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
            "SELECT id, user_id, name, avatar_url, description, tags, auto_reply, sort_order, created_at, updated_at
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

        let bot = sqlx::query_as::<_, Bot>(
            "UPDATE bots SET name = $1, avatar_url = $2, description = $3, tags = $4,
             auto_reply = $5, sort_order = $6, updated_at = $7
             WHERE id = $8 AND user_id = $9
             RETURNING id, user_id, name, avatar_url, description, tags, auto_reply, sort_order, created_at, updated_at",
        )
        .bind(&name)
        .bind(&avatar_url)
        .bind(&description)
        .bind(tags_json)
        .bind(auto_reply)
        .bind(sort_order)
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

        let result = sqlx::query("DELETE FROM bots WHERE id = $1 AND user_id = $2")
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
            parent_reply_id: Option<Uuid>,
            user_question: Option<String>,
            created_at: i64,
            bot_name: String,
            bot_avatar_url: Option<String>,
        }

        let rows = sqlx::query_as::<_, ReplyRow>(
            "SELECT br.id, br.memo_id, br.bot_id, br.content, br.parent_reply_id,
                    br.user_question, br.created_at,
                    b.name as bot_name, b.avatar_url as bot_avatar_url
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
                parent_reply_id: r.parent_reply_id,
                user_question: r.user_question,
                created_at: r.created_at,
                children: vec![],
            })
            .collect();

        Ok(build_reply_tree(all_replies))
    }

    pub async fn trigger_replies(
        &self,
        user_id: &str,
        memo_id: Uuid,
        ai_config: AiConfig,
    ) -> Result<(), AppError> {
        let user_uuid = Uuid::parse_str(user_id)
            .map_err(|e| AppError::InvalidInput(format!("Invalid user_id: {}", e)))?;

        let memo_content: Option<String> = sqlx::query_scalar(
            "SELECT content FROM memos WHERE id = $1 AND user_id = $2 AND is_deleted = FALSE",
        )
        .bind(memo_id)
        .bind(user_uuid)
        .fetch_optional(&self.pool)
        .await
        .map_err(AppError::Database)?;

        let memo_content = memo_content.ok_or(AppError::MemoNotFound)?;

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
            "SELECT id, user_id, name, avatar_url, description, tags, auto_reply, sort_order, created_at, updated_at
             FROM bots WHERE user_id = $1 AND auto_reply = TRUE",
        )
        .bind(user_uuid)
        .fetch_all(&self.pool)
        .await
        .map_err(AppError::Database)?;

        if bots.is_empty() {
            return Ok(());
        }

        let pool = self.pool.clone();
        let memo_content = memo_content.clone();
        let ai_config = std::sync::Arc::new(ai_config);

        tokio::spawn(async move {
            let mut handles = vec![];
            for bot in bots {
                let pool = pool.clone();
                let memo_content = memo_content.clone();
                let mood_info = mood_info.clone();
                let ai_config = ai_config.clone();

                handles.push(tokio::spawn(async move {
                    if let Ok(content) = call_ai_for_reply(
                        &ai_config,
                        &bot.name,
                        &bot.description,
                        &memo_content,
                        mood_info.as_ref(),
                        None,
                        None,
                    )
                    .await
                    {
                        let now = Utc::now().timestamp_millis();
                        let _ = sqlx::query(
                            "INSERT INTO bot_replies (id, memo_id, bot_id, content, parent_reply_id, user_question, created_at)
                             VALUES ($1, $2, $3, $4, NULL, NULL, $5)",
                        )
                        .bind(Uuid::new_v4())
                        .bind(memo_id)
                        .bind(bot.id)
                        .bind(&content)
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
        ai_config: AiConfig,
    ) -> Result<BotReplyResponse, AppError> {
        let user_uuid = Uuid::parse_str(user_id)
            .map_err(|e| AppError::InvalidInput(format!("Invalid user_id: {}", e)))?;

        #[derive(sqlx::FromRow)]
        struct ParentRow {
            reply_id: Uuid,
            memo_id: Uuid,
            bot_id: Uuid,
            content: String,
            memo_content: String,
            bot_name: String,
            bot_avatar_url: Option<String>,
            bot_description: String,
        }

        let parent = sqlx::query_as::<_, ParentRow>(
            "SELECT br.id as reply_id, br.memo_id, br.bot_id, br.content,
                    m.content as memo_content,
                    b.name as bot_name, b.avatar_url as bot_avatar_url, b.description as bot_description
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

        let reply_content = call_ai_for_reply(
            &ai_config,
            &parent.bot_name,
            &parent.bot_description,
            &parent.memo_content,
            None,
            Some(&parent.content),
            Some(&req.question),
        )
        .await
        .map_err(|e| AppError::Internal(e.to_string()))?;

        let now = Utc::now().timestamp_millis();
        let new_id = Uuid::new_v4();

        sqlx::query(
            "INSERT INTO bot_replies (id, memo_id, bot_id, content, parent_reply_id, user_question, created_at)
             VALUES ($1, $2, $3, $4, $5, $6, $7)",
        )
        .bind(new_id)
        .bind(parent.memo_id)
        .bind(parent.bot_id)
        .bind(&reply_content)
        .bind(parent_reply_id)
        .bind(&req.question)
        .bind(now)
        .execute(&self.pool)
        .await
        .map_err(AppError::Database)?;

        Ok(BotReplyResponse {
            id: new_id,
            memo_id: parent.memo_id,
            bot: BotSummary {
                id: parent.bot_id,
                name: parent.bot_name,
                avatar_url: parent.bot_avatar_url,
            },
            content: reply_content,
            parent_reply_id: Some(parent_reply_id),
            user_question: Some(req.question),
            created_at: now,
            children: vec![],
        })
    }
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

async fn call_ai_for_reply(
    config: &AiConfig,
    bot_name: &str,
    bot_description: &str,
    memo_content: &str,
    mood_info: Option<&(String, i32)>,
    previous_reply: Option<&str>,
    user_question: Option<&str>,
) -> Result<String, Box<dyn std::error::Error + Send + Sync>> {
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

    let mut messages = vec![json!({ "role": "user", "content": memo_content })];

    if let Some(reply) = previous_reply {
        messages.push(json!({ "role": "assistant", "content": reply }));
    }

    if let Some(question) = user_question {
        messages.push(json!({ "role": "user", "content": question }));
    }

    let client = reqwest::Client::new();
    let base_url = config.base_url.trim_end_matches('/');

    let (url, body) = match config.provider.as_str() {
        "anthropic" => {
            let url = format!("{}/messages", base_url);
            let body = json!({
                "model": config.model,
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
                "model": config.model,
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

    let content = match config.provider.as_str() {
        "anthropic" => json["content"][0]["text"]
            .as_str()
            .unwrap_or_default()
            .to_string(),
        _ => json["choices"][0]["message"]["content"]
            .as_str()
            .unwrap_or_default()
            .to_string(),
    };

    Ok(content)
}
