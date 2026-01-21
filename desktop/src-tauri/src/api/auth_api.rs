use super::client::ApiClient;
use crate::error::AppResult;
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LoginRequest {
    pub username: String,
    pub password: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LoginResponse {
    pub access_token: String,
    pub refresh_token: String,
    pub user: crate::models::User,
}

#[derive(Debug, Clone, Serialize)]
pub struct RefreshTokenRequest {
    pub refresh_token: String,
}

pub struct AuthApi {
    client: ApiClient,
}

impl AuthApi {
    pub fn new(base_url: String) -> Self {
        Self {
            client: ApiClient::new(base_url),
        }
    }

    pub async fn login(&self, username: &str, password: &str) -> AppResult<LoginResponse> {
        self.client
            .request::<LoginResponse>(
                reqwest::Method::POST,
                "/api/auth/login",
                Some(serde_json::to_value(LoginRequest {
                    username: username.to_string(),
                    password: password.to_string(),
                })?),
            )
            .await
    }

    pub async fn refresh_token(&self, refresh_token: &str) -> AppResult<LoginResponse> {
        self.client
            .request::<LoginResponse>(
                reqwest::Method::POST,
                "/api/auth/refresh",
                Some(serde_json::to_value(RefreshTokenRequest {
                    refresh_token: refresh_token.to_string(),
                })?),
            )
            .await
    }
}
