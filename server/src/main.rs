mod config;
mod database;
mod error;
mod middleware;
mod models;
mod routes;
mod services;
mod storage;

use actix_web::{web, App, HttpResponse, HttpServer};
use actix_files::Files;
use config::Config;
use database::{create_pool, run_migrations};
use middleware::{configure_cors, AuthMiddleware};
use services::{AuthService, DiaryService, MemoService, ResourceService, StatsService};
use storage::create_storage;

#[actix_web::main]
async fn main() -> anyhow::Result<()> {
    dotenv::dotenv().ok();
    env_logger::init();

    let config = Config::from_env()?;
    log::info!("Starting server with config: {:?}", config.storage_type);

    let pool = create_pool(&config.database_url).await?;
    run_migrations(&pool).await?;
    log::info!("Database migrations completed");

    let storage = create_storage(&config).await?;
    log::info!("Storage initialized: {:?}", config.storage_type);

    let auth_service = AuthService::new(pool.clone(), config.jwt_secret.clone());
    log::info!("Auth service initialized");

    let memo_service = MemoService::new(pool.clone());
    let resource_service = ResourceService::new(pool.clone(), storage.clone(), config.clone());
    let diary_service = DiaryService::new(pool.clone());
    let stats_service = StatsService::new(pool.clone());
    log::info!("Services initialized");

    let auth_middleware = AuthMiddleware::new(config.jwt_secret.clone());
    let bind_address = format!("0.0.0.0:{}", config.port);

    HttpServer::new(move || {
        App::new()
            .wrap(configure_cors())
            .app_data(web::Data::new(auth_service.clone()))
            .app_data(web::Data::new(memo_service.clone()))
            .app_data(web::Data::new(resource_service.clone()))
            .app_data(web::Data::new(diary_service.clone()))
            .app_data(web::Data::new(stats_service.clone()))
            .route("/health", web::get().to(health_check))
            .service(web::scope("/api/auth").configure(routes::configure_auth_routes))
            .service(
                web::scope("/api")
                    .wrap(auth_middleware.clone())
                    .configure(routes::configure_memo_routes)
                    .configure(routes::configure_diary_routes)
                    .configure(routes::configure_resource_routes)
                    .configure(routes::configure_stats_routes),
            )
            .service(Files::new("/", "/app/dist").index_file("index.html"))
    })
    .bind(&bind_address)?
    .run()
    .await?;

    Ok(())
}

async fn health_check() -> HttpResponse {
    HttpResponse::Ok().json(serde_json::json!({
        "status": "ok",
        "version": "0.1.0"
    }))
}
