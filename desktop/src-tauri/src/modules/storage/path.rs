use crate::database::DBPool;
use crate::error::AppResult;
use crate::modules::settings::service;
use std::path::PathBuf;
use tauri::{AppHandle, Manager};

pub async fn get_data_directory(app_handle: &AppHandle) -> AppResult<PathBuf> {
    if let Some(pool) = app_handle.try_state::<DBPool>() {
        if let Ok(Some(setting)) = service::get_setting(pool.inner(), "data_directory").await {
            let custom_path = PathBuf::from(setting.value);
            if custom_path.exists() && custom_path.is_dir() {
                return Ok(custom_path);
            }
        }
    }

    let install_dir = get_install_directory(app_handle)?;
    let data_dir = install_dir.join("data");

    if !data_dir.exists() {
        std::fs::create_dir_all(&data_dir).map_err(|e| {
            crate::error::AppError::Io(std::io::Error::new(
                std::io::ErrorKind::PermissionDenied,
                format!("Failed to create data directory: {}", e),
            ))
        })?;
    }

    Ok(data_dir)
}

pub async fn get_logs_directory(app_handle: &AppHandle) -> AppResult<PathBuf> {
    let data_dir = get_data_directory(app_handle).await?;
    let logs_dir = data_dir.join("logs");

    if !logs_dir.exists() {
        std::fs::create_dir_all(&logs_dir).map_err(|e| {
            crate::error::AppError::Io(std::io::Error::new(
                std::io::ErrorKind::PermissionDenied,
                format!("Failed to create logs directory: {}", e),
            ))
        })?;
    }

    Ok(logs_dir)
}

pub async fn get_assets_directory(app_handle: &AppHandle) -> AppResult<PathBuf> {
    let data_dir = get_data_directory(app_handle).await?;
    let assets_dir = data_dir.join("assets");

    if !assets_dir.exists() {
        std::fs::create_dir_all(&assets_dir).map_err(|e| {
            crate::error::AppError::Io(std::io::Error::new(
                std::io::ErrorKind::PermissionDenied,
                format!("Failed to create assets directory: {}", e),
            ))
        })?;
    }

    Ok(assets_dir)
}

pub async fn get_database_path(app_handle: &AppHandle) -> AppResult<PathBuf> {
    let data_dir = get_data_directory(app_handle).await?;
    Ok(data_dir.join("mosaic.db"))
}

pub fn get_install_directory(app_handle: &AppHandle) -> AppResult<PathBuf> {
    if let Ok(resource_dir) = app_handle.path().resource_dir() {
        if resource_dir.exists() {
            return Ok(resource_dir);
        }
    }

    if let Ok(local_data_dir) = app_handle.path().app_local_data_dir() {
        if local_data_dir.exists() {
            return Ok(local_data_dir);
        }
    }

    if let Ok(current_dir) = std::env::current_dir() {
        return Ok(current_dir);
    }

    Err(crate::error::AppError::Io(std::io::Error::new(
        std::io::ErrorKind::NotFound,
        "Could not determine install directory",
    )))
}
