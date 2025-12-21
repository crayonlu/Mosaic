use crate::database::DBPool;
use crate::error::AppResult;
use crate::modules::diary::models::{
    CreateOrUpdateDiaryRequest, Diary, DiaryWithMemos, ListDiariesRequest, UpdateDiaryMoodRequest,
    UpdateDiarySummaryRequest,
};
use crate::modules::diary::service;
use crate::modules::memo::models::PaginatedResponse;
use tauri::State;

#[tauri::command]
pub async fn get_diary_by_date(pool: State<'_, DBPool>, date: String) -> AppResult<DiaryWithMemos> {
    service::get_diary_by_date(pool.inner(), &date).await
}

#[tauri::command]
pub async fn create_or_update_diary(
    pool: State<'_, DBPool>,
    req: CreateOrUpdateDiaryRequest,
) -> AppResult<()> {
    service::create_or_update_diary(pool.inner(), req).await
}

#[tauri::command]
pub async fn list_diaries(
    pool: State<'_, DBPool>,
    req: ListDiariesRequest,
) -> AppResult<PaginatedResponse<Diary>> {
    service::list_diaries(pool.inner(), req).await
}

#[tauri::command]
pub async fn update_diary_summary(
    pool: State<'_, DBPool>,
    req: UpdateDiarySummaryRequest,
) -> AppResult<()> {
    service::update_diary_summary(pool.inner(), req).await
}

#[tauri::command]
pub async fn update_diary_mood(
    pool: State<'_, DBPool>,
    req: UpdateDiaryMoodRequest,
) -> AppResult<()> {
    service::update_diary_mood(pool.inner(), req).await
}
