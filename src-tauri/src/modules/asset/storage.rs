use super::constants::{is_audio_format, is_image_format, is_video_format};
use super::models::UploadedResource;
use crate::database::schema::ResourceType;
use crate::error::{AppError, AppResult};
use std::fs;
use std::path::{Path, PathBuf};
use tauri::{AppHandle, Manager};
use uuid::Uuid;

pub fn get_assets_dir(app_handle: &AppHandle) -> AppResult<PathBuf> {
    let app_dir = app_handle.path().app_data_dir().map_err(AppError::Tauri)?;

    let assets_dir = app_dir.join("assets");

    if !assets_dir.exists() {
        fs::create_dir_all(&assets_dir).map_err(AppError::Io)?;
    }

    Ok(assets_dir)
}

pub async fn process_and_store_file(
    app_handle: &AppHandle,
    source_path: &str,
) -> AppResult<UploadedResource> {
    let path = Path::new(source_path);
    let ext = path
        .extension()
        .and_then(|s| s.to_str())
        .unwrap_or("")
        .to_lowercase();

    if is_image_format(&ext) {
        process_image(app_handle, source_path).await
    } else if is_audio_format(&ext) {
        process_audio(app_handle, source_path).await
    } else if is_video_format(&ext) {
        process_video(app_handle, source_path).await
    } else {
        process_other_file(app_handle, source_path, &ext).await
    }
}

async fn process_image(app_handle: &AppHandle, source_path: &str) -> AppResult<UploadedResource> {
    let image_data = fs::read(source_path).map_err(AppError::Io)?;

    let img = image::load_from_memory(&image_data)
        .map_err(|e| AppError::Image(format!("Failed to load image: {}", e)))?;

    let filename = format!("{}.webp", Uuid::new_v4());
    let assets_dir = get_assets_dir(app_handle)?;
    let dest_path = assets_dir.join(&filename);

    img.save_with_format(&dest_path, image::ImageFormat::WebP)
        .map_err(|e| AppError::Image(format!("Failed to save image: {}", e)))?;

    let metadata = fs::metadata(&dest_path).map_err(AppError::Io)?;

    Ok(UploadedResource {
        filename,
        size: metadata.len() as i64,
        mime_type: "image/webp".to_string(),
        resource_type: ResourceType::Image,
    })
}

async fn process_audio(app_handle: &AppHandle, source_path: &str) -> AppResult<UploadedResource> {
    let ext = Path::new(source_path)
        .extension()
        .and_then(|s| s.to_str())
        .unwrap_or("m4a")
        .to_lowercase();

    let filename = format!("{}.{}", Uuid::new_v4(), ext);
    let assets_dir = get_assets_dir(app_handle)?;
    let dest_path = assets_dir.join(&filename);

    fs::copy(source_path, &dest_path).map_err(AppError::Io)?;

    let metadata = fs::metadata(&dest_path).map_err(AppError::Io)?;

    Ok(UploadedResource {
        filename,
        size: metadata.len() as i64,
        mime_type: format!("audio/{}", ext),
        resource_type: ResourceType::Voice,
    })
}

async fn process_video(app_handle: &AppHandle, source_path: &str) -> AppResult<UploadedResource> {
    let ext = Path::new(source_path)
        .extension()
        .and_then(|s| s.to_str())
        .unwrap_or("mp4")
        .to_lowercase();

    let filename = format!("{}.{}", Uuid::new_v4(), ext);
    let assets_dir = get_assets_dir(app_handle)?;
    let dest_path = assets_dir.join(&filename);

    fs::copy(source_path, &dest_path).map_err(AppError::Io)?;

    let metadata = fs::metadata(&dest_path).map_err(AppError::Io)?;

    Ok(UploadedResource {
        filename,
        size: metadata.len() as i64,
        mime_type: format!("video/{}", ext),
        resource_type: ResourceType::Video,
    })
}

async fn process_other_file(
    app_handle: &AppHandle,
    source_path: &str,
    ext: &str,
) -> AppResult<UploadedResource> {
    let filename = if ext.is_empty() {
        Uuid::new_v4().to_string()
    } else {
        format!("{}.{}", Uuid::new_v4(), ext)
    };

    let assets_dir = get_assets_dir(app_handle)?;
    let dest_path = assets_dir.join(&filename);

    fs::copy(source_path, &dest_path).map_err(AppError::Io)?;

    let metadata = fs::metadata(&dest_path).map_err(AppError::Io)?;

    Ok(UploadedResource {
        filename,
        size: metadata.len() as i64,
        mime_type: "application/octet-stream".to_string(),
        resource_type: ResourceType::File,
    })
}
