use super::models::CreateMemoRequest;
use crate::database::DBPool;
use crate::error::{AppError, AppResult};
use crate::modules::asset::constants::infer_resource_type_and_mime;
use crate::modules::asset::storage::get_assets_dir;
use chrono::Utc;
use sqlx::Sqlite;
use std::fs;
use std::path::Path;
use tauri::AppHandle;
use uuid::Uuid;

async fn get_file_info(app_handle: &AppHandle, filename: &str) -> AppResult<(i64, String, String)> {
    let assets_dir = get_assets_dir(app_handle)?;
    let file_path = assets_dir.join(filename);

    if !file_path.exists() {
        return Err(AppError::NotFound(format!("File not found: {}", filename)));
    }

    let metadata = fs::metadata(&file_path).map_err(AppError::Io)?;
    let size = metadata.len() as i64;

    let ext = Path::new(filename)
        .extension()
        .and_then(|s| s.to_str())
        .unwrap_or("")
        .to_lowercase();
    let (resource_type, mime_type) = infer_resource_type_and_mime(&ext);

    Ok((size, mime_type, resource_type))
}

pub async fn create_memo(
    pool: &DBPool,
    app_handle: &AppHandle,
    req: CreateMemoRequest,
) -> AppResult<String> {
    let mut tx = pool.begin().await?;

    let memo_id = Uuid::new_v4().to_string();
    let now = Utc::now().timestamp_millis();
    let today = Utc::now().date_naive().to_string();
    sqlx::query(
    r#"
      INSERT INTO memos (id, content, tags, is_archived, is_deleted, diary_date, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    "#
  )
  .bind(&memo_id)
  .bind(req.content)
  .bind(req.tags.unwrap_or_else(|| "[]".to_string()))
  .bind(false)
  .bind(false)
  .bind(today)
  .bind(now)
  .bind(now)
  .execute(&mut *tx)
  .await?;

    for filename in req.resource_filenames {
        let (size, mime_type, resource_type) = get_file_info(app_handle, &filename).await?;
        let res_id = Uuid::new_v4().to_string();
        sqlx::query(
            r#"
        INSERT INTO resources (id, memo_id, filename, resource_type, mime_type, size, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      "#,
        )
        .bind(res_id)
        .bind(&memo_id)
        .bind(filename)
        .bind(resource_type)
        .bind(mime_type)
        .bind(size)
        .bind(now)
        .execute(&mut *tx)
        .await?;
    }

    tx.commit().await?;
    Ok(memo_id)
}

pub async fn get_memo_by_id(
    pool: &DBPool,
    memo_id: &str,
) -> AppResult<super::models::MemoWithResources> {
    // inbox: is_deleted = 0
    let memo = sqlx::query_as::<_, super::models::Memo>(
        r#"
      SELECT id, content, tags, is_archived, diary_date, created_at
      FROM memos
      WHERE id = ? AND is_deleted = 0
      "#,
    )
    .bind(memo_id)
    .fetch_optional(pool)
    .await?
    .ok_or_else(|| AppError::NotFound(format!("Memo not found: {}", memo_id)))?;
    // then search resources
    let resources = sqlx::query_as::<_, super::models::Resource>(
        r#"
      SELECT id, memo_id, filename, resource_type, mime_type, size, created_at
      FROM resources
      WHERE memo_id = ?
      ORDER BY created_at ASC
    "#,
    )
    .bind(memo_id)
    .fetch_all(pool)
    .await?;

    Ok(super::models::MemoWithResources { memo, resources })
}

pub async fn list_memos(
    pool: &DBPool,
    req: super::models::ListMemosRequest,
) -> AppResult<super::models::PaginatedResponse<super::models::MemoWithResources>> {
    let page = req.page.unwrap_or(1);
    let page_size = req.page_size.unwrap_or(10);
    let offset = (page - 1) * page_size;

    let mut where_conditions = vec!["is_deleted = 0"];

    if let Some(is_archived) = req.is_archived {
        where_conditions.push(if is_archived {
            "is_archived = 1"
        } else {
            "is_archived = 0"
        });
    }

    if let Some(is_deleted) = req.is_deleted {
        where_conditions.pop();
        where_conditions.push(if is_deleted {
            "is_deleted = 1"
        } else {
            "is_deleted = 0"
        });
    }
    if req.diary_date.is_some() {
        where_conditions.push("diary_date = ?");
    }

    let where_clause = where_conditions.join(" AND ");

    let count_query = format!("SELECT COUNT(*) FROM memos WHERE {}", where_clause);
    let mut count_query_builder = sqlx::query_scalar::<_, i64>(&count_query);
    if let Some(ref diary_date) = req.diary_date {
        count_query_builder = count_query_builder.bind(diary_date);
    }

    let total = count_query_builder.fetch_one(pool).await?;

    let memos_query = format!(
        r#"SELECT id, content, tags, is_archived, diary_date, created_at 
    FROM memos 
    WHERE {} 
    ORDER BY created_at DESC 
    LIMIT ? OFFSET ?"#,
        where_clause
    );

    let mut memos_query_builder = sqlx::query_as::<_, super::models::Memo>(&memos_query);

    if let Some(ref diary_date) = req.diary_date {
        memos_query_builder = memos_query_builder.bind(diary_date);
    }

    let memos = memos_query_builder
        .bind(page_size as i64)
        .bind(offset as i64)
        .fetch_all(pool)
        .await?;
    let memo_ids: Vec<String> = memos.iter().map(|m| m.id.clone()).collect();
    let resources = if memo_ids.is_empty() {
        vec![]
    } else {
        let placeholders = (0..memo_ids.len())
            .map(|_| "?")
            .collect::<Vec<_>>()
            .join(",");
        let resources_query = format!(
            r#"
        SELECT id, memo_id, filename, resource_type, mime_type, size, created_at
        FROM resources
        WHERE memo_id IN ({})
        ORDER BY memo_id, created_at ASC
      "#,
            placeholders
        );

        let mut resources_query_builder =
            sqlx::query_as::<_, super::models::Resource>(&resources_query);
        for memo_id in memo_ids {
            resources_query_builder = resources_query_builder.bind(memo_id);
        }
        resources_query_builder.fetch_all(pool).await?
    };

    use std::collections::HashMap;
    let mut resource_map = HashMap::<String, Vec<super::models::Resource>>::new();
    for resource in resources {
        resource_map
            .entry(resource.memo_id.clone())
            .or_default()
            .push(resource);
    }

    let items: Vec<super::models::MemoWithResources> = memos
        .into_iter()
        .map(|memo| {
            let resources = resource_map.remove(&memo.id).unwrap_or_default();
            super::models::MemoWithResources { memo, resources }
        })
        .collect();

    let total_pages = (total as f64 / page_size as f64).ceil() as u32;
    Ok(super::models::PaginatedResponse {
        items,
        total,
        page,
        page_size,
        total_pages,
    })
}

pub async fn get_memos_by_date(
    pool: &DBPool,
    date: &str,
) -> AppResult<Vec<super::models::MemoWithResources>> {
    let req = super::models::ListMemosRequest {
        page: Some(1),
        // for getting all memos
        page_size: Some(9999),
        is_archived: None,
        is_deleted: Some(false),
        diary_date: Some(date.to_string()),
    };

    let result = list_memos(pool, req).await?;
    Ok(result.items)
}

pub async fn update_memo(
    pool: &DBPool,
    app_handle: &AppHandle,
    req: super::models::UpdateMemoRequest,
) -> AppResult<()> {
    let mut tx = pool.begin().await?;
    let now = Utc::now().timestamp_millis();

    // check if the memo exists
    let memo_exists =
        sqlx::query_scalar::<_, i64>("SELECT COUNT(*) FROM memos WHERE id = ? AND is_deleted = 0")
            .bind(&req.id)
            .fetch_one(&mut *tx)
            .await?;
    if memo_exists == 0 {
        return Err(AppError::NotFound(format!("Memo not found: {}", req.id)));
    }

    // update it
    if req.content.is_some() || req.tags.is_some() {
        let mut update_fields = Vec::new();
        let mut query_builder = sqlx::QueryBuilder::<Sqlite>::new("UPDATE memos SET ");

        if req.content.is_some() {
            update_fields.push("content = ?");
        }
        if req.tags.is_some() {
            update_fields.push("tags = ?");
        }
        update_fields.push("updated_at = ?");

        query_builder.push(update_fields.join(", "));
        query_builder.push(" WHERE id = ?");

        let mut query = sqlx::query(&query_builder.sql());

        if let Some(ref content) = req.content {
            query = query.bind(content);
        }
        if let Some(ref tags) = req.tags {
            query = query.bind(tags);
        }
        query = query.bind(now).bind(&req.id);

        query.execute(&mut *tx).await?;
    }

    if let Some(ref resource_filenames) = req.resource_filenames {
        sqlx::query("DELETE FROM resources WHERE memo_id = ?")
            .bind(&req.id)
            .execute(&mut *tx)
            .await?;

        for filename in resource_filenames {
            let (size, mime_type, resource_type) = get_file_info(app_handle, &filename).await?;
            let res_id = Uuid::new_v4().to_string();

            sqlx::query(
                r#"
                    INSERT INTO resources (id, memo_id, filename, resource_type, mime_type, size, created_at)
                    VALUES (?, ?, ?, ?, ?, ?, ?)
                "#
            )
            .bind(res_id)
            .bind(&req.id)
            .bind(filename)
            .bind(resource_type)
            .bind(mime_type)
            .bind(size)
            .bind(now)
            .execute(&mut *tx)
            .await?;
        }
    }

    tx.commit().await?;
    Ok(())
}
