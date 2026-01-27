use crate::middleware::get_user_id;
use crate::models::{ConfirmUploadRequest, CreateResourceRequest};
use crate::services::ResourceService;
use actix_web::{web, HttpRequest, HttpResponse};
use actix_multipart::Multipart;
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

pub async fn create_presigned_upload(
    req: HttpRequest,
    body: web::Json<CreateResourceRequest>,
    resource_service: web::Data<ResourceService>,
) -> HttpResponse {
    let user_id = match get_user_id(&req) {
        Ok(id) => id,
        Err(e) => return HttpResponse::from_error(e),
    };

    match resource_service
        .create_presigned_upload(&user_id, body.into_inner())
        .await
    {
        Ok(response) => HttpResponse::Ok().json(response),
        Err(e) => HttpResponse::from_error(e),
    }
}

pub async fn confirm_upload(
    req: HttpRequest,
    body: web::Json<ConfirmUploadRequest>,
    resource_service: web::Data<ResourceService>,
) -> HttpResponse {
    let user_id = match get_user_id(&req) {
        Ok(id) => id,
        Err(e) => return HttpResponse::from_error(e),
    };

    match resource_service
        .confirm_upload(&user_id, body.into_inner())
        .await
    {
        Ok(resource) => HttpResponse::Ok().json(resource),
        Err(e) => HttpResponse::from_error(e),
    }
}

pub async fn upload_avatar(
    req: HttpRequest,
    mut payload: Multipart,
    resource_service: web::Data<ResourceService>,
    auth_service: web::Data<crate::services::AuthService>,
) -> HttpResponse {
    let user_id = match get_user_id(&req) {
        Ok(id) => id,
        Err(e) => return HttpResponse::from_error(e),
    };

    let mut filename = String::new();
    let mut mime_type = String::from("image/jpeg");
    let mut data = web::BytesMut::new();

    while let Some(field_result) = payload.next().await {
        let mut field = match field_result {
            Ok(f) => f,
            Err(_) => return HttpResponse::BadRequest().finish(),
        };

        if let Some(content_disposition) = field.content_disposition() {
            if let Some(name) = content_disposition.get_filename() {
                filename = name.to_string();
            }
        }

        if let Some(content_type) = field.content_type() {
            mime_type = content_type.to_string();
        }

        while let Some(chunk_result) = field.next().await {
            match chunk_result {
                Ok(bytes) => data.extend_from_slice(&bytes),
                Err(_) => return HttpResponse::InternalServerError().finish(),
            }
        }
    }

    match resource_service
        .upload_avatar(&user_id, filename, data.freeze(), mime_type)
        .await
    {
        Ok(_avatar_url) => match auth_service.get_current_user(&user_id).await {
            Ok(user) => HttpResponse::Ok().json(user),
            Err(e) => HttpResponse::from_error(e),
        },
        Err(e) => HttpResponse::from_error(e),
    }
}

pub async fn download_avatar(
    path: web::Path<uuid::Uuid>,
    resource_service: web::Data<ResourceService>,
) -> HttpResponse {
    let avatar_id = path.into_inner();
    
    match resource_service.download_avatar(avatar_id).await {
        Ok(data) => HttpResponse::Ok().body(data),
        Err(_) => HttpResponse::NotFound().finish(),
    }
}

pub fn configure_resource_routes(cfg: &mut web::ServiceConfig) {
    cfg.service(web::resource("/resources/upload").route(web::post().to(upload_resource)))
        .service(
            web::resource("/resources/presigned-upload")
                .route(web::post().to(create_presigned_upload)),
        )
        .service(web::resource("/resources/confirm-upload").route(web::post().to(confirm_upload)))
        .service(web::resource("/resources/upload-avatar").route(web::post().to(upload_avatar)))
        .service(
            web::resource("/resources/{id}")
                .route(web::get().to(get_resource))
                .route(web::delete().to(delete_resource)),
        )
        .service(web::resource("/resources/{id}/download").route(web::get().to(download_resource)))
        .service(web::resource("/avatars/{id}").route(web::get().to(download_avatar)));
}
