use super::client::ApiClient;
use crate::error::AppResult;
use crate::models::{Diary, DiaryWithMemos, PaginatedResponse};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateOrUpdateDiaryRequest {
    pub summary: Option<String>,
    pub mood_key: Option<String>,
    pub mood_score: Option<i32>,
    pub cover_image_id: Option<Uuid>,
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdateDiarySummaryRequest {
    pub summary: String,
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdateDiaryMoodRequest {
    pub mood_key: String,
    pub mood_score: i32,
}

pub struct DiaryApi {
    client: ApiClient,
}

impl DiaryApi {
    pub fn new(client: ApiClient) -> Self {
        Self { client }
    }

    pub async fn get_by_date(&self, date: &str) -> AppResult<DiaryWithMemos> {
        self.client
            .request::<DiaryWithMemos>(
                reqwest::Method::GET,
                &format!("/api/diaries/{}", date),
                None,
            )
            .await
    }

    pub async fn create_or_update(
        &self,
        date: &str,
        req: CreateOrUpdateDiaryRequest,
    ) -> AppResult<Diary> {
        self.client
            .request::<Diary>(
                reqwest::Method::POST,
                &format!("/api/diaries/{}", date),
                Some(serde_json::to_value(req)?),
            )
            .await
    }

    pub async fn list(
        &self,
        page: u32,
        page_size: u32,
        start_date: Option<&str>,
        end_date: Option<&str>,
    ) -> AppResult<PaginatedResponse<Diary>> {
        let mut url = format!("/api/diaries?page={}&page_size={}", page, page_size);
        if let Some(start) = start_date {
            url.push_str(&format!("&start_date={}", start));
        }
        if let Some(end) = end_date {
            url.push_str(&format!("&end_date={}", end));
        }

        self.client
            .request::<PaginatedResponse<Diary>>(reqwest::Method::GET, &url, None)
            .await
    }

    pub async fn update_summary(
        &self,
        date: &str,
        req: UpdateDiarySummaryRequest,
    ) -> AppResult<()> {
        self.client
            .request::<()>(
                reqwest::Method::PUT,
                &format!("/api/diaries/{}/summary", date),
                Some(serde_json::to_value(req)?),
            )
            .await
    }

    pub async fn update_mood(&self, date: &str, req: UpdateDiaryMoodRequest) -> AppResult<()> {
        self.client
            .request::<()>(
                reqwest::Method::PUT,
                &format!("/api/diaries/{}/mood", date),
                Some(serde_json::to_value(req)?),
            )
            .await
    }
}
