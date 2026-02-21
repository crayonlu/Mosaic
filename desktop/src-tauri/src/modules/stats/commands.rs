use crate::api::StatsApi;
use crate::cache::{CacheStats, CacheStore};
use crate::models::*;
use chrono::{Datelike, TimeZone};
use std::collections::HashMap;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;
use tauri::State;

pub struct StatsAppState {
    pub stats_api: Arc<StatsApi>,
    pub cache: Arc<CacheStore>,
    pub online: Arc<AtomicBool>,
}

#[tauri::command]
pub async fn get_heatmap(
    state: State<'_, crate::modules::stats::commands::StatsAppState>,
    start_date: String,
    end_date: String,
) -> Result<HeatMapData, String> {
    let online = state.online.load(Ordering::Relaxed);

    if online {
        state
            .stats_api
            .get_heatmap(&start_date, &end_date)
            .await
            .map_err(|e| e.to_string())
    } else {
        let cached_memos = state
            .cache
            .list_memos(10000, 0, None)
            .await
            .map_err(|e| e.to_string())?;

        let mut date_counts: HashMap<String, i32> = HashMap::new();

        for memo in cached_memos {
            if let Some(diary_date) = &memo.diary_date {
                if diary_date >= &start_date && diary_date <= &end_date {
                    *date_counts.entry(diary_date.clone()).or_insert(0) += 1;
                }
            }
        }

        let mut dates: Vec<String> = date_counts.keys().cloned().collect();
        dates.sort();

        let mut counts: Vec<i32> = Vec::new();
        for date in &dates {
            counts.push(*date_counts.get(date).unwrap_or(&0));
        }

        Ok(HeatMapData { dates, counts })
    }
}

#[tauri::command]
pub async fn get_timeline(
    state: State<'_, crate::modules::stats::commands::StatsAppState>,
    start_date: String,
    end_date: String,
) -> Result<TimelineData, String> {
    let online = state.online.load(Ordering::Relaxed);

    if online {
        state
            .stats_api
            .get_timeline(&start_date, &end_date)
            .await
            .map_err(|e| e.to_string())
    } else {
        let cached_memos = state
            .cache
            .list_memos(10000, 0, None)
            .await
            .map_err(|e| e.to_string())?;

        let cached_diaries = state
            .cache
            .list_diaries(10000, 0)
            .await
            .map_err(|e| e.to_string())?;

        let mut diary_map: HashMap<String, (String, String, i32)> = HashMap::new();
        for diary in cached_diaries {
            diary_map.insert(
                diary.date.clone(),
                (diary.summary, diary.mood_key, diary.mood_score),
            );
        }

        let mut date_memo_count: HashMap<String, i32> = HashMap::new();
        for memo in cached_memos {
            if let Some(diary_date) = &memo.diary_date {
                if diary_date >= &start_date && diary_date <= &end_date {
                    *date_memo_count.entry(diary_date.clone()).or_insert(0) += 1;
                }
            }
        }

        let mut dates: Vec<String> = date_memo_count.keys().cloned().collect();
        dates.sort();
        dates.reverse();

        let mut entries: Vec<TimelineEntry> = Vec::new();
        for date in dates {
            let memo_count = *date_memo_count.get(&date).unwrap_or(&0);
            let (summary, mood_key, mood_score) = diary_map
                .get(&date)
                .map(|(s, m, sc)| (s.clone(), Some(m.clone()), Some(*sc)))
                .unwrap_or_else(|| (String::new(), None, None));

            let color = match mood_key.as_deref() {
                Some("joy") => "#FFD93D",
                Some("sadness") => "#4ECDC4",
                Some("anger") => "#FF6B6B",
                Some("anxiety") => "#FFA07A",
                Some("calm") => "#95E1D3",
                Some("focus") => "#6C5CE7",
                Some("tired") => "#A8A8A8",
                Some("neutral") | _ => "#8b5cf6",
            };

            entries.push(TimelineEntry {
                date: date.clone(),
                mood_key,
                mood_score,
                summary,
                memo_count,
                color: color.to_string(),
            });
        }

        Ok(TimelineData { entries })
    }
}

#[tauri::command]
pub async fn get_trends(
    state: State<'_, crate::modules::stats::commands::StatsAppState>,
    start_date: String,
    end_date: String,
) -> Result<TrendsData, String> {
    let online = state.online.load(Ordering::Relaxed);

    if online {
        state
            .stats_api
            .get_trends(&start_date, &end_date)
            .await
            .map_err(|e| e.to_string())
    } else {
        let cached_memos = state
            .cache
            .list_memos(10000, 0, None)
            .await
            .map_err(|e| e.to_string())?;

        let mut tag_counts: HashMap<String, i32> = HashMap::new();
        for memo in cached_memos {
            let tags: Vec<String> = serde_json::from_str(&memo.tags).unwrap_or_default();
            for tag in tags {
                *tag_counts.entry(tag).or_insert(0) += 1;
            }
        }

        let mut tags: Vec<TagData> = tag_counts
            .into_iter()
            .map(|(tag, count)| TagData { tag, count })
            .collect();
        tags.sort_by(|a, b| b.count.cmp(&a.count));
        tags.truncate(20);

        Ok(TrendsData {
            moods: Vec::new(),
            tags,
        })
    }
}

#[tauri::command]
pub async fn get_summary(
    state: State<'_, crate::modules::stats::commands::StatsAppState>,
    year: i32,
    month: i32,
) -> Result<SummaryData, String> {
    let online = state.online.load(Ordering::Relaxed);

    if online {
        state
            .stats_api
            .get_summary(year, month)
            .await
            .map_err(|e| e.to_string())
    } else {
        let cached_memos = state
            .cache
            .list_memos(10000, 0, None)
            .await
            .map_err(|e| e.to_string())?;

        let cached_diaries = state
            .cache
            .list_diaries(10000, 0)
            .await
            .map_err(|e| e.to_string())?;

        let mut total_memos: i64 = 0;
        let mut total_diaries: i64 = 0;

        for memo in cached_memos {
            let memo_date = chrono::Utc.timestamp_millis_opt(memo.created_at).unwrap();
            if memo_date.year() == year as i32 && memo_date.month() as u32 == month as u32 {
                total_memos += 1;
            }
        }

        for diary in cached_diaries {
            let diary_date = chrono::NaiveDate::parse_from_str(&diary.date, "%Y-%m-%d").unwrap();
            if diary_date.year() == year && diary_date.month() as u32 == month as u32 {
                total_diaries += 1;
            }
        }

        Ok(SummaryData {
            total_memos,
            total_diaries,
            total_resources: 0,
        })
    }
}

#[tauri::command]
pub async fn get_cache_stats(state: State<'_, StatsAppState>) -> Result<CacheStats, String> {
    state
        .cache
        .get_cache_stats()
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn clear_backend_cache(state: State<'_, StatsAppState>) -> Result<(), String> {
    state
        .cache
        .clear_all_cache()
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn clear_memos_cache(state: State<'_, StatsAppState>) -> Result<(), String> {
    state.cache.clear_memos().await.map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn clear_diaries_cache(state: State<'_, StatsAppState>) -> Result<(), String> {
    state.cache.clear_diaries().await.map_err(|e| e.to_string())
}
