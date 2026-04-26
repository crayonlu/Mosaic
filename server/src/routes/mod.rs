pub mod auth;
pub mod bots;
pub mod diaries;
pub mod memos;
pub mod resources;
pub mod stats;
pub mod sync;

pub use bots::configure_bot_routes;
pub use diaries::configure_diary_routes;
pub use memos::configure_memo_routes;
pub use resources::configure_resource_routes;
pub use stats::configure_stats_routes;
pub use sync::configure_sync_routes;
