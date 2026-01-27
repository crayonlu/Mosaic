use crate::api::{ResourceApi, ResourceResponse};
use crate::error::AppError;
use crate::modules::asset::models::UploadedResource;
use tauri::Manager;

#[tauri::command]
pub async fn upload_files(
    api_client: tauri::State<'_, crate::api::ApiClient>,
    file_paths: Vec<String>,
) -> Result<Vec<UploadedResource>, String> {
    let resource_api = ResourceApi::new(api_client.inner().clone());
    let mut results = Vec::new();

    for path in file_paths {
        let data = tokio::fs::read(&path).await.map_err(|e| e.to_string())?;

        let filename = std::path::Path::new(&path)
            .file_name()
            .unwrap()
            .to_string_lossy()
            .to_string();

        let mime_type = infer::get(&data.as_slice())
            .map(|m| m.mime_type().to_string())
            .unwrap_or_else(|| "application/octet-stream".to_string());

        if !mime_type.starts_with("image/") {
            return Err(
                AppError::UploadError("Only image files are supported".to_string()).to_string(),
            );
        }

        let response = resource_api
            .upload(filename.clone(), data, mime_type)
            .await
            .map_err(|e| e.to_string())?;

        results.push(UploadedResource {
            filename: response["filename"].as_str().unwrap().to_string(),
            size: response["size"].as_i64().unwrap_or(0),
            mime_type: response["mime_type"].as_str().unwrap().to_string(),
            resource_type: "image".to_string(),
        });
    }

    Ok(results)
}

#[tauri::command]
pub async fn save_temp_file(
    app_handle: tauri::AppHandle,
    filename: String,
    data: Vec<u8>,
) -> Result<String, String> {
    let temp_dir = app_handle.path().temp_dir().map_err(|e| e.to_string())?;

    if !temp_dir.exists() {
        std::fs::create_dir_all(&temp_dir).map_err(|e| e.to_string())?;
    }

    let file_path = temp_dir.join(&filename);
    tokio::fs::write(&file_path, data)
        .await
        .map_err(|e| e.to_string())?;

    Ok(file_path.to_string_lossy().to_string())
}

#[tauri::command]
pub async fn read_image_file(
    api_client: tauri::State<'_, crate::api::ApiClient>,
    filename: String,
) -> Result<Vec<u8>, String> {
    let resource_api = ResourceApi::new(api_client.inner().clone());
    let resource = resource_api
        .get(&filename)
        .await
        .map_err(|e| e.to_string())?;

    let client = reqwest::Client::new();
    let response = client
        .get(&resource.url)
        .send()
        .await
        .map_err(|e| e.to_string())?;

    if !response.status().is_success() {
        return Err(format!(
            "Failed to download resource: {}",
            response.status()
        ));
    }

    response
        .bytes()
        .await
        .map(|b| b.to_vec())
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn delete_asset_file(
    api_client: tauri::State<'_, crate::api::ApiClient>,
    filename: String,
) -> Result<(), String> {
    let resource_api = ResourceApi::new(api_client.inner().clone());
    resource_api
        .delete(&filename)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn get_resource(
    api_client: tauri::State<'_, crate::api::ApiClient>,
    id: String,
) -> Result<ResourceResponse, String> {
    let resource_api = ResourceApi::new(api_client.inner().clone());
    resource_api.get(&id).await.map_err(|e| e.to_string())
}
