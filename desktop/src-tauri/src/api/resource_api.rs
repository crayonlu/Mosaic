use super::client::ApiClient;
use crate::error::{AppError, AppResult};
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ResourceResponse {
    pub id: String,
    pub memo_id: String,
    pub filename: String,
    pub resource_type: String,
    pub mime_type: String,
    pub file_size: i64,
    pub storage_type: String,
    pub url: String,
    pub created_at: i64,
}

pub struct ResourceApi {
    client: ApiClient,
}

impl ResourceApi {
    pub fn new(client: ApiClient) -> Self {
        Self { client }
    }

    pub async fn upload(
        &self,
        filename: String,
        data: Vec<u8>,
        mime_type: String,
    ) -> AppResult<serde_json::Value> {
        if !mime_type.starts_with("image/") {
            return Err(crate::error::AppError::UploadError(
                "Only image uploads are supported".to_string(),
            ));
        }

        let url = format!("{}/api/resources/upload", self.client.base_url());

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

    pub async fn get(&self, id: &str) -> AppResult<ResourceResponse> {
        self.client
            .request::<ResourceResponse>(
                reqwest::Method::GET,
                &format!("/api/resources/{}", id),
                None,
            )
            .await
    }

    pub async fn download(&self, filename: String) -> AppResult<Vec<u8>> {
        let url = format!(
            "{}/api/resources/download/{}",
            self.client.base_url(),
            filename
        );

        let mut request = self.client.inner().get(&url);

        if let Some(ref token) = self.client.token() {
            request = request.header("Authorization", format!("Bearer {}", token));
        }

        let response = request.send().await?;

        if !response.status().is_success() {
            return Err(crate::error::AppError::ApiError {
                status: response.status().as_u16(),
                message: "Download failed".to_string(),
            });
        }

        Ok(response.bytes().await?.to_vec())
    }

    pub async fn delete(&self, filename: String) -> AppResult<()> {
        self.client
            .request::<()>(
                reqwest::Method::DELETE,
                &format!("/api/resources/{}", filename),
                None,
            )
            .await
    }
}
