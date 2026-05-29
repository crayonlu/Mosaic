use crate::admin::activity_log::ActivityLog;
use crate::middleware::get_user_id;
use crate::models::{CreateUserRequest, PaginatedUsersResponse, UpdateManagedUserRequest};
use crate::services::AuthService;
use actix_web::{web, HttpRequest, HttpResponse};
use serde::Deserialize;

#[derive(Debug, Deserialize)]
pub struct ListUsersQuery {
    #[serde(default = "default_page")]
    pub page: i64,
    #[serde(default = "default_page_size")]
    pub page_size: i64,
}

fn default_page() -> i64 {
    1
}
fn default_page_size() -> i64 {
    50
}

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

pub async fn list_users(
    query: web::Query<ListUsersQuery>,
    auth_service: web::Data<AuthService>,
) -> HttpResponse {
    match auth_service.list_users(query.page, query.page_size).await {
        Ok((users, total)) => HttpResponse::Ok().json(PaginatedUsersResponse {
            page: query.page,
            page_size: query.page_size,
            total,
            users,
        }),
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
