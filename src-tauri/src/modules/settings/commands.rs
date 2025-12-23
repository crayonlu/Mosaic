use crate::database::DBPool;
use crate::error::AppResult;
use crate::modules::settings::models::{SetSettingRequest, Setting};
use crate::modules::settings::service;
use crate::modules::settings::{autostart, shortcut};
use tauri::{AppHandle, Manager, State};
use tauri_plugin_global_shortcut::GlobalShortcutExt;

#[tauri::command]
pub async fn get_setting(pool: State<'_, DBPool>, key: String) -> AppResult<Option<Setting>> {
    service::get_setting(pool.inner(), &key).await
}

#[tauri::command]
pub async fn get_settings(
    pool: State<'_, DBPool>,
    category: Option<String>,
) -> AppResult<Vec<Setting>> {
    service::get_settings(pool.inner(), category.as_deref()).await
}

#[tauri::command]
pub async fn set_setting(
    pool: State<'_, DBPool>,
    req: SetSettingRequest,
) -> AppResult<Setting> {
    service::set_setting(pool.inner(), req).await
}

#[tauri::command]
pub async fn delete_setting(pool: State<'_, DBPool>, key: String) -> AppResult<()> {
    service::delete_setting(pool.inner(), &key).await
}

#[tauri::command]
pub async fn test_ai_connection(
    provider: String,
    base_url: String,
    api_key: String,
) -> Result<bool, String> {
    let client = reqwest::Client::new();
    let url = if provider.to_lowercase() == "openai" {
        format!("{}/v1/models", base_url.trim_end_matches('/'))
    } else if provider.to_lowercase() == "anthropic" {
        format!("{}/v1/messages", base_url.trim_end_matches('/'))
    } else {
        return Err("Unsupported provider".to_string());
    };

    let response = client
        .get(&url)
        .header("Authorization", format!("Bearer {}", api_key))
        .header("Content-Type", "application/json")
        .timeout(std::time::Duration::from_secs(10))
        .send()
        .await;

    match response {
        Ok(resp) => Ok(resp.status().is_success()),
        Err(e) => Err(format!("Connection failed: {}", e)),
    }
}

#[tauri::command]
pub async fn enable_autostart(app: AppHandle, enabled: bool) -> Result<(), String> {
    autostart::enable_autostart(&app, enabled)
}

#[tauri::command]
pub async fn is_autostart_enabled(app: AppHandle) -> Result<bool, String> {
    autostart::is_autostart_enabled(&app)
}

#[tauri::command]
pub async fn register_show_shortcut(app: AppHandle, shortcut: String) -> Result<(), String> {
    use tauri_plugin_global_shortcut::Shortcut;
    let parsed = shortcut::parse_shortcut(&shortcut)?;
    let shortcut_obj = Shortcut::new(Some(parsed.modifiers), parsed.code);
    let app_handle = app.clone();
    
    app.global_shortcut()
        .on_shortcut(shortcut_obj, move |_app, _shortcut, _event| {
            if let Some(window) = app_handle.get_webview_window("main") {
                let _ = window.show();
                let _ = window.set_focus();
            }
        })
        .map_err(|e| format!("Failed to register shortcut: {}", e))?;
    
    Ok(())
}

#[tauri::command]
pub async fn register_close_shortcut(app: AppHandle, shortcut: String) -> Result<(), String> {
    use tauri_plugin_global_shortcut::Shortcut;
    let parsed = shortcut::parse_shortcut(&shortcut)?;
    let shortcut_obj = Shortcut::new(Some(parsed.modifiers), parsed.code);
    let app_handle = app.clone();
    
    app.global_shortcut()
        .on_shortcut(shortcut_obj, move |_app, _shortcut, _event| {
            if let Some(window) = app_handle.get_webview_window("main") {
                let _ = window.close();
            }
        })
        .map_err(|e| format!("Failed to register shortcut: {}", e))?;
    
    Ok(())
}

#[tauri::command]
pub async fn unregister_shortcut(app: AppHandle, shortcut: String) -> Result<(), String> {
    use tauri_plugin_global_shortcut::Shortcut;
    let parsed = shortcut::parse_shortcut(&shortcut)?;
    let shortcut_obj = Shortcut::new(Some(parsed.modifiers), parsed.code);
    
    app.global_shortcut().unregister(shortcut_obj)
        .map_err(|e| format!("Failed to unregister shortcut: {}", e))?;
    
    Ok(())
}

