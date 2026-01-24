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
        Err(format!("Server returned error {}: {}", status.as_u16(), error_text))
    }
}

#[tauri::command]
pub async fn login(
    config: State<'_, AppConfig>,
    username: String,
    password: String,
) -> Result<LoginResponse, String> {
    // Reload config from disk to get the latest saved values
    let current_config = AppConfig::load().map_err(|e| e.to_string())?;
    
    let auth_api = AuthApi::new(current_config.server.url.clone());
    let response = auth_api
        .login(&username, &password)
        .await
        .map_err(|e| e.to_string())?;

    let mut config_clone = config.inner().clone();
    config_clone.server.api_token = Some(response.access_token.clone());
    config_clone.server.refresh_token = Some(response.refresh_token.clone());
    config_clone.save().map_err(|e| e.to_string())?;

    Ok(response)
}

#[tauri::command]
pub async fn refresh_token(config: State<'_, AppConfig>) -> Result<LoginResponse, String> {
    let refresh_token = match config.server.refresh_token.clone() {
        Some(token) => token,
        None => return Err("No refresh token available".to_string()),
    };

    let auth_api = AuthApi::new(config.server.url.clone());
    let response = auth_api
        .refresh_token(&refresh_token)
        .await
        .map_err(|e| e.to_string())?;

    let mut config_clone = config.inner().clone();
    config_clone.server.api_token = Some(response.access_token.clone());
    config_clone.server.refresh_token = Some(response.refresh_token.clone());
    config_clone.save().map_err(|e| e.to_string())?;

    Ok(response)
}

#[tauri::command]
pub async fn logout(config: State<'_, AppConfig>) -> Result<(), String> {
    let mut config_clone = config.inner().clone();
    config_clone.server.api_token = None;
    config_clone.save().map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn change_password(
    config: State<'_, AppConfig>,
    old_password: String,
    new_password: String,
) -> Result<(), String> {
    let auth_api = AuthApi::new(config.server.url.clone());
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
