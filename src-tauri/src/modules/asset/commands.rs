use tauri::AppHandle;
use crate::error::AppResult;
use crate::modules::asset::{storage, models};

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