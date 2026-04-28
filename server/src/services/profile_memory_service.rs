use crate::error::AppError;
use sqlx::PgPool;
use std::collections::HashMap;
use uuid::Uuid;

#[derive(Clone)]
pub struct ProfileMemoryService {
    pool: PgPool,
}

impl ProfileMemoryService {
    pub fn new(pool: PgPool) -> Self {
        Self { pool }
    }

    pub async fn refresh_for_user(&self, user_id: Uuid) -> Result<(), AppError> {
        let now = chrono::Utc::now().timestamp_millis();
        let rows = sqlx::query_as::<_, (Option<String>, serde_json::Value)>(
            "SELECT ai_summary, tags
             FROM memos
             WHERE user_id = $1 AND is_deleted = false
             ORDER BY created_at DESC
             LIMIT 30",
        )
        .bind(user_id)
        .fetch_all(&self.pool)
        .await
        .map_err(AppError::Database)?;

        let summaries: Vec<String> = rows
            .iter()
            .filter_map(|row| row.0.clone())
            .filter(|s| !s.trim().is_empty())
            .take(8)
            .collect();

        let mut tag_freq: HashMap<String, usize> = HashMap::new();
        for row in &rows {
            let tags: Vec<String> = serde_json::from_value(row.1.clone()).unwrap_or_default();
            for tag in tags {
                *tag_freq.entry(tag).or_insert(0) += 1;
            }
        }
        let mut top_tags: Vec<(String, usize)> = tag_freq.into_iter().collect();
        top_tags.sort_by(|a, b| b.1.cmp(&a.1));
        let topic_signals: Vec<String> = top_tags.into_iter().take(15).map(|(t, _)| t).collect();

        let profile_summary = if summaries.is_empty() {
            String::new()
        } else {
            let topics_line = if topic_signals.is_empty() {
                String::new()
            } else {
                format!(
                    "常见话题：{}。",
                    topic_signals
                        .iter()
                        .take(8)
                        .cloned()
                        .collect::<Vec<_>>()
                        .join("、")
                )
            };
            let recent_line = format!(
                "近期动态：{}",
                summaries
                    .iter()
                    .take(4)
                    .cloned()
                    .collect::<Vec<_>>()
                    .join("；")
            );
            format!("{}{}", topics_line, recent_line)
        };

        let profile_summary: String = profile_summary.chars().take(500).collect();

        let mood_rows = sqlx::query_as::<_, (String, i64)>(
            "SELECT mood_key, COUNT(*) as cnt
             FROM diaries
             WHERE user_id = $1 AND is_deleted = false
             GROUP BY mood_key
             ORDER BY cnt DESC
             LIMIT 5",
        )
        .bind(user_id)
        .fetch_all(&self.pool)
        .await
        .unwrap_or_default();

        let mood_patterns: Vec<serde_json::Value> = mood_rows
            .into_iter()
            .map(|(mood, count)| serde_json::json!({"mood": mood, "count": count}))
            .collect();

        sqlx::query(
            "INSERT INTO user_memory_profiles (user_id, profile_summary, topic_signals, mood_patterns, updated_at)
             VALUES ($1, $2, $3, $4, $5)
             ON CONFLICT (user_id)
             DO UPDATE SET profile_summary = EXCLUDED.profile_summary,
                           topic_signals = EXCLUDED.topic_signals,
                           mood_patterns = EXCLUDED.mood_patterns,
                           updated_at = EXCLUDED.updated_at",
        )
        .bind(user_id)
        .bind(profile_summary)
        .bind(serde_json::json!(topic_signals))
        .bind(serde_json::json!(mood_patterns))
        .bind(now)
        .execute(&self.pool)
        .await
        .map_err(AppError::Database)?;

        Ok(())
    }
}
