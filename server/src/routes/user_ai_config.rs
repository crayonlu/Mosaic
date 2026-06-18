use crate::middleware::get_user_id;
use crate::models::user_ai_config::{UpsertUserAiConfigRequest, UserAiConfigResponse};
use crate::services::UserAiConfigService;
use actix_web::{web, HttpRequest, HttpResponse};
use uuid::Uuid;

pub async fn get_ai_config(
    req: HttpRequest,
    service: web::Data<UserAiConfigService>,
) -> HttpResponse {
    let user_id = match get_user_id(&req) {
        Ok(id) => id,
        Err(e) => return HttpResponse::from_error(e),
    };

    let uuid = match Uuid::parse_str(&user_id) {
        Ok(u) => u,
        Err(_) => {
            return HttpResponse::BadRequest().json(serde_json::json!({"error": "Invalid user ID"}))
        }
    };

    match service.get(&uuid).await {
        Ok(Some(config)) => HttpResponse::Ok().json(UserAiConfigResponse::from(config)),
        Ok(None) => HttpResponse::NotFound().json(serde_json::json!({
            "error": "Not Found",
            "message": "AI configuration not set"
        })),
        Err(e) => HttpResponse::from_error(e),
    }
}

pub async fn upsert_ai_config(
    req: HttpRequest,
    payload: web::Json<UpsertUserAiConfigRequest>,
    service: web::Data<UserAiConfigService>,
) -> HttpResponse {
    let user_id = match get_user_id(&req) {
        Ok(id) => id,
        Err(e) => return HttpResponse::from_error(e),
    };

    let uuid = match Uuid::parse_str(&user_id) {
        Ok(u) => u,
        Err(_) => {
            return HttpResponse::BadRequest().json(serde_json::json!({"error": "Invalid user ID"}))
        }
    };

    match service.upsert(&uuid, payload.into_inner()).await {
        Ok(config) => HttpResponse::Ok().json(UserAiConfigResponse::from(config)),
        Err(e) => HttpResponse::from_error(e),
    }
}

pub async fn delete_ai_config(
    req: HttpRequest,
    service: web::Data<UserAiConfigService>,
) -> HttpResponse {
    let user_id = match get_user_id(&req) {
        Ok(id) => id,
        Err(e) => return HttpResponse::from_error(e),
    };

    let uuid = match Uuid::parse_str(&user_id) {
        Ok(u) => u,
        Err(_) => {
            return HttpResponse::BadRequest().json(serde_json::json!({"error": "Invalid user ID"}))
        }
    };

    match service.delete(&uuid).await {
        Ok(()) => HttpResponse::NoContent().finish(),
        Err(e) => HttpResponse::from_error(e),
    }
}
