use crate::api::user_api::UpdateUserRequest;
use crate::api::UserApi;
use crate::config::AppConfig;
use crate::models::User;
use serde::Deserialize;
use std::sync::atomic::AtomicBool;
use std::sync::Arc;
use tauri::State;
use tokio::sync::RwLock;

pub struct UserAppState {
    pub config: Arc<RwLock<AppConfig>>,
    pub user_api: Arc<UserApi>,
    pub online: Arc<AtomicBool>,
}

#[tauri::command]
pub async fn get_user(state: State<'_, UserAppState>) -> Result<Option<User>, String> {
    match state.user_api.get().await {
        Ok(user) => Ok(Some(user)),
        Err(e) => {
            eprintln!("Failed to get user: {:?}", e);
            Ok(None)
        }
    }
}

#[tauri::command]
pub async fn get_or_create_default_user(state: State<'_, UserAppState>) -> Result<User, String> {
    match state.user_api.get().await {
        Ok(user) => Ok(user),
        Err(_) => Err("User not found".to_string()),
    }
}

#[tauri::command]
pub async fn update_user(
    state: State<'_, UserAppState>,
    req: UpdateUserRequest,
) -> Result<User, String> {
    state.user_api
        .update(req)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn upload_avatar(
    state: State<'_, UserAppState>,
    file: UploadAvatarFile,
) -> Result<User, String> {
    state.user_api
        .upload_avatar(file.name, file.mime_type, file.data)
        .await
        .map_err(|e| e.to_string())
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UploadAvatarFile {
    pub name: String,
    pub data: Vec<u8>,
    pub mime_type: String,
}
