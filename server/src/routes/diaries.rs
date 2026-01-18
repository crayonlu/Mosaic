use crate::middleware::get_user_id;
use crate::models::{CreateDiaryRequest, UpdateDiaryRequest};
use crate::services::DiaryService;
use actix_web::{web, HttpRequest, HttpResponse};
use chrono::NaiveDate;

pub async fn create_diary(
    req: HttpRequest,
    payload: web::Json<CreateDiaryRequest>,
    diary_service: web::Data<DiaryService>,
) -> HttpResponse {
    let user_id = match get_user_id(&req) {
        Ok(id) => id,
        Err(e) => return HttpResponse::from_error(e),
    };

    match diary_service
        .create_diary(&user_id, payload.into_inner())
        .await
    {
        Ok(diary) => HttpResponse::Ok().json(diary),
        Err(e) => HttpResponse::from_error(e),
    }
}

pub async fn get_diary(
    req: HttpRequest,
    path: web::Path<String>,
    diary_service: web::Data<DiaryService>,
) -> HttpResponse {
    let user_id = match get_user_id(&req) {
        Ok(id) => id,
        Err(e) => return HttpResponse::from_error(e),
    };

    let date = match NaiveDate::parse_from_str(&path.into_inner(), "%Y-%m-%d") {
        Ok(d) => d,
        Err(_) => return HttpResponse::BadRequest().json("Invalid date format"),
    };

    match diary_service.get_diary(&user_id, date).await {
        Ok(diary) => HttpResponse::Ok().json(diary),
        Err(e) => HttpResponse::from_error(e),
    }
}

pub async fn list_diaries(
    req: HttpRequest,
    diary_service: web::Data<DiaryService>,
) -> HttpResponse {
    let user_id = match get_user_id(&req) {
        Ok(id) => id,
        Err(e) => return HttpResponse::from_error(e),
    };

    match diary_service.list_diaries(&user_id).await {
        Ok(diaries) => HttpResponse::Ok().json(diaries),
        Err(e) => HttpResponse::from_error(e),
    }
}

pub async fn update_diary(
    req: HttpRequest,
    path: web::Path<String>,
    payload: web::Json<UpdateDiaryRequest>,
    diary_service: web::Data<DiaryService>,
) -> HttpResponse {
    let user_id = match get_user_id(&req) {
        Ok(id) => id,
        Err(e) => return HttpResponse::from_error(e),
    };

    let date = match NaiveDate::parse_from_str(&path.into_inner(), "%Y-%m-%d") {
        Ok(d) => d,
        Err(_) => return HttpResponse::BadRequest().json("Invalid date format"),
    };

    match diary_service
        .update_diary(&user_id, date, payload.into_inner())
        .await
    {
        Ok(diary) => HttpResponse::Ok().json(diary),
        Err(e) => HttpResponse::from_error(e),
    }
}

pub fn configure_diary_routes(cfg: &mut web::ServiceConfig) {
    cfg.service(
        web::resource("/diaries")
            .route(web::post().to(create_diary))
            .route(web::get().to(list_diaries)),
    )
    .service(
        web::resource("/diaries/{date}")
            .route(web::get().to(get_diary))
            .route(web::put().to(update_diary)),
    );
}
