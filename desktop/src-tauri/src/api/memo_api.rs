use super::client::ApiClient;
use crate::error::AppResult;
use crate::models::{MemoWithResources, PaginatedResponse};
use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateMemoRequest {
    pub content: String,
    pub tags: Vec<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub diary_date: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdateMemoRequest {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub content: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub tags: Option<Vec<String>>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub is_archived: Option<bool>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub diary_date: Option<Option<String>>,
}

pub struct MemoApi {
    client: ApiClient,
}

impl MemoApi {
    pub fn new(client: ApiClient) -> Self {
        Self { client }
    }

    pub async fn create(&self, req: CreateMemoRequest) -> AppResult<MemoWithResources> {
        self.client
            .request::<MemoWithResources>(
                reqwest::Method::POST,
                "/api/memos",
                Some(serde_json::to_value(req)?),
            )
            .await
    }

    pub async fn get(&self, id: &str) -> AppResult<MemoWithResources> {
        self.client
            .request::<MemoWithResources>(reqwest::Method::GET, &format!("/api/memos/{}", id), None)
            .await
    }

    pub async fn list(
        &self,
        page: u32,
        page_size: u32,
        archived: Option<bool>,
    ) -> AppResult<PaginatedResponse<MemoWithResources>> {
        let mut url = format!("/api/memos?page={}&page_size={}", page, page_size);
        if let Some(archived) = archived {
            url.push_str(&format!("&archived={}", archived));
        }

        self.client
            .request::<PaginatedResponse<MemoWithResources>>(reqwest::Method::GET, &url, None)
            .await
    }

    pub async fn list_by_diary_date(
        &self,
        page: u32,
        page_size: u32,
        diary_date: &str,
    ) -> AppResult<PaginatedResponse<MemoWithResources>> {
        let url = format!(
            "/api/memos?page={}&page_size={}&diary_date={}",
            page, page_size, diary_date
        );

        self.client
            .request::<PaginatedResponse<MemoWithResources>>(reqwest::Method::GET, &url, None)
            .await
    }

    pub async fn update(&self, id: &str, req: UpdateMemoRequest) -> AppResult<MemoWithResources> {
        self.client
            .request::<MemoWithResources>(
                reqwest::Method::PUT,
                &format!("/api/memos/{}", id),
                Some(serde_json::to_value(req)?),
            )
            .await
    }

    pub async fn delete(&self, id: &str) -> AppResult<()> {
        self.client
            .request::<()>(reqwest::Method::DELETE, &format!("/api/memos/{}", id), None)
            .await
    }

    pub async fn archive(&self, id: &str) -> AppResult<()> {
        self.client
            .request::<()>(
                reqwest::Method::PUT,
                &format!("/api/memos/{}/archive", id),
                None,
            )
            .await
    }

    pub async fn unarchive(&self, id: &str) -> AppResult<()> {
        self.client
            .request::<()>(
                reqwest::Method::PUT,
                &format!("/api/memos/{}/unarchive", id),
                None,
            )
            .await
    }

    pub async fn search(&self, query: &str) -> AppResult<Vec<MemoWithResources>> {
        self.client
            .request::<Vec<MemoWithResources>>(
                reqwest::Method::GET,
                &format!("/api/memos/search?q={}", urlencoding::encode(query)),
                None,
            )
            .await
    }
}

impl Default for UpdateMemoRequest {
    fn default() -> Self {
        Self {
            content: None,
            tags: None,
            is_archived: None,
            diary_date: None,
        }
    }
}
