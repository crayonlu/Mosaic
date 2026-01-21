pub mod auth;
pub mod memos;
pub mod resources;
pub mod stats;

pub use auth::configure_auth_routes;
pub use memos::configure_memo_routes;
pub use resources::configure_resource_routes;
pub use stats::configure_stats_routes;
