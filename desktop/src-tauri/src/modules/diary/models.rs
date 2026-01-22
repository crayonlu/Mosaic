use crate::modules::memo::models::MemoWithResources;
use serde::{Deserialize, Serialize};
use uuid::Uuid;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Diary {
    pub date: String,
    pub summary: String,
    pub mood_key: String,
    pub mood_score: i32,
    pub cover_image_id: Option<Uuid>,
    pub created_at: i64,
    pub updated_at: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DiaryWithMemos {
    #[serde(flatten)]
    pub diary: Diary,
    pub memos: Vec<MemoWithResources>,
}
