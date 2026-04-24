use serde::{Deserialize, Serialize};
use sqlx::FromRow;
use uuid::Uuid;

#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct Bot {
    pub id: Uuid,
    pub user_id: Uuid,
    pub name: String,
    pub avatar_url: Option<String>,
    pub description: String,
    pub tags: serde_json::Value,
    pub auto_reply: bool,
    pub sort_order: i32,
    pub created_at: i64,
    pub updated_at: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct BotResponse {
    pub id: Uuid,
    pub name: String,
    pub avatar_url: Option<String>,
    pub description: String,
    pub tags: Vec<String>,
    pub auto_reply: bool,
    pub sort_order: i32,
    pub created_at: i64,
    pub updated_at: i64,
}

impl BotResponse {
    pub fn from_bot(bot: Bot) -> Self {
        let tags: Vec<String> = serde_json::from_value(bot.tags).unwrap_or_default();
        Self {
            id: bot.id,
            name: bot.name,
            avatar_url: bot.avatar_url,
            description: bot.description,
            tags,
            auto_reply: bot.auto_reply,
            sort_order: bot.sort_order,
            created_at: bot.created_at,
            updated_at: bot.updated_at,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct BotSummary {
    pub id: Uuid,
    pub name: String,
    pub avatar_url: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
#[allow(dead_code)]
pub struct BotReply {
    pub id: Uuid,
    pub memo_id: Uuid,
    pub bot_id: Uuid,
    pub content: String,
    pub parent_reply_id: Option<Uuid>,
    pub user_question: Option<String>,
    pub created_at: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct BotReplyResponse {
    pub id: Uuid,
    pub memo_id: Uuid,
    pub bot: BotSummary,
    pub content: String,
    pub thinking_content: Option<String>,
    pub parent_reply_id: Option<Uuid>,
    pub user_question: Option<String>,
    pub created_at: i64,
    pub children: Vec<BotReplyResponse>,
    pub thread_count: i64,
    pub latest_reply_id: Uuid,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct BotThreadMessage {
    pub id: Uuid,
    pub role: String,
    pub content: String,
    pub thinking_content: Option<String>,
    pub resource_ids: Vec<Uuid>,
    pub created_at: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct BotThreadResponse {
    pub memo_id: Uuid,
    pub bot: BotSummary,
    pub messages: Vec<BotThreadMessage>,
    pub latest_reply_id: Uuid,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateBotRequest {
    pub name: String,
    pub avatar_url: Option<String>,
    #[serde(default)]
    pub description: String,
    #[serde(default)]
    pub tags: Vec<String>,
    #[serde(default = "default_true")]
    pub auto_reply: bool,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdateBotRequest {
    pub name: Option<String>,
    pub avatar_url: Option<Option<String>>,
    pub description: Option<String>,
    pub tags: Option<Vec<String>>,
    pub auto_reply: Option<bool>,
    pub sort_order: Option<i32>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ReorderBotsRequest {
    pub order: Vec<Uuid>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ReplyToBotRequest {
    pub question: String,
    #[serde(default)]
    pub resource_ids: Vec<Uuid>,
}

fn default_true() -> bool {
    true
}
