use crate::api::{ApiClient, UserApi};
use crate::config::AppConfig;
use crate::models::User;
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
pub async fn get_user(state: State<'_, UserAppState>) -> Result<User, String> {
    state.user_api.get().await.map_err(|e| e.to_string())
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
    username: Option<String>,
    avatar_url: Option<String>,
) -> Result<User, String> {
    let (server_url, api_token) = {
        let config_guard = state.config.read().await;
        (
            config_guard.server.url.clone(),
            config_guard.server.api_token.clone().unwrap_or_default(),
        )
    };

    let user_api = UserApi::new(ApiClient::new(server_url).with_token(api_token));

    let update_fields = crate::api::UpdateUserRequest {
        username,
        avatar_url,
    };

    user_api
        .update(update_fields)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn upload_avatar(
    state: State<'_, UserAppState>,
    source_path: String,
    data: Vec<u8>,
    filename: String,
    mime_type: String,
) -> Result<User, String> {
    let (server_url, api_token) = {
        let config_guard = state.config.read().await;
        (
            config_guard.server.url.clone(),
            config_guard.server.api_token.clone().unwrap_or_default(),
        )
    };

    let user_api = UserApi::new(ApiClient::new(server_url).with_token(api_token));

    user_api
        .upload_avatar(source_path, data, filename, mime_type)
        .await
        .map_err(|e| e.to_string())
}
