use super::client::ApiClient;
use crate::error::{AppError, AppResult};
use serde::Serialize;

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdateUserRequest {
    pub username: Option<String>,
    pub avatar_url: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdateAvatarRequest {
    pub avatar_url: String,
}

pub struct UserApi {
    client: ApiClient,
}

impl UserApi {
    pub fn new(client: ApiClient) -> Self {
        Self { client }
    }

    pub async fn get(&self) -> AppResult<crate::models::User> {
        self.client
            .request::<crate::models::User>(reqwest::Method::GET, "/api/auth/me", None)
            .await
    }

    pub async fn update(&self, req: UpdateUserRequest) -> AppResult<crate::models::User> {
        self.client
            .request::<crate::models::User>(
                reqwest::Method::PUT,
                "/api/auth/update-user",
                Some(serde_json::to_value(req)?),
            )
            .await
    }

    pub async fn update_avatar(&self, req: UpdateAvatarRequest) -> AppResult<crate::models::User> {
        self.client
            .request::<crate::models::User>(
                reqwest::Method::POST,
                "/api/auth/update-avatar",
                Some(serde_json::to_value(req)?),
            )
            .await
    }

    pub async fn upload_avatar(
        &self,
        _source_path: String,
        data: Vec<u8>,
        filename: String,
        mime_type: String,
    ) -> AppResult<crate::models::User> {
        let url = format!("{}/api/resources/upload-avatar", self.client.base_url());

        let form = reqwest::multipart::Form::new().part(
            "file",
            reqwest::multipart::Part::bytes(data)
                .file_name(filename)
                .mime_str(&mime_type)?,
        );

        let mut request = self.client.inner().post(&url);

        if let Some(ref token) = self.client.token() {
            request = request.header("Authorization", format!("Bearer {}", token));
        }

        let response = request.multipart(form).send().await?;

        if !response.status().is_success() {
            let status = response.status();
            let error_text = response.text().await.unwrap_or_default();
            return Err(crate::error::AppError::ApiError {
                status: status.as_u16(),
                message: error_text,
            });
        }

        response.json().await.map_err(AppError::from)
    }
}
