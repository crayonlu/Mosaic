use crate::api::{CreateMemoRequest, MemoApi, UpdateMemoRequest};
use crate::cache::{CacheStore, CachedMemo, OfflineOperation};
use crate::models::{MemoWithResources, PaginatedResponse};
use serde::{Deserialize, Serialize};
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;
use tauri::State;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TauriUpdateMemoRequest {
    pub id: String,
    pub content: Option<String>,
    pub tags: Option<Vec<String>>,
    pub diary_date: Option<Option<String>>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SearchMemosRequest {
    pub query: String,
    pub tags: Option<Vec<String>>,
    pub start_date: Option<String>,
    pub end_date: Option<String>,
    pub is_archived: Option<bool>,
    pub page: Option<u32>,
    pub page_size: Option<u32>,
}

pub struct AppState {
    pub memo_api: Arc<MemoApi>,
    pub cache: Arc<CacheStore>,
    pub online: Arc<AtomicBool>,
}

#[tauri::command]
pub async fn create_memo(
    state: State<'_, AppState>,
    req: CreateMemoRequest,
) -> Result<String, String> {
    let online = state.online.load(Ordering::Relaxed);

    if online {
        match state.memo_api.create(req).await {
            Ok(memo) => {
                let cached = CachedMemo::from_memo_with_resources(&memo);
                let _ = state.cache.upsert_memo(&cached).await;
                Ok(memo.id.to_string())
            }
            Err(e) => Err(e.to_string()),
        }
    } else {
        let temp_id = uuid::Uuid::new_v4().to_string();

        let cached = CachedMemo {
            id: temp_id.clone(),
            content: req.content.clone(),
            tags: serde_json::to_string(&req.tags).unwrap_or_else(|_| "[]".to_string()),
            is_archived: false,
            is_deleted: false,
            diary_date: None,
            created_at: chrono::Utc::now().timestamp_millis(),
            updated_at: chrono::Utc::now().timestamp_millis(),
            synced_at: 0,
        };
        state
            .cache
            .upsert_memo(&cached)
            .await
            .map_err(|e| e.to_string())?;

        let op = OfflineOperation {
            id: uuid::Uuid::new_v4().to_string(),
            operation_type: "create".to_string(),
            entity_type: "memo".to_string(),
            entity_id: temp_id.clone(),
            payload: serde_json::to_string(&req).unwrap(),
            created_at: chrono::Utc::now().timestamp_millis(),
            retried_count: 0,
        };
        state
            .cache
            .add_offline_operation(&op)
            .await
            .map_err(|e| e.to_string())?;

        Ok(temp_id)
    }
}

#[tauri::command]
pub async fn get_memo(
    state: State<'_, AppState>,
    memo_id: String,
) -> Result<MemoWithResources, String> {
    let online = state.online.load(Ordering::Relaxed);

    if online {
        let memo_uuid = uuid::Uuid::parse_str(&memo_id).map_err(|e| e.to_string())?;
        state
            .memo_api
            .get(&memo_uuid.to_string())
            .await
            .map_err(|e| e.to_string())
    } else {
        state
            .cache
            .get_memo(&memo_id)
            .await
            .map_err(|e| e.to_string())?
            .map(|c| c.to_memo_with_resources())
            .ok_or_else(|| "Memo not found in cache".to_string())
    }
}

#[tauri::command]
pub async fn list_memos(
    state: State<'_, AppState>,
    page: Option<u32>,
    page_size: Option<u32>,
    is_archived: Option<bool>,
) -> Result<PaginatedResponse<MemoWithResources>, String> {
    let online = state.online.load(Ordering::Relaxed);

    if online {
        state
            .memo_api
            .list(page.unwrap_or(1), page_size.unwrap_or(20), is_archived)
            .await
            .map_err(|e| e.to_string())
    } else {
        let cached = state
            .cache
            .list_memos(
                page_size.unwrap_or(20) as i64,
                ((page.unwrap_or(1) - 1) * page_size.unwrap_or(20)) as i64,
                is_archived,
            )
            .await
            .map_err(|e| e.to_string())?;

        let items: Vec<MemoWithResources> = cached
            .into_iter()
            .map(|c| c.to_memo_with_resources())
            .collect();

        Ok(PaginatedResponse {
            total: items.len() as i64,
            items,
            page: page.unwrap_or(1),
            page_size: page_size.unwrap_or(20),
            total_pages: 1,
        })
    }
}

#[tauri::command]
pub async fn get_memos_by_date(
    state: State<'_, AppState>,
    date: String,
) -> Result<Vec<MemoWithResources>, String> {
    let online = state.online.load(Ordering::Relaxed);

    if online {
        let response = state
            .memo_api
            .list_by_diary_date(1, 1000, &date)
            .await
            .map_err(|e| e.to_string())?;

        Ok(response.items)
    } else {
        let cached = state
            .cache
            .list_memos(1000, 0, None)
            .await
            .map_err(|e| e.to_string())?;

        let items: Vec<MemoWithResources> = cached
            .into_iter()
            .filter(|c| c.diary_date.as_ref().map_or(false, |d| d == &date))
            .map(|c| c.to_memo_with_resources())
            .collect();

        Ok(items)
    }
}

#[tauri::command]
pub async fn update_memo(
    state: State<'_, AppState>,
    req: TauriUpdateMemoRequest,
) -> Result<(), String> {
    let online = state.online.load(Ordering::Relaxed);

    if online {
        let api_req = UpdateMemoRequest {
            content: req.content.clone(),
            tags: req.tags.clone(),
            is_archived: None,
            diary_date: req.diary_date.clone(),
        };
        state
            .memo_api
            .update(&req.id, api_req)
            .await
            .map_err(|e| e.to_string())?;

        if let Ok(Some(memo)) = state.cache.get_memo(&req.id).await {
            let mut updated = memo;
            if let Some(content) = &req.content {
                updated.content = content.clone();
            }
            if let Some(tags) = &req.tags {
                updated.tags = serde_json::to_string(tags).unwrap_or_default();
            }
            if let Some(diary_date) = &req.diary_date {
                updated.diary_date = diary_date.clone();
            }
            updated.updated_at = chrono::Utc::now().timestamp_millis();
            state.cache.upsert_memo(&updated).await.ok();
        }
    } else {
        let op = OfflineOperation {
            id: uuid::Uuid::new_v4().to_string(),
            operation_type: "update".to_string(),
            entity_type: "memo".to_string(),
            entity_id: req.id.clone(),
            payload: serde_json::to_string(&req).unwrap(),
            created_at: chrono::Utc::now().timestamp_millis(),
            retried_count: 0,
        };
        state
            .cache
            .add_offline_operation(&op)
            .await
            .map_err(|e| e.to_string())?;

        if let Ok(Some(mut memo)) = state.cache.get_memo(&req.id).await {
            if let Some(content) = &req.content {
                memo.content = content.clone();
            }
            if let Some(tags) = &req.tags {
                memo.tags = serde_json::to_string(tags).unwrap_or_default();
            }
            if let Some(diary_date) = &req.diary_date {
                memo.diary_date = diary_date.clone();
            }
            memo.updated_at = chrono::Utc::now().timestamp_millis();
            state.cache.upsert_memo(&memo).await.ok();
        }
    }
    Ok(())
}

#[tauri::command]
pub async fn delete_memo(state: State<'_, AppState>, memo_id: String) -> Result<(), String> {
    let online = state.online.load(Ordering::Relaxed);

    if online {
        let id = uuid::Uuid::parse_str(&memo_id).map_err(|e| e.to_string())?;
        state
            .memo_api
            .delete(&id.to_string())
            .await
            .map_err(|e| e.to_string())?;
        state
            .cache
            .delete_memo(&memo_id)
            .await
            .map_err(|e| e.to_string())?;
    } else {
        let op = OfflineOperation {
            id: uuid::Uuid::new_v4().to_string(),
            operation_type: "delete".to_string(),
            entity_type: "memo".to_string(),
            entity_id: memo_id.clone(),
            payload: "{}".to_string(),
            created_at: chrono::Utc::now().timestamp_millis(),
            retried_count: 0,
        };
        state
            .cache
            .add_offline_operation(&op)
            .await
            .map_err(|e| e.to_string())?;

        // Note: Since we removed is_deleted from CachedMemo, we just remove the memo from cache
        // when deleting in offline mode
        let _ = state.cache.delete_memo(&memo_id).await;
    }
    Ok(())
}

#[tauri::command]
pub async fn archive_memo(state: State<'_, AppState>, memo_id: String) -> Result<(), String> {
    let online = state.online.load(Ordering::Relaxed);

    if online {
        let id = uuid::Uuid::parse_str(&memo_id).map_err(|e| e.to_string())?;
        state
            .memo_api
            .archive(&id.to_string())
            .await
            .map_err(|e| e.to_string())?;

        if let Ok(Some(mut memo)) = state.cache.get_memo(&memo_id).await {
            memo.is_archived = true;
            state.cache.upsert_memo(&memo).await.ok();
        }
    } else {
        let op = OfflineOperation {
            id: uuid::Uuid::new_v4().to_string(),
            operation_type: "update".to_string(),
            entity_type: "memo".to_string(),
            entity_id: memo_id.clone(),
            payload: serde_json::to_string(&TauriUpdateMemoRequest {
                id: memo_id.clone(),
                content: None,
                tags: None,
                diary_date: None,
            })
            .unwrap(),
            created_at: chrono::Utc::now().timestamp_millis(),
            retried_count: 0,
        };
        state
            .cache
            .add_offline_operation(&op)
            .await
            .map_err(|e| e.to_string())?;

        if let Ok(Some(mut memo)) = state.cache.get_memo(&memo_id).await {
            memo.is_archived = true;
            state.cache.upsert_memo(&memo).await.ok();
        }
    }
    Ok(())
}

#[tauri::command]
pub async fn unarchive_memo(state: State<'_, AppState>, memo_id: String) -> Result<(), String> {
    let online = state.online.load(Ordering::Relaxed);

    if online {
        let id = uuid::Uuid::parse_str(&memo_id).map_err(|e| e.to_string())?;
        state
            .memo_api
            .unarchive(&id.to_string())
            .await
            .map_err(|e| e.to_string())?;

        if let Ok(Some(mut memo)) = state.cache.get_memo(&memo_id).await {
            memo.is_archived = false;
            state.cache.upsert_memo(&memo).await.ok();
        }
    } else {
        let op = OfflineOperation {
            id: uuid::Uuid::new_v4().to_string(),
            operation_type: "update".to_string(),
            entity_type: "memo".to_string(),
            entity_id: memo_id.clone(),
            payload: serde_json::to_string(&TauriUpdateMemoRequest {
                id: memo_id.clone(),
                content: None,
                tags: None,
                diary_date: None,
            })
            .unwrap(),
            created_at: chrono::Utc::now().timestamp_millis(),
            retried_count: 0,
        };
        state
            .cache
            .add_offline_operation(&op)
            .await
            .map_err(|e| e.to_string())?;

        if let Ok(Some(mut memo)) = state.cache.get_memo(&memo_id).await {
            memo.is_archived = false;
            state.cache.upsert_memo(&memo).await.ok();
        }
    }
    Ok(())
}

#[tauri::command]
pub async fn get_memos_by_diary_date(
    state: State<'_, AppState>,
    diary_date: String,
) -> Result<Vec<MemoWithResources>, String> {
    let online = state.online.load(Ordering::Relaxed);

    if online {
        state
            .memo_api
            .list_by_diary_date(1, 1000, &diary_date)
            .await
            .map(|resp| resp.items)
            .map_err(|e| e.to_string())
    } else {
        let cached = state
            .cache
            .list_memos(1000, 0, None)
            .await
            .map_err(|e| e.to_string())?;

        let items: Vec<MemoWithResources> = cached
            .into_iter()
            .filter(|c| c.diary_date.as_ref().map_or(false, |d| d == &diary_date))
            .map(|c| c.to_memo_with_resources())
            .collect();

        Ok(items)
    }
}

#[tauri::command]
pub async fn search_memos(
    state: State<'_, AppState>,
    req: SearchMemosRequest,
) -> Result<PaginatedResponse<MemoWithResources>, String> {
    let online = state.online.load(Ordering::Relaxed);
    let query = req.query.to_lowercase();
    let page = req.page.unwrap_or(1);
    let page_size = req.page_size.unwrap_or(50);

    if online {
        state
            .memo_api
            .search(
                &req.query,
                req.tags.clone(),
                req.start_date.clone(),
                req.end_date.clone(),
                req.is_archived,
                page,
                page_size,
            )
            .await
            .map_err(|e| e.to_string())
    } else {
        let cached = state
            .cache
            .list_memos(10000, 0, None)
            .await
            .map_err(|e| e.to_string())?;

        let mut filtered: Vec<MemoWithResources> = cached
            .into_iter()
            .filter(|c| {
                let matches_query = query.is_empty()
                    || c.content.to_lowercase().contains(&query)
                    || c.tags.to_lowercase().contains(&query);

                if !matches_query {
                    return false;
                }

                if let Some(is_archived) = req.is_archived {
                    if c.is_archived != is_archived {
                        return false;
                    }
                }

                if let Some(ref start_date) = req.start_date {
                    if let Some(created_date) = chrono::DateTime::from_timestamp_millis(c.created_at) {
                        let date_str = created_date.format("%Y-%m-%d").to_string();
                        if &date_str < start_date {
                            return false;
                        }
                    }
                }

                if let Some(ref end_date) = req.end_date {
                    if let Some(created_date) = chrono::DateTime::from_timestamp_millis(c.created_at) {
                        let date_str = created_date.format("%Y-%m-%d").to_string();
                        if &date_str > end_date {
                            return false;
                        }
                    }
                }

                true
            })
            .map(|c| c.to_memo_with_resources())
            .collect();

        if let Some(ref tags) = req.tags {
            if !tags.is_empty() {
                filtered.retain(|memo| {
                    tags.iter().any(|tag| memo.tags.contains(tag))
                });
            }
        }

        let total = filtered.len();
        let offset = ((page - 1) * page_size) as usize;
        let items: Vec<MemoWithResources> = filtered
            .into_iter()
            .skip(offset)
            .take(page_size as usize)
            .collect();

        Ok(PaginatedResponse {
            items,
            total: total as i64,
            page,
            page_size,
            total_pages: ((total as f64) / (page_size as f64)).ceil() as u32,
        })
    }
}
