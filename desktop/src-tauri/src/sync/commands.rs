use crate::sync::types::{SyncStatus, SyncStatusInfo};
use tauri::State;

#[tauri::command]
pub async fn check_connection(state: State<'_, crate::sync::SyncManager>) -> Result<bool, String> {
    Ok(state.check_connection().await)
}

#[tauri::command]
pub async fn trigger_sync(
    state: State<'_, crate::sync::SyncManager>,
) -> Result<SyncStatusInfo, String> {
    state.sync_all().await.map_err(|e| e.to_string())?;

    Ok(SyncStatusInfo {
        status: "completed".to_string(),
        timestamp: chrono::Utc::now().to_rfc3339(),
        error: None,
    })
}

#[tauri::command]
pub async fn get_sync_status(
    state: State<'_, crate::sync::SyncManager>,
) -> Result<SyncStatus, String> {
    let online = state.is_online();
    let is_syncing = state.is_syncing().await;

    Ok(if !online {
        SyncStatus::Offline
    } else if is_syncing {
        SyncStatus::Syncing
    } else {
        SyncStatus::Idle
    })
}
