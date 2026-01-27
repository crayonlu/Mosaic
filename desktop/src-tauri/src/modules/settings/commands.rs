use crate::config::AppConfig;
use crate::modules::settings::autostart;
use crate::modules::settings::store::SettingsStore;
use std::sync::Arc;
use tauri::State;
use tokio::sync::RwLock;

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SettingValue {
    pub value: String,
}

#[tauri::command]
pub async fn get_setting(
    _config: State<'_, Arc<RwLock<AppConfig>>>,
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
    _config: State<'_, Arc<RwLock<AppConfig>>>,
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
    _config: State<'_, Arc<RwLock<AppConfig>>>,
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

#[tauri::command]
pub async fn get_data_directory() -> Result<String, String> {
    let dir = crate::config::AppConfig::config_dir();
    Ok(dir.to_string_lossy().to_string())
}

#[tauri::command]
pub async fn get_default_data_directory() -> Result<String, String> {
    let dir = crate::config::AppConfig::default_config_dir();
    Ok(dir.to_string_lossy().to_string())
}

#[tauri::command]
pub async fn set_data_directory(new_directory_path: String) -> Result<(), String> {
    let mut config = crate::config::AppConfig::load()
        .map_err(|e| format!("Failed to load config: {}", e))?;
    
    let new_path = std::path::PathBuf::from(&new_directory_path);
    if !new_path.is_absolute() {
        return Err("Data directory path must be absolute".to_string());
    }
    
    std::fs::create_dir_all(&new_path)
        .map_err(|e| format!("Failed to create directory: {}", e))?;
    
    config.custom_data_directory = Some(new_directory_path);
    config.save()
        .map_err(|e| format!("Failed to save config: {}", e))?;
    
    Ok(())
}

#[tauri::command]
pub async fn needs_data_migration() -> Result<bool, String> {
    // No migration needed by default
    Ok(false)
}
