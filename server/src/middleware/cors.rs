use actix_cors::Cors;
use actix_web::http;

pub fn configure_cors() -> Cors {
    Cors::permissive()
        .allow_any_origin()
        .allowed_methods(vec!["GET", "POST", "PUT", "DELETE", "OPTIONS"])
        .allowed_headers(vec![
            http::header::AUTHORIZATION,
            http::header::ACCEPT,
            http::header::CONTENT_TYPE,
        ])
        .max_age(3600)
}
