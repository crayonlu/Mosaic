pub mod ai;
pub mod auth;
pub mod bots;
pub mod diaries;
pub mod memory;
pub mod memos;
pub mod resources;
pub mod stats;
pub mod sync;
pub mod user_ai_config;
pub mod user_management;

pub use ai::configure_ai_routes;
pub use bots::configure_bot_routes;
pub use diaries::configure_diary_routes;
pub use memory::configure_memory_routes;
pub use memos::configure_memo_routes;
pub use resources::configure_resource_routes;
pub use stats::configure_stats_routes;
pub use sync::configure_sync_routes;

use actix_web::web;

pub fn configure_user_ai_config_routes(cfg: &mut web::ServiceConfig) {
    cfg.service(
        web::resource("/ai-config")
            .route(web::get().to(user_ai_config::get_ai_config))
            .route(web::put().to(user_ai_config::upsert_ai_config))
            .route(web::delete().to(user_ai_config::delete_ai_config)),
    );
}
