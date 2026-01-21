use tauri::State;
use crate::config::{AppConfig, ServerConfig};
use crate::api::AuthApi;
use crate::error::AppResult;

#[tauri::command]
pub async fn get_server_config() -> Result<Option<ServerConfig>, String> {
    let config = AppConfig::load().map_err(|e| e.to_string())?;
    if config.server.is_configured() {
        Ok(Some(config.server))
    } else {
        Ok(None)
    }
}

#[tauri::command]
pub async fn set_server_config(config: ServerConfig) -> Result<(), String> {
    let mut app_config = AppConfig::load().map_err(|e| e.to_string())?;
    app_config.server = config;
    app_config.save().map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn test_server_connection(config: ServerConfig) -> Result<(), String> {
    let auth_api = AuthApi::new(config.url.clone());

    auth_api.login(&config.username, &config.password).await
        .map_err(|e| e.to_string())?;

    Ok(())
}

#[tauri::command]
pub async fn login(config: ServerConfig) -> Result<String, String> {
    let auth_api = AuthApi::new(config.url.clone());
    let response = auth_api.login(&config.username, &config.password)
        .await
        .map_err(|e| e.to_string())?;

    let mut app_config = AppConfig::load().map_err(|e| e.to_string())?;
    app_config.server = config;
    app_config.server.api_token = Some(response.token.clone());
    app_config.save().map_err(|e| e.to_string())?;

    Ok(response.token)
}

#[tauri::command]
pub async fn logout() -> Result<(), String> {
    let mut config = AppConfig::load().map_err(|e| e.to_string())?;
    config.server.api_token = None;
    config.server.password = String::new();
    config.save().map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn get_sync_settings() -> Result<(bool, u64), String> {
    let config = AppConfig::load().map_err(|e| e.to_string())?;
    Ok((config.auto_sync, config.sync_interval_seconds))
}

#[tauri::command]
pub async fn set_sync_settings(auto_sync: bool, interval_seconds: u64) -> Result<(), String> {
    let mut config = AppConfig::load().map_err(|e| e.to_string())?;
    config.auto_sync = auto_sync;
    config.sync_interval_seconds = interval_seconds;
    config.save().map_err(|e| e.to_string())
}
