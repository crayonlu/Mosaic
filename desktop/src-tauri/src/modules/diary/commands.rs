use crate::api::{DiaryApi, ApiCreateOrUpdateDiaryRequest};
use crate::cache::{CacheStore, CachedDiary, CachedMemo, OfflineOperation};
use crate::config::AppConfig;
use crate::error::{AppError, AppResult};
use crate::modules::diary::models::{DiaryWithMemos, Diary};
use crate::models::PaginatedResponse;
use crate::sync::SyncManager;
use tauri::State;
use std::sync::Arc;
use std::sync::atomic::{AtomicBool, Ordering};

pub struct DiaryAppState {
    pub config: Arc<AppConfig>,
    pub diary_api: Arc<DiaryApi>,
    pub cache: Arc<CacheStore>,
    pub sync_manager: Arc<SyncManager>,
    pub online: Arc<AtomicBool>,
}

#[derive(Debug, Clone)]
pub struct CreateOrUpdateDiaryRequest {
    pub summary: Option<String>,
    pub mood_key: Option<String>,
    pub mood_score: Option<i32>,
    pub cover_image_id: Option<String>,
}

#[derive(Debug, Clone)]
pub struct UpdateDiarySummaryRequest {
    pub date: String,
    pub summary: String,
}

#[derive(Debug, Clone)]
pub struct UpdateDiaryMoodRequest {
    pub date: String,
    pub mood_key: String,
    pub mood_score: i32,
}

#[tauri::command]
pub async fn get_diary_by_date(
    state: State<'_, DiaryAppState>,
    date: String,
) -> Result<DiaryWithMemos, String> {
    let online = state.online.load(Ordering::Relaxed);

    if online {
        let diary_with_memos = state.diary_api.get_by_date(&date).await
            .map_err(|e| e.to_string())?;

        let cached = CachedDiary {
            date: diary_with_memos.diary.date.clone(),
            summary: diary_with_memos.diary.summary.clone(),
            mood_key: diary_with_memos.diary.mood_key.clone(),
            mood_score: diary_with_memos.diary.mood_score,
            cover_image_id: diary_with_memos.diary.cover_image_id.map(|id| id.to_string()),
            memo_count: diary_with_memos.diary.memo_count,
            created_at: diary_with_memos.diary.created_at,
            updated_at: diary_with_memos.diary.updated_at,
            synced_at: chrono::Utc::now().timestamp_millis(),
        };
        let _ = state.cache.upsert_diary(&cached).await;

        Ok(diary_with_memos)
    } else {
        match state.cache.get_diary(&date).await {
            Ok(Some(cached)) => {
                let memos = state.cache.list_memos(1000, 0, None).await
                    .map_err(|e| e.to_string())?;

                let filtered_memos: Vec<crate::models::MemoWithResources> = memos
                    .into_iter()
                    .filter(|m| m.diary_date.as_ref().map_or(false, |d| d == &date))
                    .map(|c| c.to_memo_with_resources())
                    .collect();

                Ok(DiaryWithMemos {
                    diary: Diary {
                        date: cached.date,
                        summary: cached.summary,
                        mood_key: cached.mood_key,
                        mood_score: cached.mood_score,
                        cover_image_id: cached.cover_image_id.as_ref().and_then(|id| uuid::Uuid::parse_str(id).ok()),
                        memo_count: cached.memo_count,
                        created_at: cached.created_at,
                        updated_at: cached.updated_at,
                    },
                    memos: filtered_memos,
                })
            }
            Ok(None) => Err("Diary not found in cache".to_string()),
        }
    }
}

#[tauri::command]
pub async fn create_or_update_diary(
    state: State<'_, DiaryAppState>,
    date: String,
    req: CreateOrUpdateDiaryRequest,
) -> Result<(), String> {
    let online = state.online.load(Ordering::Relaxed);

    if online {
        let api_req = ApiCreateOrUpdateDiaryRequest {
            summary: req.summary.clone(),
            mood_key: req.mood_key.clone(),
            mood_score: req.mood_score,
            cover_image_id: req.cover_image_id.as_ref().and_then(|id| uuid::Uuid::parse_str(id).ok()),
        };
        state.diary_api.create_or_update(&date, api_req).await
            .map_err(|e| e.to_string())?;

        if let Some(diary) = state.cache.get_diary(&date).await {
            let mut updated = diary;
            if let Some(summary) = &req.summary {
                updated.summary = summary.clone();
            }
            if let Some(mood_key) = &req.mood_key {
                updated.mood_key = mood_key.clone();
            }
            if let Some(mood_score) = req.mood_score {
                updated.mood_score = mood_score;
            }
            if let Some(cover_image_id) = &req.cover_image_id {
                updated.cover_image_id = Some(cover_image_id.clone());
            }
            updated.updated_at = chrono::Utc::now().timestamp_millis();
            state.cache.upsert_diary(&updated).await.ok();
        }
    } else {
        let cached_diary = state.cache.get_diary(&date).await;
        let exists = cached_diary.is_some();

        let cached = CachedDiary {
            date: date.clone(),
            summary: req.summary.unwrap_or_else(|| {
                cached_diary.as_ref().map(|d| d.summary.clone()).unwrap_or_default()
            }),
            mood_key: req.mood_key.unwrap_or_else(|| {
                cached_diary.as_ref().map(|d| d.mood_key.clone()).unwrap_or_else(|| "neutral".to_string())
            }),
            mood_score: req.mood_score.unwrap_or_else(|| {
                cached_diary.as_ref().map(|d| d.mood_score).unwrap_or(50)
            }),
            cover_image_id: req.cover_image_id.clone(),
            memo_count: cached_diary.as_ref().map(|d| d.memo_count).unwrap_or(0),
            created_at: cached_diary.as_ref().map(|d| d.created_at).unwrap_or_else(|| chrono::Utc::now().timestamp_millis()),
            updated_at: chrono::Utc::now().timestamp_millis(),
            synced_at: 0,
        };
        state.cache.upsert_diary(&cached).await
            .map_err(|e| e.to_string())?;

        let op = OfflineOperation {
            id: uuid::Uuid::new_v4().to_string(),
            operation_type: if exists { "update".to_string() } else { "create".to_string() },
            entity_type: "diary".to_string(),
            entity_id: date.clone(),
            payload: serde_json::to_string(&req).unwrap(),
            created_at: chrono::Utc::now().timestamp_millis(),
            retried_count: 0,
        };
        state.cache.add_offline_operation(&op).await
            .map_err(|e| e.to_string())?;
    }
    Ok(())
}

#[tauri::command]
pub async fn update_diary_summary(
    state: State<'_, DiaryAppState>,
    req: UpdateDiarySummaryRequest,
) -> Result<(), String> {
    let online = state.online.load(Ordering::Relaxed);

    if online {
        state.diary_api.update_summary(&req.date, crate::api::UpdateDiarySummaryRequest {
            summary: req.summary.clone(),
        }).await
            .map_err(|e| e.to_string())?;

        if let Some(mut diary) = state.cache.get_diary(&req.date).await {
            diary.summary = req.summary.clone();
            diary.updated_at = chrono::Utc::now().timestamp_millis();
            state.cache.upsert_diary(&diary).await.ok();
        }
    } else {
        if let Some(mut diary) = state.cache.get_diary(&req.date).await {
            diary.summary = req.summary.clone();
            diary.updated_at = chrono::Utc::now().timestamp_millis();

            state.cache.upsert_diary(&diary).await.ok();

            let op = OfflineOperation {
                id: uuid::Uuid::new_v4().to_string(),
                operation_type: "update".to_string(),
                entity_type: "diary".to_string(),
                entity_id: req.date.clone(),
                payload: serde_json::to_string(&req).unwrap(),
                created_at: chrono::Utc::now().timestamp_millis(),
                retried_count: 0,
            };
            state.cache.add_offline_operation(&op).await.ok();
        }
    }
    Ok(())
}

#[tauri::command]
pub async fn update_diary_mood(
    state: State<'_, DiaryAppState>,
    req: UpdateDiaryMoodRequest,
) -> Result<(), String> {
    let online = state.online.load(Ordering::Relaxed);

    if online {
        state.diary_api.update_mood(&req.date, crate::api::UpdateDiaryMoodRequest {
            mood_key: req.mood_key.clone(),
            mood_score: req.mood_score,
        }).await
            .map_err(|e| e.to_string())?;

        if let Some(mut diary) = state.cache.get_diary(&req.date).await {
            diary.mood_key = req.mood_key.clone();
            diary.mood_score = req.mood_score;
            diary.updated_at = chrono::Utc::now().timestamp_millis();
            state.cache.upsert_diary(&diary).await.ok();
        }
    } else {
        if let Some(mut diary) = state.cache.get_diary(&req.date).await {
            diary.mood_key = req.mood_key.clone();
            diary.mood_score = req.mood_score;
            diary.updated_at = chrono::Utc::now().timestamp_millis();

            state.cache.upsert_diary(&diary).await.ok();

            let op = OfflineOperation {
                id: uuid::Uuid::new_v4().to_string(),
                operation_type: "update".to_string(),
                entity_type: "diary".to_string(),
                entity_id: req.date.clone(),
                payload: serde_json::to_string(&req).unwrap(),
                created_at: chrono::Utc::now().timestamp_millis(),
                retried_count: 0,
            };
            state.cache.add_offline_operation(&op).await.ok();
        }
    }
    Ok(())
}

#[tauri::command]
pub async fn list_diaries(
    state: State<'_, DiaryAppState>,
    page: Option<u32>,
    page_size: Option<u32>,
    start_date: Option<String>,
    end_date: Option<String>,
) -> Result<PaginatedResponse<Diary>, String> {
    let online = state.online.load(Ordering::Relaxed);

    if online {
        state.diary_api.list(
            page.unwrap_or(1),
            page_size.unwrap_or(10),
            start_date.as_deref(),
            end_date.as_deref(),
        ).await
            .map_err(|e| e.to_string())
    } else {
        let cached = state.cache
            .list_diaries(
                page_size.unwrap_or(10) as i64,
                ((page.unwrap_or(1) - 1) * page_size.unwrap_or(10)) as i64,
            )
            .await
            .map_err(|e| e.to_string())?;

        let items: Vec<Diary> = cached
            .into_iter()
            .map(|c| Diary {
                date: c.date.clone(),
                summary: c.summary.clone(),
                mood_key: c.mood_key.clone(),
                mood_score: c.mood_score,
                cover_image_id: c.cover_image_id.as_ref().and_then(|id| uuid::Uuid::parse_str(id).ok()),
                memo_count: c.memo_count,
                created_at: c.created_at,
                updated_at: c.updated_at,
            })
            .collect();

        Ok(PaginatedResponse {
            items,
            total: items.len() as i64,
            page: page.unwrap_or(1),
            page_size: page_size.unwrap_or(10),
            total_pages: 1,
        })
    }
}
