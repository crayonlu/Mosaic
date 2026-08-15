use base64::{engine::general_purpose, Engine as _};
use log;
use serde_json::{json, Value};
use std::collections::HashSet;
use std::sync::Arc;
use std::time::Duration;
use tokio::sync::Semaphore;

const AI_REQUEST_TIMEOUT: Duration = Duration::from_secs(60);
const MAX_CONCURRENT_AI_REQUESTS: usize = 4;

#[derive(Clone)]
pub struct AiConfig {
    pub provider: String,
    pub base_url: String,
    pub api_key: String,
    pub model: String,
    pub max_tokens: Option<i32>,
}

#[derive(Debug, Clone)]
pub struct AiReply {
    pub content: String,
    pub thinking_content: Option<String>,
}

#[derive(Clone)]
pub struct AiImageInput {
    pub mime_type: String,
    pub data: Vec<u8>,
}

#[derive(Clone)]
pub struct AiClient {
    client: reqwest::Client,
    request_gate: Arc<Semaphore>,
}

impl AiClient {
    pub fn new() -> Self {
        Self {
            client: reqwest::Client::builder()
                .timeout(AI_REQUEST_TIMEOUT)
                .build()
                .expect("Failed to build reqwest client for AiClient"),
            request_gate: Arc::new(Semaphore::new(MAX_CONCURRENT_AI_REQUESTS)),
        }
    }

    pub async fn send_ai_messages(
        &self,
        config: &AiConfig,
        system_prompt: String,
        messages: Vec<serde_json::Value>,
        bot_model: Option<&str>,
    ) -> Result<AiReply, Box<dyn std::error::Error + Send + Sync>> {
        let _permit = self
            .request_gate
            .acquire()
            .await
            .map_err(|e| format!("AI request gate closed: {}", e))?;
        let base_url = config.base_url.trim_end_matches('/');

        let target_model = bot_model.unwrap_or(&config.model);

        let url = format!("{}/chat/completions", base_url);
        let mut full_messages: Vec<serde_json::Value> =
            vec![json!({ "role": "system", "content": system_prompt })];
        full_messages.extend(messages);
        let body = json!({
            "model": target_model,
            "messages": full_messages,
            "max_tokens": config.max_tokens.unwrap_or(512),
            "temperature": 0.8,
        });

        let request = self
            .client
            .post(&url)
            .json(&body)
            .header("Authorization", format!("Bearer {}", config.api_key))
            .header("content-type", "application/json");

        let response = request.send().await?;

        if !response.status().is_success() {
            let status = response.status();
            let body_text = response.text().await.unwrap_or_default();
            let msg = format!("AI API returned HTTP {}: {}", status, body_text);
            log::warn!("[AiClient] {}", msg);
            return Err(msg.into());
        }

        let json: serde_json::Value = response.json().await?;

        let message = json
            .get("choices")
            .and_then(Value::as_array)
            .and_then(|choices| choices.first())
            .and_then(|choice| choice.get("message"))
            .ok_or_else(|| {
                format!(
                    "AI response missing choices[0].message for provider {}",
                    config.provider
                )
            })?;
        let content = extract_message_text(message.get("content"));
        let thinking_content = message
            .get("reasoning_content")
            .and_then(Value::as_str)
            .map(str::to_string);

        if content.trim().is_empty() {
            return Err(format!(
                "AI response contained no text content for provider {}",
                config.provider
            )
            .into());
        }

        Ok(AiReply {
            content,
            thinking_content,
        })
    }

    /// Parse the small, structured response used by tag generation.
    /// Providers frequently wrap the JSON in markdown or add a short preamble,
    /// so accepting only a perfect JSON array makes auto-tagging unnecessarily
    /// fragile.
    pub fn parse_tag_list(raw: &str) -> Result<Vec<String>, String> {
        let text = raw.trim();
        if text.is_empty() {
            return Err("AI returned an empty tag response".to_string());
        }

        let cleaned = text
            .trim_start_matches("```json")
            .trim_start_matches("```JSON")
            .trim_start_matches("```")
            .trim_end_matches("```")
            .trim();

        let mut candidates = Vec::new();
        if let Ok(value) = serde_json::from_str::<Value>(cleaned) {
            collect_tag_values(&value, &mut candidates);
        }

        if candidates.is_empty() {
            if let (Some(start), Some(end)) = (cleaned.find('['), cleaned.rfind(']')) {
                if start < end {
                    if let Ok(value) = serde_json::from_str::<Value>(&cleaned[start..=end]) {
                        collect_tag_values(&value, &mut candidates);
                    }
                }
            }
        }

        if candidates.is_empty() {
            if let (Some(start), Some(end)) = (cleaned.find('{'), cleaned.rfind('}')) {
                if start < end {
                    if let Ok(value) = serde_json::from_str::<Value>(&cleaned[start..=end]) {
                        collect_tag_values(&value, &mut candidates);
                    }
                }
            }
        }

        if candidates.is_empty() {
            candidates.extend(
                cleaned
                    .lines()
                    .flat_map(|line| line.split([',', '，', '、', ';', '；']))
                    .map(normalize_tag)
                    .filter(|tag| !tag.is_empty()),
            );
        }

        let mut seen = HashSet::new();
        let tags: Vec<String> = candidates
            .into_iter()
            .map(|tag| normalize_tag(&tag))
            .filter(|tag| !tag.is_empty() && seen.insert(tag.to_lowercase()))
            .take(4)
            .collect();

        if tags.is_empty() {
            Err(format!("AI returned no usable tags: {}", cleaned))
        } else {
            Ok(tags)
        }
    }

    pub fn build_user_message(
        text: &str,
        images: &[AiImageInput],
        _provider: &str,
    ) -> serde_json::Value {
        if images.is_empty() {
            return json!({ "role": "user", "content": text });
        }

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

fn extract_message_text(value: Option<&Value>) -> String {
    match value {
        Some(Value::String(text)) => text.clone(),
        Some(Value::Array(parts)) => parts
            .iter()
            .filter_map(|part| {
                part.get("text")
                    .and_then(Value::as_str)
                    .or_else(|| part.get("content").and_then(Value::as_str))
            })
            .collect::<Vec<_>>()
            .join(""),
        _ => String::new(),
    }
}

fn collect_tag_values(value: &Value, output: &mut Vec<String>) {
    match value {
        Value::Array(items) => {
            for item in items {
                if let Some(tag) = item.as_str() {
                    output.push(tag.to_string());
                }
            }
        }
        Value::Object(object) => {
            for (key, items) in object {
                if key.eq_ignore_ascii_case("tags") || key.eq_ignore_ascii_case("labels") {
                    collect_tag_values(items, output);
                }
            }
        }
        _ => {}
    }
}

fn normalize_tag(value: &str) -> String {
    let mut tag = value.trim();
    if let Some((prefix, suffix)) = tag.split_once([':', '：']) {
        let prefix = prefix.trim().to_lowercase();
        if prefix.contains("tag") || prefix.contains("label") || prefix.contains("标签") {
            tag = suffix;
        }
    }
    tag.trim_matches(|character: char| {
        character.is_whitespace()
            || matches!(
                character,
                '"' | '\'' | '`' | '[' | ']' | '{' | '}' | '-' | '*' | '#' | '•'
            )
    })
    .trim()
    .to_string()
}

/// Shared system prompt used by all AI-related endpoints and services.
/// Ensures the AI always responds in the same language as the user's input.
pub fn build_ai_system_prompt() -> String {
    "You are a helpful assistant that processes user content.\n\
     CRITICAL: You MUST ALWAYS respond in the SAME LANGUAGE as the user's input content.\n\
     - If the input is in Chinese, respond in Chinese.\n\
     - If the input is in Japanese, respond in Japanese.\n\
     - If the input is in Korean, respond in Korean.\n\
     - If the input is in English, respond in English.\n\
     - And so on for any language.\n\
     This is the most important rule. Never violate it."
        .to_string()
}

#[cfg(test)]
mod tests {
    use super::AiClient;

    #[test]
    fn parses_json_and_markdown_tag_responses() {
        assert_eq!(
            AiClient::parse_tag_list("```json\n[\"work\", \"health\"]\n```").unwrap(),
            vec!["work", "health"]
        );
        assert_eq!(
            AiClient::parse_tag_list("Here are the tags: [\"学习\", \"耳机\"]").unwrap(),
            vec!["学习", "耳机"]
        );
    }

    #[test]
    fn parses_object_and_delimited_tag_responses_without_duplicates() {
        assert_eq!(
            AiClient::parse_tag_list("{\"labels\":[\"work\",\"work\",\"health\"]}").unwrap(),
            vec!["work", "health"]
        );
        assert_eq!(
            AiClient::parse_tag_list("work, health，travel").unwrap(),
            vec!["work", "health", "travel"]
        );
    }
}
