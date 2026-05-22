use actix_cors::Cors;
use actix_web::http;
use std::env;

pub fn configure_cors() -> Cors {
    let allowed_origins = env::var("ALLOWED_ORIGINS").unwrap_or_default();

    if allowed_origins.is_empty() {
        // Development mode: allow all origins
        log::warn!("ALLOWED_ORIGINS not set, using permissive CORS (development only)");
        Cors::permissive()
            .allowed_methods(vec!["GET", "POST", "PUT", "DELETE", "OPTIONS"])
            .allowed_headers(vec![
                http::header::AUTHORIZATION,
                http::header::ACCEPT,
                http::header::CONTENT_TYPE,
            ])
            .max_age(3600)
    } else {
        // Production mode: only allow specified origins
        let mut cors = Cors::default();
        for origin in allowed_origins.split(',') {
            let origin = origin.trim();
            if !origin.is_empty() {
                cors = cors.allowed_origin(origin);
            }
        }
        cors.allowed_methods(vec!["GET", "POST", "PUT", "DELETE", "OPTIONS"])
            .allowed_headers(vec![
                http::header::AUTHORIZATION,
                http::header::ACCEPT,
                http::header::CONTENT_TYPE,
            ])
            .supports_credentials()
            .max_age(3600)
    }
}
