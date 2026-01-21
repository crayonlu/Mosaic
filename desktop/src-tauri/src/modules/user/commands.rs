use crate::api::{ApiClient, UserApi};
use crate::config::AppConfig;
use crate::error::{AppError, AppResult};
use crate::models::User;
use tauri::State;
use std::sync::Arc;
use std::sync::atomic::{AtomicBool, Ordering};

pub struct UserAppState {
    pub config: Arc<AppConfig>,
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
    let user_api = UserApi::new(ApiClient::new(state.config.server.url.clone()).with_token(
        state.config.server.api_token.clone().unwrap_or_default()
    ));

    let update_fields = crate::api::UpdateUserRequest {
        username,
        avatar_url,
    };

    user_api.update(update_fields).await.map_err(|e| e.to_string())
}
