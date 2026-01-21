use crate::api::{AuthApi, LoginRequest};
use crate::config::{AppConfig, ServerConfig};
use crate::error::{AppError, AppResult};
use tauri::State;

#[tauri::command]
pub async fn get_server_config(config: State<'_, AppConfig>) -> Result<ServerConfig, String> {
    Ok(config.server.clone())
}

#[tauri::command]
pub async fn set_server_config(
    config: State<'_, AppConfig>,
    mut server_config: ServerConfig,
) -> Result<(), String> {
    config.server.url = server_config.url;
    config.server.username = server_config.username;
    config.server.password = server_config.password;
    config.server.ai_provider = server_config.ai_provider;
    config.server.ai_base_url = server_config.ai_base_url;
    config.server.ai_api_key = server_config.ai_api_key;
    config.server.ai_model = server_config.ai_model;
    config.server.ai_temperature = server_config.ai_temperature;
    config.server.ai_max_tokens = server_config.ai_max_tokens;
    config.server.ai_timeout = server_config.ai_timeout;

    config.save().map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn test_server_connection(
    config: State<'_, AppConfig>,
) -> Result<LoginResponse, String> {
    let auth_api = AuthApi::new(config.server.url.clone());
    auth_api
        .login(&config.server.username, &config.server.password)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn login(
    config: State<'_, AppConfig>,
    username: String,
    password: String,
) -> Result<LoginResponse, String> {
    let auth_api = AuthApi::new(config.server.url.clone());
    let response = auth_api
        .login(&username, &password)
        .await
        .map_err(|e| e.to_string())?;

    config.server.api_token = Some(response.access_token.clone());
    config
        .save()
        .map_err(|e| e.to_string())?;

    Ok(response)
}

#[tauri::command]
pub async fn logout(config: State<'_, AppConfig>) -> Result<(), String> {
    config.server.api_token = None;
    config.save().map_err(|e| e.to_string())
}

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SyncSettings {
    pub auto_sync: bool,
    pub sync_interval_seconds: u64,
    pub offline_mode: bool,
}

#[tauri::command]
pub async fn get_sync_settings(config: State<'_, AppConfig>) -> Result<SyncSettings, String> {
    Ok(SyncSettings {
        auto_sync: config.auto_sync,
        sync_interval_seconds: config.sync_interval_seconds,
        offline_mode: config.offline_mode,
    })
}

#[tauri::command]
pub async fn set_sync_settings(
    config: State<'_, AppConfig>,
    settings: SyncSettings,
) -> Result<(), String> {
    config.auto_sync = settings.auto_sync;
    config.sync_interval_seconds = settings.sync_interval_seconds;
    config.offline_mode = settings.offline_mode;
    config.save().map_err(|e| e.to_string())
}
