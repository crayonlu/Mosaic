use crate::error::AppError;
use crate::models::{
    HeatMapData, MoodData, SummaryData, TagData, TimelineData, TimelineEntry, TrendsData,
};
use crate::services::AppSettingsService;
use chrono::{DateTime, Datelike, NaiveDate, TimeZone, Utc};
use chrono_tz::Tz;
use sqlx::PgPool;
use uuid::Uuid;

#[derive(Clone)]
pub struct StatsService {
    pool: PgPool,
    app_settings_service: Option<AppSettingsService>,
}

impl StatsService {
    pub fn new(pool: PgPool) -> Self {
        Self {
            pool,
            app_settings_service: None,
        }
    }

    pub fn with_app_settings_service(mut self, svc: AppSettingsService) -> Self {
        self.app_settings_service = Some(svc);
        self
    }

    async fn get_tz(&self) -> Tz {
        match &self.app_settings_service {
            Some(svc) => svc.get_tz().await,
            None => chrono_tz::Asia::Shanghai,
        }
    }

    pub async fn get_heatmap(
        &self,
        user_id: &Uuid,
        start_date: NaiveDate,
        end_date: NaiveDate,
    ) -> Result<HeatMapData, AppError> {
        let tz = self.get_tz().await;
        let start_ms = naive_date_to_ms(start_date, tz);
        let end_ms = naive_date_to_ms(end_date + chrono::Duration::days(1), tz);

        let diary_rows = sqlx::query_as::<_, (NaiveDate, String, i32)>(
            r#"
            SELECT date, mood_key, mood_score
            FROM diaries
            WHERE user_id = $1 AND date BETWEEN $2 AND $3
            ORDER BY date
            "#,
        )
        .bind(user_id)
        .bind(start_date)
        .bind(end_date)
        .fetch_all(&self.pool)
        .await?;

        use std::collections::HashMap;
        let mut mood_map: HashMap<String, (String, i32)> = HashMap::new();
        for row in diary_rows {
            mood_map.insert(row.0.to_string(), (row.1, row.2));
        }

        let memo_timestamps: Vec<(i64,)> = sqlx::query_as(
            "SELECT created_at FROM memos
             WHERE user_id = $1 AND is_deleted = false AND created_at >= $2 AND created_at < $3",
        )
        .bind(user_id)
        .bind(start_ms)
        .bind(end_ms)
        .fetch_all(&self.pool)
        .await?;

        let mut count_by_date: HashMap<NaiveDate, i32> = HashMap::new();
        for (ts,) in memo_timestamps {
            let date = date_from_ms(ts, tz);
            *count_by_date.entry(date).or_insert(0) += 1;
        }

        let mut dates = Vec::new();
        let mut counts = Vec::new();
        let mut moods = Vec::new();
        let mut mood_scores = Vec::new();

        let mut sorted_dates: Vec<NaiveDate> = count_by_date.keys().cloned().collect();
        sorted_dates.sort();

        for date in sorted_dates {
            let date_str = date.to_string();
            let count = *count_by_date.get(&date).unwrap_or(&0);
            let (mood_key, mood_score) = mood_map
                .get(&date_str)
                .map(|(m, s)| (Some(m.clone()), Some(*s)))
                .unwrap_or((None, None));
            dates.push(date_str);
            counts.push(count);
            moods.push(mood_key);
            mood_scores.push(mood_score);
        }

        Ok(HeatMapData {
            dates,
            counts,
            moods,
            mood_scores,
        })
    }

    pub async fn get_timeline(
        &self,
        user_id: &Uuid,
        start_date: NaiveDate,
        end_date: NaiveDate,
    ) -> Result<TimelineData, AppError> {
        let tz = self.get_tz().await;
        let start_ms = naive_date_to_ms(start_date, tz);
        let end_ms = naive_date_to_ms(end_date + chrono::Duration::days(1), tz);

        let memos = sqlx::query_as::<
            _,
            (
                Uuid,
                String,
                serde_json::Value,
                bool,
                Option<NaiveDate>,
                i64,
                i64,
            ),
        >(
            r#"
            SELECT id, content, tags, is_archived, diary_date, created_at, updated_at
            FROM memos
            WHERE user_id = $1 AND is_deleted = false AND created_at >= $2 AND created_at < $3
            ORDER BY created_at DESC
            "#,
        )
        .bind(user_id)
        .bind(start_ms)
        .bind(end_ms)
        .fetch_all(&self.pool)
        .await?;

        let diaries = sqlx::query_as::<_, (NaiveDate, String, String, i32, Option<Uuid>)>(
            r#"
            SELECT date, summary, mood_key, mood_score, cover_image_id
            FROM diaries
            WHERE user_id = $1 AND date BETWEEN $2 AND $3
            ORDER BY date DESC
            "#,
        )
        .bind(user_id)
        .bind(start_date)
        .bind(end_date)
        .fetch_all(&self.pool)
        .await?;

        use std::collections::HashMap;
        let mut diary_map: HashMap<String, (String, String, i32)> = HashMap::new();
        for diary in diaries {
            diary_map.insert(diary.0.to_string(), (diary.1, diary.2, diary.3));
        }

        let mut date_memo_count: HashMap<String, i32> = HashMap::new();
        for memo in &memos {
            let date = date_from_ms(memo.5, tz).to_string();
            *date_memo_count.entry(date).or_insert(0) += 1;
        }

        let mut dates: Vec<String> = date_memo_count.keys().cloned().collect();
        dates.sort();
        dates.reverse();

        let mut entries: Vec<TimelineEntry> = Vec::new();
        for date in dates {
            let memo_count = *date_memo_count.get(&date).unwrap_or(&0);
            let (summary, mood_key, mood_score) = diary_map
                .get(&date)
                .map(|(s, m, sc)| (s.clone(), Some(m.clone()), Some(*sc)))
                .unwrap_or_else(|| (String::new(), None, None));

            let color = match mood_key.as_deref() {
                Some("joy") => "#FFD93D",
                Some("sadness") => "#4ECDC4",
                Some("anger") => "#FF6B6B",
                Some("anxiety") => "#FFA07A",
                Some("calm") => "#95E1D3",
                Some("focus") => "#6C5CE7",
                Some("tired") => "#A8A8A8",
                _ => "#8b5cf6",
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

    pub async fn get_trends(
        &self,
        user_id: &Uuid,
        start_date: NaiveDate,
        end_date: NaiveDate,
    ) -> Result<TrendsData, AppError> {
        let tz = self.get_tz().await;
        let start_ms = naive_date_to_ms(start_date, tz);
        let end_ms = naive_date_to_ms(end_date + chrono::Duration::days(1), tz);

        let mood_rows = sqlx::query_as::<_, (String, Option<i64>)>(
            r#"
            SELECT mood_key, COUNT(*) as count
            FROM diaries
            WHERE user_id = $1 AND date BETWEEN $2 AND $3
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

        let tag_rows = sqlx::query_as::<_, (Option<String>, Option<i64>)>(
            r#"
            SELECT jsonb_array_elements_text(tags) as tag, COUNT(*) as count
            FROM memos
            WHERE user_id = $1 AND is_deleted = false AND created_at >= $2 AND created_at < $3
            GROUP BY tag
            ORDER BY count DESC
            LIMIT 20
            "#,
        )
        .bind(user_id)
        .bind(start_ms)
        .bind(end_ms)
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

    pub async fn get_summary(
        &self,
        user_id: &Uuid,
        year: i32,
        month: i32,
    ) -> Result<SummaryData, AppError> {
        let tz = self.get_tz().await;
        let start_ms = month_start_ms(year, month, tz);
        let end_ms = month_end_ms(year, month, tz);

        let memo_count: (i64,) = sqlx::query_as(
            "SELECT COUNT(*) FROM memos
             WHERE user_id = $1 AND is_deleted = false AND created_at >= $2 AND created_at < $3",
        )
        .bind(user_id)
        .bind(start_ms)
        .bind(end_ms)
        .fetch_one(&self.pool)
        .await?;

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

        let resource_count: (i64,) = sqlx::query_as(
            "SELECT COUNT(*) FROM resources r
             JOIN memos m ON r.memo_id = m.id
             WHERE m.user_id = $1 AND r.is_deleted = FALSE
               AND r.created_at >= $2 AND r.created_at < $3",
        )
        .bind(user_id)
        .bind(start_ms)
        .bind(end_ms)
        .fetch_one(&self.pool)
        .await?;

        Ok(SummaryData {
            total_memos: memo_count.0,
            total_diaries: diary_count.0,
            total_resources: resource_count.0,
        })
    }
}

fn naive_date_to_ms(date: NaiveDate, tz: Tz) -> i64 {
    tz.with_ymd_and_hms(date.year(), date.month(), date.day(), 0, 0, 0)
        .single()
        .map(|dt| dt.timestamp_millis())
        .unwrap_or_else(|| {
            date.and_hms_opt(0, 0, 0)
                .map(|ndt| DateTime::<Utc>::from_naive_utc_and_offset(ndt, Utc).timestamp_millis())
                .unwrap_or(0)
        })
}

fn date_from_ms(ms: i64, tz: Tz) -> NaiveDate {
    let secs = ms / 1000;
    DateTime::from_timestamp(secs, 0)
        .map(|dt| dt.with_timezone(&tz).date_naive())
        .unwrap_or_else(|| Utc::now().with_timezone(&tz).date_naive())
}

fn month_start_ms(year: i32, month: i32, tz: Tz) -> i64 {
    naive_date_to_ms(
        NaiveDate::from_ymd_opt(year, month as u32, 1).unwrap_or_default(),
        tz,
    )
}

fn month_end_ms(year: i32, month: i32, tz: Tz) -> i64 {
    let (next_year, next_month) = if month == 12 {
        (year + 1, 1)
    } else {
        (year, month + 1)
    };
    naive_date_to_ms(
        NaiveDate::from_ymd_opt(next_year, next_month as u32, 1).unwrap_or_default(),
        tz,
    )
}
