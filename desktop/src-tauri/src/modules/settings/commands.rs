use crate::config::AppConfig;
use crate::modules::settings::autostart;
use crate::modules::settings::store::SettingsStore;
use std::sync::Arc;
use tauri::State;

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct SettingValue {
    pub value: String,
}

#[tauri::command]
pub async fn get_setting(
    _config: State<'_, Arc<AppConfig>>,
    key: String,
) -> Result<Option<SettingValue>, String> {
    let store = SettingsStore::new(AppConfig::config_dir());

    match store.get(&key) {
        Ok(Some(setting)) => Ok(Some(SettingValue {
            value: setting.value,
        })),
        Ok(None) => Ok(None),
        Err(e) => Err(format!("Failed to get setting: {}", e)),
    }
}

#[tauri::command]
pub async fn get_settings(
    _config: State<'_, Arc<AppConfig>>,
) -> Result<Vec<(String, SettingValue)>, String> {
    let store = SettingsStore::new(AppConfig::config_dir());

    match store.get_all() {
        Ok(settings) => {
            let result = settings
                .into_iter()
                .map(|(key, setting)| {
                    (
                        key,
                        SettingValue {
                            value: setting.value,
                        },
                    )
                })
                .collect();
            Ok(result)
        }
        Err(e) => Err(format!("Failed to get settings: {}", e)),
    }
}

#[tauri::command]
pub async fn set_setting(
    _config: State<'_, Arc<AppConfig>>,
    key: String,
    value: SettingValue,
) -> Result<(), String> {
    let store = SettingsStore::new(AppConfig::config_dir());

    store
        .set(key, value.value, "user".to_string())
        .map_err(|e| format!("Failed to set setting: {}", e))?;

    Ok(())
}

#[tauri::command]
pub async fn delete_setting(key: String) -> Result<(), String> {
    let store = SettingsStore::new(AppConfig::config_dir());

    store
        .delete(&key)
        .map_err(|e| format!("Failed to delete setting: {}", e))?;

    Ok(())
}

#[tauri::command]
pub async fn test_ai_connection() -> Result<(), String> {
    use crate::modules::ai::provider::{create_provider, AIProvider};

    let provider = create_provider()
        .await
        .map_err(|e| format!("Failed to create AI provider: {}", e))?;

    // Test with a simple request
    let test_req = crate::modules::ai::models::CompleteTextRequest {
        content: "test".to_string(),
        context: Some("test connection".to_string()),
    };

    provider
        .complete_text(&test_req)
        .await
        .map_err(|e| format!("AI connection test failed: {}", e))?;

    Ok(())
}

#[tauri::command]
pub async fn enable_autostart(app: tauri::AppHandle, enabled: bool) -> Result<(), String> {
    autostart::enable_autostart(&app, enabled)
}

#[tauri::command]
pub async fn is_autostart_enabled(app: tauri::AppHandle) -> Result<bool, String> {
    autostart::is_autostart_enabled(&app)
}

#[tauri::command]
pub async fn register_show_shortcut() -> Result<(), String> {
    // Shortcut registration is handled by global shortcut plugin
    Ok(())
}

#[tauri::command]
pub async fn register_close_shortcut() -> Result<(), String> {
    // Shortcut registration is handled by global shortcut plugin
    Ok(())
}

#[tauri::command]
pub async fn unregister_shortcut() -> Result<(), String> {
    // Shortcut registration is handled by global shortcut plugin
    Ok(())
}
