use crate::database::schema::MoodKey;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct StatsQuery {
    // start date(YYYY-MM-DD)
    pub start_date: String,
    // end date(YYYY-MM-DD)
    pub end_date: String,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct StatsResponse {
    // total memos
    pub total_memos: i32,
    // total diaries
    pub total_diaries: i32,
    // total tags
    pub total_tags: HashMap<String, i32>,
    // total moods
    pub total_moods: HashMap<MoodKey, i32>,
}

// heat map
#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct HeatMapQuery {
    pub start_date: String,
    pub end_date: String,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct HeatMapCell {
    pub date: String,
    pub mood_key: Option<MoodKey>,
    pub mood_score: Option<i32>,
    pub color: String,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct HeatMapData {
    pub start_date: String,
    pub end_date: String,
    pub cells: Vec<HeatMapCell>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TimelineQuery {
    pub start_date: String,
    pub end_date: String,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct TimelineEntry {
    pub date: String,
    pub mood_key: Option<MoodKey>,
    pub mood_score: Option<i32>,
    pub summary: String,
    pub memo_count: i32,
    pub color: String,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct TimelineData {
    pub entries: Vec<TimelineEntry>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TrendsQuery {
    pub start_date: String,
    pub end_date: String,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct TrendPoint {
    pub date: String,
    pub mood_score: Option<i32>,
    pub color: String,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct TrendsData {
    pub points: Vec<TrendPoint>,
    pub avg_score: f32,
    pub max_score: i32,
    pub min_score: i32,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SummaryQuery {
    pub year: i32,
    pub month: i32,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct MoodStats {
    pub mood_key: MoodKey,
    pub count: i32,
    pub percentage: f32,
    pub color: String,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct TagStats {
    pub tag: String,
    pub count: i32,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SummaryData {
    pub year: i32,
    pub month: i32,
    pub total_days: i32,
    pub recorded_days: i32,
    pub avg_mood_score: f32,
    pub mood_distribution: Vec<MoodStats>,
    pub top_tags: Vec<TagStats>,
    pub dominant_mood: Option<MoodKey>,
}
