mod admin;
mod config;
mod database;
mod error;
mod middleware;
mod models;
mod routes;
mod services;
mod storage;

use actix_files as fs;
use actix_web::{web, App, HttpRequest, HttpResponse, HttpServer};
use admin::{activity_log::ActivityLog, api::StartedAt};
use anyhow::anyhow;
use config::Config;
use database::{create_pool, run_migrations};
use middleware::{configure_cors, configure_logging, AuthMiddleware};
use services::{
    AuthService, BotService, DiaryService, MemoService, ResourceService, StatsService, SyncService,
};
use storage::create_storage;

#[actix_web::main]
async fn main() -> anyhow::Result<()> {
    dotenv::dotenv().ok();
    env_logger::init_from_env(env_logger::Env::new().default_filter_or("info"));

    log::info!("========================================");
    log::info!("Mosaic Server starting...");
    log::info!("========================================");

    match Config::from_env() {
        Ok(config) => {
            log::info!("[OK] Configuration loaded");
            log::info!("  - Database URL: [HIDDEN]");
            log::info!("  - JWT Secret: [HIDDEN]");
            log::info!("  - Port: {}", config.port);
            log::info!("  - Storage Type: {:?}", config.storage_type);
            log::info!("  - Local Storage Path: {}", config.local_storage_path);
            log::info!("  - Admin User: {}", config.admin_username);
        }
        Err(e) => {
            log::error!("[FAILED] Configuration load failed: {}", e);
            log::error!("Please ensure the following environment variables are set:");
            log::error!("  - DATABASE_URL");
            log::error!("  - JWT_SECRET");
            return Err(e);
        }
    }

    let config = Config::from_env()?;

    log::info!("Connecting to database...");
    let pool = create_pool(&config.database_url).await?;
    log::info!("[OK] Database connected");

    log::info!("Running database migrations...");
    match run_migrations(&pool).await {
        Ok(_) => log::info!("[OK] Database migrations completed"),
        Err(e) => {
            log::error!("[FAILED] Database migrations failed: {}", e);
            return Err(e);
        }
    }

    log::info!("Initializing storage service...");
    let storage = create_storage(&config).await?;
    log::info!(
        "[OK] Storage service initialized: {:?}",
        config.storage_type
    );

    let auth_service = AuthService::new(pool.clone(), config.jwt_secret.clone());
    log::info!("[OK] Auth service initialized");

    let memo_service = MemoService::new(pool.clone());
    let resource_service = ResourceService::new(pool.clone(), storage.clone(), config.clone());
    let diary_service = DiaryService::new(pool.clone());
    let stats_service = StatsService::new(pool.clone());
    let bot_service = BotService::new(pool.clone(), storage.clone());
    let sync_service = SyncService::new(pool.clone());
    log::info!("[OK] Business services initialized");

    match auth_service
        .ensure_admin_user(&config.admin_username, &config.admin_password)
        .await
    {
        Ok(_) => log::info!("[OK] Admin user ensured"),
        Err(e) => {
            log::error!("[FAILED] Admin user initialization: {}", e);
            return Err(anyhow!(e.to_string()));
        }
    }

    let auth_middleware = AuthMiddleware::new(config.jwt_secret.clone());
    let bind_address = format!("0.0.0.0:{}", config.port);

    let activity_log = web::Data::new(ActivityLog::new(200));
    let started_at = web::Data::new(StartedAt(chrono::Utc::now().timestamp_millis()));
    log::info!("[OK] Admin dashboard initialized");
    log::info!("Binding to: {}", bind_address);

    log::info!("Starting HTTP server...");
    log::info!("========================================");

    HttpServer::new(move || {
        App::new()
            .wrap(configure_logging())
            .wrap(configure_cors())
            .app_data(web::Data::new(pool.clone()))
            .app_data(web::Data::new(config.clone()))
            .app_data(web::Data::new(auth_service.clone()))
            .app_data(web::Data::new(memo_service.clone()))
            .app_data(web::Data::new(resource_service.clone()))
            .app_data(web::Data::new(diary_service.clone()))
            .app_data(web::Data::new(stats_service.clone()))
            .app_data(web::Data::new(bot_service.clone()))
            .app_data(web::Data::new(sync_service.clone()))
            .app_data(activity_log.clone())
            .app_data(started_at.clone())
            .route("/health", web::get().to(health_check))
            .service(
                web::scope("/api/auth")
                    .service(web::resource("/login").route(web::post().to(routes::auth::login)))
                    .service(
                        web::resource("/refresh")
                            .route(web::post().to(routes::auth::refresh_token)),
                    )
                    .service(
                        web::scope("")
                            .wrap(auth_middleware.clone())
                            .service(
                                web::resource("/me").route(web::get().to(routes::auth::get_me)),
                            )
                            .service(
                                web::resource("/change-password")
                                    .route(web::post().to(routes::auth::change_password)),
                            )
                            .service(
                                web::resource("/update-user")
                                    .route(web::put().to(routes::auth::update_user)),
                            )
                            .service(
                                web::resource("/update-avatar")
                                    .route(web::post().to(routes::auth::update_avatar)),
                            ),
                    ),
            )
            .service(
                web::scope("/api")
                    .wrap(auth_middleware.clone())
                    .configure(routes::configure_memo_routes)
                    .configure(routes::configure_diary_routes)
                    .configure(routes::configure_resource_routes)
                    .configure(routes::configure_stats_routes)
                    .configure(routes::configure_bot_routes)
                    .configure(routes::configure_sync_routes),
            )
            .service(
                web::scope("/admin/api")
                    .wrap(auth_middleware.clone())
                    .route("/health", web::get().to(admin::api::health))
                    .route("/stats", web::get().to(admin::api::stats))
                    .route("/activity", web::get().to(admin::api::list_activity))
                    .route("/config", web::get().to(admin::api::config_endpoint))
                    .route("/clear-cache", web::post().to(admin::api::clear_cache)),
            )
            .service(fs::Files::new("/admin/static", "static/admin").prefer_utf8(true))
            .route(
                "/admin",
                web::get().to(|| async {
                    HttpResponse::Found()
                        .append_header(("Location", "/admin/"))
                        .finish()
                }),
            )
            .route("/admin/{tail:.*}", web::get().to(admin_spa_fallback))
    })
    .bind(&bind_address)?
    .run()
    .await?;

    log::info!("Server stopped");
    Ok(())
}

async fn health_check() -> HttpResponse {
    HttpResponse::Ok().json(serde_json::json!({
        "status": "ok",
        "version": "0.1.0"
    }))
}

async fn admin_spa_fallback(_req: HttpRequest) -> HttpResponse {
    match actix_files::NamedFile::open_async("static/admin/index.html").await {
        Ok(file) => file.into_response(&_req),
        Err(_) => HttpResponse::NotFound().json(serde_json::json!({
            "error": "Admin UI not found. Run `bun --filter admin-ui build` first."
        })),
    }
}
