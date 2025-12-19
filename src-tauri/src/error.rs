use serde::Serialize;
use thiserror::Error;

#[derive(Debug, Error)]
pub enum AppError {
  #[error("Database error: {0}")]
  Database(#[from] sqlx::Error),

  #[error("IO error: {0}")]
  Io(#[from] std::io::Error),

  #[error("Tauri error: {0}")]
  Tauri(#[from] tauri::Error),

  #[error("Serialization error: {0}")]
  Json(#[from] serde_json::Error),

  #[error("Resource not found: {0}")]
  NotFound(String),

  #[error("Unknown error: {0}")]
  Unknown(String),
}

impl Serialize for AppError {
  fn serialize<S>(&self, serializer: S) -> Result<S::Ok, S::Error>
    where
      S: serde::Serializer {
        use serde::ser::SerializeStruct;
        let mut state = serializer.serialize_struct("AppError", 2)?;

        let code = match self {
          AppError::Database(_) => "DATABASE_ERROR",
          AppError::Io(_) => "IO_ERROR",
          AppError::Tauri(_) => "TAURI_ERROR",
          AppError::Json(_) => "JSON_ERROR",
          AppError::NotFound(_) => "NOT_FOUND_ERROR",
          AppError::Unknown(_) => "UNKNOWN_ERROR",
        };
        state.serialize_field("code", code)?;
        state.serialize_field("message", &self.to_string())?;
        state.end()
  }
}