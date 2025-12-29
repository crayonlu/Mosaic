use crate::database::DBPool;
use crate::error::AppResult;
use crate::modules::ai::models::*;
use crate::modules::ai::service;
use tauri::State;

#[tauri::command]
pub async fn complete_text(
    pool: State<'_, DBPool>,
    req: CompleteTextRequest,
) -> AppResult<CompleteTextResponse> {
    service::complete_text(pool.inner(), req).await
}

#[tauri::command]
pub async fn rewrite_text(
    pool: State<'_, DBPool>,
    req: RewriteTextRequest,
) -> AppResult<RewriteTextResponse> {
    service::rewrite_text(pool.inner(), req).await
}

#[tauri::command]
pub async fn summarize_text(
    pool: State<'_, DBPool>,
    req: SummarizeTextRequest,
) -> AppResult<SummarizeTextResponse> {
    service::summarize_text(pool.inner(), req).await
}

#[tauri::command]
pub async fn suggest_tags(
    pool: State<'_, DBPool>,
    req: SuggestTagsRequest,
) -> AppResult<SuggestTagsResponse> {
    service::suggest_tags(pool.inner(), req).await
}
