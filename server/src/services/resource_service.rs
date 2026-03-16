use crate::config::Config;
use crate::error::AppError;
use crate::models::{
    build_download_route, build_thumbnail_route, thumbnail_mime_type, thumbnail_storage_path,
    with_thumbnail_metadata, ConfirmUploadRequest, CreateResourceRequest, PresignedUploadResponse,
    Resource, ResourceResponse,
};
use crate::services::{ImageProcessor, VideoProcessor};
use crate::storage::traits::Storage;
use bytes::Bytes;
use chrono::Utc;
use serde_json::{Map, Value};
use sqlx::PgPool;
use std::path::{Path, PathBuf};
use std::sync::Arc;
use tokio::process::Command;
use uuid::Uuid;

fn empty_metadata() -> Value {
    Value::Object(Map::new())
}

#[derive(Clone)]
pub struct ResourceService {
    pool: PgPool,
    storage: Arc<dyn Storage>,
    config: Config,
}

impl ResourceService {
    pub fn new(pool: PgPool, storage: Arc<dyn Storage>, config: Config) -> Self {
        Self {
            pool,
            storage,
            config,
        }
    }

    fn build_thumbnail_url(&self, resource: &Resource) -> Option<String> {
        if resource.mime_type.starts_with("video/") {
            Some(build_thumbnail_route(resource.id))
        } else {
            None
        }
    }

    fn extract_user_id_from_storage_path(storage_path: &str) -> Option<&str> {
        let mut segments = storage_path.split('/');
        match (segments.next(), segments.next()) {
            (Some("resources"), Some(user_id)) => Some(user_id),
            _ => None,
        }
    }

    async fn ensure_thumbnail_metadata(
        &self,
        resource: &mut Resource,
    ) -> Result<Option<(String, String)>, AppError> {
        if !resource.mime_type.starts_with("video/") {
            return Ok(None);
        }

        if let Some(thumbnail_path) = thumbnail_storage_path(&resource.metadata) {
            let mime_type = thumbnail_mime_type(&resource.metadata)
                .unwrap_or("image/jpeg")
                .to_string();
            return Ok(Some((thumbnail_path.to_string(), mime_type)));
        }

        let Some(user_id) = Self::extract_user_id_from_storage_path(&resource.storage_path) else {
            return Ok(None);
        };

        let original_data = self
            .storage
            .download(&resource.storage_path)
            .await
            .map_err(|e| AppError::Storage(e.to_string()))?;

        let Some(thumbnail_path) = self
            .try_generate_thumbnail(user_id, resource.id, &resource.mime_type, &original_data)
            .await
        else {
            return Ok(None);
        };

        resource.metadata = with_thumbnail_metadata(
            resource.metadata.clone(),
            thumbnail_path.clone(),
            "image/jpeg".to_string(),
        );

        sqlx::query("UPDATE resources SET metadata = $1 WHERE id = $2")
            .bind(&resource.metadata)
            .bind(resource.id)
            .execute(&self.pool)
            .await?;

        Ok(Some((thumbnail_path, "image/jpeg".to_string())))
    }

    async fn build_resource_response(
        &self,
        resource: Resource,
    ) -> Result<ResourceResponse, AppError> {
        let url = match self.config.storage_type {
            crate::config::StorageType::R2 => self
                .storage
                .get_presigned_url(&resource.storage_path, 86400)
                .await
                .map_err(|e| AppError::Storage(e.to_string()))?,
            crate::config::StorageType::Local => build_download_route(resource.id),
        };

        let thumbnail_url = self.build_thumbnail_url(&resource);

        Ok(ResourceResponse {
            id: resource.id,
            memo_id: resource.memo_id,
            filename: resource.filename,
            resource_type: resource.resource_type,
            mime_type: resource.mime_type,
            file_size: resource.file_size,
            storage_type: resource.storage_type,
            url,
            thumbnail_url,
            metadata: resource.metadata,
            created_at: resource.created_at,
        })
    }

    fn video_extension(mime_type: &str) -> &'static str {
        match mime_type {
            "video/quicktime" => "mov",
            "video/webm" => "webm",
            "video/x-msvideo" => "avi",
            "video/x-matroska" => "mkv",
            _ => "mp4",
        }
    }

    async fn cleanup_temp_files(paths: &[PathBuf]) {
        for path in paths {
            let _ = tokio::fs::remove_file(path).await;
        }
    }

    async fn run_thumbnail_command(
        &self,
        input_path: &Path,
        output_path: &Path,
    ) -> anyhow::Result<()> {
        let output = Command::new(&self.config.ffmpeg_binary)
            .arg("-hide_banner")
            .arg("-loglevel")
            .arg("error")
            .arg("-y")
            .arg("-i")
            .arg(input_path)
            .arg("-frames:v")
            .arg("1")
            .arg("-vf")
            .arg("scale=640:-1:force_original_aspect_ratio=decrease")
            .arg("-q:v")
            .arg("4")
            .arg(output_path)
            .output()
            .await?;

        if output.status.success() {
            return Ok(());
        }

        Err(anyhow::anyhow!(String::from_utf8_lossy(&output.stderr)
            .trim()
            .to_string()))
    }

    async fn generate_thumbnail_bytes(
        &self,
        mime_type: &str,
        data: &Bytes,
    ) -> anyhow::Result<Bytes> {
        let operation_id = Uuid::new_v4().to_string();
        let temp_dir = std::env::temp_dir();
        let input_path = temp_dir.join(format!(
            "mosaic-video-{}.{}",
            operation_id,
            Self::video_extension(mime_type)
        ));
        let output_path = temp_dir.join(format!("mosaic-video-{}.jpg", operation_id));

        tokio::fs::write(&input_path, data).await?;

        match self.run_thumbnail_command(&input_path, &output_path).await {
            Ok(()) => {
                let generated = tokio::fs::read(&output_path).await?;
                Self::cleanup_temp_files(&[input_path.clone(), output_path.clone()]).await;
                Ok(Bytes::from(generated))
            }
            Err(error) => {
                Self::cleanup_temp_files(&[input_path, output_path]).await;
                Err(error)
            }
        }
    }

    async fn try_generate_thumbnail(
        &self,
        user_id: &str,
        resource_id: Uuid,
        mime_type: &str,
        data: &Bytes,
    ) -> Option<String> {
        if !mime_type.starts_with("video/") {
            return None;
        }

        let thumbnail_bytes = match self.generate_thumbnail_bytes(mime_type, data).await {
            Ok(bytes) => bytes,
            Err(error) => {
                log::warn!(
                    "Failed to generate thumbnail for resource {}: {}",
                    resource_id,
                    error
                );
                return None;
            }
        };

        let thumbnail_path = format!("resources/{}/thumbnails/{}.jpg", user_id, resource_id);
        if let Err(error) = self
            .storage
            .upload(&thumbnail_path, thumbnail_bytes, "image/jpeg")
            .await
        {
            log::warn!(
                "Failed to store thumbnail for resource {}: {}",
                resource_id,
                error
            );
            return None;
        }

        Some(thumbnail_path)
    }

    pub async fn upload_resource(
        &self,
        user_id: &str,
        req: CreateResourceRequest,
        data: Bytes,
    ) -> Result<ResourceResponse, AppError> {
        let memo_id = req.memo_id;
        let user_uuid = Uuid::parse_str(user_id)?;

        if let Some(id) = memo_id {
            let memo_exists = sqlx::query("SELECT id FROM memos WHERE id = $1 AND user_id = $2")
                .bind(id)
                .bind(user_uuid)
                .fetch_optional(&self.pool)
                .await?;

            if memo_exists.is_none() {
                return Err(AppError::MemoNotFound);
            }
        }

        let mut metadata = req.metadata.unwrap_or_else(empty_metadata);
        let resource_id = Uuid::new_v4();
        let storage_path = format!("resources/{}/{}", user_id, resource_id);

        self.storage
            .upload(&storage_path, data.clone(), &req.mime_type)
            .await
            .map_err(|e| AppError::Storage(e.to_string()))?;

        let storage = self.storage.clone();
        let config = self.config.clone();
        let user_id_owned = user_id.to_string();
        let resource_id_owned = resource_id;
        let data_owned = data.clone().to_vec();
        let mime_type_owned = req.mime_type.clone();

        tokio::spawn(async move {
            let _ = Self::process_transcoding(
                storage,
                config,
                user_id_owned,
                resource_id_owned,
                mime_type_owned,
                data_owned,
            )
            .await;
        });

        if let Some(thumbnail_path) = self
            .try_generate_thumbnail(user_id, resource_id, &req.mime_type, &data)
            .await
        {
            metadata = with_thumbnail_metadata(metadata, thumbnail_path, "image/jpeg".to_string());
        }

        let now = Utc::now().timestamp_millis();

        let resource = sqlx::query_as::<_, Resource>(
              "INSERT INTO resources (id, memo_id, filename, resource_type, mime_type, file_size, storage_type, storage_path, metadata, created_at)
               VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
             RETURNING *",
        )
        .bind(resource_id)
        .bind(memo_id)
        .bind(&req.filename)
        .bind(if req.mime_type.starts_with("video/") { "video" } else { "image" })
        .bind(&req.mime_type)
        .bind(req.file_size)
        .bind(match self.config.storage_type {
            crate::config::StorageType::Local => "local",
            crate::config::StorageType::R2 => "r2",
        })
        .bind(&storage_path)
        .bind(&metadata)
        .bind(now)
        .fetch_one(&self.pool)
        .await?;

        self.build_resource_response(resource).await
    }

    pub async fn download_resource_thumbnail(
        &self,
        resource_id: Uuid,
    ) -> Result<(Bytes, String), AppError> {
        let mut resource = sqlx::query_as::<_, Resource>(
            "SELECT r.id, r.memo_id, r.filename, r.resource_type, r.mime_type, r.file_size, r.storage_type, r.storage_path, r.metadata, r.created_at
             FROM resources r
             WHERE r.id = $1",
        )
        .bind(resource_id)
        .fetch_optional(&self.pool)
        .await?
        .ok_or(AppError::ResourceNotFound)?;

        let (thumbnail_path, mime_type) = self
            .ensure_thumbnail_metadata(&mut resource)
            .await?
            .ok_or(AppError::ResourceNotFound)?;

        let data = self
            .storage
            .download(&thumbnail_path)
            .await
            .map_err(|e| AppError::Storage(e.to_string()))?;

        Ok((data, mime_type))
    }

    pub async fn download_resource_variant(
        &self,
        resource_id: Uuid,
        variant: &str,
    ) -> Result<Option<(Bytes, String)>, AppError> {
        let resource = sqlx::query_as::<_, Resource>(
            "SELECT r.id, r.memo_id, r.filename, r.resource_type, r.mime_type, r.file_size, r.storage_type, r.storage_path, r.metadata, r.created_at
             FROM resources r
             WHERE r.id = $1",
        )
        .bind(resource_id)
        .fetch_optional(&self.pool)
        .await?
        .ok_or(AppError::ResourceNotFound)?;

        let user_id = Self::extract_user_id_from_storage_path(&resource.storage_path)
            .ok_or(AppError::ResourceNotFound)?;

        match variant {
            "thumb" => {
                // Check for image thumbnail first
                let image_thumb_path = format!("resources/{}/{}_thumb.jpg", user_id, resource_id);
                if self.storage.exists(&image_thumb_path).await {
                    let data = self
                        .storage
                        .download(&image_thumb_path)
                        .await
                        .map_err(|e| AppError::Storage(e.to_string()))?;
                    return Ok(Some((data, "image/jpeg".to_string())));
                }

                // Fall back to video thumbnail via ensure_thumbnail_metadata
                if let Some((thumb_path, mime_type)) = self
                    .ensure_thumbnail_metadata(&mut resource.clone())
                    .await?
                {
                    if self.storage.exists(&thumb_path).await {
                        let data = self
                            .storage
                            .download(&thumb_path)
                            .await
                            .map_err(|e| AppError::Storage(e.to_string()))?;
                        return Ok(Some((data, mime_type)));
                    }
                }

                // Fall back to original
                let data = self
                    .storage
                    .download(&resource.storage_path)
                    .await
                    .map_err(|e| AppError::Storage(e.to_string()))?;
                Ok(Some((data, resource.mime_type)))
            }
            "opt" => {
                let is_image = resource.mime_type.starts_with("image/");
                let opt_path = if is_image {
                    format!("resources/{}/{}_opt.webp", user_id, resource_id)
                } else {
                    format!("resources/{}/{}_opt.mp4", user_id, resource_id)
                };

                if self.storage.exists(&opt_path).await {
                    let mime_type = if is_image { "image/webp" } else { "video/mp4" };
                    let data = self
                        .storage
                        .download(&opt_path)
                        .await
                        .map_err(|e| AppError::Storage(e.to_string()))?;
                    return Ok(Some((data, mime_type.to_string())));
                }

                // Fall back to original
                let data = self
                    .storage
                    .download(&resource.storage_path)
                    .await
                    .map_err(|e| AppError::Storage(e.to_string()))?;
                Ok(Some((data, resource.mime_type)))
            }
            _ => {
                let data = self
                    .storage
                    .download(&resource.storage_path)
                    .await
                    .map_err(|e| AppError::Storage(e.to_string()))?;
                Ok(Some((data, resource.mime_type)))
            }
        }
    }

    pub async fn delete_resource(&self, user_id: &str, resource_id: Uuid) -> Result<(), AppError> {
        let _user_uuid = Uuid::parse_str(user_id)?;
        let resource = sqlx::query_as::<_, Resource>(
              "SELECT r.id, r.memo_id, r.filename, r.resource_type, r.mime_type, r.file_size, r.storage_type, r.storage_path, r.metadata, r.created_at
             FROM resources r
             WHERE r.id = $1",
        )
        .bind(resource_id)
        .fetch_optional(&self.pool)
        .await?
        .ok_or(AppError::ResourceNotFound)?;

        self.storage
            .delete(&resource.storage_path)
            .await
            .map_err(|e| AppError::Storage(e.to_string()))?;

        if let Some(thumbnail_path) = thumbnail_storage_path(&resource.metadata) {
            if let Err(error) = self.storage.delete(thumbnail_path).await {
                log::warn!(
                    "Failed to delete thumbnail for resource {}: {}",
                    resource_id,
                    error
                );
            }
        }

        sqlx::query("DELETE FROM resources WHERE id = $1")
            .bind(resource_id)
            .execute(&self.pool)
            .await?;

        Ok(())
    }

    pub async fn upload_avatar(
        &self,
        user_id: &str,
        _filename: String,
        data: Bytes,
        mime_type: String,
    ) -> Result<String, AppError> {
        let user_uuid = Uuid::parse_str(user_id)?;

        let avatar_id = Uuid::new_v4();
        let storage_path = format!("avatars/{}/{}", user_id, avatar_id);

        self.storage
            .upload(&storage_path, data, &mime_type)
            .await
            .map_err(|e| AppError::Storage(e.to_string()))?;

        let url = match self.config.storage_type {
            crate::config::StorageType::R2 => self
                .storage
                .get_presigned_url(&storage_path, 86400 * 365)
                .await
                .map_err(|e| AppError::Storage(e.to_string()))?,
            crate::config::StorageType::Local => {
                format!("/api/avatars/{}/download", avatar_id)
            }
        };

        let now = Utc::now().timestamp_millis();
        sqlx::query("UPDATE users SET avatar_url = $1, updated_at = $2 WHERE id = $3")
            .bind(&url)
            .bind(now)
            .bind(user_uuid)
            .execute(&self.pool)
            .await?;

        Ok(url)
    }

    pub async fn download_avatar(&self, avatar_id: Uuid) -> Result<Bytes, AppError> {
        match self.config.storage_type {
            crate::config::StorageType::Local => {
                let base_path = &self.config.local_storage_path;
                let base = std::path::Path::new(base_path).join("avatars");

                if let Ok(entries) = tokio::fs::read_dir(&base).await {
                    let mut entries = entries;
                    while let Ok(Some(user_entry)) = entries.next_entry().await {
                        if user_entry.path().is_dir() {
                            if let Ok(avatar_entries) = tokio::fs::read_dir(user_entry.path()).await
                            {
                                let mut avatar_entries = avatar_entries;
                                while let Ok(Some(avatar_entry)) = avatar_entries.next_entry().await
                                {
                                    if let Some(filename) = avatar_entry.file_name().to_str() {
                                        if filename == avatar_id.to_string() {
                                            let data = tokio::fs::read(avatar_entry.path())
                                                .await
                                                .map_err(|e| {
                                                AppError::Storage(e.to_string())
                                            })?;
                                            return Ok(Bytes::from(data));
                                        }
                                    }
                                }
                            }
                        }
                    }
                }

                Err(AppError::ResourceNotFound)
            }
            crate::config::StorageType::R2 => Err(AppError::ResourceNotFound),
        }
    }

    pub async fn create_presigned_upload(
        &self,
        user_id: &str,
        req: CreateResourceRequest,
    ) -> Result<PresignedUploadResponse, AppError> {
        if self.config.storage_type != crate::config::StorageType::R2 {
            return Err(AppError::InvalidInput(
                "Direct upload only supported for R2 storage".to_string(),
            ));
        }

        let memo_id = req.memo_id;
        let user_uuid = Uuid::parse_str(user_id)?;

        let memo_exists = sqlx::query("SELECT id FROM memos WHERE id = $1 AND user_id = $2")
            .bind(memo_id)
            .bind(user_uuid)
            .fetch_optional(&self.pool)
            .await?;

        if memo_exists.is_none() {
            return Err(AppError::MemoNotFound);
        }

        let resource_id = Uuid::new_v4();
        let storage_path = format!("resources/{}/{}", user_id, resource_id);

        let upload_url = self
            .storage
            .get_presigned_upload_url(&storage_path, 3600)
            .await
            .map_err(|e| AppError::Storage(e.to_string()))?;

        let now = Utc::now().timestamp_millis();

        sqlx::query(
              "INSERT INTO resources (id, memo_id, filename, resource_type, mime_type, file_size, storage_type, storage_path, metadata, created_at)
               VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)",
        )
        .bind(resource_id)
        .bind(memo_id)
        .bind(&req.filename)
        .bind(if req.mime_type.starts_with("video/") { "video" } else { "image" })
        .bind(&req.mime_type)
        .bind(req.file_size)
        .bind("r2")
        .bind(&storage_path)
        .bind(req.metadata.unwrap_or_else(empty_metadata))
        .bind(now)
        .execute(&self.pool)
        .await?;

        Ok(PresignedUploadResponse {
            upload_url,
            resource_id,
            storage_path,
        })
    }

    pub async fn list_resources(
        &self,
        user_id: &str,
        page: i64,
        page_size: i64,
    ) -> Result<(Vec<ResourceResponse>, i64), AppError> {
        let user_uuid = Uuid::parse_str(user_id)?;
        let offset = (page - 1) * page_size;

        let resources = sqlx::query_as::<_, Resource>(
            "SELECT r.id, r.memo_id, r.filename, r.resource_type, r.mime_type, r.file_size, r.storage_type, r.storage_path, r.metadata, r.created_at
             FROM resources r
             JOIN memos m ON r.memo_id = m.id
             WHERE m.user_id = $1
             ORDER BY r.created_at DESC
             LIMIT $2 OFFSET $3",
        )
        .bind(user_uuid)
        .bind(page_size)
        .bind(offset)
        .fetch_all(&self.pool)
        .await?;

        let total = sqlx::query_scalar::<_, i64>(
            "SELECT COUNT(*)
             FROM resources r
             JOIN memos m ON r.memo_id = m.id
             WHERE m.user_id = $1",
        )
        .bind(user_uuid)
        .fetch_one(&self.pool)
        .await?;

        let mut responses = Vec::new();
        for resource in resources {
            responses.push(self.build_resource_response(resource).await?);
        }

        Ok((responses, total))
    }

    pub async fn confirm_upload(
        &self,
        user_id: &str,
        req: ConfirmUploadRequest,
    ) -> Result<ResourceResponse, AppError> {
        let user_uuid = Uuid::parse_str(user_id)?;
        let resource = sqlx::query_as::<_, Resource>(
            "SELECT r.id, r.memo_id, r.filename, r.resource_type, r.mime_type, r.file_size, r.storage_type, r.storage_path, r.metadata, r.created_at
             FROM resources r
             JOIN memos m ON r.memo_id = m.id
             WHERE r.id = $1 AND m.user_id = $2",
        )
        .bind(req.resource_id)
        .bind(user_uuid)
        .fetch_optional(&self.pool)
        .await?
        .ok_or(AppError::ResourceNotFound)?;

        let _ = user_id;

        self.build_resource_response(resource).await
    }

    async fn process_transcoding(
        storage: Arc<dyn Storage>,
        config: Config,
        user_id: String,
        resource_id: Uuid,
        mime_type: String,
        data: Vec<u8>,
    ) -> Result<(), AppError> {
        let base_path = format!("resources/{}", user_id);

        if mime_type.starts_with("image/") {
            if let Ok(thumb) = ImageProcessor::create_thumbnail(&data).await {
                let _ = storage
                    .upload(
                        &format!("{}/{}_thumb.jpg", base_path, resource_id),
                        Bytes::from(thumb),
                        "image/jpeg",
                    )
                    .await;
            }
            if let Ok(optimized) = ImageProcessor::create_optimized(&data).await {
                let _ = storage
                    .upload(
                        &format!("{}/{}_opt.webp", base_path, resource_id),
                        Bytes::from(optimized),
                        "image/webp",
                    )
                    .await;
            }
        } else if mime_type.starts_with("video/") {
            let processor = VideoProcessor::new(&config);

            if let Ok(thumb) = processor.create_thumbnail(&data).await {
                let _ = storage
                    .upload(
                        &format!("{}/{}_thumb.jpg", base_path, resource_id),
                        Bytes::from(thumb),
                        "image/jpeg",
                    )
                    .await;
            }
            if let Ok(optimized) = processor.create_optimized(&data).await {
                let _ = storage
                    .upload(
                        &format!("{}/{}_opt.mp4", base_path, resource_id),
                        Bytes::from(optimized),
                        "video/mp4",
                    )
                    .await;
            }
        }

        Ok(())
    }
}
