use crate::error::AppError;
use crate::services::ai_client::{AiClient, AiConfig, AiImageInput};
use crate::services::ServerAiConfigService;
use crate::storage::traits::Storage;
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
    html2llm_url: String,
}

impl ClipService {
    pub fn new(
        pool: PgPool,
        storage: Arc<dyn Storage>,
        ai_client: AiClient,
        server_ai_config_service: ServerAiConfigService,
        html2llm_url: String,
    ) -> Self {
        Self {
            pool,
            storage,
            ai_client,
            server_ai_config_service,
            html2llm_url,
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

        let article = fetch_and_extract(&url, &self.html2llm_url).await?;
        let truncated = truncate_str(&article.content, 8000);

        let user_note = request.user_note.unwrap_or_default();
        let ai_input = if user_note.is_empty() {
            format!("{}\n\n---\n\n{}", article.title, truncated)
        } else {
            format!(
                "{}\n\n---\n\n{}\n\n---\n\nUser note: {}",
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
        let content = request.content.ok_or_else(|| {
            AppError::InvalidInput("Content is required for text clip".to_string())
        })?;

        let user_note = request.user_note.unwrap_or_default();
        let ai_input = if user_note.is_empty() {
            content.clone()
        } else {
            format!("{}\n\n---\n\nUser note: {}", content, user_note)
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
            "Describe this image and generate a suitable title and summary.".to_string()
        } else {
            format!(
                "Describe this image and generate a suitable title and summary.\n\nUser note: {}",
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
            return Err(AppError::InvalidInput(
                "Resource is not an image".to_string(),
            ));
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

async fn fetch_and_extract(url: &str, html2llm_url: &str) -> Result<Article, AppError> {
    // Build the html2llm API URL with headless mode for anti-bot bypass
    let api_url = format!("{}/{}?headless", html2llm_url.trim_end_matches('/'), url);

    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(30)) // headless is slower, give more time
        .build()
        .map_err(|e| AppError::Internal(format!("Failed to create HTTP client: {}", e)))?;

    let response = client
        .get(&api_url)
        .send()
        .await
        .map_err(|e| AppError::Internal(format!("Failed to fetch URL via html2llm: {}", e)))?;

    if !response.status().is_success() {
        return Err(AppError::Internal(format!(
            "html2llm returned status {}",
            response.status()
        )));
    }

    let csx = response
        .text()
        .await
        .map_err(|e| AppError::Internal(format!("Failed to read html2llm response: {}", e)))?;

    let title = extract_title_from_csx(&csx).unwrap_or_else(|| "Untitled".to_string());

    Ok(Article {
        title,
        content: csx,
    })
}

/// Extract the page title from CSX format.
/// Looks for (title ...) pattern — the HTML <title> tag rendered as CSX.
fn extract_title_from_csx(csx: &str) -> Option<String> {
    // Find the (title ...) pattern in CSX
    let start = csx.find("(title ")?;
    let rest = &csx[start + "(title ".len()..];
    // Walk characters tracking byte offsets for correct &str slicing
    let mut depth = 1u32;
    let mut end_byte = 0usize;
    let mut found = false;
    for (byte_offset, ch) in rest.char_indices() {
        match ch {
            '(' => depth += 1,
            ')' => {
                depth -= 1;
                if depth == 0 {
                    end_byte = byte_offset;
                    found = true;
                    break;
                }
            }
            _ => {}
        }
    }
    if !found {
        return None; // malformed CSX: no closing paren
    }
    let title_content = rest[..end_byte].trim().to_string();
    // Strip surrounding quotes if present
    let title_content = title_content.strip_prefix('"').unwrap_or(&title_content);
    let title_content = title_content.strip_suffix('"').unwrap_or(title_content);
    if title_content.is_empty() {
        None
    } else {
        Some(title_content.to_string())
    }
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
        "url" => "The user has provided a web article in CSX (Compact S-Expression) format — a token-efficient HTML representation where (tag.class children...) encodes DOM structure. Extract the key points and information, and rewrite it concisely.",
        "text" => "The user has provided a text passage. Extract the key information and rewrite it concisely.",
        "image" => "The user has provided an image. Generate a description and summary based on the image content.",
        _ => "Extract and refine the user's content.",
    };

    format!(
        r#"You are a content refinement assistant. {type_instruction}
Use the same language as the provided content.

Output strictly in the following format:

[TITLE]
A concise and compelling title
[/TITLE]

[SUMMARY]
A one-sentence summary
[/SUMMARY]

[CONTENT]
The refined main content, preserving key information while removing noise
[/CONTENT]

[TAGS]
tag1, tag2, tag3 (3-5 tags, comma-separated)
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
