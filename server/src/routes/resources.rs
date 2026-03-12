use crate::middleware::get_user_id;
use crate::models::{ConfirmUploadRequest, CreateResourceRequest};
use crate::services::ResourceService;
use actix_multipart::Multipart;
use actix_web::http::header;
use actix_web::{web, HttpRequest, HttpResponse};
use futures_util::StreamExt;
use serde_json::{Map, Value};

fn empty_metadata() -> Value {
    Value::Object(Map::new())
}

fn parse_range_header(range_header: &str, size: usize) -> Option<(usize, usize)> {
    let bytes = range_header.strip_prefix("bytes=")?;
    let (start_raw, end_raw) = bytes.split_once('-')?;

    if size == 0 {
        return None;
    }

    if start_raw.is_empty() {
        let suffix_len = end_raw.parse::<usize>().ok()?;
        if suffix_len == 0 {
            return None;
        }

        let start = size.saturating_sub(suffix_len);
        return Some((start, size - 1));
    }

    let start = start_raw.parse::<usize>().ok()?;
    if start >= size {
        return None;
    }

    let end = if end_raw.is_empty() {
        size - 1
    } else {
        end_raw.parse::<usize>().ok()?.min(size - 1)
    };

    if start > end {
        return None;
    }

    Some((start, end))
}

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
    let mut metadata = empty_metadata();
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
        } else if field_name == "metadata" {
            let mut value = String::new();
            while let Some(chunk_result) = field.next().await {
                match chunk_result {
                    Ok(bytes) => value.push_str(&String::from_utf8_lossy(&bytes)),
                    Err(_) => return HttpResponse::InternalServerError().finish(),
                }
            }

            if !value.trim().is_empty() {
                match serde_json::from_str::<Value>(&value) {
                    Ok(parsed) => metadata = parsed,
                    Err(_) => return HttpResponse::BadRequest().finish(),
                }
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
        metadata: Some(metadata),
    };

    match resource_service
        .upload_resource(&user_id, create_req, file_data.freeze())
        .await
    {
        Ok(resource) => HttpResponse::Ok().json(resource),
        Err(e) => HttpResponse::from_error(e),
    }
}

pub async fn download_resource_proxy(
    path: web::Path<uuid::Uuid>,
    req: HttpRequest,
    resource_service: web::Data<ResourceService>,
) -> HttpResponse {
    if let Err(e) = get_user_id(&req) {
        return HttpResponse::from_error(e);
    }

    let requested_range = req
        .headers()
        .get(header::RANGE)
        .and_then(|value| value.to_str().ok())
        .map(str::to_owned);

    match resource_service
        .download_resource_proxy(path.into_inner())
        .await
    {
        Ok((data, mime_type)) => {
            let total_size = data.len();

            if let Some(range_header) = requested_range {
                if let Some((start, end)) = parse_range_header(&range_header, total_size) {
                    let chunk = data.slice(start..=end);
                    let mut response = HttpResponse::PartialContent();
                    response.insert_header((header::CONTENT_TYPE, mime_type));
                    response.insert_header((header::CACHE_CONTROL, "private, max-age=3600"));
                    response.insert_header((header::ACCEPT_RANGES, "bytes"));
                    response.insert_header((header::CONTENT_LENGTH, chunk.len().to_string()));
                    response.insert_header((
                        header::CONTENT_RANGE,
                        format!("bytes {}-{}/{}", start, end, total_size),
                    ));
                    return response.body(chunk);
                }

                let mut response = HttpResponse::RangeNotSatisfiable();
                response.insert_header((header::CONTENT_RANGE, format!("bytes */{}", total_size)));
                return response.finish();
            }

            let mut response = HttpResponse::Ok();
            response.insert_header((header::CONTENT_TYPE, mime_type));
            response.insert_header((header::CACHE_CONTROL, "private, max-age=3600"));
            response.insert_header((header::ACCEPT_RANGES, "bytes"));
            response.insert_header((header::CONTENT_LENGTH, total_size.to_string()));
            response.body(data)
        }
        Err(e) => HttpResponse::from_error(e),
    }
}

pub async fn download_resource_thumbnail(
    path: web::Path<uuid::Uuid>,
    req: HttpRequest,
    resource_service: web::Data<ResourceService>,
) -> HttpResponse {
    if let Err(e) = get_user_id(&req) {
        return HttpResponse::from_error(e);
    }

    match resource_service
        .download_resource_thumbnail(path.into_inner())
        .await
    {
        Ok((data, mime_type)) => {
            let mut response = HttpResponse::Ok();
            response.insert_header((header::CONTENT_TYPE, mime_type));
            response.insert_header((header::CACHE_CONTROL, "private, max-age=3600"));
            response.insert_header((header::CONTENT_LENGTH, data.len().to_string()));
            response.body(data)
        }
        Err(e) => HttpResponse::from_error(e),
    }
}

pub async fn download_avatar_proxy(
    path: web::Path<uuid::Uuid>,
    req: HttpRequest,
    resource_service: web::Data<ResourceService>,
) -> HttpResponse {
    if let Err(e) = get_user_id(&req) {
        return HttpResponse::from_error(e);
    }

    match resource_service.download_avatar(path.into_inner()).await {
        Ok(data) => {
            let mut response = HttpResponse::Ok();
            response.insert_header(("Content-Type", "image/jpeg"));
            response.insert_header(("Cache-Control", "private, max-age=3600"));
            response.body(data)
        }
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

#[derive(serde::Deserialize)]
#[serde(rename_all = "camelCase")]
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
            "pageSize": page_size
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
        .service(web::resource("/resources/{id}").route(web::delete().to(delete_resource)))
        .service(
            web::resource("/resources/{id}/download").route(web::get().to(download_resource_proxy)),
        )
        .service(
            web::resource("/resources/{id}/thumbnail")
                .route(web::get().to(download_resource_thumbnail)),
        )
        .service(
            web::resource("/avatars/{id}/download").route(web::get().to(download_avatar_proxy)),
        );
}
