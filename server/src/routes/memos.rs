use crate::admin::activity_log::ActivityLog;
use crate::middleware::get_user_id;
use crate::models::{CreateMemoRequest, MemoListQuery, UpdateMemoRequest};
use crate::services::{HybridSearchService, MemoService, MemoryEmbeddingService};
use actix_web::{web, HttpRequest, HttpResponse};
use serde::{Deserialize, Serialize};

/// Safely truncate a string to at most `max_chars` characters, respecting UTF-8 char boundaries.
fn truncate_str(s: &str, max_chars: usize) -> &str {
    match s.char_indices().nth(max_chars) {
        Some((idx, _)) => &s[..idx],
        None => s,
    }
}

pub async fn create_memo(
    req: HttpRequest,
    payload: web::Json<CreateMemoRequest>,
    memo_service: web::Data<MemoService>,
    activity_log: web::Data<ActivityLog>,
) -> HttpResponse {
    let user_id = match get_user_id(&req) {
        Ok(id) => id,
        Err(e) => return HttpResponse::from_error(e),
    };

    match memo_service
        .create_memo(&user_id, payload.into_inner())
        .await
    {
        Ok(memo) => {
            activity_log.record_info(
                "create_memo",
                "memo",
                Some(memo.id.to_string()),
                format!("创建了 Memo: {}...", truncate_str(&memo.content, 30)),
            );
            HttpResponse::Ok().json(memo)
        }
        Err(e) => HttpResponse::from_error(e),
    }
}

pub async fn get_memo(
    req: HttpRequest,
    path: web::Path<uuid::Uuid>,
    memo_service: web::Data<MemoService>,
) -> HttpResponse {
    let user_id = match get_user_id(&req) {
        Ok(id) => id,
        Err(e) => return HttpResponse::from_error(e),
    };

    match memo_service.get_memo(&user_id, path.into_inner()).await {
        Ok(memo) => HttpResponse::Ok().json(memo),
        Err(e) => HttpResponse::from_error(e),
    }
}

pub async fn list_memos(
    req: HttpRequest,
    query: web::Query<MemoListQuery>,
    memo_service: web::Data<MemoService>,
) -> HttpResponse {
    let user_id = match get_user_id(&req) {
        Ok(id) => id,
        Err(e) => return HttpResponse::from_error(e),
    };

    let page = query.page.unwrap_or(1);
    let page_size = query.page_size.unwrap_or(20);
    let archived = query.archived;
    let diary_date = query.diary_date;
    let search = query.search.clone();

    match memo_service
        .list_memos(&user_id, page, page_size, archived, diary_date, search)
        .await
    {
        Ok(memos) => HttpResponse::Ok().json(memos),
        Err(e) => HttpResponse::from_error(e),
    }
}

pub async fn update_memo(
    req: HttpRequest,
    path: web::Path<uuid::Uuid>,
    payload: web::Json<UpdateMemoRequest>,
    memo_service: web::Data<MemoService>,
    activity_log: web::Data<ActivityLog>,
) -> HttpResponse {
    let user_id = match get_user_id(&req) {
        Ok(id) => id,
        Err(e) => return HttpResponse::from_error(e),
    };

    let memo_id = path.into_inner();
    match memo_service
        .update_memo(&user_id, memo_id, payload.into_inner())
        .await
    {
        Ok(memo) => {
            activity_log.record_info(
                "update_memo",
                "memo",
                Some(memo.id.to_string()),
                "更新了 Memo".to_string(),
            );
            HttpResponse::Ok().json(memo)
        }
        Err(e) => HttpResponse::from_error(e),
    }
}

pub async fn delete_memo(
    req: HttpRequest,
    path: web::Path<uuid::Uuid>,
    memo_service: web::Data<MemoService>,
    activity_log: web::Data<ActivityLog>,
) -> HttpResponse {
    let user_id = match get_user_id(&req) {
        Ok(id) => id,
        Err(e) => return HttpResponse::from_error(e),
    };

    let memo_id = path.into_inner();
    match memo_service.delete_memo(&user_id, memo_id).await {
        Ok(()) => {
            activity_log.record_info(
                "delete_memo",
                "memo",
                Some(memo_id.to_string()),
                "删除了 Memo".to_string(),
            );
            HttpResponse::Ok().finish()
        }
        Err(e) => HttpResponse::from_error(e),
    }
}

pub async fn get_memos_by_date(
    req: HttpRequest,
    path: web::Path<String>,
    query: web::Query<MemoListQuery>,
    memo_service: web::Data<MemoService>,
) -> HttpResponse {
    let user_id = match get_user_id(&req) {
        Ok(id) => id,
        Err(e) => return HttpResponse::from_error(e),
    };

    let date = path.into_inner();
    let archived = query.archived;

    match memo_service
        .get_memos_by_created_date(&user_id, &date, archived)
        .await
    {
        Ok(memos) => HttpResponse::Ok().json(memos),
        Err(e) => HttpResponse::from_error(e),
    }
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ArchiveMemoRequest {
    diary_date: Option<String>,
}

pub async fn archive_memo(
    req: HttpRequest,
    path: web::Path<uuid::Uuid>,
    payload: web::Json<ArchiveMemoRequest>,
    memo_service: web::Data<MemoService>,
) -> HttpResponse {
    let user_id = match get_user_id(&req) {
        Ok(id) => id,
        Err(e) => return HttpResponse::from_error(e),
    };

    let diary_date = payload
        .diary_date
        .as_ref()
        .and_then(|d| chrono::NaiveDate::parse_from_str(d, "%Y-%m-%d").ok());

    match memo_service
        .archive_memo(&user_id, path.into_inner(), diary_date)
        .await
    {
        Ok(()) => HttpResponse::Ok().finish(),
        Err(e) => HttpResponse::from_error(e),
    }
}

pub async fn unarchive_memo(
    req: HttpRequest,
    path: web::Path<uuid::Uuid>,
    memo_service: web::Data<MemoService>,
) -> HttpResponse {
    let user_id = match get_user_id(&req) {
        Ok(id) => id,
        Err(e) => return HttpResponse::from_error(e),
    };

    match memo_service
        .unarchive_memo(&user_id, path.into_inner())
        .await
    {
        Ok(()) => HttpResponse::Ok().finish(),
        Err(e) => HttpResponse::from_error(e),
    }
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct SearchMemosResponse {
    memos: Vec<serde_json::Value>,
    total: i64,
    page: u32,
    page_size: u32,
    semantic_enabled: bool,
}

pub async fn search_memos(
    req: HttpRequest,
    query: web::Query<crate::models::SearchMemosRequest>,
    memo_service: web::Data<MemoService>,
    memory_embedding_service: web::Data<MemoryEmbeddingService>,
    hybrid_search_service: web::Data<HybridSearchService>,
) -> HttpResponse {
    let user_id = match get_user_id(&req) {
        Ok(id) => id,
        Err(e) => return HttpResponse::from_error(e),
    };

    let search_req = query.into_inner();
    let page = search_req.page.unwrap_or(1);
    let page_size = search_req.page_size.unwrap_or(50);
    let tags = if search_req.tags.is_empty() {
        None
    } else {
        Some(search_req.tags)
    };

    if search_req.query.is_empty() {
        match memo_service
            .search_memos(
                &user_id,
                &search_req.query,
                tags,
                search_req.start_date,
                search_req.end_date,
                search_req.is_archived,
                page,
                page_size,
            )
            .await
        {
            Ok(result) => {
                let memos = result
                    .items
                    .iter()
                    .filter_map(|m| serde_json::to_value(m).ok())
                    .collect();
                HttpResponse::Ok().json(SearchMemosResponse {
                    memos,
                    total: result.total,
                    page: result.page,
                    page_size: result.page_size,
                    semantic_enabled: false,
                })
            }
            Err(e) => HttpResponse::from_error(e),
        }
    } else {
        let user_uuid = match uuid::Uuid::parse_str(&user_id) {
            Ok(id) => id,
            Err(e) => return HttpResponse::from_error(crate::error::AppError::from(e)),
        };

        let embedding = memory_embedding_service
            .generate_embedding(&search_req.query, None)
            .await
            .ok()
            .filter(|emb| emb.iter().any(|&f| f != 0.0));

        if let Some(emb) = embedding {
            match hybrid_search_service
                .search(
                    user_uuid,
                    &search_req.query,
                    tags,
                    search_req.start_date,
                    search_req.end_date,
                    search_req.is_archived,
                    page as i64,
                    page_size as i64,
                    Some(emb),
                )
                .await
            {
                Ok((memos, total)) => HttpResponse::Ok().json(SearchMemosResponse {
                    memos,
                    total,
                    page,
                    page_size,
                    semantic_enabled: true,
                }),
                Err(e) => HttpResponse::from_error(e),
            }
        } else {
            match memo_service
                .search_memos(
                    &user_id,
                    &search_req.query,
                    tags,
                    search_req.start_date,
                    search_req.end_date,
                    search_req.is_archived,
                    page,
                    page_size,
                )
                .await
            {
                Ok(result) => {
                    let memos = result
                        .items
                        .iter()
                        .filter_map(|m| serde_json::to_value(m).ok())
                        .collect();
                    HttpResponse::Ok().json(SearchMemosResponse {
                        memos,
                        total: result.total,
                        page: result.page,
                        page_size: result.page_size,
                        semantic_enabled: false,
                    })
                }
                Err(e) => HttpResponse::from_error(e),
            }
        }
    }
}

pub async fn get_all_tags(req: HttpRequest, memo_service: web::Data<MemoService>) -> HttpResponse {
    let user_id = match get_user_id(&req) {
        Ok(id) => id,
        Err(e) => return HttpResponse::from_error(e),
    };

    match memo_service.get_all_tags(&user_id).await {
        Ok(tags) => HttpResponse::Ok().json(tags),
        Err(e) => HttpResponse::from_error(e),
    }
}

pub fn configure_memo_routes(cfg: &mut web::ServiceConfig) {
    cfg.service(
        web::resource("/memos")
            .route(web::post().to(create_memo))
            .route(web::get().to(list_memos)),
    )
    .service(web::resource("/memos/tags").route(web::get().to(get_all_tags)))
    .service(web::resource("/memos/search").route(web::get().to(search_memos)))
    .service(web::resource("/memos/date/{date}").route(web::get().to(get_memos_by_date)))
    .service(
        web::resource("/memos/{id}")
            .route(web::get().to(get_memo))
            .route(web::put().to(update_memo))
            .route(web::delete().to(delete_memo)),
    )
    .service(web::resource("/memos/{id}/archive").route(web::put().to(archive_memo)))
    .service(web::resource("/memos/{id}/unarchive").route(web::put().to(unarchive_memo)));
}
