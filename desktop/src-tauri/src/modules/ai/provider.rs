use crate::config::AppConfig;
use crate::error::AppResult;
use crate::modules::ai::models::{
    CompleteTextRequest, RewriteTextRequest, SuggestTagsRequest, SummarizeTextRequest,
};
use crate::modules::ai::prompts::PromptBuilder;
use crate::modules::settings::models::AIConfig;

pub async fn load_ai_config() -> AppResult<Option<AIConfig>> {
    let config = AppConfig::load().map_err(|e| {
        crate::error::AppError::ConfigError(format!("Failed to load config: {}", e))
    })?;

    let provider = config.server.ai_provider;
    let base_url = config.server.ai_base_url;
    let api_key = config.server.ai_api_key;

    if provider.is_empty() || base_url.is_empty() || api_key.is_empty() {
        return Ok(None);
    }

    let model = config.server.ai_model;
    let temperature = config.server.ai_temperature;
    let max_tokens = config.server.ai_max_tokens;
    let timeout = config.server.ai_timeout.map(|t| t as i32);

    Ok(Some(AIConfig {
        provider,
        base_url,
        api_key,
        model,
        temperature,
        max_tokens,
        timeout,
    }))
}

pub async fn create_provider() -> AppResult<Provider> {
    let config = load_ai_config()
        .await?
        .ok_or_else(|| crate::error::AppError::NotFound("AI config not found".to_string()))?;

    match config.provider.to_lowercase().as_str() {
        "openai" => Ok(Provider::OpenAI(OpenAIProvider::new(&config))),
        "anthropic" => Ok(Provider::Anthropic(AnthropicProvider::new(&config))),
        _ => Err(crate::error::AppError::ConfigError(format!(
            "not supported provider: {}",
            config.provider
        ))),
    }
}

pub trait AIProvider {
    async fn complete_text(&self, req: &CompleteTextRequest) -> AppResult<String>;
    async fn rewrite_text(&self, req: &RewriteTextRequest) -> AppResult<String>;
    async fn summarize_text(&self, req: &SummarizeTextRequest) -> AppResult<String>;
    async fn suggest_tags(&self, req: &SuggestTagsRequest) -> AppResult<String>;
}

pub enum Provider {
    OpenAI(OpenAIProvider),
    Anthropic(AnthropicProvider),
}

impl AIProvider for Provider {
    async fn complete_text(&self, req: &CompleteTextRequest) -> AppResult<String> {
        match self {
            Provider::OpenAI(provider) => provider.complete_text(req).await,
            Provider::Anthropic(provider) => provider.complete_text(req).await,
        }
    }

    async fn rewrite_text(&self, req: &RewriteTextRequest) -> AppResult<String> {
        match self {
            Provider::OpenAI(provider) => provider.rewrite_text(req).await,
            Provider::Anthropic(provider) => provider.rewrite_text(req).await,
        }
    }

    async fn summarize_text(&self, req: &SummarizeTextRequest) -> AppResult<String> {
        match self {
            Provider::OpenAI(provider) => provider.summarize_text(req).await,
            Provider::Anthropic(provider) => provider.summarize_text(req).await,
        }
    }

    async fn suggest_tags(&self, req: &SuggestTagsRequest) -> AppResult<String> {
        match self {
            Provider::OpenAI(provider) => provider.suggest_tags(req).await,
            Provider::Anthropic(provider) => provider.suggest_tags(req).await,
        }
    }
}

pub struct OpenAIProvider {
    client: reqwest::Client,
    base_url: String,
    api_key: String,
    model: String,
    temperature: f64,
    max_tokens: i32,
    timeout: u64,
}

impl OpenAIProvider {
    pub fn new(config: &AIConfig) -> Self {
        Self {
            client: reqwest::Client::new(),
            base_url: config.base_url.clone(),
            api_key: config.api_key.clone(),
            model: config.model.clone().unwrap_or_default(),
            temperature: config.temperature.unwrap_or(0.7),
            max_tokens: config.max_tokens.unwrap_or(1000),
            timeout: config.timeout.unwrap_or(30) as u64,
        }
    }

    pub async fn call_api(&self, prompt: &str) -> AppResult<String> {
        let url = format!("{}/v1/chat/completions", self.base_url);

        let request_body = serde_json::json!(
            {
                "model": self.model,
                "messages": [
                    {
                        "role": "user",
                        "content": prompt,
                    }
                ],
                "temperature": self.temperature,
                "max_tokens": self.max_tokens,
            }
        );

        let response = self
            .client
            .post(&url)
            .header("Authorization", format!("Bearer {}", self.api_key))
            .header("Content-Type", "application/json")
            .json(&request_body)
            .timeout(std::time::Duration::from_secs(self.timeout))
            .send()
            .await
            .map_err(crate::error::AppError::NetworkError)?;

        if !response.status().is_success() {
            let status = response.status();
            let error_text = response.text().await.unwrap_or_default();
            return Err(crate::error::AppError::ApiError {
                status: status.as_u16(),
                message: error_text,
            });
        }

        let json: serde_json::Value = response
            .json()
            .await
            .map_err(|e| crate::error::AppError::Internal(format!("Json parsing error: {}", e)))?;

        let generated_text = json["choices"][0]["message"]["content"]
            .as_str()
            .unwrap_or_default();
        Ok(generated_text.to_string())
    }
}

impl AIProvider for OpenAIProvider {
    async fn complete_text(&self, req: &CompleteTextRequest) -> AppResult<String> {
        let prompt = PromptBuilder::build_complete_prompt(&req.content, req.context.as_deref());
        self.call_api(&prompt).await
    }

    async fn rewrite_text(&self, req: &RewriteTextRequest) -> AppResult<String> {
        let prompt = PromptBuilder::build_rewrite_prompt(&req.text, req.style.as_deref());
        self.call_api(&prompt).await
    }

    async fn summarize_text(&self, req: &SummarizeTextRequest) -> AppResult<String> {
        let prompt = PromptBuilder::build_summarize_prompt(&req.text, req.max_length);
        self.call_api(&prompt).await
    }

    async fn suggest_tags(&self, req: &SuggestTagsRequest) -> AppResult<String> {
        let prompt =
            PromptBuilder::build_suggest_tags_prompt(&req.content, req.existing_tags.clone());
        self.call_api(&prompt).await
    }
}

pub struct AnthropicProvider {
    client: reqwest::Client,
    base_url: String,
    api_key: String,
    model: String,
    temperature: f64,
    max_tokens: i32,
    timeout: u64,
}

impl AnthropicProvider {
    pub fn new(config: &AIConfig) -> Self {
        Self {
            client: reqwest::Client::new(),
            base_url: config.base_url.clone(),
            api_key: config.api_key.clone(),
            model: config
                .model
                .clone()
                .unwrap_or_else(|| "claude-3-5-sonnet-20241022".to_string()),
            temperature: config.temperature.unwrap_or(0.7),
            max_tokens: config.max_tokens.unwrap_or(1000),
            timeout: config.timeout.unwrap_or(30) as u64,
        }
    }

    pub async fn call_api(&self, prompt: &str) -> AppResult<String> {
        let url = format!("{}/v1/messages", self.base_url.trim_end_matches('/'));

        let request_body = serde_json::json!({
            "model": self.model,
            "max_tokens": self.max_tokens,
            "temperature": self.temperature,
            "messages": [
                {
                    "role": "user",
                    "content": prompt
                }
            ]
        });

        let response = self
            .client
            .post(&url)
            .header("x-api-key", &self.api_key)
            .header("anthropic-version", "2023-06-01")
            .header("Content-Type", "application/json")
            .json(&request_body)
            .timeout(std::time::Duration::from_secs(self.timeout))
            .send()
            .await
            .map_err(crate::error::AppError::NetworkError)?;

        if !response.status().is_success() {
            let status = response.status();
            let error_text = response.text().await.unwrap_or_default();
            return Err(crate::error::AppError::ApiError {
                status: status.as_u16(),
                message: error_text,
            });
        }

        let json: serde_json::Value = response
            .json()
            .await
            .map_err(|e| crate::error::AppError::Internal(format!("Json parsing error: {}", e)))?;

        let generated_text = json["content"][0]["text"].as_str().ok_or_else(|| {
            crate::error::AppError::NotFound(
                "Json parsing error: cannot find content[0].text".to_string(),
            )
        })?;

        Ok(generated_text.to_string())
    }
}

impl AIProvider for AnthropicProvider {
    async fn complete_text(&self, req: &CompleteTextRequest) -> AppResult<String> {
        let prompt = PromptBuilder::build_complete_prompt(&req.content, req.context.as_deref());
        self.call_api(&prompt).await
    }

    async fn rewrite_text(&self, req: &RewriteTextRequest) -> AppResult<String> {
        let prompt = PromptBuilder::build_rewrite_prompt(&req.text, req.style.as_deref());
        self.call_api(&prompt).await
    }

    async fn summarize_text(&self, req: &SummarizeTextRequest) -> AppResult<String> {
        let prompt = PromptBuilder::build_summarize_prompt(&req.text, req.max_length);
        self.call_api(&prompt).await
    }

    async fn suggest_tags(&self, req: &SuggestTagsRequest) -> AppResult<String> {
        let prompt =
            PromptBuilder::build_suggest_tags_prompt(&req.content, req.existing_tags.clone());
        self.call_api(&prompt).await
    }
}
