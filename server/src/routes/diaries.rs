use crate::middleware::get_user_id;
use crate::models::{CreateDiaryRequest, DiaryListQuery, UpdateDiaryRequest};
use crate::services::DiaryService;
use actix_web::{web, HttpRequest, HttpResponse};
use chrono::NaiveDate;
use serde::Deserialize;

pub async fn list_diaries(
    req: HttpRequest,
    query: web::Query<DiaryListQuery>,
    diary_service: web::Data<DiaryService>,
) -> HttpResponse {
    let user_id = match get_user_id(&req) {
        Ok(id) => id,
        Err(e) => return HttpResponse::from_error(e),
    };

    let page = query.page.unwrap_or(1);
    let page_size = query.page_size.unwrap_or(20);
    let start_date = query.start_date;
    let end_date = query.end_date;

    match diary_service
        .list_diaries_paginated(&user_id, page, page_size, start_date, end_date)
        .await
    {
        Ok(diaries) => HttpResponse::Ok().json(diaries),
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

    let date_str = path.into_inner();
    let date = match NaiveDate::parse_from_str(&date_str, "%Y-%m-%d") {
        Ok(d) => d,
        Err(_) => {
            return HttpResponse::BadRequest().json(serde_json::json!({
                "error": "Invalid date format. Use YYYY-MM-DD"
            }))
        }
    };

    match diary_service.get_diary_with_memos(&user_id, date).await {
        Ok(Some(diary)) => HttpResponse::Ok().json(diary),
        Ok(None) => HttpResponse::Ok().json(serde_json::json!({
            "date": date_str,
            "summary": "",
            "mood_key": "",
            "mood_score": 0,
            "cover_image_id": null,
            "created_at": 0,
            "updated_at": 0,
            "memos": []
        })),
        Err(e) => HttpResponse::from_error(e),
    }
}

pub async fn create_or_update_diary(
    req: HttpRequest,
    path: web::Path<String>,
    payload: web::Json<CreateDiaryRequest>,
    diary_service: web::Data<DiaryService>,
) -> HttpResponse {
    let user_id = match get_user_id(&req) {
        Ok(id) => id,
        Err(e) => return HttpResponse::from_error(e),
    };

    let date_str = path.into_inner();
    let date = match NaiveDate::parse_from_str(&date_str, "%Y-%m-%d") {
        Ok(d) => d,
        Err(_) => {
            return HttpResponse::BadRequest().json(serde_json::json!({
                "error": "Invalid date format. Use YYYY-MM-DD"
            }))
        }
    };

    let mut req = payload.into_inner();
    req.date = date;

    match diary_service.create_diary(&user_id, req).await {
        Ok(diary) => HttpResponse::Ok().json(diary),
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

    let date_str = path.into_inner();
    let date = match NaiveDate::parse_from_str(&date_str, "%Y-%m-%d") {
        Ok(d) => d,
        Err(_) => {
            return HttpResponse::BadRequest().json(serde_json::json!({
                "error": "Invalid date format. Use YYYY-MM-DD"
            }))
        }
    };

    match diary_service
        .update_diary(&user_id, date, payload.into_inner())
        .await
    {
        Ok(diary) => HttpResponse::Ok().json(diary),
        Err(e) => HttpResponse::from_error(e),
    }
}

pub async fn update_diary_summary(
    req: HttpRequest,
    path: web::Path<String>,
    payload: web::Json<UpdateDiarySummaryRequest>,
    diary_service: web::Data<DiaryService>,
) -> HttpResponse {
    let user_id = match get_user_id(&req) {
        Ok(id) => id,
        Err(e) => return HttpResponse::from_error(e),
    };

    let date_str = path.into_inner();
    let date = match NaiveDate::parse_from_str(&date_str, "%Y-%m-%d") {
        Ok(d) => d,
        Err(_) => {
            return HttpResponse::BadRequest().json(serde_json::json!({
                "error": "Invalid date format. Use YYYY-MM-DD"
            }))
        }
    };

    match diary_service
        .update_diary_summary(&user_id, date, payload.summary.clone())
        .await
    {
        Ok(diary) => HttpResponse::Ok().json(diary),
        Err(e) => HttpResponse::from_error(e),
    }
}

pub async fn update_diary_mood(
    req: HttpRequest,
    path: web::Path<String>,
    payload: web::Json<UpdateDiaryMoodRequest>,
    diary_service: web::Data<DiaryService>,
) -> HttpResponse {
    let user_id = match get_user_id(&req) {
        Ok(id) => id,
        Err(e) => return HttpResponse::from_error(e),
    };

    let date_str = path.into_inner();
    let date = match NaiveDate::parse_from_str(&date_str, "%Y-%m-%d") {
        Ok(d) => d,
        Err(_) => {
            return HttpResponse::BadRequest().json(serde_json::json!({
                "error": "Invalid date format. Use YYYY-MM-DD"
            }))
        }
    };

    match diary_service
        .update_diary_mood(&user_id, date, payload.mood_key.clone(), payload.mood_score)
        .await
    {
        Ok(diary) => HttpResponse::Ok().json(diary),
        Err(e) => HttpResponse::from_error(e),
    }
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdateDiarySummaryRequest {
    pub summary: String,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdateDiaryMoodRequest {
    pub mood_key: String,
    pub mood_score: i32,
}

pub fn configure_diary_routes(cfg: &mut web::ServiceConfig) {
    cfg.service(web::resource("/diaries").route(web::get().to(list_diaries)))
        .service(
            web::resource("/diaries/{date}")
                .route(web::get().to(get_diary))
                .route(web::post().to(create_or_update_diary))
                .route(web::put().to(update_diary)),
        )
        .service(
            web::resource("/diaries/{date}/summary").route(web::put().to(update_diary_summary)),
        )
        .service(web::resource("/diaries/{date}/mood").route(web::put().to(update_diary_mood)));
}
