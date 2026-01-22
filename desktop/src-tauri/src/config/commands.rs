use crate::api::{AuthApi, LoginResponse};
use crate::config::{AppConfig, ServerConfig};
use tauri::State;

#[tauri::command]
pub async fn get_server_config(config: State<'_, AppConfig>) -> Result<ServerConfig, String> {
    Ok(config.server.clone())
}

#[tauri::command]
pub async fn set_server_config(
    config: State<'_, AppConfig>,
    server_config: ServerConfig,
) -> Result<(), String> {
    let mut config_clone = config.inner().clone();
    config_clone.server = server_config;
    config_clone.save().map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn test_server_connection(config: State<'_, AppConfig>) -> Result<(), String> {
    let auth_api = AuthApi::new(config.server.url.clone());
    auth_api
        .login(&config.server.username, &config.server.password)
        .await
        .map_err(|e| e.to_string())?;
    Ok(())
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

    let mut config_clone = config.inner().clone();
    config_clone.server.api_token = Some(response.access_token.clone());
    config_clone.save().map_err(|e| e.to_string())?;

    Ok(response)
}

#[tauri::command]
pub async fn logout(config: State<'_, AppConfig>) -> Result<(), String> {
    let mut config_clone = config.inner().clone();
    config_clone.server.api_token = None;
    config_clone.save().map_err(|e| e.to_string())
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
    let mut config_clone = config.inner().clone();
    config_clone.auto_sync = settings.auto_sync;
    config_clone.sync_interval_seconds = settings.sync_interval_seconds;
    config_clone.offline_mode = settings.offline_mode;
    config_clone.save().map_err(|e| e.to_string())
}
