use crate::error::{AppError, AppResult};
use tauri::State;

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct SettingValue {
    pub value: String,
}

#[tauri::command]
pub async fn get_setting(_state: State<'_, ()>, key: String) -> Result<Option<SettingValue>, String> {
    Err("Settings are managed by server in selfhost mode".to_string())
}

#[tauri::command]
pub async fn get_settings(_state: State<'_, ()>) -> Result<Vec<(String, SettingValue)>, String> {
    Err("Settings are managed by server in selfhost mode".to_string())
}

#[tauri::command]
pub async fn set_setting(_state: State<'_, ()>, key: String, value: SettingValue) -> Result<(), String> {
    Err("Settings are managed by server in selfhost mode".to_string())
}

#[tauri::command]
pub async fn delete_setting(_state: State<'_, ()>, key: String) -> Result<(), String> {
    Err("Settings are managed by server in selfhost mode".to_string())
}

#[tauri::command]
pub async fn test_ai_connection(_state: State<'_, ()>) -> Result<(), String> {
    Err("AI features are not yet implemented for selfhost mode".to_string())
}

#[tauri::command]
pub async fn enable_autostart(_state: State<'_, ()>, enabled: bool) -> Result<(), String> {
    Ok(())
}

#[tauri::command]
pub async fn is_autostart_enabled(_state: State<'_, ()>) -> Result<bool, String> {
    Ok(false)
}

#[tauri::command]
pub async fn register_show_shortcut(_state: State<'_, ()>) -> Result<(), String> {
    Ok(())
}

#[tauri::command]
pub async fn register_close_shortcut(_state: State<'_, ()>) -> Result<(), String> {
    Ok(())
}

#[tauri::command]
pub async fn unregister_shortcut(_state: State<'_, ()>) -> Result<(), String> {
    Ok(())
}
