use crate::error::AppError;
use crate::services::AppSettingsService;
use chrono::{Datelike, TimeZone};
use chrono_tz::Tz;
use pgvector::Vector;
use sqlx::PgPool;
use std::collections::HashMap;
use uuid::Uuid;

#[derive(Debug, Clone, sqlx::FromRow)]
pub struct HybridSearchResult {
    pub memo_id: Uuid,
    pub content: String,
    pub tags: serde_json::Value,
    pub ai_summary: Option<String>,
    pub is_archived: bool,
    pub diary_date: Option<chrono::NaiveDate>,
    pub created_at: i64,
    pub updated_at: i64,
}

#[derive(Clone)]
pub struct HybridSearchService {
    db: PgPool,
    app_settings_service: Option<AppSettingsService>,
}

#[derive(Debug, sqlx::FromRow)]
struct SemanticRow {
    memo_id: Uuid,
    similarity: f64,
}

impl HybridSearchService {
    pub fn new(db: PgPool) -> Self {
        Self {
            db,
            app_settings_service: None,
        }
    }

    pub fn with_app_settings_service(mut self, svc: AppSettingsService) -> Self {
        self.app_settings_service = Some(svc);
        self
    }

    fn build_filter_clauses(
        tags: &Option<Vec<String>>,
        start_ms: &Option<i64>,
        end_ms: &Option<i64>,
        is_archived: &Option<bool>,
        param_start: &mut usize,
        conditions: &mut Vec<String>,
    ) {
        if let Some(_archived) = is_archived {
            *param_start += 1;
            conditions.push(format!("is_archived = ${}", *param_start));
        }

        if let Some(ref tag_filters) = tags {
            if !tag_filters.is_empty() {
                *param_start += 1;
                conditions.push(format!("tags ?& ${}::text[]", *param_start));
            }
        }

        if start_ms.is_some() {
            *param_start += 1;
            conditions.push(format!("created_at >= ${}", *param_start));
        }

        if end_ms.is_some() {
            *param_start += 1;
            conditions.push(format!("created_at < ${}", *param_start));
        }
    }

    pub async fn search(
        &self,
        user_id: Uuid,
        query: &str,
        tags: Option<Vec<String>>,
        start_date: Option<String>,
        end_date: Option<String>,
        is_archived: Option<bool>,
        page: i64,
        page_size: i64,
        embedding: Option<Vec<f32>>,
    ) -> Result<(Vec<serde_json::Value>, i64), AppError> {
        if query.is_empty() {
            return Err(AppError::InvalidInput(
                "Query must be non-empty for hybrid search".into(),
            ));
        }

        let tz: Tz = match &self.app_settings_service {
            Some(svc) => svc.get_tz().await,
            None => chrono_tz::Asia::Shanghai,
        };

        let start_ms: Option<i64> = start_date
            .as_deref()
            .map(|d| date_str_to_ms_bounds(d, tz).map(|(s, _)| s))
            .transpose()?;
        let end_ms: Option<i64> = end_date
            .as_deref()
            .map(|d| date_str_to_ms_bounds(d, tz).map(|(_, e)| e))
            .transpose()?;

        let search_pattern = format!("%{}%", query);

        let keyword_rows = self
            .run_keyword_query(
                user_id,
                &search_pattern,
                &tags,
                &start_ms,
                &end_ms,
                &is_archived,
            )
            .await?;

        let semantic_scores = if let Some(ref emb) = embedding {
            self.run_semantic_query(user_id, emb, &tags, &start_ms, &end_ms, &is_archived)
                .await?
        } else {
            HashMap::new()
        };

        let merged = self
            .merge_results(user_id, keyword_rows, semantic_scores)
            .await?;

        let filtered: Vec<_> = merged
            .into_iter()
            .filter(|(_, kw, sem, _)| {
                let final_score = 0.6 * sem + 0.4 * kw;
                if embedding.is_some() && final_score < 0.2 {
                    return false;
                }
                true
            })
            .collect();

        let total = filtered.len() as i64;
        let offset = ((page - 1) * page_size) as usize;
        let paginated: Vec<_> = filtered
            .into_iter()
            .skip(offset)
            .take(page_size as usize)
            .collect();

        let json_results: Vec<serde_json::Value> = paginated
            .into_iter()
            .map(|(row, keyword_score, semantic_score, match_type)| {
                let tags: Vec<String> =
                    serde_json::from_value(row.tags.clone()).unwrap_or_default();
                serde_json::json!({
                    "id": row.memo_id,
                    "content": row.content,
                    "tags": tags,
                    "isArchived": row.is_archived,
                    "diaryDate": row.diary_date,
                    "aiSummary": row.ai_summary,
                    "keywordScore": keyword_score,
                    "createdAt": row.created_at,
                    "updatedAt": row.updated_at,
                    "semanticScore": semantic_score,
                    "matchType": match_type,
                    "resources": [],
                })
            })
            .collect();

        Ok((json_results, total))
    }

    async fn run_keyword_query(
        &self,
        user_id: Uuid,
        search_pattern: &str,
        tags: &Option<Vec<String>>,
        start_ms: &Option<i64>,
        end_ms: &Option<i64>,
        is_archived: &Option<bool>,
    ) -> Result<Vec<HybridSearchResult>, AppError> {
        let mut conditions = vec!["(content ILIKE $2 OR tags::text ILIKE $2)".to_string()];
        let mut param_start = 3;
        Self::build_filter_clauses(
            tags,
            start_ms,
            end_ms,
            is_archived,
            &mut param_start,
            &mut conditions,
        );

        let kw_sql = format!(
            "SELECT id as memo_id, content, tags, ai_summary, is_archived, diary_date, created_at, updated_at
             FROM memos
             WHERE user_id = $1 AND is_deleted = false AND {}
             LIMIT 200",
            conditions.join(" AND ")
        );

        let mut q = sqlx::query_as::<_, HybridSearchResult>(&kw_sql)
            .bind(user_id)
            .bind(search_pattern);

        if let Some(archived) = is_archived {
            q = q.bind(archived);
        }
        if let Some(ref tag_filters) = tags {
            if !tag_filters.is_empty() {
                q = q.bind(tag_filters);
            }
        }
        if let Some(ms) = start_ms {
            q = q.bind(ms);
        }
        if let Some(ms) = end_ms {
            q = q.bind(ms);
        }

        q.fetch_all(&self.db).await.map_err(AppError::Database)
    }

    async fn run_semantic_query(
        &self,
        user_id: Uuid,
        embedding: &Vec<f32>,
        tags: &Option<Vec<String>>,
        start_ms: &Option<i64>,
        end_ms: &Option<i64>,
        is_archived: &Option<bool>,
    ) -> Result<HashMap<Uuid, f64>, AppError> {
        let mut conditions = vec!["(1.0 - (me.embedding <=> $2::vector)) >= 0.4".to_string()];
        let mut param_start = 3;
        Self::build_filter_clauses(
            tags,
            start_ms,
            end_ms,
            is_archived,
            &mut param_start,
            &mut conditions,
        );

        let sem_sql = format!(
            "SELECT m.id as memo_id, (1.0 - (me.embedding <=> $2::vector)) as similarity
             FROM memos m
             JOIN memo_embeddings me ON me.memo_id = m.id
             WHERE m.user_id = $1 AND m.is_deleted = false AND {}
             ORDER BY similarity DESC
             LIMIT 50",
            conditions.join(" AND ")
        );

        let mut q = sqlx::query_as::<_, SemanticRow>(&sem_sql)
            .bind(user_id)
            .bind(Vector::from(embedding.clone()));

        if let Some(archived) = is_archived {
            q = q.bind(archived);
        }
        if let Some(ref tag_filters) = tags {
            if !tag_filters.is_empty() {
                q = q.bind(tag_filters);
            }
        }
        if let Some(ms) = start_ms {
            q = q.bind(ms);
        }
        if let Some(ms) = end_ms {
            q = q.bind(ms);
        }

        let rows = q.fetch_all(&self.db).await.map_err(AppError::Database)?;
        Ok(rows
            .into_iter()
            .map(|r| (r.memo_id, r.similarity))
            .collect())
    }

    async fn merge_results(
        &self,
        user_id: Uuid,
        keyword_rows: Vec<HybridSearchResult>,
        semantic_scores: HashMap<Uuid, f64>,
    ) -> Result<Vec<(HybridSearchResult, f64, f64, String)>, AppError> {
        let mut merged: HashMap<Uuid, (HybridSearchResult, f64, f64)> = HashMap::new();

        for row in keyword_rows {
            let sem_score = semantic_scores.get(&row.memo_id).copied().unwrap_or(0.0);
            merged.insert(row.memo_id, (row, 1.0, sem_score));
        }

        let semantic_only_ids: Vec<Uuid> = semantic_scores
            .keys()
            .filter(|id| !merged.contains_key(id))
            .copied()
            .collect();

        if !semantic_only_ids.is_empty() {
            let rows = sqlx::query_as::<_, HybridSearchResult>(
                "SELECT id as memo_id, content, tags, ai_summary, is_archived, diary_date, created_at, updated_at
                 FROM memos
                 WHERE user_id = $1 AND is_deleted = false AND id = ANY($2)",
            )
            .bind(user_id)
            .bind(&semantic_only_ids)
            .fetch_all(&self.db)
            .await
            .map_err(AppError::Database)?;

            for row in rows {
                let sem_score = semantic_scores.get(&row.memo_id).copied().unwrap_or(0.0);
                merged.insert(row.memo_id, (row, 0.0, sem_score));
            }
        }

        let mut result: Vec<(HybridSearchResult, f64, f64, String, f64)> = merged
            .into_iter()
            .map(|(_id, (row, kw, sem))| {
                let final_score = 0.6 * sem + 0.4 * kw;
                let match_type = if kw > 0.0 && sem > 0.0 {
                    "hybrid".to_string()
                } else if kw > 0.0 {
                    "keyword".to_string()
                } else {
                    "semantic".to_string()
                };
                (row, kw, sem, match_type, final_score)
            })
            .collect();

        result.sort_by(|a, b| b.4.partial_cmp(&a.4).unwrap_or(std::cmp::Ordering::Equal));

        Ok(result
            .into_iter()
            .map(|(row, kw, sem, mt, _)| (row, kw, sem, mt))
            .collect())
    }
}

fn date_str_to_ms_bounds(date: &str, tz: Tz) -> Result<(i64, i64), AppError> {
    use chrono::NaiveDate;
    let naive = NaiveDate::parse_from_str(date, "%Y-%m-%d")
        .map_err(|_| AppError::InvalidInput(format!("invalid date: {}", date)))?;
    let start = tz
        .with_ymd_and_hms(naive.year(), naive.month(), naive.day(), 0, 0, 0)
        .single()
        .ok_or_else(|| AppError::InvalidInput(format!("ambiguous or invalid date: {}", date)))?;
    let end = start + chrono::Duration::days(1);
    Ok((start.timestamp_millis(), end.timestamp_millis()))
}
