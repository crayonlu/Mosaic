use crate::database::DBPool;
use crate::error::AppResult;
use crate::modules::settings::service;
use crate::modules::storage::path;
use std::fs;
use std::path::PathBuf;
use tauri::{AppHandle, Manager};
use tokio::task;

pub async fn migrate_data(app_handle: &AppHandle, new_data_directory: &PathBuf) -> AppResult<()> {
    let current_data_dir = path::get_data_directory(app_handle).await?;
    let current_db_path = path::get_database_path(app_handle).await?;
    let current_assets_dir = path::get_assets_directory(app_handle).await?;
    let current_logs_dir = path::get_logs_directory(app_handle).await?;

    let new_db_path = new_data_directory.join("mosaic.db");
    let new_assets_dir = new_data_directory.join("assets");
    let new_logs_dir = new_data_directory.join("logs");

    if !new_data_directory.exists() {
        fs::create_dir_all(new_data_directory).map_err(|e| {
            crate::error::AppError::Io(std::io::Error::new(
                std::io::ErrorKind::PermissionDenied,
                format!("Failed to create new data directory: {}", e),
            ))
        })?;
    }

    if current_db_path.exists() {
        tracing::info!(
            "Migrating database from {:?} to {:?}",
            current_db_path,
            new_db_path
        );
        migrate_file(&current_db_path, &new_db_path)?;
    }

    if current_assets_dir.exists() {
        tracing::info!(
            "Migrating assets from {:?} to {:?}",
            current_assets_dir,
            new_assets_dir
        );
        migrate_directory(&current_assets_dir, &new_assets_dir)?;
    }

    if current_logs_dir.exists() {
        tracing::info!(
            "Migrating logs from {:?} to {:?}",
            current_logs_dir,
            new_logs_dir
        );
        migrate_directory(&current_logs_dir, &new_logs_dir)?;
    }

    if let Some(pool) = app_handle.try_state::<DBPool>() {
        service::set_setting(
            pool.inner(),
            crate::modules::settings::models::SetSettingRequest {
                key: "data_directory".to_string(),
                value: new_data_directory.to_string_lossy().to_string(),
                category: "storage".to_string(),
            },
        )
        .await?;
    }

    tracing::info!("Data migration completed successfully");
    Ok(())
}

fn migrate_file(from: &PathBuf, to: &PathBuf) -> AppResult<()> {
    if let Some(parent) = to.parent() {
        if !parent.exists() {
            fs::create_dir_all(parent).map_err(|e| {
                crate::error::AppError::Io(std::io::Error::new(
                    std::io::ErrorKind::PermissionDenied,
                    format!("Failed to create parent directory: {}", e),
                ))
            })?;
        }
    }

    fs::copy(from, to).map_err(|e| {
        crate::error::AppError::Io(std::io::Error::new(
            std::io::ErrorKind::Other,
            format!("Failed to copy file from {:?} to {:?}: {}", from, to, e),
        ))
    })?;

    Ok(())
}

fn migrate_directory(from: &PathBuf, to: &PathBuf) -> AppResult<()> {
    if !to.exists() {
        fs::create_dir_all(to).map_err(|e| {
            crate::error::AppError::Io(std::io::Error::new(
                std::io::ErrorKind::PermissionDenied,
                format!("Failed to create directory {:?}: {}", to, e),
            ))
        })?;
    }

    copy_directory_recursive(from, to)
}

fn copy_directory_recursive(from: &PathBuf, to: &PathBuf) -> AppResult<()> {
    let entries = fs::read_dir(from).map_err(|e| {
        crate::error::AppError::Io(std::io::Error::new(
            std::io::ErrorKind::NotFound,
            format!("Failed to read directory {:?}: {}", from, e),
        ))
    })?;

    for entry in entries {
        let entry = entry.map_err(|e| {
            crate::error::AppError::Io(std::io::Error::new(
                std::io::ErrorKind::Other,
                format!("Failed to read directory entry: {}", e),
            ))
        })?;

        let entry_path = entry.path();
        let file_name = entry_path.file_name().ok_or_else(|| {
            crate::error::AppError::Io(std::io::Error::new(
                std::io::ErrorKind::InvalidInput,
                "Invalid file name",
            ))
        })?;

        let dest_path = to.join(file_name);

        let file_type = entry.file_type().map_err(|e| {
            crate::error::AppError::Io(std::io::Error::new(
                std::io::ErrorKind::Other,
                format!("Failed to get file type: {}", e),
            ))
        })?;

        if file_type.is_dir() {
            copy_directory_recursive(&entry_path, &dest_path)?;
        } else {
            fs::copy(&entry_path, &dest_path).map_err(|e| {
                crate::error::AppError::Io(std::io::Error::new(
                    std::io::ErrorKind::Other,
                    format!(
                        "Failed to copy file {:?} to {:?}: {}",
                        entry_path, dest_path, e
                    ),
                ))
            })?;
        }
    }

    Ok(())
}

pub async fn needs_migration(app_handle: &AppHandle) -> AppResult<bool> {
    let setting_path = if let Some(pool) = app_handle.try_state::<DBPool>() {
        if let Ok(Some(setting)) = service::get_setting(pool.inner(), "data_directory").await {
            Some(PathBuf::from(setting.value))
        } else {
            None
        }
    } else {
        None
    };

    let current_path = path::get_data_directory(app_handle).await?;

    if setting_path.is_none() {
        return Ok(false);
    }

    let setting_path = setting_path.unwrap();
    Ok(setting_path != current_path)
}
