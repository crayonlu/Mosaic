use crate::middleware::get_user_id;
use crate::models::{CreateMemoRequest, MemoListQuery, UpdateMemoRequest};
use crate::services::MemoService;
use actix_web::{web, HttpRequest, HttpResponse};

pub async fn create_memo(
    req: HttpRequest,
    payload: web::Json<CreateMemoRequest>,
    memo_service: web::Data<MemoService>,
) -> HttpResponse {
    let user_id = match get_user_id(&req) {
        Ok(id) => id,
        Err(e) => return HttpResponse::from_error(e),
    };

    match memo_service
        .create_memo(&user_id, payload.into_inner())
        .await
    {
        Ok(memo) => HttpResponse::Ok().json(memo),
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

    match memo_service
        .list_memos(&user_id, page, page_size, archived, diary_date)
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
) -> HttpResponse {
    let user_id = match get_user_id(&req) {
        Ok(id) => id,
        Err(e) => return HttpResponse::from_error(e),
    };

    match memo_service
        .update_memo(&user_id, path.into_inner(), payload.into_inner())
        .await
    {
        Ok(memo) => HttpResponse::Ok().json(memo),
        Err(e) => HttpResponse::from_error(e),
    }
}

pub async fn delete_memo(
    req: HttpRequest,
    path: web::Path<uuid::Uuid>,
    memo_service: web::Data<MemoService>,
) -> HttpResponse {
    let user_id = match get_user_id(&req) {
        Ok(id) => id,
        Err(e) => return HttpResponse::from_error(e),
    };

    match memo_service.delete_memo(&user_id, path.into_inner()).await {
        Ok(()) => HttpResponse::Ok().finish(),
        Err(e) => HttpResponse::from_error(e),
    }
}

pub async fn archive_memo(
    req: HttpRequest,
    path: web::Path<uuid::Uuid>,
    memo_service: web::Data<MemoService>,
) -> HttpResponse {
    let user_id = match get_user_id(&req) {
        Ok(id) => id,
        Err(e) => return HttpResponse::from_error(e),
    };

    match memo_service.archive_memo(&user_id, path.into_inner()).await {
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

pub async fn search_memos(
    req: HttpRequest,
    query: web::Query<std::collections::HashMap<String, String>>,
    memo_service: web::Data<MemoService>,
) -> HttpResponse {
    let user_id = match get_user_id(&req) {
        Ok(id) => id,
        Err(e) => return HttpResponse::from_error(e),
    };

    let search_query = query.get("q").unwrap_or(&String::new()).clone();

    match memo_service.search_memos(&user_id, &search_query).await {
        Ok(memos) => HttpResponse::Ok().json(memos),
        Err(e) => HttpResponse::from_error(e),
    }
}

pub fn configure_memo_routes(cfg: &mut web::ServiceConfig) {
    cfg.service(
        web::resource("/memos")
            .route(web::post().to(create_memo))
            .route(web::get().to(list_memos)),
    )
    .service(
        web::resource("/memos/{id}")
            .route(web::get().to(get_memo))
            .route(web::put().to(update_memo))
            .route(web::delete().to(delete_memo)),
    )
    .service(web::resource("/memos/{id}/archive").route(web::put().to(archive_memo)))
    .service(web::resource("/memos/{id}/unarchive").route(web::put().to(unarchive_memo)))
    .service(web::resource("/memos/search").route(web::get().to(search_memos)));
}
