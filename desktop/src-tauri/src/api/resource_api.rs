use super::client::ApiClient;
use crate::error::{AppError, AppResult};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

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

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateResourceRequest {
    pub memo_id: String,
    pub filename: String,
    pub mime_type: String,
    pub file_size: i64,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PresignedUploadResponse {
    pub upload_url: String,
    pub resource_id: String,
    pub storage_path: String,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ConfirmUploadRequest {
    pub resource_id: String,
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

        if let Some(token) = self.client.token().await {
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

    pub async fn delete(&self, id: &str) -> AppResult<()> {
        self.client
            .request::<()>(
                reqwest::Method::DELETE,
                &format!("/api/resources/{}", id),
                None,
            )
            .await
    }

    pub async fn upload_direct(
        &self,
        memo_id: String,
        filename: String,
        data: Vec<u8>,
        mime_type: String,
    ) -> AppResult<ResourceResponse> {
        if !mime_type.starts_with("image/") {
            return Err(AppError::UploadError(
                "Only image uploads are supported".to_string(),
            ));
        }

        let create_req = CreateResourceRequest {
            memo_id: memo_id.clone(),
            filename: filename.clone(),
            mime_type: mime_type.clone(),
            file_size: data.len() as i64,
        };

        let presigned_response: PresignedUploadResponse = self
            .client
            .request(
                reqwest::Method::POST,
                "/api/resources/presigned-upload",
                Some(serde_json::to_value(create_req).map_err(AppError::SerializationError)?),
            )
            .await?;

        let client = reqwest::Client::new();
        let response = client
            .put(&presigned_response.upload_url)
            .header("content-type", &mime_type)
            .body(data)
            .send()
            .await?;

        if !response.status().is_success() {
            return Err(AppError::UploadError(format!(
                "Direct upload failed: {}",
                response.status()
            )));
        }

        let confirm_req = ConfirmUploadRequest {
            resource_id: presigned_response.resource_id,
        };

        self.client
            .request(
                reqwest::Method::POST,
                "/api/resources/confirm-upload",
                Some(serde_json::to_value(confirm_req).map_err(AppError::SerializationError)?),
            )
            .await
    }
}
