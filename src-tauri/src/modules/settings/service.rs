use crate::database::DBPool;
use crate::error::AppResult;
use crate::modules::settings::models::{SetSettingRequest, Setting};
use chrono::Utc;
use uuid::Uuid;

pub async fn get_setting(pool: &DBPool, key: &str) -> AppResult<Option<Setting>> {
    let result = sqlx::query_as::<_, Setting>(
        "SELECT id, key, value, category, created_at, updated_at FROM settings WHERE key = ?",
    )
    .bind(key)
    .fetch_optional(pool)
    .await?;

    Ok(result)
}

pub async fn get_settings(pool: &DBPool, category: Option<&str>) -> AppResult<Vec<Setting>> {
    let result = if let Some(cat) = category {
        sqlx::query_as::<_, Setting>(
            "SELECT id, key, value, category, created_at, updated_at FROM settings WHERE category = ? ORDER BY key",
        )
        .bind(cat)
        .fetch_all(pool)
        .await?
    } else {
        sqlx::query_as::<_, Setting>(
            "SELECT id, key, value, category, created_at, updated_at FROM settings ORDER BY category, key",
        )
        .fetch_all(pool)
        .await?
    };

    Ok(result)
}

pub async fn set_setting(pool: &DBPool, req: SetSettingRequest) -> AppResult<Setting> {
    let now = Utc::now().timestamp_millis();

    let existing = get_setting(pool, &req.key).await?;

    if existing.is_some() {
        sqlx::query("UPDATE settings SET value = ?, category = ?, updated_at = ? WHERE key = ?")
            .bind(&req.value)
            .bind(&req.category)
            .bind(now)
            .bind(&req.key)
            .execute(pool)
            .await?;

        get_setting(pool, &req.key).await?.ok_or_else(|| {
            crate::error::AppError::NotFound("Setting not found after update".to_string())
        })
    } else {
        let id = Uuid::new_v4().to_string();
        sqlx::query(
            "INSERT INTO settings (id, key, value, category, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)",
        )
        .bind(&id)
        .bind(&req.key)
        .bind(&req.value)
        .bind(&req.category)
        .bind(now)
        .bind(now)
        .execute(pool)
        .await?;

        get_setting(pool, &req.key).await?.ok_or_else(|| {
            crate::error::AppError::NotFound("Setting not found after creation".to_string())
        })
    }
}

pub async fn delete_setting(pool: &DBPool, key: &str) -> AppResult<()> {
    let rows_affected = sqlx::query("DELETE FROM settings WHERE key = ?")
        .bind(key)
        .execute(pool)
        .await?
        .rows_affected();

    if rows_affected == 0 {
        return Err(crate::error::AppError::NotFound(format!(
            "Setting with key {} not found",
            key
        )));
    }

    Ok(())
}
