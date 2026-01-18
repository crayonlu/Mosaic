use crate::middleware::get_user_id;
use crate::models::CreateResourceRequest;
use crate::services::ResourceService;
use actix_web::{web, HttpRequest, HttpResponse};
use futures_util::StreamExt;

pub async fn upload_resource(
    req: HttpRequest,
    mut payload: web::Payload,
    query: web::Query<std::collections::HashMap<String, String>>,
    resource_service: web::Data<ResourceService>,
) -> HttpResponse {
    let user_id = match get_user_id(&req) {
        Ok(id) => id,
        Err(e) => return HttpResponse::from_error(e),
    };

    let memo_id = match query.get("memo_id") {
        Some(id) => match uuid::Uuid::parse_str(id) {
            Ok(uuid) => uuid,
            Err(_) => return HttpResponse::BadRequest().json("Invalid memo_id"),
        },
        None => return HttpResponse::BadRequest().json("Missing memo_id"),
    };

    let filename = query.get("filename").unwrap_or(&String::new()).clone();
    let mime_type = query
        .get("mime_type")
        .unwrap_or(&"image/jpeg".to_string())
        .clone();

    let mut data = web::BytesMut::new();
    while let Some(chunk) = payload.next().await {
        #[allow(unused_variables)]
        match chunk {
            Ok(c) => data.extend_from_slice(&c),
            Err(e) => return HttpResponse::InternalServerError().finish(),
        }
    }

    let file_size = data.len() as i64;

    let create_req = CreateResourceRequest {
        memo_id,
        filename,
        mime_type,
        file_size,
    };

    match resource_service
        .upload_resource(&user_id, create_req, data.freeze())
        .await
    {
        Ok(resource) => HttpResponse::Ok().json(resource),
        Err(e) => HttpResponse::from_error(e),
    }
}

pub async fn get_resource(
    req: HttpRequest,
    path: web::Path<uuid::Uuid>,
    resource_service: web::Data<ResourceService>,
) -> HttpResponse {
    let user_id = match get_user_id(&req) {
        Ok(id) => id,
        Err(e) => return HttpResponse::from_error(e),
    };

    match resource_service
        .get_resource(&user_id, path.into_inner())
        .await
    {
        Ok(resource) => HttpResponse::Ok().json(resource),
        Err(e) => HttpResponse::from_error(e),
    }
}

pub async fn download_resource(
    req: HttpRequest,
    path: web::Path<uuid::Uuid>,
    resource_service: web::Data<ResourceService>,
) -> HttpResponse {
    let user_id = match get_user_id(&req) {
        Ok(id) => id,
        Err(e) => return HttpResponse::from_error(e),
    };

    match resource_service
        .download_resource(&user_id, path.into_inner())
        .await
    {
        Ok(data) => HttpResponse::Ok().body(data),
        Err(e) => HttpResponse::from_error(e),
    }
}

pub async fn delete_resource(
    req: HttpRequest,
    path: web::Path<uuid::Uuid>,
    resource_service: web::Data<ResourceService>,
) -> HttpResponse {
    let user_id = match get_user_id(&req) {
        Ok(id) => id,
        Err(e) => return HttpResponse::from_error(e),
    };

    match resource_service
        .delete_resource(&user_id, path.into_inner())
        .await
    {
        Ok(()) => HttpResponse::Ok().finish(),
        Err(e) => HttpResponse::from_error(e),
    }
}

pub fn configure_resource_routes(cfg: &mut web::ServiceConfig) {
    cfg.service(web::resource("/resources/upload").route(web::post().to(upload_resource)))
        .service(
            web::resource("/resources/{id}")
                .route(web::get().to(get_resource))
                .route(web::delete().to(delete_resource)),
        )
        .service(web::resource("/resources/{id}/download").route(web::get().to(download_resource)));
}
