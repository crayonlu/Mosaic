use chrono::NaiveDate;
use serde::{Deserialize, Serialize};
use sqlx::FromRow;
use uuid::Uuid;

#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct Diary {
    pub date: NaiveDate,
    pub user_id: Uuid,
    pub summary: String,
    pub mood_key: String,
    pub mood_score: i32,
    pub cover_image_id: Option<Uuid>,
    pub created_at: i64,
    pub updated_at: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DiaryResponse {
    pub date: NaiveDate,
    pub summary: String,
    pub mood_key: String,
    pub mood_score: i32,
    pub cover_image_id: Option<Uuid>,
    pub created_at: i64,
    pub updated_at: i64,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateDiaryRequest {
    pub date: NaiveDate,
    pub summary: String,
    pub mood_key: String,
    #[serde(default)]
    pub mood_score: i32,
    #[serde(default)]
    pub cover_image_id: Option<Uuid>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdateDiaryRequest {
    pub summary: Option<String>,
    pub mood_key: Option<String>,
    pub mood_score: Option<i32>,
    pub cover_image_id: Option<Option<Uuid>>,
}

#[derive(Debug, Deserialize)]
pub struct DiaryListQuery {
    pub page: Option<u32>,
    pub page_size: Option<u32>,
    pub start_date: Option<NaiveDate>,
    pub end_date: Option<NaiveDate>,
}

impl From<Diary> for DiaryResponse {
    fn from(diary: Diary) -> Self {
        DiaryResponse {
            date: diary.date,
            summary: diary.summary,
            mood_key: diary.mood_key,
            mood_score: diary.mood_score,
            cover_image_id: diary.cover_image_id,
            created_at: diary.created_at,
            updated_at: diary.updated_at,
        }
    }
}
