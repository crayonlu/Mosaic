use crate::modules::ai::models::*;
use crate::modules::ai::provider::{create_provider, AIProvider};
use serde::Serialize;
use tauri::State;

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CompleteTextResponse {
    generated_text: String,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct RewriteTextResponse {
    rewritten_text: String,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SummarizeTextResponse {
    summary: String,
}

#[tauri::command]
pub async fn complete_text(
    _api_client: State<'_, crate::api::ApiClient>,
    req: CompleteTextRequest,
) -> Result<CompleteTextResponse, String> {
    let provider = create_provider().await.map_err(|e| e.to_string())?;
    let result = provider
        .complete_text(&req)
        .await
        .map_err(|e| e.to_string())?;
    Ok(CompleteTextResponse {
        generated_text: result,
    })
}

#[tauri::command]
pub async fn rewrite_text(
    _api_client: State<'_, crate::api::ApiClient>,
    req: RewriteTextRequest,
) -> Result<RewriteTextResponse, String> {
    let provider = create_provider().await.map_err(|e| e.to_string())?;
    let result = provider
        .rewrite_text(&req)
        .await
        .map_err(|e| e.to_string())?;
    Ok(RewriteTextResponse {
        rewritten_text: result,
    })
}

#[tauri::command]
pub async fn summarize_text(
    _api_client: State<'_, crate::api::ApiClient>,
    req: SummarizeTextRequest,
) -> Result<SummarizeTextResponse, String> {
    let provider = create_provider().await.map_err(|e| e.to_string())?;
    let result = provider
        .summarize_text(&req)
        .await
        .map_err(|e| e.to_string())?;
    Ok(SummarizeTextResponse { summary: result })
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SuggestTagsResponse {
    tags: Vec<String>,
}

#[tauri::command]
pub async fn suggest_tags(
    _api_client: State<'_, crate::api::ApiClient>,
    req: SuggestTagsRequest,
) -> Result<SuggestTagsResponse, String> {
    let provider = create_provider().await.map_err(|e| e.to_string())?;
    let tags_str = provider
        .suggest_tags(&req)
        .await
        .map_err(|e| e.to_string())?;
    let tags = tags_str.split_whitespace().map(|s| s.to_string()).collect();
    Ok(SuggestTagsResponse { tags })
}
