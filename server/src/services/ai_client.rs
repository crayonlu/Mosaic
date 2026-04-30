use base64::{engine::general_purpose, Engine as _};
use serde_json::json;

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
}

impl AiClient {
    pub fn new() -> Self {
        Self {
            client: reqwest::Client::new(),
        }
    }

    pub async fn send_ai_messages(
        &self,
        config: &AiConfig,
        system_prompt: String,
        messages: Vec<serde_json::Value>,
        bot_model: Option<&str>,
    ) -> Result<AiReply, Box<dyn std::error::Error + Send + Sync>> {
        let base_url = config.base_url.trim_end_matches('/');

        let target_model = bot_model.unwrap_or(&config.model);

        let (url, body) = match config.provider.as_str() {
            "anthropic" => {
                let url = format!("{}/messages", base_url);
                let body = json!({
                    "model": target_model,
                    "max_tokens": config.max_tokens.unwrap_or(512),
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
                    "max_tokens": config.max_tokens.unwrap_or(512),
                    "temperature": 0.8,
                });
                (url, body)
            }
        };

        let mut request = self.client.post(&url).json(&body);

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

    pub fn build_user_message(
        text: &str,
        images: &[AiImageInput],
        provider: &str,
    ) -> serde_json::Value {
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
}
