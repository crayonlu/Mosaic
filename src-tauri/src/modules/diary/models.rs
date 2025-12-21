use crate::database::schema::MoodKey;
use crate::modules::memo::models::MemoWithResources;
use serde::{Deserialize, Serialize};
use sqlx::FromRow;

#[derive(Debug, Serialize, FromRow)]
#[serde(rename_all = "camelCase")]
pub struct Diary {
    // date(YYYY-MM-DD)
    pub date: String,
    // summary of the day
    pub summary: String,
    // mood of the day
    pub mood_key: MoodKey,
    // mood score
    pub mood_score: i32,
    // tags
    pub tags: String,
    // cover image id(optional)
    pub cover_image_id: Option<String>,
    // memo count(that day contains how many memos)
    pub memo_count: i32,
    // created at(ms)
    pub created_at: i64,
    // updated at(ms)(for sync)
    pub updated_at: i64,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DiaryWithMemos {
    #[serde(flatten)]
    pub diary: Diary,
    // memos of the day
    pub memos: Vec<MemoWithResources>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateOrUpdateDiaryRequest {
    // date(YYYY-MM-DD)
    pub date: String,
    pub summary: Option<String>,
    pub mood_key: Option<MoodKey>,
    // mood score
    pub mood_score: Option<i32>,
    // tags
    pub tags: Option<String>,
    // cover image id(optional)
    pub cover_image_id: Option<String>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdateDiarySummaryRequest {
    pub date: String,
    pub summary: String,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdateDiaryMoodRequest {
    pub date: String,
    pub mood_key: MoodKey,
    // mood score
    pub mood_score: i32,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ListDiariesRequest {
    // page number, start from 1
    pub page: Option<u32>,
    // page size
    pub page_size: Option<u32>,
    // start date(YYYY-MM-DD)
    pub start_date: Option<String>,
    // end date(YYYY-MM-DD)
    pub end_date: Option<String>,
}
