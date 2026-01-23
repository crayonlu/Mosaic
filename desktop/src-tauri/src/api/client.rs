use crate::error::{AppError, AppResult};
use reqwest::Client;

#[derive(Clone)]
pub struct ApiClient {
    client: Client,
    base_url: String,
    token: Option<String>,
}

impl ApiClient {
    pub fn new(base_url: String) -> Self {
        Self {
            client: Client::builder()
                .timeout(std::time::Duration::from_secs(30))
                .build()
                .expect("Failed to create HTTP client"),
            base_url,
            token: None,
        }
    }

    pub fn with_token(mut self, token: String) -> Self {
        self.token = Some(token);
        self
    }

    pub fn base_url(&self) -> &str {
        &self.base_url
    }

    pub fn token(&self) -> Option<&String> {
        self.token.as_ref()
    }

    pub fn set_token(&mut self, token: Option<String>) {
        self.token = token;
    }

    pub fn inner(&self) -> &Client {
        &self.client
    }

    pub async fn request<T: for<'de> serde::Deserialize<'de>>(
        &self,
        method: reqwest::Method,
        path: &str,
        body: Option<serde_json::Value>,
    ) -> AppResult<T> {
        let url = format!("{}{}", self.base_url.trim_end_matches('/'), path);
        let mut request = self.client.request(method, &url);

        if let Some(ref token) = self.token {
            request = request.header("Authorization", format!("Bearer {}", token));
        }

        if let Some(body) = body {
            request = request.json(&body);
        }

        let response = request.send().await?;

        let status = response.status();
        if !status.is_success() {
            let error_text = response.text().await.unwrap_or_default();
            if status.as_u16() == 401 {
                return Err(AppError::Unauthorized);
            }
            return Err(AppError::ApiError {
                status: status.as_u16(),
                message: error_text,
            });
        }

        response.json::<T>().await.map_err(AppError::from)
    }
}
