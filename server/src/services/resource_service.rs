use crate::config::Config;
use crate::error::AppError;
use crate::models::{
    ConfirmUploadRequest, CreateResourceRequest, PresignedUploadResponse, Resource,
    ResourceResponse,
};
use crate::storage::traits::Storage;
use bytes::Bytes;
use chrono::Utc;
use jsonwebtoken::{decode, encode, DecodingKey, EncodingKey, Header, Validation};
use serde::{Deserialize, Serialize};
use sqlx::PgPool;
use std::sync::Arc;
use uuid::Uuid;

#[derive(Debug, Serialize, Deserialize)]
struct ResourceTokenClaims {
    sub: String,
    resource_id: String,
    exp: usize,
    iat: usize,
}

#[derive(Clone)]
pub struct ResourceService {
    pool: PgPool,
    storage: Arc<dyn Storage>,
    config: Config,
    jwt_secret: String,
}

impl ResourceService {
    pub fn new(
        pool: PgPool,
        storage: Arc<dyn Storage>,
        config: Config,
        jwt_secret: String,
    ) -> Self {
        Self {
            pool,
            storage,
            config,
            jwt_secret,
        }
    }

    fn generate_resource_token(
        &self,
        user_id: &str,
        resource_id: Uuid,
        expires_secs: u64,
    ) -> Result<String, AppError> {
        let now = Utc::now().timestamp() as usize;
        let exp = now + expires_secs as usize;

        let claims = ResourceTokenClaims {
            sub: user_id.to_string(),
            resource_id: resource_id.to_string(),
            exp,
            iat: now,
        };

        let token = encode(
            &Header::default(),
            &claims,
            &EncodingKey::from_secret(self.jwt_secret.as_ref()),
        )
        .map_err(|_| AppError::Internal("Token generation failed".to_string()))?;

        Ok(token)
    }

    pub async fn validate_resource_token(&self, token: &str) -> Result<Uuid, AppError> {
        let token_data: ResourceTokenClaims = decode::<ResourceTokenClaims>(
            token,
            &DecodingKey::from_secret(self.jwt_secret.as_ref()),
            &Validation::default(),
        )
        .map_err(|_| AppError::InvalidToken)?
        .claims;

        Uuid::parse_str(&token_data.resource_id).map_err(|_| AppError::InvalidToken)
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

        let resource_id = Uuid::new_v4();
        let storage_path = format!("resources/{}/{}", user_id, resource_id);

        self.storage
            .upload(&storage_path, data, &req.mime_type)
            .await
            .map_err(|e| AppError::Storage(e.to_string()))?;

        let now = Utc::now().timestamp_millis();

        let resource = sqlx::query_as::<_, Resource>(
            "INSERT INTO resources (id, memo_id, filename, resource_type, mime_type, file_size, storage_type, storage_path, created_at)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
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
        .bind(now)
        .fetch_one(&self.pool)
        .await?;

        let url = match self.config.storage_type {
            crate::config::StorageType::R2 => self
                .storage
                .get_presigned_url(&storage_path, 86400)
                .await
                .map_err(|e| AppError::Storage(e.to_string()))?,
            crate::config::StorageType::Local => {
                let token = self.generate_resource_token(user_id, resource_id, 300)?;
                format!("/api/resources/{}/download?token={}", resource_id, token)
            }
        };

        Ok(ResourceResponse {
            id: resource.id,
            memo_id: resource.memo_id,
            filename: resource.filename,
            resource_type: resource.resource_type,
            mime_type: resource.mime_type,
            file_size: resource.file_size,
            storage_type: resource.storage_type,
            url,
            created_at: resource.created_at,
        })
    }

    async fn get_resource_for_user(
        &self,
        user_uuid: Uuid,
        resource_id: Uuid,
    ) -> Result<Resource, AppError> {
        sqlx::query_as::<_, Resource>(
            "SELECT r.id, r.memo_id, r.filename, r.resource_type, r.mime_type, r.file_size, r.storage_type, r.storage_path, r.created_at
             FROM resources r
             JOIN memos m ON r.memo_id = m.id
             WHERE r.id = $1 AND m.user_id = $2",
        )
        .bind(resource_id)
        .bind(user_uuid)
        .fetch_optional(&self.pool)
        .await?
        .ok_or(AppError::ResourceNotFound)
    }

    pub async fn create_presigned_download_url(
        &self,
        user_id: &str,
        resource_id: Uuid,
        expires_secs: u64,
    ) -> Result<String, AppError> {
        let user_uuid = Uuid::parse_str(user_id)?;

        let resource = sqlx::query_as::<_, Resource>(
            "SELECT r.id, r.memo_id, r.filename, r.resource_type, r.mime_type, r.file_size, r.storage_type, r.storage_path, r.created_at
             FROM resources r
             JOIN memos m ON r.memo_id = m.id
             WHERE r.id = $1 AND m.user_id = $2",
        )
        .bind(resource_id)
        .bind(user_uuid)
        .fetch_optional(&self.pool)
        .await?
        .ok_or(AppError::ResourceNotFound)?;

        let url = match self.config.storage_type {
            crate::config::StorageType::R2 => self
                .storage
                .get_presigned_url(&resource.storage_path, expires_secs)
                .await
                .map_err(|e| AppError::Storage(e.to_string()))?,
            crate::config::StorageType::Local => {
                let token = self.generate_resource_token(user_id, resource_id, expires_secs)?;
                format!("/api/resources/{}/download?token={}", resource_id, token)
            }
        };

        Ok(url)
    }

    pub async fn download_resource_proxy(
        &self,
        resource_id: Uuid,
    ) -> Result<(Bytes, String), AppError> {
        let resource = sqlx::query_as::<_, Resource>(
            "SELECT r.id, r.memo_id, r.filename, r.resource_type, r.mime_type, r.file_size, r.storage_type, r.storage_path, r.created_at
             FROM resources r
             WHERE r.id = $1",
        )
        .bind(resource_id)
        .fetch_optional(&self.pool)
        .await?
        .ok_or(AppError::ResourceNotFound)?;

        let data = self
            .storage
            .download(&resource.storage_path)
            .await
            .map_err(|e| AppError::Storage(e.to_string()))?;

        Ok((data, resource.mime_type))
    }

    pub async fn download_resource(
        &self,
        _user_id: &str,
        resource_id: Uuid,
    ) -> Result<Bytes, AppError> {
        let resource = sqlx::query_as::<_, Resource>(
            "SELECT r.id, r.memo_id, r.filename, r.resource_type, r.mime_type, r.file_size, r.storage_type, r.storage_path, r.created_at
             FROM resources r
             WHERE r.id = $1",
        )
        .bind(resource_id)
        .fetch_optional(&self.pool)
        .await?
        .ok_or(AppError::ResourceNotFound)?;

        self.storage
            .download(&resource.storage_path)
            .await
            .map_err(|e| AppError::Storage(e.to_string()))
    }

    pub async fn delete_resource(&self, user_id: &str, resource_id: Uuid) -> Result<(), AppError> {
        let _user_uuid = Uuid::parse_str(user_id)?;
        let resource = sqlx::query_as::<_, Resource>(
            "SELECT r.id, r.memo_id, r.filename, r.resource_type, r.mime_type, r.file_size, r.storage_type, r.storage_path, r.created_at
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
                let token = self.generate_resource_token(user_id, avatar_id, 86400 * 365)?;
                format!("/api/avatars/{}/download?token={}", avatar_id, token)
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

    pub async fn download_avatar_proxy(
        &self,
        avatar_id: Uuid,
    ) -> Result<(Bytes, String), AppError> {
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
                                            return Ok((
                                                Bytes::from(data),
                                                "image/jpeg".to_string(),
                                            ));
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
            "INSERT INTO resources (id, memo_id, filename, resource_type, mime_type, file_size, storage_type, storage_path, created_at)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)",
        )
        .bind(resource_id)
        .bind(memo_id)
        .bind(&req.filename)
        .bind(if req.mime_type.starts_with("video/") { "video" } else { "image" })
        .bind(&req.mime_type)
        .bind(req.file_size)
        .bind("r2")
        .bind(&storage_path)
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
            "SELECT r.id, r.memo_id, r.filename, r.resource_type, r.mime_type, r.file_size, r.storage_type, r.storage_path, r.created_at
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
            let url = match self.config.storage_type {
                crate::config::StorageType::R2 => self
                    .storage
                    .get_presigned_url(&resource.storage_path, 300)
                    .await
                    .map_err(|e| AppError::Storage(e.to_string()))?,
                crate::config::StorageType::Local => {
                    let token = self.generate_resource_token(user_id, resource.id, 300)?;
                    format!("/api/resources/{}/download?token={}", resource.id, token)
                }
            };

            responses.push(ResourceResponse {
                id: resource.id,
                memo_id: resource.memo_id,
                filename: resource.filename,
                resource_type: resource.resource_type,
                mime_type: resource.mime_type,
                file_size: resource.file_size,
                storage_type: resource.storage_type,
                url,
                created_at: resource.created_at,
            });
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
            "SELECT r.id, r.memo_id, r.filename, r.resource_type, r.mime_type, r.file_size, r.storage_type, r.storage_path, r.created_at
             FROM resources r
             JOIN memos m ON r.memo_id = m.id
             WHERE r.id = $1 AND m.user_id = $2",
        )
        .bind(req.resource_id)
        .bind(user_uuid)
        .fetch_optional(&self.pool)
        .await?
        .ok_or(AppError::ResourceNotFound)?;

        let url = match self.config.storage_type {
            crate::config::StorageType::R2 => self
                .storage
                .get_presigned_url(&resource.storage_path, 300)
                .await
                .map_err(|e| AppError::Storage(e.to_string()))?,
            crate::config::StorageType::Local => {
                let token = self.generate_resource_token(user_id, resource.id, 300)?;
                format!("/api/resources/{}/download?token={}", resource.id, token)
            }
        };

        Ok(ResourceResponse {
            id: resource.id,
            memo_id: resource.memo_id,
            filename: resource.filename,
            resource_type: resource.resource_type,
            mime_type: resource.mime_type,
            file_size: resource.file_size,
            storage_type: resource.storage_type,
            url,
            created_at: resource.created_at,
        })
    }
}
