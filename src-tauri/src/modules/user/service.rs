use super::models::UpdateUserRequest;
use crate::database::DBPool;
use crate::error::{AppError, AppResult};
use crate::modules::asset::constants::is_image_format;
use crate::modules::asset::storage::get_assets_dir;
use chrono::Utc;
use sqlx::Sqlite;
use std::fs;
use std::path::Path;
use tauri::AppHandle;
use uuid::Uuid;

pub async fn get_user(pool: &DBPool) -> AppResult<Option<super::models::User>> {
    let user = sqlx::query_as::<_, super::models::User>(
        r#"
      SELECT id, username, avatar_path, avatar_url, created_at, updated_at
      FROM users
      LIMIT 1
    "#,
    )
    .fetch_optional(pool)
    .await?;

    Ok(user)
}

pub async fn get_or_create_default_user(pool: &DBPool) -> AppResult<super::models::User> {
    if let Some(user) = get_user(pool).await? {
        return Ok(user);
    }

    let user_id = Uuid::new_v4().to_string();
    let now = Utc::now().timestamp_millis();

    sqlx::query(
        r#"
      INSERT INTO users (id, username, avatar_path, avatar_url, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?)
    "#,
    )
    .bind(&user_id)
    .bind("User")
    .bind::<Option<String>>(None)
    .bind::<Option<String>>(None)
    .bind(now)
    .bind(now)
    .execute(pool)
    .await?;

    get_user(pool)
        .await?
        .ok_or_else(|| AppError::NotFound("User not found after creation".to_string()))
}

pub async fn update_user(pool: &DBPool, req: UpdateUserRequest) -> AppResult<super::models::User> {
    let user = get_or_create_default_user(pool).await?;
    let now = Utc::now().timestamp_millis();

    let mut update_fields = Vec::new();
    let mut query_builder = sqlx::QueryBuilder::<Sqlite>::new("UPDATE users SET ");

    if req.username.is_some() {
        update_fields.push("username = ?");
    }
    if req.avatar_path.is_some() {
        update_fields.push("avatar_path = ?");
    }
    if req.avatar_url.is_some() {
        update_fields.push("avatar_url = ?");
    }
    update_fields.push("updated_at = ?");

    query_builder.push(update_fields.join(", "));
    query_builder.push(" WHERE id = ?");

    let mut query = sqlx::query(&query_builder.sql());

    if let Some(ref username) = req.username {
        query = query.bind(username);
    }
    if let Some(ref avatar_path) = req.avatar_path {
        query = query.bind(avatar_path);
    }
    if let Some(ref avatar_url) = req.avatar_url {
        query = query.bind(avatar_url);
    }
    query = query.bind(now).bind(&user.id);

    query.execute(pool).await?;

    get_user(pool)
        .await?
        .ok_or_else(|| AppError::NotFound("User not found after update".to_string()))
}

pub async fn upload_avatar(
    pool: &DBPool,
    app_handle: &AppHandle,
    source_path: &str,
) -> AppResult<super::models::User> {
    let path = Path::new(source_path);
    let ext = path
        .extension()
        .and_then(|s| s.to_str())
        .unwrap_or("")
        .to_lowercase();

    let assets_dir = get_assets_dir(app_handle)?;
    let avatars_dir = assets_dir.join("avatars");

    if !avatars_dir.exists() {
        fs::create_dir_all(&avatars_dir).map_err(AppError::Io)?;
    }

    let filename = if ext.is_empty() {
        format!("{}.webp", Uuid::new_v4())
    } else {
        format!("{}.{}", Uuid::new_v4(), ext)
    };

    let dest_path = avatars_dir.join(&filename);

    if is_image_format(&ext) {
        let image_data = fs::read(source_path).map_err(AppError::Io)?;
        let img = image::load_from_memory(&image_data)
            .map_err(|e| AppError::Image(format!("Failed to load image: {}", e)))?;
        img.save_with_format(&dest_path, image::ImageFormat::WebP)
            .map_err(|e| AppError::Image(format!("Failed to save image: {}", e)))?;
    } else {
        fs::copy(source_path, &dest_path).map_err(AppError::Io)?;
    }

    let avatar_path = format!("avatars/{}", filename);

    let req = UpdateUserRequest {
        username: None,
        avatar_path: Some(avatar_path),
        avatar_url: None,
    };

    update_user(pool, req).await
}
