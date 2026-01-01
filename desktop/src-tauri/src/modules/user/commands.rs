use crate::database::DBPool;
use crate::error::AppResult;
use crate::modules::user::models::{UpdateUserRequest, User};
use crate::modules::user::service;
use tauri::{AppHandle, State};

#[tauri::command]
pub async fn get_user(pool: State<'_, DBPool>) -> AppResult<Option<User>> {
    service::get_user(pool.inner()).await
}

#[tauri::command]
pub async fn get_or_create_default_user(pool: State<'_, DBPool>) -> AppResult<User> {
    service::get_or_create_default_user(pool.inner()).await
}

#[tauri::command]
pub async fn update_user(pool: State<'_, DBPool>, req: UpdateUserRequest) -> AppResult<User> {
    service::update_user(pool.inner(), req).await
}

#[tauri::command]
pub async fn upload_avatar(
    app_handle: AppHandle,
    pool: State<'_, DBPool>,
    source_path: String,
) -> AppResult<User> {
    service::upload_avatar(pool.inner(), &app_handle, &source_path).await
}
