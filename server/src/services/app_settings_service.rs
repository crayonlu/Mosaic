use crate::error::AppError;
use sqlx::PgPool;

#[derive(Clone)]
pub struct AppSettingsService {
    pool: PgPool,
}

impl AppSettingsService {
    pub fn new(pool: PgPool) -> Self {
        Self { pool }
    }

    pub async fn get_bool(&self, key: &str, default: bool) -> bool {
        let result: Option<String> =
            sqlx::query_scalar("SELECT value FROM app_settings WHERE key = $1")
                .bind(key)
                .fetch_optional(&self.pool)
                .await
                .ok()
                .flatten();

        match result.as_deref() {
            Some("true") => true,
            Some("false") => false,
            _ => default,
        }
    }

    pub async fn get_all(&self) -> Result<Vec<(String, String)>, AppError> {
        let rows: Vec<(String, String)> =
            sqlx::query_as("SELECT key, value FROM app_settings ORDER BY key ASC")
                .fetch_all(&self.pool)
                .await
                .map_err(AppError::Database)?;
        Ok(rows)
    }

    pub async fn set(&self, key: &str, value: &str) -> Result<(), AppError> {
        let now = chrono::Utc::now().timestamp_millis();
        sqlx::query(
            "INSERT INTO app_settings (key, value, updated_at)
             VALUES ($1, $2, $3)
             ON CONFLICT (key) DO UPDATE SET value = $2, updated_at = $3",
        )
        .bind(key)
        .bind(value)
        .bind(now)
        .execute(&self.pool)
        .await
        .map_err(AppError::Database)?;
        Ok(())
    }
}
