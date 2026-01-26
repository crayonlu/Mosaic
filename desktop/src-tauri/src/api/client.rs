use crate::error::{AppError, AppResult};
use base64::{engine::general_purpose, Engine as _};
use reqwest::Client;
use std::sync::Arc;
use tokio::sync::RwLock;

type RefreshTokenFn = Arc<
    dyn Fn() -> std::pin::Pin<Box<dyn std::future::Future<Output = AppResult<String>> + Send>>
        + Send
        + Sync,
>;

#[derive(Clone)]
pub struct ApiClient {
    client: Client,
    base_url: String,
    token: Arc<RwLock<Option<String>>>,
    refresh_token_fn: Option<RefreshTokenFn>,
}

impl ApiClient {
    pub fn new(base_url: String) -> Self {
        Self {
            client: Client::builder()
                .timeout(std::time::Duration::from_secs(30))
                .build()
                .expect("Failed to create HTTP client"),
            base_url,
            token: Arc::new(RwLock::new(None)),
            refresh_token_fn: None,
        }
    }

    pub fn with_token(mut self, token: String) -> Self {
        self.token = Arc::new(RwLock::new(Some(token)));
        self
    }

    pub fn with_refresh_fn<F>(mut self, f: F) -> Self
    where
        F: Fn() -> std::pin::Pin<Box<dyn std::future::Future<Output = AppResult<String>> + Send>>
            + Send
            + Sync
            + 'static,
    {
        self.refresh_token_fn = Some(Arc::new(f));
        self
    }

    pub fn base_url(&self) -> &str {
        &self.base_url
    }

    pub async fn token(&self) -> Option<String> {
        self.token.read().await.clone()
    }

    pub async fn set_token(&self, token: Option<String>) {
        *self.token.write().await = token;
    }

    pub fn inner(&self) -> &Client {
        &self.client
    }

    fn is_token_expired(token: &str) -> bool {
        if let Some(parts) = token.split('.').nth(1) {
            if let Ok(decoded) = general_purpose::URL_SAFE_NO_PAD.decode(parts) {
                if let Ok(claims) = serde_json::from_slice::<serde_json::Value>(&decoded) {
                    if let Some(exp) = claims.get("exp").and_then(|v| v.as_i64()) {
                        let now = chrono::Utc::now().timestamp();
                        let buffer = 60;
                        return now + buffer >= exp;
                    }
                }
            }
        }
        false
    }

    async fn refresh_token_if_needed(&self) -> AppResult<()> {
        let token = self.token.read().await.clone();

        if let Some(token_str) = token {
            if Self::is_token_expired(&token_str) {
                if let Some(ref refresh_fn) = self.refresh_token_fn {
                    let new_token = refresh_fn().await?;
                    *self.token.write().await = Some(new_token);
                }
            }
        }

        Ok(())
    }

    pub async fn request<T: for<'de> serde::Deserialize<'de>>(
        &self,
        method: reqwest::Method,
        path: &str,
        body: Option<serde_json::Value>,
    ) -> AppResult<T> {
        self.refresh_token_if_needed().await.ok();

        let result = self.do_request(method.clone(), path, body.clone()).await;

        if let Err(AppError::Unauthorized) = result {
            if let Some(ref refresh_fn) = self.refresh_token_fn {
                if let Ok(new_token) = refresh_fn().await {
                    *self.token.write().await = Some(new_token);
                    return self.do_request(method, path, body).await;
                }
            }
        }

        result
    }

    async fn do_request<T: for<'de> serde::Deserialize<'de>>(
        &self,
        method: reqwest::Method,
        path: &str,
        body: Option<serde_json::Value>,
    ) -> AppResult<T> {
        let url = format!("{}{}", self.base_url.trim_end_matches('/'), path);
        let mut request = self.client.request(method, &url);

        if let Some(token) = self.token.read().await.as_ref() {
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
