use crate::middleware::get_user_id;
use crate::services::StatsService;
use actix_web::{web, HttpRequest, HttpResponse};
use uuid::Uuid;

pub async fn get_heatmap(
    req: HttpRequest,
    query: web::Query<StatsQuery>,
    stats_service: web::Data<StatsService>,
) -> HttpResponse {
    let user_uuid = match get_user_id(&req) {
        Ok(id) => match Uuid::parse_str(&id) {
            Ok(uuid) => uuid,
            Err(_) => return HttpResponse::BadRequest().json("Invalid user ID format"),
        },
        Err(e) => return HttpResponse::from_error(e),
    };

    let start_date = match chrono::NaiveDate::parse_from_str(&query.start_date, "%Y-%m-%d") {
        Ok(date) => date,
        Err(_) => {
            return HttpResponse::BadRequest()
                .json("Invalid startDate format, expected YYYY-MM-DD")
        }
    };

    let end_date = match chrono::NaiveDate::parse_from_str(&query.end_date, "%Y-%m-%d") {
        Ok(date) => date,
        Err(_) => {
            return HttpResponse::BadRequest().json("Invalid endDate format, expected YYYY-MM-DD")
        }
    };

    match stats_service
        .get_heatmap(&user_uuid, start_date, end_date)
        .await
    {
        Ok(data) => HttpResponse::Ok().json(data),
        Err(e) => HttpResponse::from_error(e),
    }
}

pub async fn get_timeline(
    req: HttpRequest,
    query: web::Query<StatsQuery>,
    stats_service: web::Data<StatsService>,
) -> HttpResponse {
    let user_uuid = match get_user_id(&req) {
        Ok(id) => match Uuid::parse_str(&id) {
            Ok(uuid) => uuid,
            Err(_) => return HttpResponse::BadRequest().json("Invalid user ID format"),
        },
        Err(e) => return HttpResponse::from_error(e),
    };

    let start_date = match chrono::NaiveDate::parse_from_str(&query.start_date, "%Y-%m-%d") {
        Ok(date) => date,
        Err(_) => {
            return HttpResponse::BadRequest()
                .json("Invalid startDate format, expected YYYY-MM-DD")
        }
    };

    let end_date = match chrono::NaiveDate::parse_from_str(&query.end_date, "%Y-%m-%d") {
        Ok(date) => date,
        Err(_) => {
            return HttpResponse::BadRequest().json("Invalid endDate format, expected YYYY-MM-DD")
        }
    };

    match stats_service
        .get_timeline(&user_uuid, start_date, end_date)
        .await
    {
        Ok(data) => HttpResponse::Ok().json(data),
        Err(e) => HttpResponse::from_error(e),
    }
}

pub async fn get_trends(
    req: HttpRequest,
    query: web::Query<StatsQuery>,
    stats_service: web::Data<StatsService>,
) -> HttpResponse {
    let user_uuid = match get_user_id(&req) {
        Ok(id) => match Uuid::parse_str(&id) {
            Ok(uuid) => uuid,
            Err(_) => return HttpResponse::BadRequest().json("Invalid user ID format"),
        },
        Err(e) => return HttpResponse::from_error(e),
    };

    let start_date = match chrono::NaiveDate::parse_from_str(&query.start_date, "%Y-%m-%d") {
        Ok(date) => date,
        Err(_) => {
            return HttpResponse::BadRequest()
                .json("Invalid startDate format, expected YYYY-MM-DD")
        }
    };

    let end_date = match chrono::NaiveDate::parse_from_str(&query.end_date, "%Y-%m-%d") {
        Ok(date) => date,
        Err(_) => {
            return HttpResponse::BadRequest().json("Invalid endDate format, expected YYYY-MM-DD")
        }
    };

    match stats_service
        .get_trends(&user_uuid, start_date, end_date)
        .await
    {
        Ok(data) => HttpResponse::Ok().json(data),
        Err(e) => HttpResponse::from_error(e),
    }
}

pub async fn get_summary(
    req: HttpRequest,
    query: web::Query<SummaryQuery>,
    stats_service: web::Data<StatsService>,
) -> HttpResponse {
    let user_uuid = match get_user_id(&req) {
        Ok(id) => match Uuid::parse_str(&id) {
            Ok(uuid) => uuid,
            Err(_) => return HttpResponse::BadRequest().json("Invalid user ID format"),
        },
        Err(e) => return HttpResponse::from_error(e),
    };

    match stats_service
        .get_summary(&user_uuid, query.year, query.month)
        .await
    {
        Ok(data) => HttpResponse::Ok().json(data),
        Err(e) => HttpResponse::from_error(e),
    }
}

#[derive(serde::Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct StatsQuery {
    pub start_date: String,
    pub end_date: String,
}

#[derive(serde::Deserialize)]
pub struct SummaryQuery {
    pub year: i32,
    pub month: i32,
}

pub fn configure_stats_routes(cfg: &mut web::ServiceConfig) {
    cfg.service(web::resource("/stats/heatmap").route(web::get().to(get_heatmap)))
        .service(web::resource("/stats/timeline").route(web::get().to(get_timeline)))
        .service(web::resource("/stats/trends").route(web::get().to(get_trends)))
        .service(web::resource("/stats/summary").route(web::get().to(get_summary)));
}
