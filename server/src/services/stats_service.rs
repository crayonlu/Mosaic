use crate::error::AppError;
use crate::models::{
    HeatMapData, MoodData, SummaryData, TagData, TimelineData, TimelineEntry, TrendsData,
};
use chrono::{NaiveDate, TimeZone, Utc};
use sqlx::PgPool;
use uuid::Uuid;

#[derive(Clone)]
pub struct StatsService {
    pool: PgPool,
}

impl StatsService {
    pub fn new(pool: PgPool) -> Self {
        Self { pool }
    }

    /// Get heatmap data for a date range
    pub async fn get_heatmap(
        &self,
        user_id: &Uuid,
        start_date: NaiveDate,
        end_date: NaiveDate,
    ) -> Result<HeatMapData, AppError> {
        let rows = sqlx::query_as::<_, (chrono::NaiveDate, Option<i64>)>(
            r#"
            SELECT
                to_timestamp(created_at)::date as date,
                COUNT(*) as count
            FROM memos
            WHERE user_id = $1
                AND is_deleted = false
                AND to_timestamp(created_at)::date BETWEEN $2 AND $3
            GROUP BY date
            ORDER BY date
            "#,
        )
        .bind(user_id)
        .bind(start_date)
        .bind(end_date)
        .fetch_all(&self.pool)
        .await?;

        let mut dates = Vec::new();
        let mut counts = Vec::new();

        for row in rows {
            dates.push(row.0.to_string());
            counts.push(row.1.unwrap_or(0) as i32);
        }

        Ok(HeatMapData { dates, counts })
    }

    /// Get timeline data for a date range
    pub async fn get_timeline(
        &self,
        user_id: &Uuid,
        start_date: NaiveDate,
        end_date: NaiveDate,
    ) -> Result<TimelineData, AppError> {
        // Get all memos in the date range
        let memos = sqlx::query_as::<
            _,
            (
                Uuid,
                String,
                serde_json::Value,
                bool,
                Option<chrono::NaiveDate>,
                i64,
                i64,
            ),
        >(
            r#"
            SELECT
                id, content, tags, is_archived, diary_date, created_at, updated_at
            FROM memos
            WHERE user_id = $1
                AND is_deleted = false
                AND to_timestamp(created_at)::date BETWEEN $2 AND $3
            ORDER BY created_at DESC
            "#,
        )
        .bind(user_id)
        .bind(start_date)
        .bind(end_date)
        .fetch_all(&self.pool)
        .await?;

        // Get all diaries in the date range
        let diaries = sqlx::query_as::<_, (chrono::NaiveDate, String, String, i32, Option<Uuid>)>(
            r#"
            SELECT
                date, summary, mood_key, mood_score, cover_image_id
            FROM diaries
            WHERE user_id = $1
                AND date BETWEEN $2 AND $3
            ORDER BY date DESC
            "#,
        )
        .bind(user_id)
        .bind(start_date)
        .bind(end_date)
        .fetch_all(&self.pool)
        .await?;

        // Build a map of date -> diary info
        use std::collections::HashMap;
        let mut diary_map: HashMap<String, (String, String, i32)> = HashMap::new();
        for diary in diaries {
            diary_map.insert(diary.0.to_string(), (diary.1, diary.2, diary.3));
        }

        // Group memos by date and count
        let mut date_memo_count: HashMap<String, i32> = HashMap::new();
        for memo in &memos {
            let date = Utc
                .timestamp_opt(memo.5, 0)
                .unwrap()
                .date_naive()
                .to_string();
            *date_memo_count.entry(date).or_insert(0) += 1;
        }

        // Get all unique dates with memos, sorted in descending order
        let mut dates: Vec<String> = date_memo_count.keys().cloned().collect();
        dates.sort();
        dates.reverse();

        // Build timeline entries
        let mut entries: Vec<TimelineEntry> = Vec::new();
        for date in dates {
            let memo_count = *date_memo_count.get(&date).unwrap_or(&0);
            let (summary, mood_key, mood_score) = diary_map
                .get(&date)
                .map(|(s, m, sc)| (s.clone(), Some(m.clone()), Some(*sc)))
                .unwrap_or_else(|| (String::new(), None, None));

            // Calculate color based on mood
            let color = match mood_key.as_deref() {
                Some("happy") => "#22c55e",
                Some("sad") => "#3b82f6",
                Some("angry") => "#ef4444",
                Some("anxious") => "#f59e0b",
                Some("calm") => "#06b6d4",
                Some("excited") => "#f97316",
                Some("tired") => "#6b7280",
                Some("neutral") | _ => "#8b5cf6",
            };

            entries.push(TimelineEntry {
                date: date.clone(),
                mood_key,
                mood_score,
                summary,
                memo_count,
                color: color.to_string(),
            });
        }

        Ok(TimelineData { entries })
    }

    /// Get trends data (moods and tags) for a date range
    pub async fn get_trends(
        &self,
        user_id: &Uuid,
        start_date: NaiveDate,
        end_date: NaiveDate,
    ) -> Result<TrendsData, AppError> {
        // Get mood distribution
        let mood_rows = sqlx::query_as::<_, (String, Option<i64>)>(
            r#"
            SELECT
                mood_key,
                COUNT(*) as count
            FROM diaries
            WHERE user_id = $1
                AND date BETWEEN $2 AND $3
            GROUP BY mood_key
            "#,
        )
        .bind(user_id)
        .bind(start_date)
        .bind(end_date)
        .fetch_all(&self.pool)
        .await?;

        let total_moods: i32 = mood_rows.iter().map(|r| r.1.unwrap_or(0) as i32).sum();

        let moods: Vec<MoodData> = mood_rows
            .into_iter()
            .map(|row| {
                let count = row.1.unwrap_or(0) as i32;
                let percentage = if total_moods > 0 {
                    (count as f32 / total_moods as f32) * 100.0
                } else {
                    0.0
                };
                MoodData {
                    mood_key: row.0,
                    count,
                    percentage,
                }
            })
            .collect();

        // Get tag distribution
        let tag_rows = sqlx::query_as::<_, (Option<String>, Option<i64>)>(
            r#"
            SELECT
                jsonb_array_elements_text(tags) as tag,
                COUNT(*) as count
            FROM memos
            WHERE user_id = $1
                AND is_deleted = false
                AND to_timestamp(created_at)::date BETWEEN $2 AND $3
            GROUP BY tag
            ORDER BY count DESC
            LIMIT 20
            "#,
        )
        .bind(user_id)
        .bind(start_date)
        .bind(end_date)
        .fetch_all(&self.pool)
        .await?;

        let tags: Vec<TagData> = tag_rows
            .into_iter()
            .map(|row| TagData {
                tag: row.0.unwrap_or_default(),
                count: row.1.unwrap_or(0) as i32,
            })
            .collect();

        Ok(TrendsData { moods, tags })
    }

    /// Get summary data for a specific month
    pub async fn get_summary(
        &self,
        user_id: &Uuid,
        year: i32,
        month: i32,
    ) -> Result<SummaryData, AppError> {
        // Count memos for the month
        let memo_count: (i64,) = sqlx::query_as(
            r#"
            SELECT COUNT(*) FROM memos
            WHERE user_id = $1 
                AND is_deleted = false
                AND EXTRACT(YEAR FROM to_timestamp(created_at)) = $2
                AND EXTRACT(MONTH FROM to_timestamp(created_at)) = $3
            "#,
        )
        .bind(user_id)
        .bind(year)
        .bind(month)
        .fetch_one(&self.pool)
        .await?;

        // Count diaries for the month
        let diary_count: (i64,) = sqlx::query_as(
            r#"
            SELECT COUNT(*) FROM diaries
            WHERE user_id = $1
                AND EXTRACT(YEAR FROM date) = $2
                AND EXTRACT(MONTH FROM date) = $3
            "#,
        )
        .bind(user_id)
        .bind(year)
        .bind(month)
        .fetch_one(&self.pool)
        .await?;

        // Count resources for the month
        let resource_count: (i64,) = sqlx::query_as(
            r#"
            SELECT COUNT(*) FROM resources r
            JOIN memos m ON r.memo_id = m.id
            WHERE m.user_id = $1
                AND EXTRACT(YEAR FROM to_timestamp(r.created_at)) = $2
                AND EXTRACT(MONTH FROM to_timestamp(r.created_at)) = $3
            "#,
        )
        .bind(user_id)
        .bind(year)
        .bind(month)
        .fetch_one(&self.pool)
        .await?;

        Ok(SummaryData {
            total_memos: memo_count.0,
            total_diaries: diary_count.0,
            total_resources: resource_count.0,
        })
    }
}
