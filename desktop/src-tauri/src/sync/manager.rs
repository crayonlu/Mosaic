use crate::api::{ApiClient, DiaryApi, MemoApi};
use crate::cache::{CacheStore, CachedDiary, CachedMemo, OfflineOperation};
use crate::config::AppConfig;
use crate::error::{AppError, AppResult};
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;
use tokio::sync::Mutex;

pub struct SyncManager {
    config: AppConfig,
    client: ApiClient,
    cache: CacheStore,
    memo_api: Arc<MemoApi>,
    diary_api: Arc<DiaryApi>,
    online: Arc<AtomicBool>,
    sync_handle: Arc<Mutex<Option<tokio::task::JoinHandle<()>>>>,
}

impl SyncManager {
    pub fn new(config: AppConfig, client: ApiClient, cache: CacheStore) -> Self {
        let memo_api = Arc::new(MemoApi::new(client.clone()));
        let diary_api = Arc::new(DiaryApi::new(client.clone()));

        Self {
            config,
            client,
            cache,
            memo_api,
            diary_api,
            online: Arc::new(AtomicBool::new(true)),
            sync_handle: Arc::new(Mutex::new(None)),
        }
    }

    pub async fn sync_all(&self) -> AppResult<()> {
        self.online.store(true, Ordering::Relaxed);

        self.sync_offline_operations().await?;
        self.sync_memos().await?;
        self.sync_diaries().await?;

        Ok(())
    }

    async fn sync_offline_operations(&self) -> AppResult<()> {
        let operations = self.cache.get_pending_operations().await?;

        for op in operations {
            match op.operation_type.as_str() {
                "create" => self.sync_create_operation(&op).await?,
                "update" => self.sync_update_operation(&op).await?,
                "delete" => self.sync_delete_operation(&op).await?,
                _ => continue,
            }

            self.cache.remove_operation(&op.id).await?;
        }

        Ok(())
    }

    async fn sync_create_operation(&self, op: &OfflineOperation) -> AppResult<()> {
        if op.entity_type == "memo" {
            use crate::modules::memo::commands::TauriUpdateMemoRequest;
            let req: TauriUpdateMemoRequest =
                serde_json::from_str(&op.payload).map_err(AppError::SerializationError)?;
            // Only create operations have content
            if let Some(content) = req.content {
                let api_req = crate::api::CreateMemoRequest {
                    content,
                    tags: req.tags.unwrap_or_default(),
                    diary_date: None,
                };
                let memo = self.memo_api.create(api_req).await?;
                let updated = CachedMemo::from_memo_with_resources(&memo);
                self.cache.upsert_memo(&updated).await?;
            }
        } else if op.entity_type == "diary" {
            use crate::modules::diary::commands::CreateOrUpdateDiaryRequest;
            let req: CreateOrUpdateDiaryRequest =
                serde_json::from_str(&op.payload).map_err(AppError::SerializationError)?;
            let api_req = crate::api::CreateOrUpdateDiaryRequest {
                summary: req.summary,
                mood_key: req.mood_key,
                mood_score: req.mood_score,
                cover_image_id: req.cover_image_id,
            };
            let _diary = self
                .diary_api
                .create_or_update(&op.entity_id, api_req)
                .await?;
        }
        Ok(())
    }

    async fn sync_update_operation(&self, op: &OfflineOperation) -> AppResult<()> {
        if op.entity_type == "memo" {
            use crate::modules::memo::commands::TauriUpdateMemoRequest;
            let req: TauriUpdateMemoRequest =
                serde_json::from_str(&op.payload).map_err(AppError::SerializationError)?;

            // Convert TauriUpdateMemoRequest to UpdateMemoRequest
            let api_req = crate::api::UpdateMemoRequest {
                content: req.content,
                tags: req.tags,
                is_archived: None,
                diary_date: None,
            };

            let id = &op.entity_id;
            let _memo = self.memo_api.update(id, api_req).await?;

            // Update cache - fetch updated memo from server
            // This is handled by sync_memos, so we skip here
        } else if op.entity_type == "diary" {
            use crate::modules::diary::commands::UpdateDiarySummaryRequest;
            let req: UpdateDiarySummaryRequest =
                serde_json::from_str(&op.payload).map_err(AppError::SerializationError)?;
            let api_req = crate::api::UpdateDiarySummaryRequest {
                summary: req.summary,
            };
            self.diary_api
                .update_summary(&op.entity_id, api_req)
                .await?;
        }
        Ok(())
    }

    async fn sync_delete_operation(&self, op: &OfflineOperation) -> AppResult<()> {
        if op.entity_type == "memo" {
            self.memo_api.delete(&op.entity_id).await?;
            self.cache.delete_memo(&op.entity_id).await?;
        }
        Ok(())
    }

    async fn sync_memos(&self) -> AppResult<()> {
        let server_memos = self.memo_api.list(1, 1000, None).await?;

        for server_memo in server_memos.items {
            let cached = self.cache.get_memo(&server_memo.id.to_string()).await?;

            match cached {
                Some(local) => {
                    if server_memo.updated_at > local.updated_at {
                        let updated = CachedMemo::from_memo_with_resources(&server_memo);
                        self.cache.upsert_memo(&updated).await?;
                    }
                }
                None => {
                    let cached = CachedMemo::from_memo_with_resources(&server_memo);
                    self.cache.upsert_memo(&cached).await?;
                }
            }
        }

        Ok(())
    }

    async fn sync_diaries(&self) -> AppResult<()> {
        let server_diaries = self.diary_api.list(1, 1000, None, None).await?;

        for diary in server_diaries.items {
            let cached = self.cache.get_diary(&diary.date).await?;

            match cached {
                Some(local) => {
                    if diary.updated_at > local.updated_at {
                        let updated = CachedDiary {
                            date: diary.date.clone(),
                            summary: diary.summary.clone(),
                            mood_key: diary.mood_key.clone(),
                            mood_score: diary.mood_score,
                            cover_image_id: diary.cover_image_id.map(|id| id.to_string()),
                            created_at: diary.created_at,
                            updated_at: diary.updated_at,
                            synced_at: chrono::Utc::now().timestamp_millis(),
                        };
                        self.cache.upsert_diary(&updated).await?;
                    }
                }
                None => {
                    let cached = CachedDiary {
                        date: diary.date.clone(),
                        summary: diary.summary.clone(),
                        mood_key: diary.mood_key.clone(),
                        mood_score: diary.mood_score,
                        cover_image_id: diary.cover_image_id.map(|id| id.to_string()),
                        created_at: diary.created_at,
                        updated_at: diary.updated_at,
                        synced_at: chrono::Utc::now().timestamp_millis(),
                    };
                    self.cache.upsert_diary(&cached).await?;
                }
            }
        }

        Ok(())
    }

    pub async fn start_auto_sync(&self) {
        if !self.config.auto_sync {
            return;
        }

        let interval = std::time::Duration::from_secs(self.config.sync_interval_seconds);
        let online = self.online.clone();
        let sync_handle = self.sync_handle.clone();
        let cache = self.cache.clone();

        let handle = tokio::spawn(async move {
            let mut ticker = tokio::time::interval(interval);
            loop {
                ticker.tick().await;
                if online.load(Ordering::Relaxed) {
                    if let Err(e) = cache.get_pending_operations().await {
                        eprintln!("Failed to get pending operations: {}", e);
                    }
                }
            }
        });

        *sync_handle.lock().await = Some(handle);
    }

    pub async fn check_connection(&self) -> bool {
        match self.memo_api.list(1, 1, None).await {
            Ok(_) => {
                self.online.store(true, Ordering::Relaxed);
                true
            }
            Err(_) => {
                self.online.store(false, Ordering::Relaxed);
                false
            }
        }
    }

    pub fn is_online(&self) -> bool {
        self.online.load(Ordering::Relaxed)
    }

    pub async fn is_syncing(&self) -> bool {
        let handle = self.sync_handle.lock().await;
        handle.is_some()
    }
}

impl Clone for SyncManager {
    fn clone(&self) -> Self {
        Self {
            config: self.config.clone(),
            client: self.client.clone(),
            cache: self.cache.clone(),
            memo_api: Arc::clone(&self.memo_api),
            diary_api: Arc::clone(&self.diary_api),
            online: Arc::clone(&self.online),
            sync_handle: Arc::clone(&self.sync_handle),
        }
    }
}

impl Clone for CacheStore {
    fn clone(&self) -> Self {
        Self {
            pool: self.pool.clone(),
        }
    }
}
