use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct HeatMapData {
    pub dates: Vec<String>,
    pub counts: Vec<i32>,
    pub moods: Vec<Option<String>>,
    pub mood_scores: Vec<Option<i32>>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TimelineEntry {
    pub date: String,
    pub mood_key: Option<String>,
    pub mood_score: Option<i32>,
    pub summary: String,
    pub memo_count: i32,
    pub color: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TimelineData {
    pub entries: Vec<TimelineEntry>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TrendsData {
    pub moods: Vec<MoodData>,
    pub tags: Vec<TagData>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct MoodData {
    pub mood_key: String,
    pub count: i32,
    pub percentage: f32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TagData {
    pub tag: String,
    pub count: i32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SummaryData {
    pub total_memos: i64,
    pub total_diaries: i64,
    pub total_resources: i64,
}
