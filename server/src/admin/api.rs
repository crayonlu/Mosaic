use crate::config::Config;
use crate::models::{Memo, ServerAiConfigPayload, ServerAiConfigResponse};
use crate::services::{AppSettingsService, MemoryEmbeddingService, ServerAiConfigService};
use actix_web::{web, HttpRequest, HttpResponse};
use chrono::{Datelike, NaiveDate, TimeZone};
use chrono_tz::Tz;
use serde::{Deserialize, Serialize};
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
struct AdminAiConfigResponse {
    bot: ServerAiConfigResponse,
    embedding: ServerAiConfigResponse,
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

pub async fn stats(
    pool: web::Data<PgPool>,
    _req: HttpRequest,
    app_settings_service: web::Data<AppSettingsService>,
) -> HttpResponse {
    let tz: Tz = app_settings_service.get_tz().await;
    let now = chrono::Utc::now().with_timezone(&tz);
    let month_start = NaiveDate::from_ymd_opt(now.year(), now.month(), 1).unwrap();
    let month_start_ts = tz
        .with_ymd_and_hms(
            month_start.year(),
            month_start.month(),
            month_start.day(),
            0,
            0,
            0,
        )
        .single()
        .map(|dt| dt.timestamp_millis())
        .unwrap_or(0);
    let (next_year, next_month) = if now.month() == 12 {
        (now.year() + 1, 1u32)
    } else {
        (now.year(), now.month() + 1)
    };
    let month_end_ts = tz
        .with_ymd_and_hms(next_year, next_month, 1, 0, 0, 0)
        .single()
        .map(|dt| dt.timestamp_millis())
        .unwrap_or(i64::MAX);
    let tz_name = format!("{}", tz);

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
          (SELECT COUNT(*) FROM memos WHERE is_deleted = FALSE AND created_at >= $1 AND created_at < $2) AS memos_month,
          (SELECT COUNT(*) FROM diaries WHERE is_deleted = FALSE) AS diaries_total,
          (SELECT COUNT(*) FROM diaries WHERE is_deleted = FALSE AND created_at >= $1 AND created_at < $2) AS diaries_month,
          (SELECT COUNT(*) FROM resources WHERE is_deleted = FALSE) AS resources_total,
          (SELECT COALESCE(SUM(file_size), 0)::BIGINT FROM resources WHERE is_deleted = FALSE) AS resources_size,
          (SELECT COUNT(*) FROM bots WHERE is_deleted = FALSE) AS bots_total,
          (SELECT COUNT(*) FROM bots WHERE is_deleted = FALSE AND auto_reply = TRUE) AS bots_auto,
          (SELECT COUNT(*) FROM bot_replies) AS replies_total,
          (SELECT COUNT(DISTINCT (to_timestamp(created_at / 1000) AT TIME ZONE $3)::date) FROM memos WHERE is_deleted = FALSE AND created_at >= $1 AND created_at < $2) AS active_days
        "#,
    )
    .bind(month_start_ts)
    .bind(month_end_ts)
    .bind(&tz_name)
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

pub async fn get_ai_config(
    server_ai_config_service: web::Data<ServerAiConfigService>,
) -> HttpResponse {
    let bot = match server_ai_config_service.get("bot").await {
        Ok(config) => ServerAiConfigResponse::from_config(config),
        Err(e) => return HttpResponse::from_error(e),
    };
    let embedding = match server_ai_config_service.get("embedding").await {
        Ok(config) => ServerAiConfigResponse::from_config(config),
        Err(e) => return HttpResponse::from_error(e),
    };
    HttpResponse::Ok().json(AdminAiConfigResponse { bot, embedding })
}

pub async fn update_ai_config(
    path: web::Path<String>,
    payload: web::Json<ServerAiConfigPayload>,
    server_ai_config_service: web::Data<ServerAiConfigService>,
) -> HttpResponse {
    let key = path.into_inner();
    if key != "bot" && key != "embedding" {
        return HttpResponse::BadRequest().json(serde_json::json!({
            "error": "Bad Request",
            "message": "Unsupported AI config key"
        }));
    }

    match server_ai_config_service
        .upsert(&key, payload.into_inner())
        .await
    {
        Ok(config) => HttpResponse::Ok().json(ServerAiConfigResponse::from_config(config)),
        Err(e) => HttpResponse::from_error(e),
    }
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

pub async fn backfill_memory(
    pool: web::Data<PgPool>,
    embedding_service: web::Data<MemoryEmbeddingService>,
    activity_log: web::Data<ActivityLog>,
) -> HttpResponse {
    let pool_ref = pool.get_ref().clone();
    let embedding = embedding_service.get_ref().clone();
    let log_clone = activity_log.clone();

    activity_log.record_info(
        "backfill_memory_started",
        "system",
        None,
        "Memory backfill started".to_string(),
    );

    tokio::spawn(async move {
        log::info!("[Backfill] Starting memory backfill");

        const BATCH_SIZE: i64 = 200;
        let mut offset: i64 = 0;
        let mut success = 0u64;
        let mut failed = 0u64;
        let mut user_ids = std::collections::HashSet::new();

        loop {
            let batch = match sqlx::query_as::<_, Memo>(
                "SELECT m.id, m.user_id, m.content, m.tags, m.is_archived, m.is_deleted,
                        m.diary_date, m.ai_summary, m.created_at, m.updated_at
                 FROM memos m
                 LEFT JOIN memo_embeddings me ON me.memo_id = m.id
                 WHERE m.is_deleted = false AND me.memo_id IS NULL
                 ORDER BY m.created_at ASC
                 LIMIT $1 OFFSET $2",
            )
            .bind(BATCH_SIZE)
            .bind(offset)
            .fetch_all(&pool_ref)
            .await
            {
                Ok(b) => b,
                Err(e) => {
                    log::error!(
                        "[Backfill] Failed to fetch batch at offset {}: {}",
                        offset,
                        e
                    );
                    break;
                }
            };

            if batch.is_empty() {
                break;
            }

            let batch_len = batch.len();
            for memo in &batch {
                user_ids.insert(memo.user_id);
                if let Err(e) = embedding.refresh_for_memo(memo).await {
                    log::error!("[Backfill] Embedding failed for {}: {}", memo.id, e);
                    failed += 1;
                    continue;
                }
                success += 1;
            }

            log::info!(
                "[Backfill] Batch done: offset={}, batch_size={}, total_success={}",
                offset,
                batch_len,
                success
            );
            offset += BATCH_SIZE;
        }

        log::info!(
            "[Backfill] Complete: {} success, {} failed, {} users refreshed",
            success,
            failed,
            user_ids.len()
        );
        log_clone.record_info(
            "backfill_memory_completed",
            "system",
            None,
            format!(
                "Memory backfill complete: {} indexed, {} failed, {} users",
                success,
                failed,
                user_ids.len()
            ),
        );
    });

    HttpResponse::Ok().json(serde_json::json!({
        "message": "Backfill started in background. Check server logs for progress."
    }))
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AppSettingsPayload {
    pub auto_tag_enabled: bool,
    pub auto_summary_enabled: bool,
    pub auto_diary_enabled: bool,
    pub auto_diary_min_memos: i32,
    pub auto_diary_min_chars: i32,
    pub app_timezone: String,
}

pub async fn get_settings(app_settings_service: web::Data<AppSettingsService>) -> HttpResponse {
    let auto_tag = app_settings_service
        .get_bool("auto_tag_enabled", true)
        .await;
    let auto_summary = app_settings_service
        .get_bool("auto_summary_enabled", false)
        .await;
    let auto_diary = app_settings_service
        .get_bool("auto_diary_enabled", true)
        .await;
    let auto_diary_min_memos = app_settings_service
        .get_i32("auto_diary_min_memos", 2)
        .await;
    let auto_diary_min_chars = app_settings_service
        .get_i32("auto_diary_min_chars", 150)
        .await;
    let app_timezone = app_settings_service
        .get_str("app_timezone", "Asia/Shanghai")
        .await;
    HttpResponse::Ok().json(AppSettingsPayload {
        auto_tag_enabled: auto_tag,
        auto_summary_enabled: auto_summary,
        auto_diary_enabled: auto_diary,
        auto_diary_min_memos,
        auto_diary_min_chars,
        app_timezone,
    })
}

pub async fn update_settings(
    payload: web::Json<AppSettingsPayload>,
    app_settings_service: web::Data<AppSettingsService>,
) -> HttpResponse {
    let auto_tag_val = if payload.auto_tag_enabled {
        "true"
    } else {
        "false"
    };
    let auto_summary_val = if payload.auto_summary_enabled {
        "true"
    } else {
        "false"
    };
    let auto_diary_val = if payload.auto_diary_enabled {
        "true"
    } else {
        "false"
    };

    if payload.auto_diary_min_memos < 1 || payload.auto_diary_min_chars < 1 {
        return HttpResponse::BadRequest().json(serde_json::json!({
            "error": "auto diary thresholds must be positive"
        }));
    }
    if payload.app_timezone.parse::<Tz>().is_err() {
        return HttpResponse::BadRequest().json(serde_json::json!({
            "error": "invalid timezone: must be a valid IANA timezone name"
        }));
    }

    if let Err(e) = app_settings_service
        .set("auto_tag_enabled", auto_tag_val)
        .await
    {
        return HttpResponse::InternalServerError()
            .json(serde_json::json!({ "error": e.to_string() }));
    }
    if let Err(e) = app_settings_service
        .set("auto_summary_enabled", auto_summary_val)
        .await
    {
        return HttpResponse::InternalServerError()
            .json(serde_json::json!({ "error": e.to_string() }));
    }
    if let Err(e) = app_settings_service
        .set("auto_diary_enabled", auto_diary_val)
        .await
    {
        return HttpResponse::InternalServerError()
            .json(serde_json::json!({ "error": e.to_string() }));
    }
    if let Err(e) = app_settings_service
        .set(
            "auto_diary_min_memos",
            &payload.auto_diary_min_memos.to_string(),
        )
        .await
    {
        return HttpResponse::InternalServerError()
            .json(serde_json::json!({ "error": e.to_string() }));
    }
    if let Err(e) = app_settings_service
        .set(
            "auto_diary_min_chars",
            &payload.auto_diary_min_chars.to_string(),
        )
        .await
    {
        return HttpResponse::InternalServerError()
            .json(serde_json::json!({ "error": e.to_string() }));
    }
    if let Err(e) = app_settings_service
        .set("app_timezone", &payload.app_timezone)
        .await
    {
        return HttpResponse::InternalServerError()
            .json(serde_json::json!({ "error": e.to_string() }));
    }

    HttpResponse::Ok().json(payload.into_inner())
}
