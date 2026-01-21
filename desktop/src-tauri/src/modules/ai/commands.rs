use crate::error::{AppError, AppResult};
use crate::modules::ai::models::*;
use crate::modules::ai::provider::{create_provider, AIProvider};
use tauri::State;

#[tauri::command]
pub async fn complete_text(
    _api_client: State<'_, crate::api::ApiClient>,
    req: CompleteTextRequest,
) -> Result<String, String> {
    let provider = create_provider().await.map_err(|e| e.to_string())?;
    provider.complete_text(&req).await.map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn rewrite_text(
    _api_client: State<'_, crate::api::ApiClient>,
    req: RewriteTextRequest,
) -> Result<String, String> {
    let provider = create_provider().await.map_err(|e| e.to_string())?;
    provider.rewrite_text(&req).await.map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn summarize_text(
    _api_client: State<'_, crate::api::ApiClient>,
    req: SummarizeTextRequest,
) -> Result<String, String> {
    let provider = create_provider().await.map_err(|e| e.to_string())?;
    provider.summarize_text(&req).await.map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn suggest_tags(
    _api_client: State<'_, crate::api::ApiClient>,
    req: SuggestTagsRequest,
) -> Result<Vec<String>, String> {
    let provider = create_provider().await.map_err(|e| e.to_string())?;
    let tags_str = provider.suggest_tags(&req).await.map_err(|e| e.to_string())?;
    let tags = tags_str.split_whitespace().map(|s| s.to_string()).collect();
    Ok(tags)
}
