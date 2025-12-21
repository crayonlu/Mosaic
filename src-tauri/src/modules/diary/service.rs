use super::models::{
    CreateOrUpdateDiaryRequest, Diary, DiaryWithMemos, ListDiariesRequest, UpdateDiaryMoodRequest,
    UpdateDiarySummaryRequest,
};
use crate::database::schema::MoodKey;
use crate::database::DBPool;
use crate::error::{AppError, AppResult};
use crate::modules::memo::service;
use chrono::Utc;

pub async fn get_diary_by_date(pool: &DBPool, date: &str) -> AppResult<DiaryWithMemos> {
    let diary = sqlx::query_as::<_, Diary>(
        r#"
        SELECT date, summary, mood_key, mood_score, tags, cover_image_id, memo_count, created_at, updated_at
        FROM diaries
        WHERE date = ?
        "#,
    )
    .bind(date)
    .fetch_optional(pool)
    .await?
    .ok_or_else(|| AppError::NotFound(format!("Diary not found: {}", date)))?;

    let memos = service::get_memos_by_date(pool, date).await?;

    Ok(DiaryWithMemos { diary, memos })
}

pub async fn create_or_update_diary(
    pool: &DBPool,
    req: CreateOrUpdateDiaryRequest,
) -> AppResult<()> {
    let now = Utc::now().timestamp_millis();
    let mut tx = pool.begin().await?;

    let exists = sqlx::query_scalar::<_, i64>("SELECT COUNT(*) FROM diaries WHERE date = ?")
        .bind(&req.date)
        .fetch_one(&mut *tx)
        .await?;

    let memo_count = sqlx::query_scalar::<_, i64>(
        "SELECT COUNT(*) FROM memos WHERE diary_date = ? AND is_deleted = 0",
    )
    .bind(&req.date)
    .fetch_one(&mut *tx)
    .await?;

    if exists > 0 {
        let mut update_parts = Vec::new();

        if req.summary.is_some() {
            update_parts.push("summary = ?");
        }
        if req.mood_key.is_some() {
            update_parts.push("mood_key = ?");
        }
        if req.mood_score.is_some() {
            update_parts.push("mood_score = ?");
        }
        if req.tags.is_some() {
            update_parts.push("tags = ?");
        }
        if req.cover_image_id.is_some() {
            update_parts.push("cover_image_id = ?");
        }
        update_parts.push("memo_count = ?");
        update_parts.push("updated_at = ?");

        let update_sql = format!(
            "UPDATE diaries SET {} WHERE date = ?",
            update_parts.join(", ")
        );

        let mut query = sqlx::query(&update_sql);

        if let Some(ref summary) = req.summary {
            query = query.bind(summary);
        }
        if let Some(ref mood_key) = req.mood_key {
            query = query.bind(mood_key);
        }
        if let Some(ref mood_score) = req.mood_score {
            query = query.bind(mood_score);
        }
        if let Some(ref tags) = req.tags {
            query = query.bind(tags);
        }
        if let Some(ref cover_image_id) = req.cover_image_id {
            query = query.bind(cover_image_id);
        }
        query = query.bind(memo_count).bind(now).bind(&req.date);

        query.execute(&mut *tx).await?;
    } else {
        let summary = req.summary.unwrap_or_default();
        let mood_key = req.mood_key.unwrap_or_default();
        let mood_score = req.mood_score.unwrap_or(50);
        let tags = req.tags.unwrap_or_else(|| "[]".to_string());
        sqlx::query(
            r#"
            INSERT INTO diaries (date, summary, mood_key, mood_score, tags, cover_image_id, memo_count, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            "#,
        )
        .bind(&req.date)
        .bind(summary)
        .bind(mood_key)
        .bind(mood_score)
        .bind(tags)
        .bind(&req.cover_image_id)
        .bind(memo_count)
        .bind(now)
        .bind(now)
        .execute(&mut *tx)
        .await?;
    }

    tx.commit().await?;
    Ok(())
}

pub async fn list_diaries(
    pool: &DBPool,
    req: ListDiariesRequest,
) -> AppResult<crate::modules::memo::models::PaginatedResponse<Diary>> {
    let page = req.page.unwrap_or(1);
    let page_size = req.page_size.unwrap_or(10);
    let offset = (page - 1) * page_size;

    let mut where_conditions = vec![];

    if let Some(ref start_date) = req.start_date {
        where_conditions.push("date >= ?");
    }
    if let Some(ref end_date) = req.end_date {
        where_conditions.push("date <= ?");
    }

    let where_clause = if where_conditions.is_empty() {
        String::new()
    } else {
        format!("WHERE {}", where_conditions.join(" AND "))
    };

    let count_query = format!("SELECT COUNT(*) FROM diaries {}", where_clause);
    let mut count_query_builder = sqlx::query_scalar::<_, i64>(&count_query);

    if let Some(ref start_date) = req.start_date {
        count_query_builder = count_query_builder.bind(start_date);
    }
    if let Some(ref end_date) = req.end_date {
        count_query_builder = count_query_builder.bind(end_date);
    }

    let total = count_query_builder.fetch_one(pool).await?;
    let diaries_query = format!(
        r#"
        SELECT date, summary, mood_key, mood_score, tags, cover_image_id, memo_count, created_at, updated_at
        FROM diaries
        {}
        ORDER BY date DESC
        LIMIT ? OFFSET ?
        "#,
        where_clause
    );
    let mut diaries_query_builder = sqlx::query_as::<_, Diary>(&diaries_query);

    if let Some(ref start_date) = req.start_date {
        diaries_query_builder = diaries_query_builder.bind(start_date);
    }
    if let Some(ref end_date) = req.end_date {
        diaries_query_builder = diaries_query_builder.bind(end_date);
    }

    let diaries = diaries_query_builder
        .bind(page_size as i64)
        .bind(offset as i64)
        .fetch_all(pool)
        .await?;
    let total_pages = (total as f64 / page_size as f64).ceil() as u32;

    Ok(crate::modules::memo::models::PaginatedResponse {
        items: diaries,
        total,
        page,
        page_size,
        total_pages,
    })
}

pub async fn update_diary_summary(pool: &DBPool, req: UpdateDiarySummaryRequest) -> AppResult<()> {
    let now = Utc::now().timestamp_millis();
    let rows_affected =
        sqlx::query("UPDATE diaries SET summary = ?, updated_at = ? WHERE date = ?")
            .bind(&req.summary)
            .bind(now)
            .bind(&req.date)
            .execute(pool)
            .await?
            .rows_affected();

    if rows_affected == 0 {
        return Err(AppError::NotFound(format!("Diary not found: {}", req.date)));
    }

    Ok(())
}

pub async fn update_diary_mood(pool: &DBPool, req: UpdateDiaryMoodRequest) -> AppResult<()> {
    let now = Utc::now().timestamp_millis();
    let rows_affected = sqlx::query(
        "UPDATE diaries SET mood_key = ?, mood_score = ?, updated_at = ? WHERE date = ?",
    )
    .bind(&req.mood_key)
    .bind(req.mood_score)
    .bind(now)
    .bind(&req.date)
    .execute(pool)
    .await?
    .rows_affected();

    if rows_affected == 0 {
        return Err(AppError::NotFound(format!("Diary not found: {}", req.date)));
    }

    Ok(())
}

pub async fn increment_memo_count(pool: &DBPool, date: &str) -> AppResult<()> {
    let now = Utc::now().timestamp_millis();
    sqlx::query(
        r#"
        UPDATE diaries 
        SET memo_count = memo_count + 1, updated_at = ? 
        WHERE date = ?
        "#,
    )
    .bind(now)
    .bind(date)
    .execute(pool)
    .await?;

    Ok(())
}

pub async fn decrement_memo_count(pool: &DBPool, date: &str) -> AppResult<()> {
    let now = Utc::now().timestamp_millis();
    sqlx::query(
        r#"
        UPDATE diaries 
        SET memo_count = CASE WHEN memo_count > 0 THEN memo_count - 1 ELSE 0 END, 
            updated_at = ? 
        WHERE date = ?
        "#,
    )
    .bind(now)
    .bind(date)
    .execute(pool)
    .await?;

    Ok(())
}

// recalculate the memo count of the diary
// for fix data inconsistency
pub async fn recalculate_memo_count(pool: &DBPool, date: &str) -> AppResult<()> {
    let mut tx = pool.begin().await?;
    let now = Utc::now().timestamp_millis();

    let memo_count = sqlx::query_scalar::<_, i64>(
        "SELECT COUNT(*) FROM memos WHERE diary_date = ? AND is_deleted = 0",
    )
    .bind(date)
    .fetch_one(&mut *tx)
    .await?;

    sqlx::query("UPDATE diaries SET memo_count = ?, updated_at = ? WHERE date = ?")
        .bind(memo_count)
        .bind(now)
        .bind(date)
        .execute(&mut *tx)
        .await?;

    tx.commit().await?;
    Ok(())
}
