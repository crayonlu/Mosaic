use crate::error::AppResult;
use crate::modules::asset::{models, storage};
use std::fs;
use std::io::Write;
use tauri::{AppHandle, Manager};

#[tauri::command]
pub async fn upload_files(
    app_handle: AppHandle,
    file_paths: Vec<String>,
) -> AppResult<Vec<models::UploadedResource>> {
    let mut results = Vec::new();
    for path in file_paths {
        let result = storage::process_and_store_file(&app_handle, &path).await?;
        results.push(result);
    }
    Ok(results)
}

#[tauri::command]
pub async fn save_temp_audio(
    app_handle: AppHandle,
    filename: String,
    data: Vec<u8>,
) -> AppResult<String> {
    let temp_dir = app_handle
        .path()
        .temp_dir()
        .map_err(crate::error::AppError::from)?;

    if !temp_dir.exists() {
        fs::create_dir_all(&temp_dir).map_err(|e| crate::error::AppError::Io(e))?;
    }

    let file_path = temp_dir.join(&filename);
    let mut file = fs::File::create(&file_path).map_err(|e| crate::error::AppError::Io(e))?;

    file.write_all(&data)
        .map_err(|e| crate::error::AppError::Io(e))?;

    Ok(file_path.to_string_lossy().to_string())
}

#[tauri::command]
pub async fn save_temp_file(
    app_handle: AppHandle,
    filename: String,
    data: Vec<u8>,
) -> AppResult<String> {
    let temp_dir = app_handle
        .path()
        .temp_dir()
        .map_err(crate::error::AppError::from)?;

    if !temp_dir.exists() {
        fs::create_dir_all(&temp_dir).map_err(|e| crate::error::AppError::Io(e))?;
    }

    let file_path = temp_dir.join(&filename);
    let mut file = fs::File::create(&file_path).map_err(|e| crate::error::AppError::Io(e))?;

    file.write_all(&data)
        .map_err(|e| crate::error::AppError::Io(e))?;

    Ok(file_path.to_string_lossy().to_string())
}

#[tauri::command]
pub async fn read_audio_file(app_handle: AppHandle, filename: String) -> AppResult<Vec<u8>> {
    let assets_dir = storage::get_assets_dir(&app_handle)?;
    let file_path = assets_dir.join(&filename);

    if !file_path.exists() {
        return Err(crate::error::AppError::NotFound(format!(
            "Audio file not found: {}",
            filename
        )));
    }

    let data = fs::read(&file_path).map_err(|e| crate::error::AppError::Io(e))?;
    Ok(data)
}

#[tauri::command]
pub async fn read_image_file(app_handle: AppHandle, filename: String) -> AppResult<Vec<u8>> {
    let assets_dir = storage::get_assets_dir(&app_handle)?;
    let file_path = assets_dir.join(&filename);

    if !file_path.exists() {
        return Err(crate::error::AppError::NotFound(format!(
            "Image file not found: {}",
            filename
        )));
    }

    let data = fs::read(&file_path).map_err(|e| crate::error::AppError::Io(e))?;
    Ok(data)
}
