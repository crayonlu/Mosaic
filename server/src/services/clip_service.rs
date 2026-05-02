use crate::error::AppError;
use crate::services::ai_client::{AiClient, AiConfig, AiImageInput};
use crate::services::ServerAiConfigService;
use crate::storage::Storage;
use serde::{Deserialize, Serialize};
use sqlx::PgPool;
use std::sync::Arc;

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ClipRequest {
    pub clip_type: ClipType,
    pub url: Option<String>,
    pub content: Option<String>,
    pub resource_id: Option<String>,
    pub user_note: Option<String>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum ClipType {
    Url,
    Text,
    Image,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ClipResult {
    pub title: String,
    pub content: String,
    pub ai_summary: String,
    pub tags: Vec<String>,
    pub source_url: Option<String>,
    pub source_type: String,
    pub original_title: Option<String>,
}

#[derive(Clone)]
pub struct ClipService {
    pool: PgPool,
    storage: Arc<dyn Storage>,
    ai_client: AiClient,
    server_ai_config_service: ServerAiConfigService,
}

impl ClipService {
    pub fn new(
        pool: PgPool,
        storage: Arc<dyn Storage>,
        ai_client: AiClient,
        server_ai_config_service: ServerAiConfigService,
    ) -> Self {
        Self {
            pool,
            storage,
            ai_client,
            server_ai_config_service,
        }
    }

    async fn load_ai_config(&self) -> Result<AiConfig, AppError> {
        let config = self.server_ai_config_service.get("bot").await?;
        if config.api_key.trim().is_empty() || config.model.trim().is_empty() {
            return Err(AppError::InvalidInput(
                "Server AI config 'bot' is incomplete".to_string(),
            ));
        }
        Ok(AiConfig {
            provider: config.provider,
            base_url: config.base_url,
            api_key: config.api_key,
            model: config.model,
            max_tokens: config.max_tokens,
        })
    }

    pub async fn process_clip(&self, request: ClipRequest) -> Result<ClipResult, AppError> {
        match request.clip_type {
            ClipType::Url => self.process_url_clip(request).await,
            ClipType::Text => self.process_text_clip(request).await,
            ClipType::Image => self.process_image_clip(request).await,
        }
    }

    async fn process_url_clip(&self, request: ClipRequest) -> Result<ClipResult, AppError> {
        let url = request
            .url
            .ok_or_else(|| AppError::InvalidInput("URL is required for url clip".to_string()))?;

        let article = fetch_and_extract(&url).await?;
        let markdown = html_to_markdown(&article.content);
        let truncated = truncate_str(&markdown, 8000);

        let user_note = request.user_note.unwrap_or_default();
        let ai_input = if user_note.is_empty() {
            format!("{}\n\n---\n\n{}", article.title, truncated)
        } else {
            format!(
                "{}\n\n---\n\n{}\n\n---\n\n用户备注: {}",
                article.title, truncated, user_note
            )
        };

        let config = self.load_ai_config().await?;
        let result = call_ai_for_clip(&config, &ai_input, "url", &self.ai_client).await?;

        Ok(ClipResult {
            source_url: Some(url),
            source_type: "url".to_string(),
            original_title: Some(article.title),
            ..result
        })
    }

    async fn process_text_clip(&self, request: ClipRequest) -> Result<ClipResult, AppError> {
        let content = request
            .content
            .ok_or_else(|| AppError::InvalidInput("Content is required for text clip".to_string()))?;

        let user_note = request.user_note.unwrap_or_default();
        let ai_input = if user_note.is_empty() {
            content.clone()
        } else {
            format!("{}\n\n---\n\n用户备注: {}", content, user_note)
        };

        let config = self.load_ai_config().await?;
        let result = call_ai_for_clip(&config, &ai_input, "text", &self.ai_client).await?;

        Ok(ClipResult {
            source_type: "text".to_string(),
            ..result
        })
    }

    async fn process_image_clip(&self, request: ClipRequest) -> Result<ClipResult, AppError> {
        let resource_id = request.resource_id.ok_or_else(|| {
            AppError::InvalidInput("resource_id is required for image clip".to_string())
        })?;

        let user_note = request.user_note.unwrap_or_default();
        let ai_input = if user_note.is_empty() {
            "请描述这张图片的内容，并为它生成一个合适的标题和摘要。".to_string()
        } else {
            format!(
                "请描述这张图片的内容，并为它生成一个合适的标题和摘要。\n\n用户备注: {}",
                user_note
            )
        };

        let image_data = self.load_image_data(&resource_id).await?;
        let config = self.load_ai_config().await?;

        let images = if image_data.is_empty() {
            vec![]
        } else {
            vec![AiImageInput {
                mime_type: "image/jpeg".to_string(),
                data: image_data,
            }]
        };

        let result =
            call_ai_for_clip_with_images(&config, &ai_input, &images, &self.ai_client).await?;

        Ok(ClipResult {
            source_type: "image".to_string(),
            ..result
        })
    }

    async fn load_image_data(&self, resource_id: &str) -> Result<Vec<u8>, AppError> {
        let id = uuid::Uuid::parse_str(resource_id)
            .map_err(|_| AppError::InvalidInput("Invalid resource_id".to_string()))?;

        #[derive(sqlx::FromRow)]
        struct ResourceRow {
            storage_path: String,
            mime_type: String,
        }

        let resource = sqlx::query_as::<_, ResourceRow>(
            "SELECT storage_path, mime_type FROM resources WHERE id = $1 AND is_deleted = false",
        )
        .bind(id)
        .fetch_optional(&self.pool)
        .await?
        .ok_or_else(|| AppError::ResourceNotFound)?;

        if !resource.mime_type.starts_with("image/") {
            return Err(AppError::InvalidInput("Resource is not an image".to_string()));
        }

        let data = self
            .storage
            .download(&resource.storage_path)
            .await
            .map_err(|e| AppError::Storage(e.to_string()))?;

        Ok(data.to_vec())
    }
}

struct Article {
    title: String,
    content: String,
}

async fn fetch_and_extract(url: &str) -> Result<Article, AppError> {
    let parsed_url = reqwest::Url::parse(url)
        .map_err(|e| AppError::InvalidInput(format!("Invalid URL: {}", e)))?;

    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(15))
        .user_agent("Mozilla/5.0 (compatible; MosaicBot/1.0)")
        .build()
        .map_err(|e| AppError::Internal(format!("Failed to create HTTP client: {}", e)))?;

    let response = client
        .get(url)
        .send()
        .await
        .map_err(|e| AppError::Internal(format!("Failed to fetch URL: {}", e)))?;

    let html = response
        .text()
        .await
        .map_err(|e| AppError::Internal(format!("Failed to read response: {}", e)))?;

    let mut reader = html.as_bytes();
    let article = readability::extractor::extract(&mut reader, &parsed_url)
        .map_err(|e| AppError::Internal(format!("Failed to extract content: {}", e)))?;

    Ok(Article {
        title: article.title,
        content: article.content,
    })
}

fn html_to_markdown(html: &str) -> String {
    htmd::convert(html).unwrap_or_else(|_| html.to_string())
}

fn truncate_str(s: &str, max_chars: usize) -> &str {
    match s.char_indices().nth(max_chars) {
        Some((idx, _)) => &s[..idx],
        None => s,
    }
}

fn parse_ai_clip_response(raw: &str) -> ClipResult {
    let trimmed = raw.trim();

    let title = extract_field(trimmed, "TITLE").unwrap_or_else(|| "未命名".to_string());
    let summary = extract_field(trimmed, "SUMMARY").unwrap_or_default();
    let tags_str = extract_field(trimmed, "TAGS").unwrap_or_default();
    let body = extract_field(trimmed, "CONTENT").unwrap_or_else(|| trimmed.to_string());

    let tags: Vec<String> = tags_str
        .split(|c: char| c == ',' || c == '，' || c == ' ')
        .map(|s| s.trim().to_string())
        .filter(|s| !s.is_empty())
        .collect();

    ClipResult {
        title,
        content: body,
        ai_summary: summary,
        tags,
        source_url: None,
        source_type: String::new(),
        original_title: None,
    }
}

fn extract_field(text: &str, field: &str) -> Option<String> {
    let start_tag = format!("[{}]", field);
    let end_tag = format!("[/{}]", field);

    let start_idx = text.find(&start_tag)?;
    let content_start = start_idx + start_tag.len();
    let end_idx = text[content_start..].find(&end_tag)? + content_start;

    Some(text[content_start..end_idx].trim().to_string())
}

fn build_clip_system_prompt(clip_type: &str) -> String {
    let type_instruction = match clip_type {
        "url" => "用户提供了一篇网页文章的内容。请提炼出核心观点和信息，用简洁的中文重写。",
        "text" => "用户提供了一段文本内容。请提炼出核心信息，用简洁的中文重写。",
        "image" => "用户提供了一张图片。请根据图片内容生成描述和摘要。",
        _ => "请提炼用户提供的内容。",
    };

    format!(
        r#"你是一个内容提炼助手。{type_instruction}

请严格按照以下格式输出：

[TITLE]
一个简洁有力的标题（15字以内）
[/TITLE]

[SUMMARY]
一句话摘要（30字以内）
[/SUMMARY]

[CONTENT]
提炼后的正文内容（200-500字，保留关键信息，去除噪音）
[/CONTENT]

[TAGS]
标签1, 标签2, 标签3（3-5个，用逗号分隔）
[/TAGS]"#
    )
}

async fn call_ai_for_clip(
    config: &AiConfig,
    content: &str,
    clip_type: &str,
    ai_client: &AiClient,
) -> Result<ClipResult, AppError> {
    let system_prompt = build_clip_system_prompt(clip_type);
    let messages = vec![serde_json::json!({
        "role": "user",
        "content": content
    })];

    let reply = ai_client
        .send_ai_messages(config, system_prompt, messages, None)
        .await
        .map_err(|e| AppError::Internal(format!("AI call failed: {}", e)))?;

    Ok(parse_ai_clip_response(&reply.content))
}

async fn call_ai_for_clip_with_images(
    config: &AiConfig,
    content: &str,
    images: &[AiImageInput],
    ai_client: &AiClient,
) -> Result<ClipResult, AppError> {
    let system_prompt = build_clip_system_prompt("image");
    let message = AiClient::build_user_message(content, images, &config.provider);
    let messages = vec![message];

    let reply = ai_client
        .send_ai_messages(config, system_prompt, messages, None)
        .await
        .map_err(|e| AppError::Internal(format!("AI call failed: {}", e)))?;

    Ok(parse_ai_clip_response(&reply.content))
}
