use crate::middleware::get_user_id;
use crate::models::{ChangePasswordRequest, LoginRequest, RefreshTokenRequest};
use crate::services::AuthService;
use actix_web::{web, HttpRequest, HttpResponse};
use serde::Deserialize;

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdateUserRequest {
    pub username: Option<String>,
    pub avatar_url: Option<String>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdateAvatarRequest {
    pub avatar_url: String,
}

pub async fn login(
    req: web::Json<LoginRequest>,
    auth_service: web::Data<AuthService>,
) -> HttpResponse {
    match auth_service.login(req.into_inner()).await {
        Ok(response) => HttpResponse::Ok().json(response),
        Err(e) => HttpResponse::from_error(e),
    }
}

pub async fn change_password(
    req: HttpRequest,
    payload: web::Json<ChangePasswordRequest>,
    auth_service: web::Data<AuthService>,
) -> HttpResponse {
    let user_id = match get_user_id(&req) {
        Ok(id) => id,
        Err(e) => return HttpResponse::from_error(e),
    };

    match auth_service
        .change_password(&user_id, payload.into_inner())
        .await
    {
        Ok(()) => HttpResponse::Ok().finish(),
        Err(e) => HttpResponse::from_error(e),
    }
}

pub async fn update_avatar(
    req: HttpRequest,
    payload: web::Json<UpdateAvatarRequest>,
    auth_service: web::Data<AuthService>,
) -> HttpResponse {
    let user_id = match get_user_id(&req) {
        Ok(id) => id,
        Err(e) => return HttpResponse::from_error(e),
    };

    match auth_service
        .update_avatar(&user_id, payload.into_inner().avatar_url)
        .await
    {
        Ok(user) => HttpResponse::Ok().json(user),
        Err(e) => HttpResponse::from_error(e),
    }
}

pub async fn get_me(req: HttpRequest, auth_service: web::Data<AuthService>) -> HttpResponse {
    let user_id = match get_user_id(&req) {
        Ok(id) => id,
        Err(e) => return HttpResponse::from_error(e),
    };

    match auth_service.get_current_user(&user_id).await {
        Ok(user) => HttpResponse::Ok().json(user),
        Err(e) => HttpResponse::from_error(e),
    }
}

pub async fn refresh_token(
    _req: HttpRequest,
    payload: web::Json<RefreshTokenRequest>,
    auth_service: web::Data<AuthService>,
) -> HttpResponse {
    match auth_service
        .refresh_token(payload.into_inner().refresh_token)
        .await
    {
        Ok(response) => HttpResponse::Ok().json(response),
        Err(e) => HttpResponse::from_error(e),
    }
}

pub async fn update_user(
    req: HttpRequest,
    payload: web::Json<UpdateUserRequest>,
    auth_service: web::Data<AuthService>,
) -> HttpResponse {
    let user_id = match get_user_id(&req) {
        Ok(id) => id,
        Err(e) => return HttpResponse::from_error(e),
    };

    let payload_inner = payload.into_inner();

    match auth_service
        .update_user(&user_id, payload_inner.username, payload_inner.avatar_url)
        .await
    {
        Ok(user) => HttpResponse::Ok().json(user),
        Err(e) => HttpResponse::from_error(e),
    }
}

pub fn configure_auth_routes(cfg: &mut web::ServiceConfig) {
    cfg.service(web::resource("/login").route(web::post().to(login)))
        .service(web::resource("/refresh").route(web::post().to(refresh_token)))
        .service(web::resource("/me").route(web::get().to(get_me)))
        .service(web::resource("/change-password").route(web::post().to(change_password)))
        .service(web::resource("/update-user").route(web::put().to(update_user)))
        .service(web::resource("/update-avatar").route(web::post().to(update_avatar)));
}
