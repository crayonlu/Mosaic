use crate::middleware::get_user_id;
use crate::models::MemoryStatsResponse;
use actix_web::{web, HttpRequest, HttpResponse};
use serde::{Deserialize, Serialize};
use sqlx::PgPool;
use std::collections::HashMap;
use uuid::Uuid;

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct MemoryActivityEntry {
    pub id: Uuid,
    pub bot_id: Uuid,
    pub bot_name: String,
    pub memo_id: Uuid,
    pub retrieved_count: i64,
    pub prompt_size: i32,
    pub has_episode: bool,
    pub created_at: i64,
}

#[derive(Deserialize)]
pub(crate) struct ActivityQuery {
    limit: Option<i64>,
}

#[derive(sqlx::FromRow)]
struct MemoryCountsRow {
    total_memos: i64,
    indexed_memos: i64,
    ongoing_episodes: i64,
    resolved_episodes: i64,
}

pub async fn get_memory_stats(req: HttpRequest, pool: web::Data<PgPool>) -> HttpResponse {
    let user_id = match get_user_id(&req) {
        Ok(id) => id,
        Err(e) => return HttpResponse::from_error(e),
    };
    let user_uuid = match Uuid::parse_str(&user_id) {
        Ok(id) => id,
        Err(_) => return HttpResponse::BadRequest().finish(),
    };

    let counts = match sqlx::query_as::<_, MemoryCountsRow>(
        r#"SELECT
            (SELECT COUNT(*) FROM memos WHERE user_id = $1 AND is_deleted = FALSE)::bigint AS total_memos,
            (SELECT COUNT(*) FROM memo_embeddings me
             JOIN memos m ON me.memo_id = m.id
             WHERE m.user_id = $1 AND m.is_deleted = FALSE)::bigint AS indexed_memos,
            (SELECT COUNT(*) FROM memo_episodes WHERE user_id = $1 AND status = 'ongoing')::bigint AS ongoing_episodes,
            (SELECT COUNT(*) FROM memo_episodes WHERE user_id = $1 AND status = 'resolved')::bigint AS resolved_episodes"#,
    )
    .bind(user_uuid)
    .fetch_one(pool.get_ref())
    .await
    {
        Ok(row) => row,
        Err(e) => {
            log::error!("[MemoryStats] Failed to query counts: {}", e);
            return HttpResponse::InternalServerError().finish();
        }
    };

    let profile = sqlx::query_as::<_, (String, serde_json::Value, i64)>(
        "SELECT profile_summary, topic_signals, updated_at FROM user_memory_profiles WHERE user_id = $1",
    )
    .bind(user_uuid)
    .fetch_optional(pool.get_ref())
    .await
    .unwrap_or(None);

    let (profile_summary, profile_topic_count, profile_updated_at) = match profile {
        Some((summary, topics, updated_at)) => {
            let topic_count = topics.as_array().map(|a| a.len() as i64).unwrap_or(0);
            let summary_opt = if summary.trim().is_empty() {
                None
            } else {
                Some(summary)
            };
            (summary_opt, topic_count, Some(updated_at))
        }
        None => (None, 0, None),
    };

    HttpResponse::Ok().json(MemoryStatsResponse {
        total_memos: counts.total_memos,
        indexed_memos: counts.indexed_memos,
        ongoing_episodes: counts.ongoing_episodes,
        resolved_episodes: counts.resolved_episodes,
        profile_summary,
        profile_topic_count,
        profile_updated_at,
    })
}

pub async fn get_memory_activity(
    req: HttpRequest,
    pool: web::Data<PgPool>,
    query: web::Query<ActivityQuery>,
) -> HttpResponse {
    let user_id = match get_user_id(&req) {
        Ok(id) => id,
        Err(e) => return HttpResponse::from_error(e),
    };
    let user_uuid = match Uuid::parse_str(&user_id) {
        Ok(id) => id,
        Err(_) => return HttpResponse::BadRequest().finish(),
    };

    let limit = query.limit.unwrap_or(20).min(50);

    #[derive(sqlx::FromRow)]
    struct ActivityRow {
        id: Uuid,
        bot_id: Uuid,
        bot_name: String,
        memo_id: Uuid,
        retrieved_memo_ids: serde_json::Value,
        selected_episode_ids: serde_json::Value,
        prompt_size: i32,
        created_at: i64,
    }

    let rows = match sqlx::query_as::<_, ActivityRow>(
        r#"SELECT l.id, l.bot_id, b.name AS bot_name, l.memo_id,
            l.retrieved_memo_ids, l.selected_episode_ids, l.prompt_size, l.created_at
           FROM bot_memory_debug_logs l
           JOIN bots b ON b.id = l.bot_id
           WHERE l.user_id = $1
           ORDER BY l.created_at DESC
           LIMIT $2"#,
    )
    .bind(user_uuid)
    .bind(limit)
    .fetch_all(pool.get_ref())
    .await
    {
        Ok(rows) => rows,
        Err(e) => {
            log::error!("[MemoryActivity] Query failed: {}", e);
            return HttpResponse::InternalServerError().finish();
        }
    };

    let entries: Vec<MemoryActivityEntry> = rows
        .into_iter()
        .map(|row| {
            let retrieved_count = row
                .retrieved_memo_ids
                .as_array()
                .map(|a| a.len() as i64)
                .unwrap_or(0);
            let has_episode = row
                .selected_episode_ids
                .as_array()
                .map(|a| !a.is_empty())
                .unwrap_or(false);
            MemoryActivityEntry {
                id: row.id,
                bot_id: row.bot_id,
                bot_name: row.bot_name,
                memo_id: row.memo_id,
                retrieved_count,
                prompt_size: row.prompt_size,
                has_episode,
                created_at: row.created_at,
            }
        })
        .collect();

    HttpResponse::Ok().json(entries)
}

#[derive(Deserialize)]
pub(crate) struct ContextQuery {
    memo_id: Uuid,
    bot_id: Uuid,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct MemoryContextResponse {
    retrieved_memos: Vec<RetrievedMemoItem>,
    episode: Option<EpisodeContextItem>,
    profile_summary: Option<String>,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct RetrievedMemoItem {
    id: Uuid,
    excerpt: String,
    score: f64,
    reason: String,
    created_at: i64,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct EpisodeContextItem {
    id: Uuid,
    title: String,
    summary: String,
    status: String,
}

pub async fn get_memory_context(
    req: HttpRequest,
    pool: web::Data<PgPool>,
    query: web::Query<ContextQuery>,
) -> HttpResponse {
    let user_id = match get_user_id(&req) {
        Ok(id) => id,
        Err(e) => return HttpResponse::from_error(e),
    };
    let user_uuid = match Uuid::parse_str(&user_id) {
        Ok(id) => id,
        Err(_) => return HttpResponse::BadRequest().finish(),
    };

    let empty = MemoryContextResponse {
        retrieved_memos: vec![],
        episode: None,
        profile_summary: None,
    };

    #[derive(sqlx::FromRow)]
    struct LogRow {
        retrieved_memo_ids: serde_json::Value,
        selected_episode_ids: serde_json::Value,
        score_payload: serde_json::Value,
    }

    let log = match sqlx::query_as::<_, LogRow>(
        "SELECT retrieved_memo_ids, selected_episode_ids, score_payload
         FROM bot_memory_debug_logs
         WHERE user_id = $1 AND memo_id = $2 AND bot_id = $3
         ORDER BY created_at DESC LIMIT 1",
    )
    .bind(user_uuid)
    .bind(query.memo_id)
    .bind(query.bot_id)
    .fetch_optional(pool.get_ref())
    .await
    {
        Ok(Some(row)) => row,
        Ok(None) => return HttpResponse::Ok().json(empty),
        Err(e) => {
            log::error!("[MemoryContext] Query failed: {}", e);
            return HttpResponse::InternalServerError().finish();
        }
    };

    let score_map: HashMap<Uuid, (f64, String)> = log
        .score_payload
        .as_array()
        .unwrap_or(&vec![])
        .iter()
        .filter_map(|item| {
            let id = item["memoId"]
                .as_str()
                .and_then(|s| Uuid::parse_str(s).ok())?;
            let score = item["score"].as_f64().unwrap_or(0.0);
            let reason = item["reason"].as_str().unwrap_or("").to_string();
            Some((id, (score, reason)))
        })
        .collect();

    let memo_ids: Vec<Uuid> = log
        .retrieved_memo_ids
        .as_array()
        .unwrap_or(&vec![])
        .iter()
        .filter_map(|v| v.as_str().and_then(|s| Uuid::parse_str(s).ok()))
        .collect();

    let mut retrieved_memos: Vec<RetrievedMemoItem> = if memo_ids.is_empty() {
        vec![]
    } else {
        #[derive(sqlx::FromRow)]
        struct MemoRow {
            id: Uuid,
            content: String,
            ai_summary: Option<String>,
            created_at: i64,
        }
        sqlx::query_as::<_, MemoRow>(
            "SELECT id, content, ai_summary, created_at FROM memos WHERE id = ANY($1) AND is_deleted = FALSE",
        )
        .bind(&memo_ids)
        .fetch_all(pool.get_ref())
        .await
        .unwrap_or_default()
        .into_iter()
        .map(|m| {
            let (score, reason) = score_map.get(&m.id).cloned().unwrap_or((0.0, "recent".into()));
            let excerpt = m
                .ai_summary
                .filter(|s| !s.trim().is_empty())
                .unwrap_or_else(|| m.content.chars().take(120).collect());
            RetrievedMemoItem {
                id: m.id,
                excerpt,
                score,
                reason,
                created_at: m.created_at,
            }
        })
        .collect()
    };

    retrieved_memos.sort_by(|a, b| {
        b.score
            .partial_cmp(&a.score)
            .unwrap_or(std::cmp::Ordering::Equal)
    });

    let episode_id = log
        .selected_episode_ids
        .as_array()
        .and_then(|a| a.first())
        .and_then(|v| v.as_str())
        .and_then(|s| Uuid::parse_str(s).ok());

    let episode = if let Some(ep_id) = episode_id {
        #[derive(sqlx::FromRow)]
        struct EpRow {
            id: Uuid,
            title: String,
            summary: String,
            status: String,
        }
        sqlx::query_as::<_, EpRow>(
            "SELECT id, title, summary, status FROM memo_episodes WHERE id = $1",
        )
        .bind(ep_id)
        .fetch_optional(pool.get_ref())
        .await
        .ok()
        .flatten()
        .map(|r| EpisodeContextItem {
            id: r.id,
            title: r.title,
            summary: r.summary,
            status: r.status,
        })
    } else {
        None
    };

    let profile_summary = sqlx::query_scalar::<_, String>(
        "SELECT profile_summary FROM user_memory_profiles WHERE user_id = $1",
    )
    .bind(user_uuid)
    .fetch_optional(pool.get_ref())
    .await
    .ok()
    .flatten()
    .filter(|s| !s.trim().is_empty());

    HttpResponse::Ok().json(MemoryContextResponse {
        retrieved_memos,
        episode,
        profile_summary,
    })
}

pub fn configure_memory_routes(cfg: &mut web::ServiceConfig) {
    cfg.service(web::resource("/memory/stats").route(web::get().to(get_memory_stats)))
        .service(web::resource("/memory/activity").route(web::get().to(get_memory_activity)))
        .service(web::resource("/memory/context").route(web::get().to(get_memory_context)));
}
