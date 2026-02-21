use crate::error::AppError;
use crate::models::{
    CreateMemoRequest, Memo, MemoResourceResponse as ResourceResponse, MemoWithResources,
    PaginatedResponse, Resource, UpdateMemoRequest,
};
use chrono::Utc;
use serde_json::json;
use sqlx::PgPool;
use uuid::Uuid;

#[derive(Clone)]
pub struct MemoService {
    pool: PgPool,
}

impl MemoService {
    pub fn new(pool: PgPool) -> Self {
        Self { pool }
    }

    pub async fn create_memo(
        &self,
        user_id: &str,
        req: CreateMemoRequest,
    ) -> Result<MemoWithResources, AppError> {
        let content_preview = if req.content.len() <= 50 {
            req.content.clone()
        } else {
            let mut end_idx = 50;
            while end_idx > 0 && !req.content.is_char_boundary(end_idx) {
                end_idx -= 1;
            }
            format!("{}...", &req.content[..end_idx])
        };
        
        log::info!(
            "[MemoService] Creating memo for user: {}, content: {}, tags: {:?}, resource_ids: {:?}",
            user_id,
            content_preview,
            req.tags,
            req.resource_ids
        );

        let user_uuid = Uuid::parse_str(user_id).map_err(|e| {
            log::error!("[MemoService] Invalid user_id format: {}", e);
            AppError::InvalidInput(format!("Invalid user_id format: {}", e))
        })?;
        log::debug!("[MemoService] User UUID: {}", user_uuid);

        let tags_json = json!(req.tags);
        let now = Utc::now().timestamp_millis();

        let memo = sqlx::query_as::<_, Memo>(
            "INSERT INTO memos (id, user_id, content, tags, is_archived, is_deleted, diary_date, created_at, updated_at)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
             RETURNING id, user_id, content, tags, is_archived, is_deleted, diary_date, created_at, updated_at",
        )
        .bind(Uuid::new_v4())
        .bind(user_uuid)
        .bind(&req.content)
        .bind(tags_json)
        .bind(false)
        .bind(false)
        .bind(req.diary_date)
        .bind(now)
        .bind(now)
        .fetch_one(&self.pool)
        .await
        .map_err(|e| {
            log::error!("[MemoService] Failed to insert memo: {}", e);
            AppError::Database(e)
        })?;
        log::info!("[MemoService] Memo created with ID: {}", memo.id);

        // Update resources with the new memo_id if resource_ids are provided
        if !req.resource_ids.is_empty() {
            log::info!(
                "[MemoService] Associating {} resources with memo {}",
                req.resource_ids.len(),
                memo.id
            );
            for resource_id_str in &req.resource_ids {
                let resource_uuid = match Uuid::parse_str(resource_id_str) {
                    Ok(uuid) => uuid,
                    Err(e) => {
                        log::warn!(
                            "[MemoService] Invalid resource_id format: {} - {}",
                            resource_id_str,
                            e
                        );
                        continue;
                    }
                };
                log::debug!(
                    "[MemoService] Updating resource {} with memo_id {}",
                    resource_uuid,
                    memo.id
                );
                if let Err(e) = sqlx::query(
                    "UPDATE resources SET memo_id = $1 WHERE id = $2 AND memo_id IS NULL",
                )
                .bind(memo.id)
                .bind(resource_uuid)
                .execute(&self.pool)
                .await
                {
                    log::warn!(
                        "[MemoService] Failed to update resource {} with memo_id {}: {}",
                        resource_uuid,
                        memo.id,
                        e
                    );
                } else {
                    log::info!(
                        "[MemoService] Successfully associated resource {} with memo {}",
                        resource_uuid,
                        memo.id
                    );
                }
            }
        } else {
            log::debug!("[MemoService] No resource_ids to associate");
        }

        let resources = self.get_memo_resources(memo.id).await?;
        log::info!(
            "[MemoService] Memo {} has {} resources",
            memo.id,
            resources.len()
        );

        Ok(MemoWithResources::from_memo(memo, resources))
    }

    async fn get_memo_resources(&self, memo_id: Uuid) -> Result<Vec<ResourceResponse>, AppError> {
        log::debug!("[MemoService] Getting resources for memo {}", memo_id);
        let resources = sqlx::query_as::<_, Resource>(
            "SELECT id, memo_id, filename, resource_type, mime_type, file_size, storage_type, storage_path, created_at
             FROM resources WHERE memo_id = $1 ORDER BY created_at ASC",
        )
        .bind(memo_id)
        .fetch_all(&self.pool)
        .await
        .map_err(|e| {
            log::error!("[MemoService] Failed to get resources for memo {}: {}", memo_id, e);
            e
        })?;

        log::debug!(
            "[MemoService] Found {} resources for memo {}",
            resources.len(),
            memo_id
        );
        Ok(resources
            .into_iter()
            .map(|r| {
                let url = format!("/api/resources/{}/download", r.id);
                ResourceResponse {
                    id: r.id,
                    memo_id: r.memo_id,
                    filename: r.filename,
                    resource_type: r.resource_type,
                    mime_type: r.mime_type,
                    size: r.file_size,
                    storage_type: Some(r.storage_type),
                    storage_path: Some(r.storage_path),
                    url,
                    created_at: r.created_at,
                }
            })
            .collect())
    }

    pub async fn get_memo(
        &self,
        user_id: &str,
        memo_id: Uuid,
    ) -> Result<MemoWithResources, AppError> {
        log::info!("[MemoService] Getting memo {} for user {}", memo_id, user_id);
        let user_uuid = Uuid::parse_str(user_id).map_err(|e| {
            log::error!("[MemoService] Invalid user_id format: {}", e);
            e
        })?;
        let memo = sqlx::query_as::<_, Memo>(
            "SELECT id, user_id, content, tags, is_archived, is_deleted, diary_date, created_at, updated_at
             FROM memos WHERE id = $1 AND user_id = $2 AND is_deleted = false",
        )
        .bind(memo_id)
        .bind(user_uuid)
        .fetch_optional(&self.pool)
        .await
        .map_err(|e| {
            log::error!("[MemoService] Failed to get memo: {}", e);
            e
        })?
        .ok_or(AppError::MemoNotFound)?;
        log::info!("[MemoService] Memo {} found", memo.id);

        let resources = self.get_memo_resources(memo.id).await?;
        log::debug!(
            "[MemoService] Memo {} has {} resources",
            memo.id,
            resources.len()
        );
        Ok(MemoWithResources::from_memo(memo, resources))
    }

    pub async fn list_memos(
        &self,
        user_id: &str,
        page: u32,
        page_size: u32,
        archived: Option<bool>,
        diary_date: Option<chrono::NaiveDate>,
        search: Option<String>,
    ) -> Result<PaginatedResponse<MemoWithResources>, AppError> {
        let user_uuid = Uuid::parse_str(user_id)?;
        let offset = (page - 1) * page_size;

        let search_pattern = search.map(|s| format!("%{}%", s));

        let memos = if let Some(ref search_pattern) = search_pattern {
            // Search mode: search in content and tags
            sqlx::query_as::<_, Memo>(
                "SELECT id, user_id, content, tags, is_archived, is_deleted, diary_date, created_at, updated_at
                 FROM memos 
                 WHERE user_id = $1 
                   AND is_deleted = false 
                   AND (content ILIKE $2 OR tags::text ILIKE $2)
                 ORDER BY created_at DESC LIMIT $3 OFFSET $4",
            )
            .bind(user_uuid)
            .bind(search_pattern)
            .bind(page_size as i64)
            .bind(offset as i64)
            .fetch_all(&self.pool)
            .await?
        } else if let Some(diary_date) = diary_date {
            sqlx::query_as::<_, Memo>(
                "SELECT id, user_id, content, tags, is_archived, is_deleted, diary_date, created_at, updated_at
                 FROM memos WHERE user_id = $1 AND is_deleted = false AND diary_date = $2 AND is_archived = true
                 ORDER BY created_at DESC LIMIT $3 OFFSET $4",
            )
            .bind(user_uuid)
            .bind(diary_date)
            .bind(page_size as i64)
            .bind(offset as i64)
            .fetch_all(&self.pool)
            .await?
        } else {
            match archived {
                Some(true) => {
                    sqlx::query_as::<_, Memo>(
                        "SELECT id, user_id, content, tags, is_archived, is_deleted, diary_date, created_at, updated_at
                         FROM memos WHERE user_id = $1 AND is_deleted = false AND is_archived = true
                         ORDER BY created_at DESC LIMIT $2 OFFSET $3",
                    )
                    .bind(user_uuid)
                    .bind(page_size as i64)
                    .bind(offset as i64)
                    .fetch_all(&self.pool)
                    .await?
                }
                Some(false) => {
                    sqlx::query_as::<_, Memo>(
                        "SELECT id, user_id, content, tags, is_archived, is_deleted, diary_date, created_at, updated_at
                         FROM memos WHERE user_id = $1 AND is_deleted = false AND is_archived = false
                         ORDER BY created_at DESC LIMIT $2 OFFSET $3",
                    )
                    .bind(user_uuid)
                    .bind(page_size as i64)
                    .bind(offset as i64)
                    .fetch_all(&self.pool)
                    .await?
                }
                None => {
                    sqlx::query_as::<_, Memo>(
                        "SELECT id, user_id, content, tags, is_archived, is_deleted, diary_date, created_at, updated_at
                         FROM memos WHERE user_id = $1 AND is_deleted = false
                         ORDER BY created_at DESC LIMIT $2 OFFSET $3",
                    )
                    .bind(user_uuid)
                    .bind(page_size as i64)
                    .bind(offset as i64)
                    .fetch_all(&self.pool)
                    .await?
                }
            }
        };

        let total = if let Some(ref search_pattern) = search_pattern {
            let row = sqlx::query_as::<_, (i64,)>(
                "SELECT COUNT(*) as total
                 FROM memos 
                 WHERE user_id = $1 
                   AND is_deleted = false 
                   AND (content ILIKE $2 OR tags::text ILIKE $2)",
            )
            .bind(user_uuid)
            .bind(search_pattern)
            .fetch_one(&self.pool)
            .await?;
            row.0
        } else if let Some(diary_date) = diary_date {
            let row = sqlx::query_as::<_, (i64,)>(
                "SELECT COUNT(*) as total
                 FROM memos WHERE user_id = $1 AND is_deleted = false AND diary_date = $2",
            )
            .bind(user_uuid)
            .bind(diary_date)
            .fetch_one(&self.pool)
            .await?;
            row.0
        } else {
            match archived {
                Some(true) => {
                    let row = sqlx::query_as::<_, (i64,)>(
                        "SELECT COUNT(*) as total
                         FROM memos WHERE user_id = $1 AND is_deleted = false AND is_archived = true",
                    )
                    .bind(user_uuid)
                    .fetch_one(&self.pool)
                    .await?;
                    row.0
                }
                Some(false) => {
                    let row = sqlx::query_as::<_, (i64,)>(
                        "SELECT COUNT(*) as total
                         FROM memos WHERE user_id = $1 AND is_deleted = false AND is_archived = false",
                    )
                    .bind(user_uuid)
                    .fetch_one(&self.pool)
                    .await?;
                    row.0
                }
                None => {
                    let row = sqlx::query_as::<_, (i64,)>(
                        "SELECT COUNT(*) as total
                         FROM memos WHERE user_id = $1 AND is_deleted = false",
                    )
                    .bind(user_uuid)
                    .fetch_one(&self.pool)
                    .await?;
                    row.0
                }
            }
        };

        let total_pages = ((total as f64) / (page_size as f64)).ceil() as u32;

        let mut items = Vec::new();
        for memo in memos {
            let resources = self.get_memo_resources(memo.id).await?;
            items.push(MemoWithResources::from_memo(memo, resources));
        }

        Ok(PaginatedResponse {
            items,
            total,
            page,
            page_size,
            total_pages,
        })
    }

    pub async fn get_memos_by_created_date(
        &self,
        user_id: &str,
        date: &str,
        archived: Option<bool>,
    ) -> Result<Vec<MemoWithResources>, AppError> {
        let user_uuid = Uuid::parse_str(user_id)?;

        let mut query = String::from(
            "SELECT id, user_id, content, tags, is_archived, is_deleted, diary_date, created_at, updated_at
             FROM memos
             WHERE user_id = $1
                AND is_deleted = false
                AND DATE(to_timestamp(created_at / 1000)) = $2::date",
        );

        if let Some(is_archived) = archived {
            query.push_str(&format!(" AND is_archived = {}", is_archived));
        }

        query.push_str(" ORDER BY created_at DESC");

        let memos = sqlx::query_as::<_, Memo>(&query)
        .bind(user_uuid)
        .bind(date)
        .fetch_all(&self.pool)
        .await?;

        let mut items = Vec::new();
        for memo in memos {
            let resources = self.get_memo_resources(memo.id).await?;
            items.push(MemoWithResources::from_memo(memo, resources));
        }

        Ok(items)
    }

    pub async fn update_memo(
        &self,
        user_id: &str,
        memo_id: Uuid,
        req: UpdateMemoRequest,
    ) -> Result<MemoWithResources, AppError> {
        let user_uuid = Uuid::parse_str(user_id)?;
        let now = Utc::now().timestamp_millis();

        let mut set_clauses = vec!["updated_at = $1".to_string()];
        let mut param_idx = 2;

        if req.content.is_some() {
            set_clauses.push(format!("content = ${}", param_idx));
            param_idx += 1;
        }

        if req.tags.is_some() {
            set_clauses.push(format!("tags = ${}", param_idx));
            param_idx += 1;
        }

        if req.is_archived.is_some() {
            set_clauses.push(format!("is_archived = ${}", param_idx));
            param_idx += 1;
        }

        if req.diary_date.is_some() {
            set_clauses.push(format!("diary_date = ${}", param_idx));
            param_idx += 1;
        }

        let query = format!(
            "UPDATE memos SET {} WHERE id = ${} AND user_id = ${} RETURNING *",
            set_clauses.join(", "),
            param_idx,
            param_idx + 1
        );

        let mut query_builder = sqlx::query_as::<_, Memo>(&query).bind(now);

        if let Some(content) = &req.content {
            query_builder = query_builder.bind(content);
        }

        if let Some(tags) = &req.tags {
            let tags_json = json!(tags);
            query_builder = query_builder.bind(tags_json);
        }

        if let Some(is_archived) = req.is_archived {
            query_builder = query_builder.bind(is_archived);
        }

        if let Some(diary_date) = &req.diary_date {
            query_builder = query_builder.bind(*diary_date);
        }

        let memo = query_builder
            .bind(memo_id)
            .bind(user_uuid)
            .fetch_optional(&self.pool)
            .await?
            .ok_or(AppError::MemoNotFound)?;

        if let Some(resource_ids) = &req.resource_ids {
            let parsed_resource_ids: Vec<Uuid> = resource_ids
                .iter()
                .filter_map(|resource_id| Uuid::parse_str(resource_id).ok())
                .collect();

            if parsed_resource_ids.is_empty() {
                sqlx::query("UPDATE resources SET memo_id = NULL WHERE memo_id = $1")
                    .bind(memo.id)
                    .execute(&self.pool)
                    .await?;
            } else {
                sqlx::query(
                    "UPDATE resources SET memo_id = NULL WHERE memo_id = $1 AND NOT (id = ANY($2))",
                )
                .bind(memo.id)
                .bind(&parsed_resource_ids)
                .execute(&self.pool)
                .await?;

                for (index, resource_id) in parsed_resource_ids.iter().enumerate() {
                    let ordered_created_at = now + index as i64;
                    sqlx::query(
                        "UPDATE resources
                         SET memo_id = $1, created_at = $2
                         WHERE id = $3 AND (memo_id IS NULL OR memo_id = $1)",
                    )
                    .bind(memo.id)
                    .bind(ordered_created_at)
                    .bind(resource_id)
                    .execute(&self.pool)
                    .await?;
                }
            }
        }

        let resources = self.get_memo_resources(memo.id).await?;
        Ok(MemoWithResources::from_memo(memo, resources))
    }

    pub async fn delete_memo(&self, user_id: &str, memo_id: Uuid) -> Result<(), AppError> {
        let user_uuid = Uuid::parse_str(user_id)?;
        let now = Utc::now().timestamp_millis();

        let result = sqlx::query(
            "UPDATE memos SET is_deleted = true, updated_at = $1 WHERE id = $2 AND user_id = $3",
        )
        .bind(now)
        .bind(memo_id)
        .bind(user_uuid)
        .execute(&self.pool)
        .await?;

        if result.rows_affected() == 0 {
            return Err(AppError::MemoNotFound);
        }

        Ok(())
    }

    pub async fn archive_memo(
        &self,
        user_id: &str,
        memo_id: Uuid,
        diary_date: Option<chrono::NaiveDate>,
    ) -> Result<(), AppError> {
        let user_uuid = Uuid::parse_str(user_id)?;
        let now = Utc::now().timestamp_millis();

        let result = if let Some(date) = diary_date {
            sqlx::query(
                "UPDATE memos SET is_archived = true, diary_date = $1, updated_at = $2 WHERE id = $3 AND user_id = $4 AND is_deleted = false",
            )
            .bind(date)
            .bind(now)
            .bind(memo_id)
            .bind(user_uuid)
            .execute(&self.pool)
            .await?
        } else {
            sqlx::query(
                "UPDATE memos SET is_archived = true, updated_at = $1 WHERE id = $2 AND user_id = $3 AND is_deleted = false",
            )
            .bind(now)
            .bind(memo_id)
            .bind(user_uuid)
            .execute(&self.pool)
            .await?
        };

        if result.rows_affected() == 0 {
            return Err(AppError::MemoNotFound);
        }

        Ok(())
    }

    pub async fn unarchive_memo(&self, user_id: &str, memo_id: Uuid) -> Result<(), AppError> {
        let user_uuid = Uuid::parse_str(user_id)?;
        let now = Utc::now().timestamp_millis();

        let result = sqlx::query(
            "UPDATE memos SET is_archived = false, updated_at = $1 WHERE id = $2 AND user_id = $3 AND is_deleted = false",
        )
        .bind(now)
        .bind(memo_id)
        .bind(user_uuid)
        .execute(&self.pool)
        .await?;

        if result.rows_affected() == 0 {
            return Err(AppError::MemoNotFound);
        }

        Ok(())
    }

    pub async fn search_memos(
        &self,
        user_id: &str,
        query: &str,
        tags: Option<Vec<String>>,
        start_date: Option<String>,
        end_date: Option<String>,
        is_archived: Option<bool>,
        page: u32,
        page_size: u32,
    ) -> Result<PaginatedResponse<MemoWithResources>, AppError> {
        let user_uuid = Uuid::parse_str(user_id)?;
        let search_pattern = format!("%{}%", query);
        let offset = (page - 1) * page_size;

        let mut query_str = String::from(
            "SELECT id, user_id, content, tags, is_archived, is_deleted, diary_date, created_at, updated_at 
             FROM memos WHERE user_id = $1 AND is_deleted = false",
        );

        let mut conditions = Vec::new();
        let mut param_count = 2;

        if !query.is_empty() {
            conditions.push(format!(
                "(content ILIKE ${} OR tags::text ILIKE ${})",
                param_count, param_count
            ));
            param_count += 1;
        }

        if let Some(archived) = is_archived {
            conditions.push(format!("is_archived = ${}", param_count));
            param_count += 1;
        }

        if start_date.is_some() {
            conditions.push(format!(
                "DATE(to_timestamp(created_at / 1000)) >= ${}::date",
                param_count
            ));
            param_count += 1;
        }

        if end_date.is_some() {
            conditions.push(format!(
                "DATE(to_timestamp(created_at / 1000)) <= ${}::date",
                param_count
            ));
            param_count += 1;
        }

        if !conditions.is_empty() {
            query_str.push_str(" AND ");
            query_str.push_str(&conditions.join(" AND "));
        }

        query_str.push_str(" ORDER BY created_at DESC");

        let count_query = format!(
            "SELECT COUNT(*) FROM memos WHERE user_id = $1 AND is_deleted = false{}",
            if conditions.is_empty() {
                String::new()
            } else {
                format!(" AND {}", conditions.join(" AND "))
            }
        );

        let mut count_builder = sqlx::query_scalar::<_, i64>(&count_query).bind(user_uuid);

        if !query.is_empty() {
            count_builder = count_builder.bind(&search_pattern);
        }
        if let Some(archived) = is_archived {
            count_builder = count_builder.bind(archived);
        }
        if let Some(ref date) = start_date {
            count_builder = count_builder.bind(date);
        }
        if let Some(ref date) = end_date {
            count_builder = count_builder.bind(date);
        }

        let total = count_builder.fetch_one(&self.pool).await?;

        query_str.push_str(&format!(
            " LIMIT ${} OFFSET ${}",
            param_count,
            param_count + 1
        ));

        let mut query_builder = sqlx::query_as::<_, Memo>(&query_str).bind(user_uuid);

        if !query.is_empty() {
            query_builder = query_builder.bind(&search_pattern);
        }
        if let Some(archived) = is_archived {
            query_builder = query_builder.bind(archived);
        }
        if let Some(ref date) = start_date {
            query_builder = query_builder.bind(date);
        }
        if let Some(ref date) = end_date {
            query_builder = query_builder.bind(date);
        }

        query_builder = query_builder.bind(page_size as i64).bind(offset as i64);

        let memos = query_builder.fetch_all(&self.pool).await?;

        let mut items = Vec::new();
        for memo in memos {
            let resources = self.get_memo_resources(memo.id).await?;
            items.push(MemoWithResources::from_memo(memo, resources));
        }

        if let Some(ref tag_filters) = tags {
            if !tag_filters.is_empty() {
                items.retain(|item| tag_filters.iter().any(|tag| item.tags.contains(tag)));
            }
        }

        let filtered_total = items.len() as i64;
        let total_pages = ((filtered_total as f64) / (page_size as f64)).ceil() as u32;

        Ok(PaginatedResponse {
            items,
            total: filtered_total,
            page,
            page_size,
            total_pages,
        })
    }
}
