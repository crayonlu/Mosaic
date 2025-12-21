use crate::database::DBPool;
use crate::error::AppResult;
use crate::modules::memo::models::{
    CreateMemoRequest, ListMemosRequest, MemoWithResources, PaginatedResponse,
};
use crate::modules::memo::service;
use tauri::{AppHandle, State};

#[tauri::command]
pub async fn create_memo(
    app_handle: AppHandle,
    pool: State<'_, DBPool>,
    req: CreateMemoRequest,
) -> AppResult<String> {
    let memo_id = service::create_memo(pool.inner(), &app_handle, req).await?;
    Ok(memo_id)
}

#[tauri::command]
pub async fn get_memo(pool: State<'_, DBPool>, memo_id: String) -> AppResult<MemoWithResources> {
    service::get_memo_by_id(pool.inner(), &memo_id).await
}

#[tauri::command]
pub async fn list_memos(
    pool: State<'_, DBPool>,
    req: ListMemosRequest,
) -> AppResult<PaginatedResponse<MemoWithResources>> {
    service::list_memos(pool.inner(), req).await
}

#[tauri::command]
pub async fn get_memos_by_date(
    pool: State<'_, DBPool>,
    date: String,
) -> AppResult<Vec<MemoWithResources>> {
    service::get_memos_by_date(pool.inner(), &date).await
}
