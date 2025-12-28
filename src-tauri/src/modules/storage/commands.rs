use crate::error::AppResult;
use crate::modules::storage::{migration, path};
use std::path::PathBuf;
use tauri::AppHandle;

fn normalize_path_for_display(path: PathBuf) -> String {
    let path_str = path.to_string_lossy().to_string();
    if path_str.starts_with("\\\\?\\") {
        path_str[4..].to_string()
    } else {
        path_str
    }
}

#[tauri::command]
pub async fn get_data_directory(app_handle: AppHandle) -> AppResult<String> {
    let data_dir = path::get_data_directory(&app_handle).await?;
    Ok(normalize_path_for_display(data_dir))
}

#[tauri::command]
pub async fn get_default_data_directory(app_handle: AppHandle) -> AppResult<String> {
    let install_dir = path::get_install_directory(&app_handle)?;
    let default_dir = install_dir.join("data");
    Ok(normalize_path_for_display(default_dir))
}

#[tauri::command]
pub async fn select_data_directory(_app_handle: AppHandle) -> AppResult<Option<String>> {
    Ok(None)
}

#[tauri::command]
pub async fn set_data_directory(
    app_handle: AppHandle,
    new_directory_path: String,
) -> AppResult<()> {
    let new_directory = PathBuf::from(new_directory_path);

    if !new_directory.exists() {
        return Err(crate::error::AppError::Io(std::io::Error::new(
            std::io::ErrorKind::NotFound,
            "选择的目录不存在",
        )));
    }

    if !new_directory.is_dir() {
        return Err(crate::error::AppError::Io(std::io::Error::new(
            std::io::ErrorKind::InvalidInput,
            "选择的项目不是目录",
        )));
    }

    let test_file = new_directory.join(".write_test");
    match std::fs::File::create(&test_file) {
        Ok(_) => {
            let _ = std::fs::remove_file(&test_file);
        }
        Err(e) => {
            return Err(crate::error::AppError::Io(std::io::Error::new(
                std::io::ErrorKind::PermissionDenied,
                format!("选择的目录不可写: {}", e),
            )));
        }
    }

    migration::migrate_data(&app_handle, &new_directory).await?;

    Ok(())
}

#[tauri::command]
pub async fn needs_data_migration(app_handle: AppHandle) -> AppResult<bool> {
    migration::needs_migration(&app_handle).await
}
