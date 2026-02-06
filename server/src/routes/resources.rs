use crate::middleware::get_user_id;
use crate::models::{ConfirmUploadRequest, CreateResourceRequest};
use crate::services::ResourceService;
use actix_multipart::Multipart;
use actix_web::{web, HttpRequest, HttpResponse};
use futures_util::StreamExt;

pub async fn upload_resource(
    req: HttpRequest,
    mut payload: Multipart,
    resource_service: web::Data<ResourceService>,
) -> HttpResponse {
    let user_id = match get_user_id(&req) {
        Ok(id) => id,
        Err(e) => return HttpResponse::from_error(e),
    };

    let mut memo_id: Option<uuid::Uuid> = None;
    let mut filename = String::new();
    let mut mime_type = String::from("image/jpeg");
    let mut file_data = web::BytesMut::new();

    while let Some(field_result) = payload.next().await {
        let mut field = match field_result {
            Ok(f) => f,
            Err(_) => return HttpResponse::BadRequest().finish(),
        };

        let field_name = field.name().unwrap_or("").to_string();

        if field_name == "file" {
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
                    Ok(bytes) => file_data.extend_from_slice(&bytes),
                    Err(_) => return HttpResponse::InternalServerError().finish(),
                }
            }
        } else if field_name == "memoId" {
            let mut value = String::new();
            while let Some(chunk_result) = field.next().await {
                match chunk_result {
                    Ok(bytes) => value.push_str(&String::from_utf8_lossy(&bytes)),
                    Err(_) => return HttpResponse::InternalServerError().finish(),
                }
            }
            if let Ok(id) = uuid::Uuid::parse_str(&value) {
                memo_id = Some(id);
            }
        }
    }

    if filename.is_empty() {
        filename = "unnamed".to_string();
    }

    let file_size = file_data.len() as i64;

    let create_req = CreateResourceRequest {
        memo_id,
        filename,
        mime_type,
        file_size,
    };

    match resource_service
        .upload_resource(&user_id, create_req, file_data.freeze())
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

#[derive(serde::Deserialize)]
pub struct ListResourcesQuery {
    pub page: Option<i64>,
    pub page_size: Option<i64>,
}

pub async fn list_resources(
    req: HttpRequest,
    query: web::Query<ListResourcesQuery>,
    resource_service: web::Data<ResourceService>,
) -> HttpResponse {
    let user_id = match get_user_id(&req) {
        Ok(id) => id,
        Err(e) => return HttpResponse::from_error(e),
    };

    let page = query.page.unwrap_or(1);
    let page_size = query.page_size.unwrap_or(100);

    match resource_service
        .list_resources(&user_id, page, page_size)
        .await
    {
        Ok((items, total)) => HttpResponse::Ok().json(serde_json::json!({
            "items": items,
            "total": total,
            "page": page,
            "page_size": page_size
        })),
        Err(e) => HttpResponse::from_error(e),
    }
}

pub fn configure_resource_routes(cfg: &mut web::ServiceConfig) {
    cfg.service(web::resource("/resources").route(web::get().to(list_resources)))
        .service(web::resource("/resources/upload").route(web::post().to(upload_resource)))
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
