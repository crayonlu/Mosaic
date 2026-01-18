use crate::config::Config;
use crate::error::AppError;
use crate::models::{CreateResourceRequest, Resource, ResourceResponse};
use crate::storage::traits::Storage;
use bytes::Bytes;
use chrono::Utc;
use sqlx::PgPool;
use std::sync::Arc;
use uuid::Uuid;

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

    pub async fn upload_resource(
        &self,
        user_id: &str,
        req: CreateResourceRequest,
        data: Bytes,
    ) -> Result<ResourceResponse, AppError> {
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

        self.storage
            .upload(&storage_path, data, &req.mime_type)
            .await
            .map_err(|e| AppError::Storage(e.to_string()))?;

        let now = Utc::now().timestamp();

        let resource = sqlx::query_as::<_, Resource>(
            "INSERT INTO resources (id, memo_id, filename, resource_type, mime_type, file_size, storage_type, storage_path, created_at)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
             RETURNING *",
        )
        .bind(resource_id)
        .bind(memo_id)
        .bind(&req.filename)
        .bind("image")
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

        let url = self
            .storage
            .get_presigned_url(&storage_path, 86400)
            .await
            .map_err(|e| AppError::Storage(e.to_string()))?;

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

    pub async fn get_resource(
        &self,
        user_id: &str,
        resource_id: Uuid,
    ) -> Result<ResourceResponse, AppError> {
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

        let url = self
            .storage
            .get_presigned_url(&resource.storage_path, 86400)
            .await
            .map_err(|e| AppError::Storage(e.to_string()))?;

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

    pub async fn download_resource(
        &self,
        user_id: &str,
        resource_id: Uuid,
    ) -> Result<Bytes, AppError> {
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

        self.storage
            .download(&resource.storage_path)
            .await
            .map_err(|e| AppError::Storage(e.to_string()))
    }

    pub async fn delete_resource(&self, user_id: &str, resource_id: Uuid) -> Result<(), AppError> {
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
}
