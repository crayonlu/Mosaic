use crate::middleware::get_user_id;
use crate::models::{ChangePasswordRequest, LoginRequest};
use crate::services::AuthService;
use actix_web::{web, HttpRequest, HttpResponse};

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

pub fn configure_auth_routes(cfg: &mut web::ServiceConfig) {
    cfg.service(web::resource("/login").route(web::post().to(login)))
        .service(web::resource("/change-password").route(web::post().to(change_password)))
        .service(web::resource("/me").route(web::get().to(get_me)));
}
