use crate::api::{AuthApi, LoginResponse, RefreshTokenResponse};
use crate::config::{AppConfig, ServerConfig};
use std::sync::Arc;
use tauri::State;
use tokio::sync::RwLock;

#[tauri::command]
pub async fn get_server_config(
    config: State<'_, Arc<RwLock<AppConfig>>>,
) -> Result<ServerConfig, String> {
    let config_guard = config.read().await;
    Ok(config_guard.server.clone())
}

#[tauri::command]
pub async fn set_server_config(
    config: State<'_, Arc<RwLock<AppConfig>>>,
    server_config: ServerConfig,
) -> Result<(), String> {
    let mut config_guard = config.write().await;
    config_guard.server = server_config;
    config_guard.save().map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub async fn test_server_connection(server_config: ServerConfig) -> Result<(), String> {
    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(10))
        .build()
        .map_err(|e| format!("Failed to create HTTP client: {}", e))?;

    let url = format!("{}/api/auth/login", server_config.url.trim_end_matches('/'));

    let response = client
        .post(&url)
        .json(&serde_json::json!({
            "username": server_config.username,
            "password": server_config.password
        }))
        .send()
        .await
        .map_err(|e| format!("Network error: {}", e))?;

    let status = response.status();
    if status.is_success() {
        Ok(())
    } else {
        let error_text = response.text().await.unwrap_or_default();
        Err(format!(
            "Server returned error {}: {}",
            status.as_u16(),
            error_text
        ))
    }
}

#[tauri::command]
pub async fn login(
    config: State<'_, Arc<RwLock<AppConfig>>>,
    username: String,
    password: String,
) -> Result<LoginResponse, String> {
    let server_url = {
        let config_guard = config.read().await;
        config_guard.server.url.clone()
    };

    let auth_api = AuthApi::new(server_url);
    let response = auth_api
        .login(&username, &password)
        .await
        .map_err(|e| e.to_string())?;

    let mut config_guard = config.write().await;
    config_guard.server.api_token = Some(response.access_token.clone());
    config_guard.server.refresh_token = Some(response.refresh_token.clone());
    config_guard.save().map_err(|e| e.to_string())?;

    Ok(response)
}

#[tauri::command]
pub async fn refresh_token(
    config: State<'_, Arc<RwLock<AppConfig>>>,
) -> Result<RefreshTokenResponse, String> {
    let (refresh_token, server_url) = {
        let config_guard = config.read().await;
        let refresh_token = match config_guard.server.refresh_token.clone() {
            Some(token) => token,
            None => return Err("No refresh token available".to_string()),
        };
        (refresh_token, config_guard.server.url.clone())
    };

    let auth_api = AuthApi::new(server_url);
    let response = auth_api
        .refresh_token(&refresh_token)
        .await
        .map_err(|e| e.to_string())?;

    let mut config_guard = config.write().await;
    config_guard.server.api_token = Some(response.access_token.clone());
    config_guard.server.refresh_token = Some(response.refresh_token.clone());
    config_guard.save().map_err(|e| e.to_string())?;

    Ok(response)
}

#[tauri::command]
pub async fn logout(config: State<'_, Arc<RwLock<AppConfig>>>) -> Result<(), String> {
    let mut config_guard = config.write().await;
    config_guard.server.api_token = None;
    config_guard.server.refresh_token = None;
    config_guard.save().map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn change_password(
    config: State<'_, Arc<RwLock<AppConfig>>>,
    old_password: String,
    new_password: String,
) -> Result<(), String> {
    let server_url = {
        let config_guard = config.read().await;
        config_guard.server.url.clone()
    };

    let auth_api = AuthApi::new(server_url);
    auth_api
        .change_password(&old_password, &new_password)
        .await
        .map_err(|e| e.to_string())
}

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SyncSettings {
    pub auto_sync: bool,
    pub sync_interval_seconds: u64,
    pub offline_mode: bool,
}

#[tauri::command]
pub async fn get_sync_settings(
    config: State<'_, Arc<RwLock<AppConfig>>>,
) -> Result<SyncSettings, String> {
    let config_guard = config.read().await;
    Ok(SyncSettings {
        auto_sync: config_guard.auto_sync,
        sync_interval_seconds: config_guard.sync_interval_seconds,
        offline_mode: config_guard.offline_mode,
    })
}

#[tauri::command]
pub async fn set_sync_settings(
    config: State<'_, Arc<RwLock<AppConfig>>>,
    settings: SyncSettings,
) -> Result<(), String> {
    let mut config_guard = config.write().await;
    config_guard.auto_sync = settings.auto_sync;
    config_guard.sync_interval_seconds = settings.sync_interval_seconds;
    config_guard.offline_mode = settings.offline_mode;
    config_guard.save().map_err(|e| e.to_string())
}
