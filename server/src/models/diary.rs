use chrono::NaiveDate;
use serde::{Deserialize, Deserializer, Serialize};
use sqlx::FromRow;
use uuid::Uuid;

fn deserialize_cover_image_id<'de, D>(deserializer: D) -> Result<Option<Option<Uuid>>, D::Error>
where
    D: Deserializer<'de>,
{
    let value = serde_json::Value::deserialize(deserializer)?;

    match value {
        serde_json::Value::Null => Ok(Some(None)),
        serde_json::Value::String(s) => {
            let parsed = Uuid::parse_str(&s).map_err(serde::de::Error::custom)?;
            Ok(Some(Some(parsed)))
        }
        _ => Err(serde::de::Error::custom(
            "coverImageId must be a UUID string or null",
        )),
    }
}

#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
#[serde(rename_all = "camelCase")]
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
    #[serde(default, deserialize_with = "deserialize_cover_image_id")]
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
