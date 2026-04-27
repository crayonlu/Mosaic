use crate::config::Config;
use actix_web::{web, HttpRequest, HttpResponse};
use chrono::Datelike;
use serde::Serialize;
use sqlx::PgPool;

use super::activity_log::ActivityLog;

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct HealthResponse {
    uptime: String,
    started_at: i64,
    version: String,
    storage_type: String,
    storage_used: i64,
    storage_used_formatted: String,
    db_size: i64,
    db_size_formatted: String,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct StatsResponse {
    memos: CountWithMonth,
    diaries: CountWithMonth,
    resources: ResourceStats,
    bots: BotStats,
    active_days: i64,
    longest_streak: i64,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct CountWithMonth {
    total: i64,
    this_month: i64,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct ResourceStats {
    total: i64,
    total_size: i64,
    total_size_formatted: String,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct BotStats {
    total: i64,
    auto_reply: i64,
    total_replies: i64,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct ConfigResponse {
    port: u16,
    storage_type: String,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct ActivityResponse {
    entries: Vec<ActivityEntryResponse>,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct ActivityEntryResponse {
    timestamp: i64,
    action: String,
    entity_type: String,
    entity_id: Option<String>,
    level: String,
    detail: String,
}

#[derive(serde::Deserialize)]
pub(crate) struct ActivityQuery {
    limit: Option<usize>,
    level: Option<String>,
}

pub async fn health(
    pool: web::Data<PgPool>,
    config: web::Data<Config>,
    _started_at: web::Data<StartedAt>,
) -> HttpResponse {
    let storage_used: i64 = sqlx::query_scalar(
        "SELECT COALESCE(SUM(file_size), 0)::BIGINT FROM resources WHERE is_deleted = FALSE",
    )
    .fetch_one(pool.get_ref())
    .await
    .unwrap_or_else(|e| {
        log::error!("[Admin] Failed to query storage_used: {}", e);
        0
    });

    let db_size: i64 =
        sqlx::query_scalar("SELECT COALESCE(pg_database_size(current_database()), 0)")
            .fetch_one(pool.get_ref())
            .await
            .unwrap_or_else(|e| {
                log::error!("[Admin] Failed to query db_size: {}", e);
                0
            });

    let elapsed = chrono::Utc::now().timestamp_millis() - _started_at.0;
    let days = elapsed / 86400000;
    let hours = (elapsed % 86400000) / 3600000;

    HttpResponse::Ok().json(HealthResponse {
        uptime: format!("{}天{}小时", days, hours),
        started_at: _started_at.0,
        version: "0.1.0".to_string(),
        storage_type: format!("{:?}", config.storage_type).to_lowercase(),
        storage_used,
        storage_used_formatted: format_size(storage_used),
        db_size,
        db_size_formatted: format_size(db_size),
    })
}

pub async fn stats(pool: web::Data<PgPool>, _req: HttpRequest) -> HttpResponse {
    let now = chrono::Utc::now();
    let month_start = chrono::NaiveDate::from_ymd_opt(now.year(), now.month(), 1).unwrap();
    let month_start_ts = month_start
        .and_hms_opt(0, 0, 0)
        .unwrap()
        .and_utc()
        .timestamp_millis();

    // Single combined query for all stats (global, not user-scoped)
    #[derive(sqlx::FromRow)]
    struct StatsRow {
        memos_total: i64,
        memos_month: i64,
        diaries_total: i64,
        diaries_month: i64,
        resources_total: i64,
        resources_size: i64,
        bots_total: i64,
        bots_auto: i64,
        replies_total: i64,
        active_days: i64,
    }

    // Fallback row if the query fails — log the error for diagnostics
    let row: StatsRow = match sqlx::query_as(
        r#"
        SELECT
          (SELECT COUNT(*) FROM memos WHERE is_deleted = FALSE) AS memos_total,
          (SELECT COUNT(*) FROM memos WHERE is_deleted = FALSE AND created_at >= $1) AS memos_month,
          (SELECT COUNT(*) FROM diaries WHERE is_deleted = FALSE) AS diaries_total,
          (SELECT COUNT(*) FROM diaries WHERE is_deleted = FALSE AND created_at >= $1) AS diaries_month,
          (SELECT COUNT(*) FROM resources WHERE is_deleted = FALSE) AS resources_total,
          (SELECT COALESCE(SUM(file_size), 0)::BIGINT FROM resources WHERE is_deleted = FALSE) AS resources_size,
          (SELECT COUNT(*) FROM bots WHERE is_deleted = FALSE) AS bots_total,
          (SELECT COUNT(*) FROM bots WHERE is_deleted = FALSE AND auto_reply = TRUE) AS bots_auto,
          (SELECT COUNT(*) FROM bot_replies) AS replies_total,
          (SELECT COUNT(DISTINCT to_timestamp(created_at / 1000)::date) FROM memos WHERE is_deleted = FALSE AND created_at >= $1) AS active_days
        "#,
    )
    .bind(month_start_ts)
    .fetch_one(pool.get_ref())
    .await
    {
        Ok(row) => row,
        Err(e) => {
            log::error!("[Admin] Failed to query stats: {}", e);
            StatsRow {
                memos_total: 0, memos_month: 0, diaries_total: 0, diaries_month: 0,
                resources_total: 0, resources_size: 0, bots_total: 0, bots_auto: 0,
                replies_total: 0, active_days: 0,
            }
        }
    };

    HttpResponse::Ok().json(StatsResponse {
        memos: CountWithMonth {
            total: row.memos_total,
            this_month: row.memos_month,
        },
        diaries: CountWithMonth {
            total: row.diaries_total,
            this_month: row.diaries_month,
        },
        resources: ResourceStats {
            total: row.resources_total,
            total_size: row.resources_size,
            total_size_formatted: format_size(row.resources_size),
        },
        bots: BotStats {
            total: row.bots_total,
            auto_reply: row.bots_auto,
            total_replies: row.replies_total,
        },
        active_days: row.active_days,
        longest_streak: 0,
    })
}

pub async fn list_activity(
    query: web::Query<ActivityQuery>,
    log: web::Data<ActivityLog>,
) -> HttpResponse {
    let entries = log.list(query.limit.unwrap_or(50), query.level.as_deref());
    let items: Vec<ActivityEntryResponse> = entries
        .into_iter()
        .map(|e| ActivityEntryResponse {
            timestamp: e.timestamp,
            action: e.action,
            entity_type: e.entity_type,
            entity_id: e.entity_id,
            level: e.level,
            detail: e.detail,
        })
        .collect();
    HttpResponse::Ok().json(ActivityResponse { entries: items })
}

pub async fn config_endpoint(config: web::Data<Config>) -> HttpResponse {
    HttpResponse::Ok().json(ConfigResponse {
        port: config.port,
        storage_type: format!("{:?}", config.storage_type).to_lowercase(),
    })
}

pub async fn clear_cache() -> HttpResponse {
    HttpResponse::Ok().json(serde_json::json!({ "message": "Cache cleared" }))
}

#[derive(Clone)]
pub struct StartedAt(pub i64);

fn format_size(bytes: i64) -> String {
    const KB: i64 = 1024;
    const MB: i64 = KB * 1024;
    const GB: i64 = MB * 1024;
    if bytes >= GB {
        format!("{:.1} GB", bytes as f64 / GB as f64)
    } else if bytes >= MB {
        format!("{:.1} MB", bytes as f64 / MB as f64)
    } else if bytes >= KB {
        format!("{:.1} KB", bytes as f64 / KB as f64)
    } else {
        format!("{} B", bytes)
    }
}
