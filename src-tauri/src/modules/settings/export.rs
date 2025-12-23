use crate::error::AppResult;
use std::fs;
use tauri::{AppHandle, Manager};

#[tauri::command]
pub async fn export_data(
    app: AppHandle,
    data: String,
    filename: String,
) -> AppResult<String> {
    let app_dir = app.path().app_data_dir()?;
    if !app_dir.exists() {
        fs::create_dir_all(&app_dir)?;
    }

    let file_path = app_dir.join(&filename);
    fs::write(&file_path, data)?;

    Ok(file_path.to_string_lossy().to_string())
}

