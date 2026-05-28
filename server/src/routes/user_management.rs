use crate::admin::activity_log::ActivityLog;
use crate::middleware::get_user_id;
use crate::models::{CreateUserRequest, UpdateManagedUserRequest};
use crate::services::AuthService;
use actix_web::{web, HttpRequest, HttpResponse};

pub async fn create_user(
    req: HttpRequest,
    payload: web::Json<CreateUserRequest>,
    auth_service: web::Data<AuthService>,
    activity_log: web::Data<ActivityLog>,
) -> HttpResponse {
    let admin_id = match get_user_id(&req) {
        Ok(id) => id,
        Err(e) => return HttpResponse::from_error(e),
    };

    match auth_service.create_user(payload.into_inner()).await {
        Ok(user) => {
            activity_log.record_info(
                "create_user",
                "user",
                Some(user.id.to_string()),
                format!("Admin {} created user {}", admin_id, user.username),
            );
            HttpResponse::Created().json(user)
        }
        Err(e) => HttpResponse::from_error(e),
    }
}

pub async fn list_users(auth_service: web::Data<AuthService>) -> HttpResponse {
    match auth_service.list_users().await {
        Ok(users) => HttpResponse::Ok().json(users),
        Err(e) => HttpResponse::from_error(e),
    }
}

pub async fn update_user(
    req: HttpRequest,
    path: web::Path<String>,
    payload: web::Json<UpdateManagedUserRequest>,
    auth_service: web::Data<AuthService>,
    activity_log: web::Data<ActivityLog>,
) -> HttpResponse {
    let admin_id = match get_user_id(&req) {
        Ok(id) => id,
        Err(e) => return HttpResponse::from_error(e),
    };

    let target_user_id = path.into_inner();

    match auth_service
        .update_managed_user(&target_user_id, &admin_id, payload.into_inner())
        .await
    {
        Ok(user) => {
            activity_log.record_info(
                "update_user",
                "user",
                Some(user.id.to_string()),
                format!("Admin {} updated user {}", admin_id, user.username),
            );
            HttpResponse::Ok().json(user)
        }
        Err(e) => HttpResponse::from_error(e),
    }
}
